import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { attachRooms } from "../server/lib/rooms.js";
import { AuthError } from "../server/lib/auth.js";

const CLASS = { id: "class1", name: "3/4B", students: [{ id: "s1", name: "Ava" }, { id: "s2", name: "Ben" }, { id: "s3", name: "Chloe" }] };
// C A T S on the top row, X everywhere else: "cat" and "cats" are the only answers.
const GAME = size => ({
  tiles: ["C", "A", "T", "S", ...Array(size * size - 4).fill("X")], rots: Array(size * size).fill("0"),
  solution: { list: ["cat", "cats"], longest: [{ word: "cats" }], phonics: { tagMap: { cat: [[1, 2]] }, bySpelling: { a: [{ word: "cat" }, { word: "cats" }] } } },
});
const ROUND = { seconds: 60, size: 4, minLen: 3, phSound: null, phTicked: [], phBonus: false };
const TEACHERS = { "tok-a": { id: "teacherA", name: "A" }, "tok-b": { id: "teacherB", name: "B" } };

let server, url, roomsApi, clock = 1_000_000;
let saved = [], pending = [];   // rounds saved for progress tracking, and saves waiting out the grace window
const summaries = new Map();     // class1 students' saved reward summaries
const sockets = [];

before(async () => {
  server = http.createServer();
  const io = new Server(server);
  roomsApi = attachRooms(io, {
    verifyTeacher: async t => { if (!TEACHERS[t]) throw new AuthError(401, "token-invalid"); return TEACHERS[t]; },
    getClass: async (tid, cid) => (tid === "teacherA" && cid === "class1" ? CLASS : null),
    makeGame: async ({ size }) => GAME(size),
    isRealWord: async w => ["tac", "cat", "cats"].includes(w),
    saveRound: async (teacherId, classId, record, updates) => {
      saved.push({ teacherId, classId, record, updates });
      for (const [sid, sum] of Object.entries(updates || {})) summaries.set(sid, sum);
    },
    loadSummaries: async (tid, cid) => new Map(tid === "teacherA" && cid === "class1" ? summaries : []),
    getStudent: async (tid, cid, sid) => ({ ...(summaries.get(sid) || {}), awards: [{ id: "x", emoji: "💪", label: "Great effort" }] }),
    now: () => clock,
    later: fn => pending.push(fn),
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
  assert.equal((await word("cats")).total, 2);
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
  assert.equal(back.round.total, 2);

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

  await call(host, "host:phase", { phase: "reveal" });
  assert.equal(pending.length, 1, "save scheduled");
  assert.equal(saved.length, 0, "not before the grace window ends");
  clock += 1000;
  assert.equal((await call(ava, "player:word", { n: r.n, word: "cats" })).result, "ok", "word inside the grace");
  const avaRewards = next(ava, "round:rewards"), hostRewards = next(host, "round:rewards-summary");
  let guestGotRewards = false;
  guest.once("round:rewards", () => { guestGotRewards = true; });
  pending.shift()();
  const mine = await avaRewards, totals = await hostRewards;
  await new Promise(res => setImmediate(res));
  assert.equal(saved.length, 1);
  assert.equal(mine.n, r.n);
  assert.deepEqual(mine.trophies.sort(), ["first-round", "first-word", "sound-spotter"].sort());
  assert.deepEqual(mine.stickers, [{ sound: "a", g: "a", tier: 1 }]);
  assert.deepEqual(mine.best, [], "no personal best in a first round");
  assert.deepEqual(totals, { n: r.n, trophies: 4, stickers: 1, bests: 0 }, "big screen: totals only (Ava 3, Ben 1)");
  assert.equal(guestGotRewards, false, "guests get no rewards");
  assert.equal(saved[0].updates.s1.rounds, 1);
  assert.equal(saved[0].updates.s1.name, "Ava");
  assert.deepEqual(Object.keys(saved[0].updates).sort(), ["s1", "s2"]);

  // A refresh during the answers brings the rewards back.
  const ava2 = await client();
  const back = await call(ava2, "player:rejoin", { code: room.code, token: avaJoin.token });
  assert.deepEqual(back.round.rewards.trophies.sort(), mine.trophies);
  assert.deepEqual(back.round.rewards.stickers, mine.stickers);
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
  assert.deepEqual(record.players.s1, { name: "Ava", words: ["cat", "cats"], score: 4, bonusCount: 1, bySpelling: { a: ["cat", "cats"] } });
  assert.deepEqual(record.players.s2, { name: "Ben", words: [], score: 0, bonusCount: 0, bySpelling: {} }, "a zero still counts");
  assert.deepEqual(record.available, { a: 2 });
  assert.equal(record.settings.phSound, "a");
  assert.equal(record.boardWords, 2);

  // The teacher refreshes during the answers: no second save.
  await call(host, "host:phase", { phase: "reveal" });
  assert.equal(pending.length, 0);

  // An abandoned round (back to the lobby mid-round) is never saved.
  const r2 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r2.n, state: "playing", remainingMs: 60000 });
  await call(host, "host:phase", { phase: "lobby" });
  await call(host, "host:phase", { phase: "reveal" });
  assert.equal(pending.length, 0);

  // Closing the room straight after a round still saves it.
  const r3 = await call(host, "host:start", { settings: ROUND });
  await call(host, "host:clock", { n: r3.n, state: "playing", remainingMs: 60000 });
  await call(host, "host:phase", { phase: "reveal" });
  await call(host, "host:close");
  await new Promise(res => setImmediate(res));
  assert.equal(saved.length, 2);
  assert.deepEqual(Object.keys(saved[1].record.players).sort(), ["s1", "s2", "s3"], "Chloe plays from the next round");
  pending.length = 0;

  // Guests-only rooms save nothing.
  const host2 = await client();
  const g = await call(host2, "host:open", { idToken: "tok-b" });
  const kid = await client();
  await call(kid, "player:join", { code: g.room.code, guestName: "Zed" });
  const r4 = await call(host2, "host:start", { settings: ROUND });
  await call(host2, "host:clock", { n: r4.n, state: "playing", remainingMs: 60000 });
  await call(host2, "host:phase", { phase: "reveal" });
  assert.equal(pending.length, 0);
  await call(host2, "host:close");
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
