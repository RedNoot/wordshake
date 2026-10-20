import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { attachRooms } from "../server/lib/rooms.js";
import { AuthError } from "../server/lib/auth.js";
import { applyRound } from "../shared/rewards.js";
import { ITEM_BY_ID, SLOTS, starsForRound } from "../shared/shop.js";
import { buyIn, equipIn } from "../server/lib/wallet.js";

const CLASS = { id: "class1", name: "3/4B", students: [{ id: "s1", name: "Ava" }, { id: "s2", name: "Ben" }, { id: "s3", name: "Chloe" }] };
// C A T S on the top row, X everywhere else: "cat" and "cats" are the only answers.
const GAME = size => ({
  tiles: ["C", "A", "T", "S", ...Array(size * size - 4).fill("X")], rots: Array(size * size).fill("0"),
  solution: { list: ["cat", "cats"], total: 2, longest: [{ word: "cats" }], phonics: { tagMap: { cat: [[1, 2]] }, bySpelling: { a: [{ word: "cat" }, { word: "cats" }] } } },
});
const ROUND = { seconds: 60, size: 4, minLen: 3, phSound: null, phTicked: [], phBonus: false };
const TEACHERS = { "tok-a": { id: "teacherA", name: "A" }, "tok-b": { id: "teacherB", name: "B" } };

let server, url, roomsApi, clock = 1_000_000;
let saved = [], pending = [];   // rounds saved for progress tracking, and timers ({ fn, ms }) the rooms have set
const summaries = new Map();     // class1 students' saved reward summaries
const savedIds = new Set();
// class1 students' shop wallets (spent, owned, equipped): in the same document as the summary, as in the database.
const wallets = new Map(), versions = new Map();
const studentData = sid => ({ ...(summaries.get(sid) || {}), ...(wallets.get(sid) || {}) });
const bump = sid => versions.set(sid, (versions.get(sid) || 0) + 1);
// A transaction as Firestore runs one: if a document it read has changed by the time it commits, it runs again.
async function runTx(fn) {
  for (;;) {
    const seen = new Map(), writes = [];
    const tx = {
      get: async sid => { await new Promise(r => setImmediate(r)); seen.set(sid, versions.get(sid) || 0); return { exists: true, data: () => studentData(sid) }; },
      set: (sid, data) => writes.push([sid, data]),
    };
    const out = await fn(tx);
    await new Promise(r => setImmediate(r));   // the commit is a round trip too, so two transactions really overlap
    if ([...seen].some(([sid, v]) => (versions.get(sid) || 0) !== v)) continue;
    for (const [sid, data] of writes) { wallets.set(sid, { ...wallets.get(sid), ...data }); bump(sid); }
    return out;
  }
}
const buyItem = (tid, cid, sid, id, t) => runTx(tx => buyIn(tx, sid, id, t));
// Made-up items, so these tests don't depend on what the shop happens to sell.
Object.assign(ITEM_BY_ID, {
  "test-fox": { id: "test-fox", slot: "avatar", name: "Fox", emoji: "🦊", price: 10 },
  "test-owl": { id: "test-owl", slot: "avatar", name: "Owl", emoji: "🦉", price: 10 },
  "test-dots": { id: "test-dots", slot: "dice", name: "Dots", emoji: "🎲", price: 50 },
  "test-crown": { id: "test-crown", slot: "avatar", name: "Crown", emoji: "👑", price: 0, unlock: "weeks-10" },
});
const noLooks = Object.fromEntries(SLOTS.map(k => [k, null]));
let failSaves = 0;               // the next N saves throw, as a database outage would
// Runs the timers that are due (grace windows, the server's round clock, save retries) up to `ms` from now.
const runTimers = (ms = Infinity) => {
  const due = pending.filter(t => t.ms <= ms);
  pending = pending.filter(t => t.ms > ms);
  due.forEach(t => t.fn());
};
const settle = () => new Promise(res => setTimeout(res, 20));
const sockets = [];

before(async () => {
  server = http.createServer();
  const io = new Server(server);
  roomsApi = attachRooms(io, {
    verifyTeacher: async t => { if (!TEACHERS[t]) throw new AuthError(401, "token-invalid"); return TEACHERS[t]; },
    getClass: async (tid, cid) => (tid === "teacherA" && cid === "class1" ? CLASS : null),
    makeGame: async ({ size }) => GAME(size),
    isRealWord: async w => ["tac", "cat", "cats"].includes(w),
    // Behaves like the real transaction: rewards worked out from what's stored, and a round id is only ever counted once.
    saveRound: async (teacherId, classId, gameId, record, endedAt) => {
      if (failSaves > 0) { failSaves--; throw new Error("database unavailable"); }
      if (savedIds.has(gameId)) return { status: "already-saved" };
      savedIds.add(gameId);
      const earned = {}, updates = {};
      for (const [sid, p] of Object.entries(record.players)) {
        const { summary, earned: e } = applyRound(summaries.get(sid), p, record, endedAt);
        summaries.set(sid, summary);
        bump(sid);
        updates[sid] = { ...summary, name: p.name, spent: (wallets.get(sid) || {}).spent || 0 };
        earned[sid] = e;
      }
      saved.push({ teacherId, classId, gameId, record, updates, endedAt });
      return { status: "saved", earned, summaries: updates };
    },
    getStudent: async (tid, cid, sid) => ({ ...studentData(sid), awards: [{ id: "x", emoji: "💪", label: "Great effort" }] }),
    buyItem,
    equipItem: (tid, cid, sid, slot, id) => runTx(tx => equipIn(tx, sid, slot, id)),
    now: () => clock,
    later: (fn, ms) => pending.push({ fn, ms }),
  });
  await new Promise(r => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});
after(() => { sockets.forEach(s => s.close()); server.close(); });

const client = async () => {
  const s = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  sockets.push(s);
  await new Promise(r => s.on("connect", r));
  return s;
};
const call = (s, ev, data) => s.emitWithAck(ev, data);
const next = (s, ev) => new Promise(r => s.once(ev, r));

test("teacher must be signed in to open a room", async () => {
  const host = await client();
  assert.deepEqual(await call(host, "host:open", { idToken: "nope" }), { error: "token-invalid" });
  assert.deepEqual(await call(host, "host:open", { idToken: "tok-b", classId: "class1" }), { error: "class-not-found" });
  assert.deepEqual(await call(host, "host:open", { idToken: "tok-a", classId: "../x" }), { error: "class-not-found" });
});

test("full class-list flow: lookup, tap name, one device per name, reclaim, rejoin, kick", async () => {
  const host = await client();
  const opened = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  assert.ok(opened.ok);
  const { code } = opened.room;
  assert.match(code, /^[BCDFGHJKLMNPQRSTVWXZ2-9]{4}$/);
  assert.equal(opened.room.roster.length, 3);

  const kid1 = await client();
  const look = await call(kid1, "player:lookup", { code: code.toLowerCase() });
  assert.equal(look.room.className, "3/4B");
  assert.deepEqual(look.room.roster.map(s => s.taken), [false, false, false]);
  assert.equal(JSON.stringify(look).includes("token"), false, "lookup leaks no tokens");

  const watcher = await client();
  await call(watcher, "player:lookup", { code });
  const rosterUpdate = next(watcher, "room:roster");
  const hostUpdate = next(host, "room:update");
  const j1 = await call(kid1, "player:join", { code, studentId: "s1" });
  assert.equal(j1.ok, true);
  assert.equal(j1.name, "Ava");
  assert.equal((await rosterUpdate).roster.find(s => s.id === "s1").taken, true, "name greys out for others");
  assert.deepEqual((await hostUpdate).players.map(p => [p.name, p.connected]), [["Ava", true]]);

  // Second device can't take Ava while the first is connected.
  const kid2 = await client();
  assert.deepEqual(await call(kid2, "player:join", { code, studentId: "s1" }), { error: "already-in" });

  // First device drops out; a new device can reclaim the name, and the old token stops working.
  const dropped = next(host, "room:update");
  kid1.close();
  assert.equal((await dropped).players[0].connected, false);
  const j2 = await call(kid2, "player:join", { code, studentId: "s1" });
  assert.equal(j2.ok, true);
  assert.notEqual(j2.token, j1.token);
  const kid1b = await client();
  assert.deepEqual(await call(kid1b, "player:rejoin", { code, token: j1.token }), { error: "no-player" });

  // Same device (saved token) comes back after sleeping.
  kid2.close();
  const kid2b = await client();
  const back = await call(kid2b, "player:rejoin", { code, token: j2.token });
  assert.equal(back.name, "Ava");

  // Phase changes reach joined devices.
  const phase = next(kid2b, "room:phase");
  assert.equal((await call(host, "host:phase", { phase: "playing" })).ok, true);
  assert.equal(await phase, "playing");
  assert.deepEqual(await call(host, "host:phase", { phase: "hacked" }), { error: "invalid phase" });

  // Students can't drive the room.
  assert.deepEqual(await call(kid2b, "host:phase", { phase: "lobby" }), { error: "no-room" });

  // Kick: device is told, name is free again.
  const hostView = (await call(host, "host:resume", { idToken: "tok-a" })).room;
  const kicked = next(kid2b, "room:kicked");
  assert.equal((await call(host, "host:kick", { playerId: hostView.players[0].id })).ok, true);
  await kicked;
  const kid3 = await client();
  assert.equal((await call(kid3, "player:join", { code, studentId: "s1" })).ok, true);
  assert.deepEqual(await call(kid3, "player:join", { code, studentId: "nobody" }), { error: "no-student" });
});

test("guests: filtered names, duplicate suffix, and 'that's not me'", async () => {
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const g = await client();
  for (const bad of ["", "x", "f u c k", "Sh1t", "poo", "ThirteenChars", "<b>Ava</b>", 42, null]) {
    assert.deepEqual(await call(g, "player:join", { code: room.code, guestName: bad }), { error: "bad-name" }, String(bad));
  }
  assert.equal((await call(g, "player:join", { code: room.code, guestName: "  ava " })).name, "ava 2", "clashes with roster Ava");
  const g2 = await client();
  assert.equal((await call(g2, "player:join", { code: room.code, guestName: "Zoe" })).name, "Zoe");
  const g3 = await client();
  assert.equal((await call(g3, "player:join", { code: room.code, guestName: "zoe" })).name, "zoe 2");

  const left = next(host, "room:update");
  assert.equal((await call(g3, "player:leave")).ok, true);
  assert.deepEqual((await left).players.map(p => p.name), ["ava 2", "Zoe"]);
});

test("guests-only room, refresh recovery, one room per teacher, close", async () => {
  const host = await client();
  const first = (await call(host, "host:open", { idToken: "tok-b" })).room;
  assert.equal(first.roster, null);
  const kid = await client();
  assert.equal((await call(kid, "player:lookup", { code: first.code })).room.roster, null);
  await call(kid, "player:join", { code: first.code, guestName: "Max" });

  // Teacher refreshes: a new socket gets the same room back with its players.
  host.close();
  const host2 = await client();
  const resumed = await call(host2, "host:resume", { idToken: "tok-b" });
  assert.equal(resumed.room.code, first.code);
  assert.deepEqual(resumed.room.players.map(p => p.name), ["Max"]);

  // A second tab takes over; the first is told.
  const host3 = await client();
  const replaced = next(host2, "host:replaced");
  await call(host3, "host:resume", { idToken: "tok-b" });
  await replaced;
  assert.deepEqual(await call(host2, "host:phase", { phase: "lobby" }), { error: "no-room" });

  // Opening a new room closes the old one.
  const closed = next(kid, "room:closed");
  const second = (await call(host3, "host:open", { idToken: "tok-b" })).room;
  assert.equal(await closed, "replaced");
  assert.notEqual(second.code, first.code);
  assert.deepEqual(await call(kid, "player:lookup", { code: first.code }), { error: "no-room" });

  assert.deepEqual(await host3.emitWithAck("host:close"), { ok: true }, "works with no data at all");
  assert.deepEqual(await call(host3, "host:resume", { idToken: "tok-b" }), { error: "no-room" });
});

test("rooms expire when the teacher has been gone for 2 hours", async () => {
  const host = await client();
  const { code } = (await call(host, "host:open", { idToken: "tok-a" })).room;
  host.close();
  await new Promise(r => setTimeout(r, 50));
  const kid = await client();
  assert.equal((await call(kid, "player:lookup", { code })).ok, true);
  const closed = next(kid, "room:closed");
  clock += 60 * 60 * 1000;
  roomsApi.sweep();
  assert.equal(roomsApi.rooms.has(code), true, "still open after 1 hour");
  clock += 60 * 60 * 1000 + 1;
  roomsApi.sweep();
  assert.equal(await closed, "expired");
  assert.equal(roomsApi.rooms.has(code), false);
});


test("device play: letters only, word checks, scoring, clock and late joiners", async () => {
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const kid = await client();
  const joined = await call(kid, "player:join", { code: room.code, studentId: "s1" });
  assert.equal(joined.round, null, "no round in the lobby");

  assert.deepEqual(await call(host, "host:start", { settings: { ...ROUND, seconds: 7 } }), { error: "invalid settings" });
  const gotRound = next(kid, "round:state");
  const started = await call(host, "host:start", { settings: ROUND });
  assert.equal(started.ok, true);
  assert.deepEqual(started.game.solution.list, ["cat", "cats"], "the big screen gets the answers");
  const view = await gotRound;
  assert.equal(view.tiles.length, 16);
  assert.equal(view.state, "countdown");
  assert.equal(view.eligible, true);
  assert.equal(JSON.stringify(view).includes("cats"), false, "devices never get the answers");

  const word = w => call(kid, "player:word", { n: started.n, word: w });
  assert.equal((await word("cat")).result, "early", "nothing counts before GO");

  const clockMsg = next(kid, "round:clock");
  await call(host, "host:clock", { n: started.n, state: "playing", remainingMs: 60000 });
  assert.equal((await clockMsg).remainingMs, 60000);

  assert.deepEqual(await word("CAT"), { result: "ok", word: "cat", pts: 1, bonus: 0, total: 1 });
  assert.equal((await word("cat")).result, "dupe");
  assert.equal((await word("ca")).result, "short");
  assert.equal((await word("dog")).result, "board");
  assert.equal((await word("tac")).result, "notword", "full dictionary round: a word that isn't on the list isn't a word");
  assert.equal((await word("<b>")).result, "notword");
  assert.equal((await word("cats")).total, 3, "cats: 1 + 1 extra letter");
  assert.equal((await call(kid, "player:word", { n: started.n - 1, word: "cat" })).result, "late", "old round");

  // A late joiner waits for the next round.
  const late = await client();
  const lateJoin = await call(late, "player:join", { code: room.code, guestName: "Max" });
  assert.equal(lateJoin.round.eligible, false);
  assert.equal((await call(late, "player:word", { n: started.n, word: "cat" })).result, "wait");

  // Reconnecting mid-round brings the found words back.
  kid.close();
  const kid2 = await client();
  const back = await call(kid2, "player:rejoin", { code: room.code, token: joined.token });
  assert.deepEqual(back.round.words.map(w => w.word), ["cat", "cats"]);
  assert.equal(back.round.total, 3);

  // Paused: nothing counts. Time runs out: nothing counts after a short grace.
  await call(host, "host:clock", { n: started.n, state: "paused" });
  assert.equal((await call(kid2, "player:word", { n: started.n, word: "tac" })).result, "paused");
  await call(host, "host:clock", { n: started.n, state: "playing", remainingMs: 1000 });
  clock += 2000;
  assert.equal((await call(kid2, "player:word", { n: started.n, word: "cat" })).result, "dupe", "inside the grace period");
  clock += 1000;
  assert.equal((await call(kid2, "player:word", { n: started.n, word: "cats" })).result, "late");

  // The big screen ends the round as its timer hits zero: a word already on its way still counts during the grace.
  await call(host, "host:clock", { n: started.n, state: "playing", remainingMs: 5000 });
  clock += 5000;
  await call(host, "host:clock", { n: started.n, state: "over" });
  clock += 1000;
  assert.equal((await call(kid2, "player:word", { n: started.n, word: "tac" })).result, "notword", "checked, inside the grace");
  clock += 1000;
  assert.equal((await call(kid2, "player:word", { n: started.n, word: "tac" })).result, "late");
  // Ended while paused: no grace.
  await call(host, "host:clock", { n: started.n, state: "playing", remainingMs: 5000 });
  await call(host, "host:clock", { n: started.n, state: "paused" });
  await call(host, "host:clock", { n: started.n, state: "over" });
  assert.equal((await call(kid2, "player:word", { n: started.n, word: "tac" })).result, "late");

  // Teacher refreshes mid-round: the round comes back with the answers.
  const host2 = await client();
  const resumed = await call(host2, "host:resume", { idToken: "tok-a" });
  assert.equal(resumed.round.n, started.n);
  assert.deepEqual(resumed.round.game.solution.list, ["cat", "cats"]);

  // Back to the lobby ends the round on every device.
  const toLobby = next(kid2, "round:state");
  await call(host2, "host:phase", { phase: "lobby" });
  assert.equal(await toLobby, null);

  // Next round: the late joiner plays this time, everyone starts from zero.
  const r2 = next(late, "round:state");
  const second = await call(host2, "host:start", { settings: { ...ROUND, phSound: "a", phTicked: ["a"], phBonus: true } });
  assert.equal((await r2).eligible, true);
  await call(host2, "host:clock", { n: second.n, state: "playing", remainingMs: 60000 });
  assert.deepEqual(await call(late, "player:word", { n: second.n, word: "cat" }), { result: "ok", word: "cat", pts: 1, bonus: 2, total: 3 }, "+2 for today's sound");
  assert.equal((await call(late, "player:word", { n: second.n, word: "tac" })).result, "notlist", "Sounds-Write round: real word, not on today's list");
});

test("teams: shared out evenly, late joiners balance, scores added up, devices see the winner with the big screen", async () => {
  pending = [];
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-b" });
  const kids = [];
  for (const name of ["Ann", "Bob", "Cat", "Dan", "Eve"]) {
    const s = await client();
    const j = await call(s, "player:join", { code: room.code, guestName: name });
    assert.equal(j.team, null, "no teams yet");
    kids.push({ s, id: null, name, token: j.token });
  }
  assert.deepEqual(await call(host, "host:teams", { count: 7 }), { error: "invalid teams" });
  assert.deepEqual(await call(host, "host:teams", { count: 1 }), { error: "invalid teams" });

  const told = next(kids[0].s, "player:team");
  const update = next(host, "room:update");
  assert.equal((await call(host, "host:teams", { count: 2 })).ok, true);
  const view = await update;
  assert.equal(view.teams, 2);
  const sizes = [0, 0];
  for (const p of view.players) sizes[p.team]++;
  assert.deepEqual(sizes.sort(), [2, 3], "even split");
  for (const k of kids) k.id = view.players.find(p => p.name === k.name).id;
  assert.equal(await told, view.players.find(p => p.id === kids[0].id).team, "each device is told its team");

  // A late joiner goes into the smaller team.
  const small = view.players.filter(p => p.team === 0).length === 2 ? 0 : 1;
  const fin = await client();
  const fj = await call(fin, "player:join", { code: room.code, guestName: "Fin" });
  assert.equal(fj.team, small);

  // Moving: only to a real team.
  assert.deepEqual(await call(host, "host:team-move", { playerId: kids[0].id, team: 5 }), { error: "invalid team" });
  const moved = next(kids[0].s, "player:team");
  await call(host, "host:team-move", { playerId: kids[0].id, team: 0 });
  assert.equal(await moved, 0);
  await call(host, "host:team-move", { playerId: kids[1].id, team: 1 });

  const r = await call(host, "host:start", { settings: ROUND });
  assert.equal(r.teams, 2);
  await call(host, "host:clock", { n: r.n, state: "playing", remainingMs: 60000 });
  await call(kids[0].s, "player:word", { n: r.n, word: "cat" });    // team 0: 1
  await call(kids[1].s, "player:word", { n: r.n, word: "cat" });    // team 1: 1 + 1
  await call(kids[1].s, "player:word", { n: r.n, word: "cats" });
  // Moving someone mid-round counts from the next round.
  await call(host, "host:team-move", { playerId: kids[1].id, team: 0 });

  await call(host, "host:phase", { phase: "reveal" });
  let early = false, hostEarly = false;
  kids[2].s.once("round:teams", () => { early = true; });
  host.once("round:teams", () => { hostEarly = true; });
  await new Promise(res => setTimeout(res, 50));
  assert.equal(hostEarly, false, "team scores wait out the grace window");
  const hostResult = next(host, "round:teams");
  for (const t of pending.splice(0)) t.fn();
  const result = await hostResult;
  assert.equal(result.n, r.n);
  assert.deepEqual(result.teams.map(t => t.score), [1, 3]);
  assert.deepEqual(result.winners, [1]);
  assert.equal(result.teams.reduce((a, t) => a + t.players, 0), 6);
  await new Promise(res => setTimeout(res, 30));
  assert.equal(early, false, "devices wait for the big screen");

  const shown = next(kids[2].s, "round:teams");
  assert.deepEqual(await call(host, "host:teams-reveal", { n: r.n + 1 }), { error: "no-round" });
  await call(host, "host:teams-reveal", { n: r.n });
  assert.deepEqual((await shown).winners, [1]);
  const again = await call(kids[2].s, "player:rejoin", { code: room.code, token: kids[2].token });
  assert.deepEqual(again.round.teamResult.winners, [1], "a device that reconnects gets the result back");
  assert.equal(again.round.team, view.players.find(p => p.id === kids[2].id).team);
  const resumed = await call(host, "host:resume", { idToken: "tok-b" });
  assert.deepEqual(resumed.round.teamResult.winners, [1], "a refreshed big screen gets the result back");

  // Teams off.
  await call(host, "host:teams", { count: 0 });
  const r2 = next(kids[0].s, "round:state");
  const second = await call(host, "host:start", { settings: ROUND });
  assert.equal(second.teams, 0);
  assert.equal((await r2).team, null);
  await call(host, "host:close");
});

test("class together: one shared list, live on the big screen, compared with the class's own best", async () => {
  pending = [];
  const host = await client();
  // A guests-only room (so the class's saved progress, used by the tests below, isn't touched).
  const { room } = await call(host, "host:open", { idToken: "tok-b" });
  const ava = await client(), ben = await client();
  const ja = await call(ava, "player:join", { code: room.code, guestName: "Ava" });
  await call(ben, "player:join", { code: room.code, guestName: "Ben" });

  // It replaces teams, and teams replace it.
  await call(host, "host:teams", { count: 2 });
  assert.deepEqual(await call(host, "host:coop", { on: "yes" }), { error: "invalid" });
  let update = next(host, "room:update");
  assert.equal((await call(host, "host:coop", { on: true })).ok, true);
  let view = await update;
  assert.deepEqual([view.coop, view.teams], [true, 0]);
  update = next(host, "room:update");
  await call(host, "host:teams", { count: 2 });
  view = await update;
  assert.deepEqual([view.coop, view.teams], [false, 2]);
  await call(host, "host:coop", { on: true });

  const avaRound = next(ava, "round:state");
  const r = await call(host, "host:start", { settings: ROUND });
  assert.equal(r.coop, true);
  assert.equal(r.teams, 0);
  assert.deepEqual((await avaRound).coop, { words: 0, of: 2 });
  await call(host, "host:clock", { n: r.n, state: "playing", remainingMs: 60000 });

  // A word counts once for the class, however many find it; everyone's own score is as usual.
  assert.deepEqual(await call(ava, "player:word", { n: r.n, word: "cat" }), { result: "ok", word: "cat", pts: 1, bonus: 0, total: 1, classNew: true });
  assert.deepEqual(await call(ben, "player:word", { n: r.n, word: "cat" }), { result: "ok", word: "cat", pts: 1, bonus: 0, total: 1, classNew: false });
  assert.equal((await call(ben, "player:word", { n: r.n, word: "cats" })).classNew, true);

  // The wall goes up at most every half second: one update for all three finds, no names; cat found by two grows.
  assert.equal(pending.filter(t => t.ms === 500).length, 1, "one wall update waiting, not one per word");
  const wall = next(host, "round:wall"), count = next(ava, "round:coop");
  runTimers(500);
  assert.deepEqual(await wall, { n: r.n, words: ["cat", "cats"], counts: [2, 1], of: 2 });
  assert.deepEqual(await count, { n: r.n, words: 2, of: 2 });

  // A device or the big screen coming back gets the class's progress again.
  const ava2 = await client();
  assert.deepEqual((await call(ava2, "player:rejoin", { code: room.code, token: ja.token })).round.coop, { words: 2, of: 2 });
  assert.deepEqual((await call(host, "host:resume", { idToken: "tok-b" })).round.wall.words, ["cat", "cats"]);

  // The class's total once late words have had their grace window: a first best.
  await call(host, "host:phase", { phase: "reveal" });
  const result = next(host, "round:coop-result"), avaResult = next(ava2, "round:coop-result");
  // The big screen's celebration gets every different word the class found (guests-only rooms too), once.
  const found = next(host, "round:class-found");
  await call(host, "host:phase", { phase: "reveal" });
  let sentFound = 0;
  host.on("round:class-found", () => sentFound++);
  runTimers();
  const res = await result;
  assert.deepEqual(res, { n: r.n, words: 2, of: 2, points: 3, key: "4-3-all", best: null, newBest: true });
  assert.deepEqual(await avaResult, res);
  assert.deepEqual(await found, { n: r.n, words: ["cat", "cats"] });
  assert.equal(sentFound, 1, "a repeated 'answers' message doesn't send it twice");
  assert.deepEqual((await call(host, "host:resume", { idToken: "tok-b" })).round.classFound, ["cat", "cats"]);

  // Next time the class is compared with that best (and only that).
  const r2 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r2.n, state: "playing", remainingMs: 60000 });
  await call(ava2, "player:word", { n: r2.n, word: "cat" });
  await call(host, "host:phase", { phase: "reveal" });
  const res2 = next(host, "round:coop-result");
  runTimers();
  assert.deepEqual(await res2, { n: r2.n, words: 1, of: 2, points: 1, key: "4-3-all", best: 2, newBest: false });

  // Off again: an ordinary round.
  await call(host, "host:coop", { on: false });
  const r3 = await call(host, "host:start", { settings: ROUND });
  assert.equal(r3.coop, false);
  await call(host, "host:clock", { n: r3.n, state: "playing", remainingMs: 60000 });
  assert.equal("classNew" in await call(ava2, "player:word", { n: r3.n, word: "cat" }), false);
  await call(host, "host:close");
  runTimers();
});

// Runs last: it locks this machine's address out of joining.
test("progress: finished class-list rounds are saved once, after the grace window", async () => {
  saved = []; pending = [];
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const ava = await client(), ben = await client(), guest = await client();
  const avaJoin = await call(ava, "player:join", { code: room.code, studentId: "s1" });
  await call(ben, "player:join", { code: room.code, studentId: "s2" });
  await call(guest, "player:join", { code: room.code, guestName: "Max" });

  const r = await call(host, "host:start", { settings: { ...ROUND, phSound: "a", phTicked: ["a"], phBonus: true } });
  await call(host, "host:clock", { n: r.n, state: "playing", remainingMs: 60000 });
  const chloe = await client();
  await call(chloe, "player:join", { code: room.code, studentId: "s3" });   // late: waits for the next round
  assert.equal((await call(ava, "player:word", { n: r.n, word: "cat" })).result, "ok");
  assert.equal((await call(guest, "player:word", { n: r.n, word: "cat" })).result, "ok");

  pending = [];   // the server's own round clock (tested below)
  await call(host, "host:phase", { phase: "reveal" });
  assert.deepEqual(pending.map(t => t.ms), [1600, 1600], "save (and the class's found words) scheduled after the grace window");
  assert.equal(saved.length, 0, "not before the grace window ends");
  clock += 1000;
  assert.equal((await call(ava, "player:word", { n: r.n, word: "cats" })).result, "ok", "word inside the grace");
  const avaRewards = next(ava, "round:rewards"), hostRewards = next(host, "round:rewards-summary");
  let guestGotRewards = false;
  guest.once("round:rewards", () => { guestGotRewards = true; });
  const savedMsg = next(host, "round:saved");
  runTimers();
  const mine = await avaRewards, totals = await hostRewards;
  assert.deepEqual(await savedMsg, { n: r.n, ok: true }, "the big screen hears the round was saved");
  await new Promise(res => setImmediate(res));
  assert.equal(saved.length, 1);
  assert.equal(mine.n, r.n);
  assert.deepEqual(mine.trophies.sort(), ["first-round", "first-word", "sound-spotter"].sort());
  assert.deepEqual(mine.stickers, [{ sound: "a", g: "a", tier: 1 }, { sound: "k", g: "c", tier: 1 }, { sound: "t", g: "t", tier: 1 }, { sound: "s", g: "s", tier: 1 }],
    "today's sound, and every other Sounds-Write spelling in cat and cats");
  assert.deepEqual(mine.best, [], "no personal best in a first round");
  assert.equal(mine.summary.rounds, 1, "the device gets its own updated collection for the end-of-round splash");
  assert.ok(mine.summary.trophies["first-word"]);
  assert.deepEqual(totals, { n: r.n, trophies: 4, stickers: 4, bests: 0 }, "big screen: totals only (Ava 3, Ben 1)");
  assert.equal(guestGotRewards, false, "guests get no rewards");
  assert.equal(saved[0].updates.s1.rounds, 1);
  assert.equal(saved[0].updates.s1.name, "Ava");
  assert.deepEqual(Object.keys(saved[0].updates).sort(), ["s1", "s2"]);

  // A refresh during the answers brings the rewards back.
  const ava2 = await client();
  const back = await call(ava2, "player:rejoin", { code: room.code, token: avaJoin.token });
  assert.deepEqual(back.round.rewards.trophies.sort(), mine.trophies);
  assert.deepEqual(back.round.rewards.stickers, mine.stickers);
  assert.equal(back.round.rewards.summary.rounds, 1, "and again after a refresh");
  // Trophy cabinet: the student's own summary plus teacher awards; guests have none.
  const cab = await call(ava2, "player:trophies");
  assert.equal(cab.summary.rounds, 1);
  assert.ok(cab.summary.trophies["first-word"]);
  assert.equal(cab.summary.awards[0].label, "Great effort");
  assert.deepEqual(await call(guest, "player:trophies"), { error: "guest" });
  // An award given from the Progress page reaches that student's device only, so an open cabinet refreshes.
  let guestPings = 0, avaPings = 0;
  guest.on("player:rewards-changed", () => { guestPings++; });
  ava2.on("player:rewards-changed", () => { avaPings++; });
  roomsApi.rewardsChanged("teacherB", "class1", "s1");   // another teacher's class: nobody here
  roomsApi.rewardsChanged("teacherA", "class1", "s1");
  await new Promise(res => setTimeout(res, 100));
  assert.equal(avaPings, 1);
  assert.equal(guestPings, 0);
  const { teacherId, classId, record } = saved[0];
  assert.deepEqual([teacherId, classId], ["teacherA", "class1"]);
  assert.deepEqual(Object.keys(record.players).sort(), ["s1", "s2"], "no guests, no late joiners");
  assert.deepEqual(record.players.s1, { name: "Ava", words: ["cat", "cats"], score: 5, bonusCount: 1, bySpelling: { a: ["cat", "cats"] },
    spotted: { k: { c: 2 }, t: { t: 2 }, s: { s: 1 } }, hints: 0 }, "/a/ is today's sound, so it isn't counted again");
  assert.deepEqual(record.players.s2, { name: "Ben", words: [], score: 0, bonusCount: 0, bySpelling: {}, spotted: {}, hints: 0 }, "a zero still counts");
  assert.deepEqual(record.available, { a: 2 });
  assert.equal(record.settings.phSound, "a");
  assert.equal(record.boardWords, 2);

  // The teacher refreshes during the answers: no second save.
  await call(host, "host:phase", { phase: "reveal" });
  assert.equal(pending.length, 0);

  // An abandoned round (back to the lobby mid-round) is never saved, even when its clock would have run out.
  const r2 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r2.n, state: "playing", remainingMs: 60000 });
  await call(host, "host:phase", { phase: "lobby" });
  await call(host, "host:phase", { phase: "reveal" });
  clock += 61000;
  runTimers();
  await settle();
  assert.equal(saved.length, 1);

  // Closing the room straight after a round still saves it.
  const r3 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r3.n, state: "playing", remainingMs: 60000 });
  await call(host, "host:phase", { phase: "reveal" });
  await call(host, "host:close");
  await settle();
  assert.equal(saved.length, 2);
  assert.deepEqual(Object.keys(saved[1].record.players).sort(), ["s1", "s2", "s3"], "Chloe plays from the next round");
  pending = [];

  // Guests-only rooms save nothing.
  const host2 = await client();
  const g = await call(host2, "host:open", { idToken: "tok-b" });
  const kid = await client();
  await call(kid, "player:join", { code: g.room.code, guestName: "Zed" });
  const r4 = await call(host2, "host:start", { settings: ROUND });
  await call(host2, "host:clock", { n: r4.n, state: "playing", remainingMs: 60000 });
  await call(host2, "host:phase", { phase: "reveal" });
  runTimers();
  await settle();
  assert.equal(saved.length, 2);
  await call(host2, "host:close");
});

// The rounds that "didn't happen": the big screen's end-of-round message never reached the server.
test("a round is saved even when the big screen's 'answers' message is lost", async () => {
  saved = []; pending = [];
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const ava = await client();
  await call(ava, "player:join", { code: room.code, studentId: "s1" });
  const roundsBefore = summaries.get("s1").rounds, starsBefore = summaries.get("s1").stars;

  // 1. Time runs out while the big screen is offline: the server's own clock ends and saves the round.
  const r1 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r1.n, state: "playing", remainingMs: 60000 });
  assert.equal((await call(ava, "player:word", { n: r1.n, word: "cat" })).result, "ok");
  const over = next(ava, "round:clock");
  clock += 60100;
  runTimers(61000);              // the server's clock
  assert.equal((await over).state, "over", "devices are told the round is over");
  runTimers(2000);               // the grace window
  await settle();
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].record.players.s1.words, ["cat"]);
  assert.equal(summaries.get("s1").rounds, roundsBefore + 1, "rewards and reports move together");
  // The big screen comes back and tries to carry on the clock: the round stays ended.
  assert.deepEqual(await call(host, "host:clock", { n: r1.n, state: "playing", remainingMs: 5000 }), { error: "round-over" });
  assert.equal((await call(host, "host:resume", { idToken: "tok-a" })).round.state, "over");

  // 2. Time ran out, the "answers" message was lost, and the teacher went straight back to the lobby: still saved.
  const r2 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r2.n, state: "playing", remainingMs: 60000 });
  clock += 60100;
  await call(host, "host:phase", { phase: "lobby" });
  runTimers();
  await settle();
  assert.equal(saved.length, 2, "time was up, so going to the lobby isn't abandoning it");

  // 3. Time ran out and the next round was started before any end-of-round message got through: still saved.
  const r3 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r3.n, state: "playing", remainingMs: 60000 });
  clock += 60100;
  pending = [];                  // the server's clock timer is lost too
  await call(host, "host:start", { settings: ROUND });
  runTimers();
  await settle();
  assert.equal(saved.length, 3);
  assert.equal(new Set(saved.map(x => x.gameId)).size, 3, "every round has its own id");

  // 4. The database is down: the save is retried until it lands, exactly once, and the teacher is told meanwhile.
  failSaves = 2;
  const r4 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r4.n, state: "playing", remainingMs: 60000 });
  assert.equal((await call(ava, "player:word", { n: r4.n, word: "cats" })).result, "ok");
  const warned = next(host, "round:saved");
  await call(host, "host:phase", { phase: "reveal" });
  runTimers(2000);
  assert.deepEqual(await warned, { n: r4.n, ok: false, retrying: true });
  assert.equal(saved.length, 3);
  const rewards = next(ava, "round:rewards"), ok = next(host, "round:saved");
  for (let i = 0; i < 3; i++) { runTimers(); await settle(); }
  assert.deepEqual(await ok, { n: r4.n, ok: true });
  assert.equal((await rewards).n, r4.n, "the student's rewards arrive once the save lands");
  assert.equal(saved.length, 4);
  assert.equal(failSaves, 0);
  // A retry of a save that already landed changes nothing.
  assert.equal(summaries.get("s1").rounds, roundsBefore + 4);
  assert.equal(summaries.get("s1").stars, starsBefore + saved.reduce((n, x) => n + starsForRound(x.record.players.s1.score), 0), "nor its stars");

  // 5. The server is stopped mid-round (a deploy, or the free plan going to sleep): the round is saved as it stands.
  const r5 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r5.n, state: "playing", remainingMs: 60000 });
  assert.equal((await call(ava, "player:word", { n: r5.n, word: "cat" })).result, "ok");
  assert.equal(await roomsApi.shutdown(), 0, "nothing left unsaved");
  assert.equal(saved.length, 5);
  assert.equal(saved[4].record.cutShort, true);
  assert.deepEqual(saved[4].record.players.s1.words, ["cat"]);
  await call(host, "host:close");
  pending = [];
});

test("hints: a shortest unfound word after 15 seconds without finding one", async () => {
  saved = []; pending = [];
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const kid = await client();
  const joined = await call(kid, "player:join", { code: room.code, studentId: "s1" });
  const r = await call(host, "host:start", { settings: ROUND });
  const hint = () => call(kid, "player:hint", { n: r.n });
  assert.equal((await hint()).result, "late", "not before the round starts");
  await call(host, "host:clock", { n: r.n, state: "playing", remainingMs: 60000 });

  const early = await hint();
  assert.equal(early.result, "wait");
  assert.equal(early.waitMs, 15000);
  clock += 15000;
  assert.deepEqual(await hint(), { result: "hint", word: "cat" }, "the shortest word on the board");
  assert.equal((await hint()).result, "wait", "the next one is 15 seconds away");

  // A refresh keeps the hint on screen until it's found.
  kid.close();
  const kid2 = await client();
  assert.equal((await call(kid2, "player:rejoin", { code: room.code, token: joined.token })).round.hint, "cat");
  clock += 5000;
  assert.equal((await call(kid2, "player:word", { n: r.n, word: "cat" })).result, "ok");
  assert.equal((await call(kid2, "player:rejoin", { code: room.code, token: joined.token })).round.hint, null, "found: gone");
  clock += 14000;
  assert.equal((await call(kid2, "player:hint", { n: r.n })).result, "wait", "finding a word restarts the 15 seconds");

  // Paused time doesn't count as being stuck.
  await call(host, "host:clock", { n: r.n, state: "paused" });
  clock += 30000;
  await call(host, "host:clock", { n: r.n, state: "playing", remainingMs: 50000 });
  assert.equal((await call(kid2, "player:hint", { n: r.n })).result, "wait");
  clock += 15000;
  assert.deepEqual(await call(kid2, "player:hint", { n: r.n }), { result: "hint", word: "cats" });
  await call(kid2, "player:word", { n: r.n, word: "cats" });
  clock += 15000;
  assert.equal((await call(kid2, "player:hint", { n: r.n })).result, "none", "nothing left to suggest");

  // The teacher's report shows how many hints each student used.
  await call(host, "host:phase", { phase: "reveal" });
  runTimers();
  await settle();
  assert.equal(saved.at(-1).record.players.s1.hints, 2);

  // Hints switched off for a round.
  const off = await call(host, "host:start", { settings: { ...ROUND, hints: false } });
  await call(host, "host:clock", { n: off.n, state: "playing", remainingMs: 60000 });
  clock += 20000;
  assert.equal((await call(kid2, "player:hint", { n: off.n })).result, "off");
  assert.equal((await call(kid2, "player:rejoin", { code: room.code, token: joined.token })).round.hints, false);

  // The teacher's own hint time.
  const quick = await call(host, "host:start", { settings: { ...ROUND, hintSeconds: 10 } });
  await call(host, "host:clock", { n: quick.n, state: "playing", remainingMs: 60000 });
  assert.equal((await call(kid2, "player:rejoin", { code: room.code, token: joined.token })).round.hintAfterMs, 10000);
  assert.equal((await call(kid2, "player:hint", { n: quick.n })).waitMs, 10000);
  clock += 10000;
  assert.equal((await call(kid2, "player:hint", { n: quick.n })).result, "hint");
  assert.equal((await call(host, "host:start", { settings: { ...ROUND, hintSeconds: 3 } })).error !== undefined, true, "only 10, 15, 20 or 30");
  await call(host, "host:close");
  pending = [];
});

test("guessing room codes gets throttled, whichever message is used", async () => {
  const kid = await client();
  const guesses = [
    () => call(kid, "player:lookup", { code: "ZZZZ" }),
    () => call(kid, "player:rejoin", { code: "ZZZZ", token: "x" }),
    () => call(kid, "player:join", { code: "ZZZZ", guestName: "Max" }),
  ];
  for (let i = 0; i < 100; i++) assert.deepEqual(await guesses[i % 3](), { error: "no-room" });
  for (const g of guesses) assert.deepEqual(await g(), { error: "too-many" });
});

test("own looks: the teacher's setting reaches the room and every device", async () => {
  clock += 60 * 60 * 1000; roomsApi.sweep();   // let the code-guessing throttle from the test before run out
  const host = await client();
  const open = await call(host, "host:open", { idToken: "tok-a", classId: "class1", ownLooks: false, theme: "rednut" });
  assert.equal(open.room.ownLooks, false);
  assert.equal("theme" in open.room, false, "the room has no theme any more");
  const kid = await client();
  assert.equal("theme" in (await call(kid, "player:lookup", { code: open.room.code })).room, false);
  const joined = await call(kid, "player:join", { code: open.room.code, studentId: "s1" });
  assert.equal(joined.ownLooks, false);
  const pushed = next(kid, "room:looks"), hostSees = next(host, "room:update");
  assert.deepEqual(await call(host, "host:own-looks", { on: true }), { ok: true });
  assert.deepEqual(await pushed, { ownLooks: true });
  assert.equal((await hostSees).ownLooks, true);
  assert.deepEqual(await call(host, "host:own-looks", { on: "yes" }), { error: "invalid" });
  assert.deepEqual(await call(kid, "host:own-looks", { on: false }), { error: "no-room" }, "students can't change it");
  assert.equal((await call(host, "host:resume", { idToken: "tok-a" })).room.ownLooks, true);
  await call(host, "host:close");
  assert.equal((await call(host, "host:open", { idToken: "tok-a", classId: "class1" })).room.ownLooks, true, "on unless the teacher says");
  await call(host, "host:close");
});

test("shop: buying and wearing looks, from the lobby only, never for guests", async () => {
  saved = []; pending = [];
  summaries.set("s3", { ...summaries.get("s3"), stars: 30 });
  wallets.set("s3", {});
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const chloe = await client(), guest = await client(), stranger = await client();
  const joined = await call(chloe, "player:join", { code: room.code, studentId: "s3" });
  assert.deepEqual(joined.looks, noLooks, "the device dresses itself from the join");
  assert.equal(joined.ownLooks, true);
  assert.equal(joined.balance, 30, "and shows its stars straight away");
  const guestJoin = await call(guest, "player:join", { code: room.code, guestName: "Max" });
  assert.equal(guestJoin.looks, null, "guests have no looks");
  assert.equal(guestJoin.balance, null, "or stars");
  for (const ev of ["player:shop", "player:buy", "player:equip"]) {
    assert.deepEqual(await call(guest, ev, { id: "test-fox", slot: "avatar" }), { error: "guest" });
    assert.deepEqual(await call(stranger, ev, { id: "test-fox", slot: "avatar" }), { error: "not-joined" });
  }
  const buy = id => { clock += 1000; return call(chloe, "player:buy", { id }); };
  const equip = (slot, id) => { clock += 1000; return call(chloe, "player:equip", { slot, id }); };

  const shop = await call(chloe, "player:shop");
  assert.deepEqual(shop.wallet, { stars: 30, spent: 0, balance: 30, owned: {}, equipped: {} });
  assert.deepEqual(shop.worn, noLooks);
  assert.ok(shop.trophies["first-round"], "her trophies come too, for the unlock-only looks");
  assert.deepEqual(await call(chloe, "player:shop"), { error: "slow-down" });

  assert.deepEqual(await buy("test-dots"), { error: "not-enough" });
  assert.deepEqual(await buy("test-crown"), { error: "unlock-only" });
  assert.deepEqual(await buy("nope"), { error: "no-item" });
  assert.deepEqual(await buy(42), { error: "no-item" });
  const bought = await buy("test-fox");
  assert.equal(bought.ok, true);
  assert.deepEqual({ ...bought.wallet, owned: Object.keys(bought.wallet.owned) }, { stars: 30, spent: 10, balance: 20, owned: ["test-fox"], equipped: {} });
  assert.equal(bought.worn.avatar, null, "bought isn't worn until she chooses");
  assert.deepEqual(await buy("test-fox"), { error: "owned" });
  assert.deepEqual(await call(chloe, "player:buy", { id: "test-owl" }), { error: "slow-down" }, "one buy a second");
  assert.equal(summaries.get("s3").stars, 30, "buying never touches the summary");

  assert.deepEqual(await equip("avatar", "test-owl"), { error: "not-owned" });
  assert.deepEqual(await equip("dice", "test-fox"), { error: "no-item" }, "a fox isn't dice");
  assert.deepEqual(await equip("hat", "test-fox"), { error: "no-slot" });
  const lobby = next(host, "room:update");
  const worn = await equip("avatar", "test-fox");
  assert.deepEqual(worn, { ok: true, worn: { ...noLooks, avatar: "test-fox" } });
  assert.equal((await lobby).players.find(p => p.studentId === "s3").avatar, "🦊", "the big-screen lobby shows it straight away");
  const view = (await call(host, "host:resume", { idToken: "tok-a" })).room;
  assert.equal(view.players.find(p => p.guest).avatar, null);

  // Mid-round the shop is only for looking.
  const r = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r.n, state: "playing", remainingMs: 60000 });
  assert.deepEqual(await buy("test-owl"), { error: "not-now" });
  assert.deepEqual(await equip("avatar", null), { error: "not-now" });
  clock += 2000;
  assert.equal((await call(chloe, "player:shop")).wallet.balance, 20);
  assert.equal((await call(chloe, "player:word", { n: r.n, word: "cats" })).result, "ok");
  const rewards = next(chloe, "round:rewards");
  await call(host, "host:phase", { phase: "reveal" });
  runTimers();
  const mine = await rewards;
  const earned = starsForRound(saved.at(-1).record.players.s3.score);
  assert.equal(mine.stars, earned, "the device hears the stars this round earned");
  assert.equal(mine.balance, 20 + earned, "and what it can spend now");
  assert.equal(wallets.get("s3").spent, 10, "a saved round never touches the wallet");

  // Back on the device after a refresh: still wearing the fox.
  const back = await call(await client(), "player:rejoin", { code: room.code, token: joined.token });
  assert.equal(back.looks.avatar, "test-fox");
  assert.equal(back.balance, 20 + earned);
  await call(host, "host:phase", { phase: "lobby" });
  clock += 1000;
  assert.deepEqual(await call(chloe, "player:equip", { slot: "avatar", id: null }), { error: "not-joined" }, "the old device was replaced");
  await call(host, "host:close");
  pending = [];
});

test("shop: two buys at once can't spend the same stars", async () => {
  summaries.set("s2", { ...summaries.get("s2"), stars: 15 });
  wallets.set("s2", { spent: 0 });
  const out = await Promise.all(["test-fox", "test-owl"].map(id => buyItem("teacherA", "class1", "s2", id, clock)));
  assert.deepEqual(out.map(o => o.error || "ok").sort(), ["not-enough", "ok"]);
  assert.equal(wallets.get("s2").spent, 10);
  assert.equal(Object.keys(wallets.get("s2").owned).length, 1);
});
