import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { attachRooms } from "../server/lib/rooms.js";
import { AuthError } from "../server/lib/auth.js";
import { countHomeRound, homeDay, HOME_STAR_ROUNDS } from "../shared/home.js";

test("home stars: the first few rounds of a Melbourne day, counted afresh each morning", () => {
  const nine = Date.parse("2026-10-22T22:00:00Z");   // 9am on the 23rd in Melbourne (summer time), still the 22nd in UTC
  assert.equal(homeDay(nine), "2026-10-23");
  let day = null;
  const got = [];
  for (let i = 0; i < HOME_STAR_ROUNDS + 2; i++) { day = countHomeRound(day, nine + i * 60000); got.push(day.stars); }
  assert.deepEqual(got, [true, true, true, true, true, false, false]);
  assert.equal(day.rounds, HOME_STAR_ROUNDS + 2);
  const tomorrow = countHomeRound(day, nine + 24 * 3600 * 1000);
  assert.deepEqual(tomorrow, { day: "2026-10-24", rounds: 1, stars: true });
});

/* ---- over a real connection ---- */

const CLASS = { id: "class1", name: "3/4B", homePlay: true, students: [{ id: "s1", name: "Ava", pin: [0, 1, 2] }, { id: "s2", name: "Ben", pin: [3, 4, 5] }] };
const OFF = { id: "class2", name: "5/6", homePlay: false, students: [{ id: "t1", name: "Dee", pin: [6, 7, 8] }] };
const classes = { class1: CLASS, class2: OFF };
const PASSES = { "pass-ava": { classId: "class1", studentId: "s1" }, "pass-ben": { classId: "class1", studentId: "s2" }, "pass-dee": { classId: "class2", studentId: "t1" } };
// C A T S on the top row: "cat" and "cats" are the only answers.
const GAME = { tiles: ["C", "A", "T", "S", ...Array(12).fill("X")], rots: Array(16).fill("0"), solution: { list: ["cat", "cats"], total: 2, longest: [{ word: "cats" }], phonics: null } };
const ROUND = { seconds: 60, size: 4, minLen: 3 };
// The teacher's home game (store.js homeTaskFor): what the database would say, changed by the tests.
let task = null;
const tasksDone = new Set();   // "studentId:taskId"
const TASK_GAME = { tiles: ["D", "O", "G", "S", ...Array(12).fill("Q")], rots: Array(16).fill("0"), solution: { list: ["dog", "dogs"], total: 2, longest: [{ word: "dogs" }], phonics: null } };
const TASK_SETTINGS = { seconds: 60, size: 4, minLen: 3, phSound: null, phTicked: [], phBonus: false, hints: true, hintSeconds: 15, wordOfGame: false };

let server, url, roomsApi, clock = Date.parse("2026-10-22T08:00:00Z");
let pending = [];
const savedClass = [], savedHome = [], kept = [];
const runTimers = () => { const due = pending; pending = []; due.forEach(t => t.fn()); };
const settle = () => new Promise(r => setTimeout(r, 20));
const sockets = [];

before(async () => {
  server = http.createServer();
  const io = new Server(server);
  roomsApi = attachRooms(io, {
    verifyTeacher: async t => { if (t !== "tok-a") throw new AuthError(401, "token-invalid"); return { id: "teacherA", name: "A" }; },
    getClass: async (tid, cid) => (tid === "teacherA" && classes[cid]) || null,
    makeGame: async () => GAME,
    isRealWord: async () => false,
    saveRound: async (...a) => { savedClass.push(a); return { status: "saved", earned: {}, summaries: {} }; },
    saveHomeRound: async (teacherId, classId, gameId, record) => {
      savedHome.push({ teacherId, classId, gameId, record });
      const earned = Object.fromEntries(Object.keys(record.players).map(sid => [sid, { trophies: [], stickers: [], best: [], stars: 7 }]));
      const summaries = Object.fromEntries(Object.keys(record.players).map(sid => [sid, { stars: 7, spent: 0 }]));
      return { status: "saved", earned, summaries };
    },
    getStudent: async () => ({ stars: 0 }),
    homeTaskFor: async (tid, cid, sid) => (task && cid === "class1" ? { ...task, game: JSON.parse(JSON.stringify(task.game)), done: tasksDone.has(`${sid}:${task.id}`) } : null),
    liveStore: {
      save: async (tid, snap) => { kept.push(snap.code); },
      byTeacher: async () => null,
      byCode: async () => null,
      remove: async (tid, code) => { kept.push(`removed ${code}`); },
    },
    signin: {
      passOwner: async p => (PASSES[p] ? { teacherId: "teacherA", ...PASSES[p] } : null),
      forgetPass: async () => {},
    },
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
const signedIn = async pass => { const s = await client(); assert.equal((await call(s, "student:resume", { pass })).ok, true); return s; };

test("home game: only for a signed-in student, and only if the teacher allows it", async () => {
  const nobody = await client();
  assert.deepEqual(await call(nobody, "home:open"), { error: "signed-out" });
  const dee = await signedIn("pass-dee");
  assert.deepEqual(await call(dee, "home:open"), { error: "home-off" });
});

test("home game: leaves the teacher's lesson alone, tells no classmates, and is never kept", async () => {
  const teacher = await client();
  const lesson = await call(teacher, "host:open", { idToken: "tok-a", classId: "class1" });
  const ben = await signedIn("pass-ben");
  let told = 0;
  ben.on("class:room", () => told++);
  kept.length = 0;

  const ava = await signedIn("pass-ava");
  const home = await call(ava, "home:open");
  assert.equal(home.ok, true);
  assert.notEqual(home.code, lesson.room.code);
  assert.deepEqual([home.name, home.guest, home.home], ["Ava", false, { host: "Ava" }]);
  assert.equal(home.host.className, "Ava's game");
  await settle();
  assert.equal(told, 0, "classmates' home screens aren't sent into Ava's game");
  assert.equal(kept.some(k => k.includes(home.code)), false, "a home game is never written to the kept rooms");

  // The teacher's room is still open; opening a new one doesn't close Ava's game either.
  const look = await call(ben, "player:lookup", { code: lesson.room.code });
  assert.equal(look.ok, true);
  await call(teacher, "host:open", { idToken: "tok-a", classId: "class1" });
  assert.equal((await call(ben, "player:lookup", { code: home.code })).ok, true);

  // Opening it again (a refresh) picks the same game back up.
  const again = await signedIn("pass-ava");
  assert.equal((await call(again, "home:open")).code, home.code);
});

test("joining a home game: guests type a name, a classmate is themselves, nobody can pick a name from the class", async () => {
  const ava = await signedIn("pass-ava");
  const { code } = await call(ava, "home:open");

  const mum = await client();
  const look = await call(mum, "player:lookup", { code });
  assert.deepEqual([look.room.className, look.room.roster], ["Ava's game", null], "the class list isn't shown");
  assert.deepEqual(await call(mum, "player:join", { code, studentId: "s2" }), { error: "no-student" });
  assert.deepEqual(await call(mum, "player:join", { code, studentId: "s2", remember: true }), { error: "no-student" }, "no pass for Ben's account");
  const asGuest = await call(mum, "player:join", { code, guestName: "Mum" });
  assert.deepEqual([asGuest.ok, asGuest.name, asGuest.guest, asGuest.home], [true, "Mum", true, { host: "Ava" }]);
  assert.equal(asGuest.pass, undefined);

  const ben = await signedIn("pass-ben");
  const asBen = await call(ben, "player:join", { code, me: true });
  assert.deepEqual([asBen.ok, asBen.name, asBen.guest], [true, "Ben", false]);

  const dee = await signedIn("pass-dee");
  assert.deepEqual(await call(dee, "player:join", { code, me: true }), { error: "not-your-class" });
});

test("a round at home: the server counts down and keeps time, answers come after, and it's saved apart from lessons", async () => {
  const ava = await signedIn("pass-ava");
  const { code } = await call(ava, "home:open");
  const mum = await client();
  await call(mum, "player:join", { code, guestName: "Mum" });
  savedClass.length = 0; savedHome.length = 0; pending = [];

  const states = [];
  ava.on("round:state", r => states.push(r));
  const started = await call(ava, "host:start", { settings: ROUND });
  assert.equal(started.ok, true);
  assert.equal(started.game, undefined, "the host plays too, so it never gets the answers");
  await settle();
  assert.equal(states.at(-1).state, "countdown");
  assert.equal(JSON.stringify(states.at(-1)).includes("cats"), false);

  const clockSent = new Promise(r => ava.once("round:clock", r));
  runTimers();   // "Get ready" is over
  assert.deepEqual(await clockSent, { n: started.n, state: "playing", remainingMs: 60000 });
  assert.equal((await call(ava, "player:word", { n: started.n, word: "cat" })).result, "ok");
  assert.equal((await call(ava, "host:clock", { n: started.n, state: "paused", remainingMs: 30000 })).ok, true, "the student can pause");
  assert.equal((await call(ava, "host:clock", { n: started.n, state: "playing", remainingMs: 30000 })).ok, true);

  clock += 31000;
  runTimers();   // the server's clock runs out
  runTimers();   // the grace window: the round is saved and every device moves on to its answers
  await settle();
  assert.equal(savedClass.length, 0, "nothing goes into the class's lessons");
  assert.equal(savedHome.length, 1);
  const who = Object.values(savedHome[0].record.players).map(p => p.name);
  assert.ok(who.includes("Ava") && !who.includes("Mum"), "class-list students are saved (Ben joined earlier), guests aren't");
  const end = states.at(-1);
  assert.equal(end.state, "over");
  assert.deepEqual(end.missed, ["cats"]);
});

test("closing a home game sends everyone home and forgets it", async () => {
  const ava = await signedIn("pass-ava");
  const { code } = await call(ava, "home:open");
  const mum = await client();
  await call(mum, "player:join", { code, guestName: "Mum" });
  const closed = new Promise(r => mum.once("room:closed", r));
  assert.equal((await call(ava, "host:close")).ok, true);
  assert.equal(await closed, "closed");
  assert.deepEqual(await call(mum, "player:lookup", { code }), { error: "no-room" });
  assert.equal(kept.includes(`removed ${code}`), false);
  // A new one gets a new code.
  assert.notEqual((await call(ava, "home:open")).code, code);
});

test("signed out by the teacher: the student's home game ends for everyone", async () => {
  const ava = await signedIn("pass-ava");
  const { code } = await call(ava, "home:open");
  const mum = await client();
  await call(mum, "player:join", { code, guestName: "Mum" });
  const closed = new Promise(r => mum.once("room:closed", r));
  const told = new Promise(r => ava.once("student:signed-out", r));
  roomsApi.signedOut("teacherA", "class1", "s1");
  await told;
  assert.equal(await closed, "closed");
  assert.deepEqual(await call(ava, "host:start", { settings: ROUND }), { error: "no-room" });
  assert.deepEqual(await call(ava, "home:open"), { error: "signed-out" });

  // The whole class signed out (or the class deleted), with the host's device away: its game ends too.
  const again = await signedIn("pass-ava");
  const second = await call(again, "home:open");
  again.disconnect();
  await new Promise(r => setTimeout(r, 50));
  roomsApi.signedOut("teacherA", "class1");
  assert.deepEqual(await call(mum, "player:lookup", { code: second.code }), { error: "no-room" });
});

test("the teacher's home game: the same board for everyone, played before a student's own boards", async () => {
  task = { id: "t1", settings: TASK_SETTINGS, game: TASK_GAME };
  const ava = await signedIn("pass-ava"), ben = await signedIn("pass-ben");
  const home = await call(ava, "home:open");
  assert.deepEqual(home.host.task, { id: "t1", settings: TASK_SETTINGS, done: false });
  pending = []; savedHome.length = 0;
  clock += 10000;

  assert.deepEqual(await call(ava, "host:start", { settings: ROUND }), { error: "task-first" }, "their own board waits");
  const states = [];
  ava.on("round:state", r => states.push(r));
  const started = await call(ava, "host:start", { settings: { ...ROUND, size: 6 }, task: true });
  assert.equal(started.ok, true);
  await settle();
  assert.deepEqual(states.at(-1).tiles, TASK_GAME.tiles, "the teacher's board, whatever settings the device sent");

  // Ben, in his own home game, gets exactly the same letters.
  const benStates = [];
  ben.on("round:state", r => benStates.push(r));
  await call(ben, "home:open");
  assert.equal((await call(ben, "host:start", { task: true })).ok, true);
  await settle();
  assert.deepEqual(benStates.at(-1).tiles, TASK_GAME.tiles);

  // Ava plays it to the end: done straight away, before the save lands, so "Play again" works.
  runTimers();   // "Get ready"
  assert.equal((await call(ava, "player:word", { n: started.n, word: "dog" })).result, "ok");
  const updated = new Promise(r => ava.on("room:update", v => { if (v.task && v.task.done) r(v); }));
  clock += 61000;
  runTimers();
  assert.equal((await updated).task.done, true);
  runTimers();
  await settle();
  const saved = savedHome.find(x => x.record.players.s1);
  assert.equal(saved.record.task, "t1", "the saved round says it was the teacher's game");
  clock += 6000;
  assert.equal((await call(ava, "host:start", { settings: ROUND })).ok, true, "now her own boards are open");
  clock += 6000;
  assert.equal((await call(ava, "host:start", { task: true })).ok, true, "and she can play the teacher's game again");

  // A new board from the teacher: it comes first again. Switched off: nothing in the way.
  task = { id: "t2", settings: TASK_SETTINGS, game: TASK_GAME };
  clock += 6000;
  assert.deepEqual(await call(ava, "host:start", { settings: ROUND }), { error: "task-first" });
  task = null;
  assert.equal((await call(ava, "host:start", { settings: ROUND })).ok, true);
  clock += 6000;
  assert.deepEqual(await call(ava, "host:start", { task: true }), { error: "no-task" });

  // Finished on another day (the database says so): done when the game opens.
  task = { id: "t3", settings: TASK_SETTINGS, game: TASK_GAME };
  tasksDone.add("s2:t3");
  assert.equal((await call(ben, "home:open")).host.task.done, true);
  task = null;
  await call(ava, "host:close"); await call(ben, "host:close");
  pending = [];
});

test("the teacher's home game can have today's sound: shown on the device, bonus for its words", async () => {
  const rain = [{ spelling: "ai", ranges: [[1, 3]] }];
  const settings = { ...TASK_SETTINGS, phSound: "ae", phTicked: ["ai", "ay"], phBonus: true };
  const game = { tiles: ["R", "A", "I", "N", ...Array(12).fill("Q")], rots: Array(16).fill("0"),
    solution: { list: ["rain", "ran"], total: 2, longest: [{ word: "rain" }], phonics: { soundId: "ae", spellings: ["ai", "ay"], covered: 1, bySpelling: { ai: [{ word: "rain", ranges: rain[0].ranges }] }, tagMap: { rain }, count: 1 } } };
  task = JSON.parse(JSON.stringify({ id: "t9", settings, game }));   // as it comes back from the database
  const ava = await signedIn("pass-ava");
  await call(ava, "home:open");
  clock += 60000;
  const states = [];
  ava.on("round:state", r => states.push(r));
  const started = await call(ava, "host:start", { task: true });
  assert.equal(started.ok, true);
  await settle();
  const view = states.at(-1);
  assert.deepEqual([view.phSound, view.phTicked, view.phBonus], ["ae", ["ai", "ay"], true]);
  runTimers();   // "Get ready"
  const hit = await call(ava, "player:word", { n: started.n, word: "rain" });
  assert.equal(hit.bonus, 2, "a word with today's sound earns the bonus");
  assert.equal((await call(ava, "player:word", { n: started.n, word: "ran" })).bonus, 0);
  task = null;
  await call(ava, "host:close");
  pending = [];
});
