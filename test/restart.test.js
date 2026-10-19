import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { attachRooms } from "../server/lib/rooms.js";
import { AuthError } from "../server/lib/auth.js";
import { restoreRoom } from "../server/lib/snapshot.js";
import { ITEM_BY_ID, SLOTS } from "../shared/shop.js";

// A made-up avatar, so this doesn't depend on what the shop happens to sell.
ITEM_BY_ID["test-fox"] = { id: "test-fox", slot: "avatar", name: "Fox", emoji: "🦊", price: 10 };

// Rooms survive a server restart: a deploy, Render's free plan sleeping, or a crash.
const CLASS = { id: "class1", name: "3/4B", students: [{ id: "s1", name: "Ava" }, { id: "s2", name: "Ben" }] };
const GAME = () => ({
  tiles: ["C", "A", "T", "S", ...Array(12).fill("X")], rots: Array(16).fill("0"),
  solution: { list: ["cat", "cats"], longest: [{ word: "cats", path: [[0, 0], [0, 1]] }], phonics: null },
});
const ROUND = { seconds: 60, size: 4, minLen: 3, phSound: null, phTicked: [], phBonus: false };
const TEACHERS = { "tok-a": { id: "teacherA", name: "A" } };

let clock = 5_000_000;
const sockets = [], servers = [];
after(() => { sockets.forEach(s => s.close()); servers.forEach(s => s.close()); });

// The database, shared by every server: kept rooms (stored as text, as Firestore does) and saved rounds.
function fakeDb() {
  const kept = new Map(), saved = [], savedIds = new Set();
  return {
    kept, saved, writes: 0,
    liveStore: {
      async save(teacherId, doc) { this.db.writes++; kept.set(teacherId, { ...doc }); },
      async byTeacher(teacherId) { const d = kept.get(teacherId); return d ? JSON.parse(d.data) : null; },
      async byCode(code) { const d = [...kept.values()].find(x => x.code === code); return d ? JSON.parse(d.data) : null; },
      async remove(teacherId, code) { if (kept.get(teacherId)?.code === code) kept.delete(teacherId); },
    },
    async saveRound(teacherId, classId, gameId, record) {
      if (savedIds.has(gameId)) return { status: "already-saved" };
      savedIds.add(gameId);
      saved.push(record);
      const earned = Object.fromEntries(Object.keys(record.players).map(sid => [sid, { trophies: [], stickers: [], best: [] }]));
      return { status: "saved", earned };
    },
  };
}

async function startServer(db) {
  const server = http.createServer();
  const io = new Server(server);
  const pending = [];
  db.liveStore.db = db;
  const api = attachRooms(io, {
    verifyTeacher: async t => { if (!TEACHERS[t]) throw new AuthError(401, "token-invalid"); return TEACHERS[t]; },
    getClass: async (tid, cid) => (cid === "class1" ? CLASS : null),
    makeGame: async () => GAME(),
    isRealWord: async () => false,
    saveRound: (...a) => db.saveRound(...a),
    equipItem: async (tid, cid, sid, slot, id) => ({ ok: true, worn: { ...Object.fromEntries(SLOTS.map(k => [k, null])), [slot]: id } }),
    liveStore: db.liveStore,
    now: () => clock,
    later: (fn, ms) => pending.push({ fn, ms }),
  });
  await new Promise(r => server.listen(0, r));
  servers.push(server);
  const url = `http://localhost:${server.address().port}`;
  const runTimers = () => { while (pending.length) pending.splice(0).forEach(t => t.fn()); };
  // A server going away: its connections drop, as they do when Render stops it.
  const stop = () => { io.close(); };
  return { api, url, pending, runTimers, stop };
}

const client = async url => {
  const s = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  sockets.push(s);
  await new Promise(r => s.on("connect", r));
  return s;
};
const call = (s, ev, data) => s.emitWithAck(ev, data);
const settle = () => new Promise(res => setTimeout(res, 30));

// A room with Ava and Ben in two teams, a round under way, and Ava's first word found.
async function midRound(db) {
  const A = await startServer(db);
  const host = await client(A.url);
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const ava = await client(A.url), ben = await client(A.url);
  const a = await call(ava, "player:join", { code: room.code, studentId: "s1" });
  const b = await call(ben, "player:join", { code: room.code, studentId: "s2" });
  await call(host, "host:teams", { count: 2 });
  const r = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r.n, state: "playing", remainingMs: 60000 });
  assert.equal((await call(ava, "player:word", { n: r.n, word: "cat" })).result, "ok");
  clock += 16000;   // stuck for a while: a hint
  assert.deepEqual(await call(ava, "player:hint", { n: r.n }), { result: "hint", word: "cats" });
  return { A, code: room.code, n: r.n, tokens: { ava: a.token, ben: b.token } };
}

test("restart mid-round: the big screen and the devices carry on where they were", async () => {
  const db = fakeDb();
  const { A, code, n, tokens } = await midRound(db);

  assert.equal(await A.api.shutdown(), 0);
  assert.equal(db.saved.length, 0, "a round still being played isn't saved early or cut short");
  assert.ok(db.kept.has("teacherA"), "the room is kept");
  A.stop();

  clock += 8000;   // the restart takes a few seconds
  const B = await startServer(db);
  const writesBefore = db.writes;
  const ava = await client(B.url);
  const back = await call(ava, "player:rejoin", { code, token: tokens.ava });
  assert.equal(back.ok, true, "Ava's device rejoins with the pass it saved");
  assert.equal(back.round.n, n);
  assert.equal(back.round.state, "playing");
  assert.equal(back.round.hint, "cats", "the hint she was given is still showing");
  assert.deepEqual(back.round.words.map(w => w.word), ["cat"], "her words are still there");
  assert.notEqual(back.team, null, "and her team");
  assert.equal(db.writes, writesBefore, "a picked-up room isn't written back before its teacher's screen returns");

  const host = await client(B.url);
  const res = await call(host, "host:resume", { idToken: "tok-a" });
  assert.equal(res.ok, true);
  assert.equal(res.room.code, code);
  assert.equal(res.round.n, n);
  assert.equal(res.room.teams, 2);
  assert.deepEqual(await call(host, "host:clock", { n, state: "playing", remainingMs: 40000 }), { ok: true }, "the clock carries on");
  assert.equal((await call(ava, "player:word", { n, word: "cats" })).result, "ok");

  await call(host, "host:phase", { phase: "reveal" });
  B.runTimers();
  await settle();
  assert.equal(db.saved.length, 1, "saved exactly once, after the restart");
  assert.deepEqual(db.saved[0].players.s1.words, ["cat", "cats"]);
  assert.equal(db.saved[0].cutShort, undefined);
  const kept = JSON.parse(db.kept.get("teacherA").data);
  assert.equal(kept.round.save, "done");
  assert.ok(kept.round.teamResult, "team scores are kept too");
  B.stop();
});

test("restart while the clock runs out: the server ends and saves the round on its own", async () => {
  const db = fakeDb();
  const { A, code, tokens } = await midRound(db);
  await A.api.shutdown();
  A.stop();

  clock += 120000;   // the server was down past the end of the round
  const B = await startServer(db);
  const ben = await client(B.url);
  assert.equal((await call(ben, "player:rejoin", { code, token: tokens.ben })).ok, true);
  B.runTimers();
  await settle();
  assert.equal(db.saved.length, 1);
  assert.deepEqual(db.saved[0].players.s1.words, ["cat"]);
  B.stop();
});

test("a crash after the answers were shown: the round's save is finished by the next server", async () => {
  const db = fakeDb();
  const { A, code, tokens } = await midRound(db);
  const host = await client(A.url);
  await call(host, "host:resume", { idToken: "tok-a" });
  await call(host, "host:phase", { phase: "reveal" });   // kept straight away, with the save still waiting for its grace window
  await settle();
  A.stop();          // no shutdown: a crash
  assert.equal(db.saved.length, 0);

  const B = await startServer(db);
  const ava = await client(B.url);
  assert.equal((await call(ava, "player:rejoin", { code, token: tokens.ava })).ok, true);
  await settle();
  B.runTimers();
  await settle();
  assert.equal(db.saved.length, 1, "saved once by the new server");
  B.stop();
});

test("a closed room stays closed; a bad code never reaches the database", async () => {
  const db = fakeDb();
  const { A, code, tokens } = await midRound(db);
  const host = await client(A.url);
  await call(host, "host:resume", { idToken: "tok-a" });
  await call(host, "host:close");
  await settle();
  assert.equal(db.kept.size, 0, "closing forgets the room");
  A.stop();

  const B = await startServer(db);
  let reads = 0;
  const byCode = db.liveStore.byCode;
  db.liveStore.byCode = async c => { reads++; return byCode.call(db.liveStore, c); };
  const kid = await client(B.url);
  assert.deepEqual(await call(kid, "player:rejoin", { code, token: tokens.ava }), { error: "no-room" });
  assert.deepEqual(await call(await client(B.url), "host:resume", { idToken: "tok-a" }), { error: "no-room" });
  assert.deepEqual(await call(kid, "player:lookup", { code: "AEIO" }), { error: "no-room" });
  assert.equal(reads, 1, "only the well-formed code was looked up");
  B.stop();
});

test("an old copy is never kept over a newer one", async () => {
  const db = fakeDb();
  const { A, code, n, tokens } = await midRound(db);
  // A device reaches the new server while the old one is still running and before its last write.
  const B = await startServer(db);
  const early = await client(B.url);
  assert.equal((await call(early, "player:rejoin", { code, token: tokens.ben })).ok, true);
  // The old server finds another word, then stops and keeps the room.
  const ava = await client(A.url);
  await call(ava, "player:rejoin", { code, token: tokens.ava });
  assert.equal((await call(ava, "player:word", { n, word: "cats" })).result, "ok");
  await A.api.shutdown();
  A.stop();

  // The teacher's screen reconnects to the new server, which takes the newer copy.
  clock += 1000;
  const host = await client(B.url);
  assert.equal((await call(host, "host:resume", { idToken: "tok-a" })).ok, true);
  const ava2 = await client(B.url);
  const back = await call(ava2, "player:rejoin", { code, token: tokens.ava });
  assert.deepEqual(back.round.words.map(w => w.word), ["cat", "cats"]);
  B.stop();
});

test("own looks and avatars come through a restart", async () => {
  const db = fakeDb();
  const A = await startServer(db);
  const host = await client(A.url);
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1", ownLooks: false });
  const ava = await client(A.url);
  await call(ava, "player:join", { code: room.code, studentId: "s1" });
  assert.equal((await call(ava, "player:equip", { slot: "avatar", id: "test-fox" })).ok, true);
  await A.api.shutdown();
  A.stop();

  const B = await startServer(db);
  const res = await call(await client(B.url), "host:resume", { idToken: "tok-a" });
  assert.equal(res.room.ownLooks, false, "the teacher's choice is kept");
  assert.equal(res.room.players[0].avatar, "🦊", "the lobby still shows her avatar");
  B.stop();

  // A room kept before the shop had a theme: it's left behind, and own looks are on.
  const old = restoreRoom({ ...JSON.parse(db.kept.get("teacherA").data), ownLooks: undefined, theme: "rednut" });
  assert.equal(old.ownLooks, true);
  assert.equal("theme" in old, false);
});
