import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { createHash } from "crypto";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { attachRooms } from "../server/lib/rooms.js";
import { AuthError } from "../server/lib/auth.js";
import { pickClass } from "../server/lib/classes.js";
import { checkPin, deviceLabel, passFromCookie, PIN_TRIES, PIN_LOCK_MS, practiceMode, practised, PRACTICE_CHECK_MS } from "../server/lib/signin.js";
import { PICTURES, validPin, cleanClassCode, validClassCode, suggestClassCode } from "../shared/pictures.js";

/* ---- the rules on their own ---- */

test("pictures: twelve, all different, and old enough for Windows 10", () => {
  assert.equal(PICTURES.length, 12);
  assert.equal(new Set(PICTURES.map(p => p.emoji)).size, 12);
  for (const { emoji } of PICTURES) for (const ch of emoji) assert.ok(ch.codePointAt(0) < 0x1FA70, `${emoji} is too new`);
  assert.ok(validPin([0, 5, 11]));
  for (const bad of [[0, 0, 1], [0, 1], [0, 1, 12], [0, 1, 2.5], "012", null]) assert.equal(validPin(bad), false);
});

test("class codes: 5 to 10 letters and numbers, typed any way", () => {
  assert.equal(cleanClassCode(" birds-34 "), "BIRDS34");
  assert.ok(validClassCode("BIRDS34"));
  assert.equal(validClassCode("ABCD"), false, "4 characters is a game code");
  assert.equal(validClassCode("ABCDEFGHIJK"), false);
  assert.ok(validClassCode(suggestClassCode()));
});

test("classes: every student is given pictures, keeps them when the list is edited, and can't choose them", () => {
  const c = pickClass({ name: "3/4B", code: "birds34", students: [{ name: "Ava" }, { name: "Ben", pin: [0, 1, 2] }] });
  assert.equal(c.code, "BIRDS34");
  assert.ok(c.students.every(s => validPin(s.pin)));
  const again = pickClass({ name: "3/4B", students: [{ id: c.students[0].id, name: "Ava L", pin: [9, 10, 11] }] }, c.students);
  assert.deepEqual(again.students[0].pin, c.students[0].pin);
  assert.equal(again.code, null, "no code: the class keeps working without one");
  assert.equal(pickClass({ name: "x", code: "AB", students: [] }).error, "class-code");
  // A class saved before sign-in existed has students with no pictures: they're given some on the next save.
  assert.ok(validPin(pickClass({ name: "x", students: [{ id: "old1", name: "Cy" }] }, [{ id: "old1", name: "Cy" }]).students[0].pin));
});

test("secret pictures: five wrong in a row means a wait, and the right ones still don't work until it ends", () => {
  const pin = [1, 2, 3];
  let state = { pinShown: true, pinFails: 0, pinLockedUntil: 0 };
  assert.deepEqual(checkPin(state, [1, 2, 3], pin, 0), { ok: true, patch: { pinFails: 0, pinLockedUntil: 0 } });
  assert.equal(checkPin(state, [3, 2, 1], pin, 0).error, "wrong-pin", "order matters");
  for (let i = 1; i < PIN_TRIES; i++) {
    const out = checkPin(state, [4, 5, 6], pin, 0);
    assert.deepEqual([out.error, out.left], ["wrong-pin", PIN_TRIES - i]);
    state = { ...state, ...out.patch };
  }
  const lock = checkPin(state, [4, 5, 6], pin, 1000);
  assert.deepEqual([lock.error, lock.until], ["locked", 1000 + PIN_LOCK_MS]);
  state = { ...state, ...lock.patch };
  assert.equal(checkPin(state, pin, pin, 2000).error, "locked");
  assert.equal(checkPin(state, pin, pin, 2000).patch, undefined, "trying while locked doesn't make the wait longer");
  assert.equal(checkPin(state, [4, 5, 6], pin, 1000 + PIN_LOCK_MS).left, PIN_TRIES - 1, "after the wait, a fresh count");
  assert.ok(checkPin(state, pin, pin, 1000 + PIN_LOCK_MS).ok);
});

test("practice: pictures showing at first, then from memory until known, then a check now and then", () => {
  const t = 5_000_000_000;
  assert.equal(practiceMode({}, t), "shown");
  assert.equal(practiceMode({ pinPractised: 2 }, t), "shown");
  assert.equal(practiceMode({ pinPractised: 3 }, t), "memory");
  assert.equal(practiceMode({ pinPractised: 6, pinStreak: 2 }, t), "memory");
  assert.equal(practiceMode({ pinPractised: 6, pinStreak: 3, pinCheckedAt: t - 1000 }, t), null, "knows them: no practice");
  assert.equal(practiceMode({ pinPractised: 6, pinStreak: 3, pinCheckedAt: t - PRACTICE_CHECK_MS }, t), "memory", "a check every so often");

  assert.deepEqual(practised({}, "first", false, t), { pinPractised: 1 });
  assert.deepEqual(practised({ pinPractised: 1 }, "shown", true, t), { pinPractised: 2 }, "copying doesn't count as remembering");
  assert.deepEqual(practised({ pinPractised: 3, pinStreak: 1 }, "memory", true, t), { pinPractised: 4, pinStreak: 2, pinCheckedAt: t });
  assert.deepEqual(practised({ pinPractised: 9, pinStreak: 3, pinCheckedAt: 1 }, "memory", false, t), { pinPractised: 10, pinStreak: 0 }, "forgot: practise again");
});

test("device names and the cookie", () => {
  assert.equal(deviceLabel("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "iPad");
  assert.equal(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"), "iPad");
  assert.equal(deviceLabel("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)"), "Chromebook");
  assert.equal(deviceLabel(undefined), "Device");
  assert.equal(passFromCookie("a=1; ws_student=abcdefghijklmnopqrstuvwxyz; b=2"), "abcdefghijklmnopqrstuvwxyz");
  assert.equal(passFromCookie("ws_student=short"), null);
  assert.equal(passFromCookie(undefined), null);
});

/* ---- the whole flow, over a real connection ---- */

const CLASS = {
  id: "class1", name: "3/4B", code: "BIRDS34",
  students: [{ id: "s1", name: "Ava", pin: [0, 1, 2] }, { id: "s2", name: "Ben", pin: [3, 4, 5] }, { id: "s3", name: "Cy" }],   // Cy: saved before sign-in
};
const OTHER = { id: "class2", name: "5/6", code: "OWLS56", students: [{ id: "t1", name: "Dee", pin: [6, 7, 8] }] };
const TEACHERS = { "tok-a": { id: "teacherA", name: "A" } };
const hash = p => createHash("sha256").update(p).digest("hex");
const classes = { class1: CLASS, class2: OTHER };
const states = new Map(), passes = new Map();
let clock = 1_000_000, n = 0;

const signin = {
  classByCode: async code => Object.values(classes).find(c => c.code === code) && { teacherId: "teacherA", classId: Object.values(classes).find(c => c.code === code).id },
  createPass: async (owner, device) => { const p = `pass-${++n}-abcdefghijklmnopqrstuvwxyz`; passes.set(hash(p), { ...owner, device }); return p; },
  passOwner: async p => { const o = passes.get(hash(p)); return o ? { teacherId: o.teacherId, classId: o.classId, studentId: o.studentId } : null; },
  forgetPass: async p => { passes.delete(hash(p)); },
  getSignin: async (t, c, sid) => ({ pinShown: null, pinFails: null, pinLockedUntil: null, ...states.get(sid) }),
  setSignin: async (t, c, sid, patch) => { states.set(sid, { ...states.get(sid), ...patch }); },
  resetPin: async (t, c, sid, pin) => {
    const s = classes[c].students.find(x => x.id === sid);
    s.pin = pin;
    states.set(sid, { ...states.get(sid), pinShown: false, pinFails: 0, pinLockedUntil: 0 });
    return { ok: true, pin };
  },
};

let server, url, roomsApi;
const sockets = [];
before(async () => {
  server = http.createServer();
  const io = new Server(server);
  roomsApi = attachRooms(io, {
    verifyTeacher: async t => { if (!TEACHERS[t]) throw new AuthError(401, "token-invalid"); return TEACHERS[t]; },
    getClass: async (tid, cid) => (tid === "teacherA" && classes[cid]) || null,
    makeGame: async () => ({ tiles: Array(16).fill("A"), rots: Array(16).fill("0"), solution: { list: [], total: 0, longest: [], phonics: { tagMap: {}, bySpelling: {} } } }),
    isRealWord: async () => false,
    getStudent: async () => ({ awards: [] }),
    getWords: async () => ({ cat: 1 }),
    signin,
    now: () => clock,
    later: () => {},
  });
  await new Promise(r => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});
after(() => { sockets.forEach(s => s.close()); server.close(); });

const client = async (headers = {}) => {
  const s = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false, extraHeaders: headers });
  sockets.push(s);
  await new Promise(r => s.on("connect", r));
  return s;
};
const call = (s, ev, data) => s.emitWithAck(ev, data);
const next = (s, ev) => new Promise(r => s.once(ev, r));

test("class code: a wrong one counts as a guess, a right one shows names but never pictures", async () => {
  const kid = await client();
  assert.deepEqual(await call(kid, "student:class", { code: "NOPE99" }), { error: "no-class" });
  assert.deepEqual(await call(kid, "student:class", { code: "abc" }), { error: "no-class" });
  const out = await call(kid, "student:class", { code: "birds 34" });
  assert.equal(out.className, "3/4B");
  assert.deepEqual(out.roster, [{ id: "s1", name: "Ava" }, { id: "s2", name: "Ben" }, { id: "s3", name: "Cy" }]);
});

test("first time: pictures are only shown in class, then the device is remembered", async () => {
  const kid = await client();
  assert.deepEqual(await call(kid, "student:signin", { code: "BIRDS34", studentId: "s1" }), { error: "first-in-class" }, "no game open: no teacher in the room");

  const host = await client();
  const opened = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const first = await call(kid, "student:signin", { code: "BIRDS34", studentId: "s1" });
  assert.equal(first.ok, true);
  assert.deepEqual(first.reveal, [0, 1, 2]);
  assert.equal(first.room, opened.room.code, "the class's game is open: the device can join it");
  assert.equal(first.name, "Ava");

  // The next visit: straight in with the pass.
  const later = await client();
  const back = await call(later, "student:resume", { pass: first.pass });
  assert.deepEqual([back.ok, back.name, back.className, back.reveal], [true, "Ava", "3/4B", undefined]);
  // ...and it joins its class's game as itself, without tapping a name.
  const joined = await call(later, "player:join", { code: opened.room.code, me: true });
  assert.deepEqual([joined.ok, joined.name, joined.guest], [true, "Ava", false]);

  // A signed-in device can't use "me" in another class's game.
  const other = await client();
  const theirs = await call(other, "host:open", { idToken: "tok-a", classId: "class2" });   // replaces the 3/4B room
  assert.deepEqual(await call(later, "player:join", { code: theirs.room.code, me: true }), { error: "not-your-class" });
  await call(other, "host:close");
});

test("a new device needs the pictures, in order; five wrong means a wait", async () => {
  states.set("s2", { pinShown: true });
  const kid = await client();
  assert.deepEqual(await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2" }), { error: "need-pin" });
  assert.deepEqual(await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [5, 4, 3] }), { error: "wrong-pin", left: 4 });
  const ok = await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [3, 4, 5] });
  assert.deepEqual([ok.ok, ok.name, ok.reveal, ok.room], [true, "Ben", undefined, null]);

  for (let i = 0; i < 4; i++) await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [0, 1, 2] });
  const locked = await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [0, 1, 2] });
  assert.equal(locked.error, "locked");
  assert.equal((await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [3, 4, 5] })).error, "locked");
  assert.equal((await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2" })).error, "locked", "told before tapping any pictures");
  clock += 16 * 60 * 1000;
  assert.equal((await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [3, 4, 5] })).ok, true);
});

test("signed in at home: trophies and the word jar work without a game", async () => {
  states.set("s2", { pinShown: true });
  const kid = await client();
  assert.deepEqual(await call(kid, "player:words"), { error: "not-joined" });
  await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [3, 4, 5] });
  assert.deepEqual(await call(kid, "player:words"), { ok: true, bank: { cat: 1 } });
  assert.equal((await call(kid, "player:trophies")).ok, true);
});

test("tapping a name in class remembers the device; pictures are shown only the first time", async () => {
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  const kid = await client();
  const j = await call(kid, "player:join", { code: room.code, studentId: "s3", remember: true });
  assert.equal(j.ok, true);
  assert.ok(validPin(j.reveal), "Cy had no pictures (class saved before sign-in): given some and shown them");
  assert.deepEqual(CLASS.students[2].pin, j.reveal);
  assert.equal((await call(await client(), "student:resume", { pass: j.pass })).name, "Cy");

  // Another device, the same way: remembered, but the pictures aren't shown again.
  await call(kid, "player:leave");
  const kid2 = await client();
  const j2 = await call(kid2, "player:join", { code: room.code, studentId: "s3", remember: true });
  assert.ok(j2.pass);
  assert.equal(j2.reveal, null);
  // Without remember (a device that's already signed in, or the old app), nothing changes.
  assert.equal((await call(await client(), "player:join", { code: room.code, guestName: "Visitor" })).pass, undefined);
  await call(host, "host:close");
});

test("the game appearing and going away reaches signed-in devices", async () => {
  states.set("s2", { pinShown: true });
  const kid = await client();
  await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [3, 4, 5] });
  const host = await client();
  const opening = next(kid, "class:room");
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class1" });
  assert.deepEqual(await opening, { code: room.code });
  const closing = next(kid, "class:room");
  await call(host, "host:close");
  assert.deepEqual(await closing, { code: null });
});

test("signing out: by the student, by the teacher, and a cleared browser still has its cookie", async () => {
  states.set("s2", { pinShown: true });
  const kid = await client();
  const { pass } = await call(kid, "student:signin", { code: "BIRDS34", studentId: "s2", pin: [3, 4, 5] });

  // Saved pass gone (Safari cleared it), cookie still there.
  const cleared = await client({ cookie: `ws_student=${pass}` });
  assert.equal((await call(cleared, "student:resume", {})).name, "Ben");

  const told = next(kid, "student:signed-out");
  roomsApi.signedOut("teacherA", "class1", "s2", hash(pass));
  await told;
  assert.deepEqual(await call(kid, "player:words"), { error: "not-joined" });

  await call(cleared, "student:signout");
  assert.deepEqual(await call(await client(), "student:resume", { pass }), { error: "signed-out" });
  assert.deepEqual(await call(await client(), "student:resume", {}), { error: "signed-out" });
});

test("a student taken off the list can't come back with an old pass", async () => {
  states.set("s2", { pinShown: true });
  const { pass } = await call(await client(), "student:signin", { code: "BIRDS34", studentId: "s2", pin: [3, 4, 5] });
  const ben = CLASS.students.splice(1, 1);
  try {
    assert.deepEqual(await call(await client(), "student:resume", { pass }), { error: "signed-out" });
    assert.equal(passes.has(hash(pass)), false, "the pass is forgotten");
  } finally { CLASS.students.splice(1, 0, ...ben); }
});

test("joining the class's game: practise the pictures, showing at first, from memory later, then not at all", async () => {
  const host = await client();
  const { room } = await call(host, "host:open", { idToken: "tok-a", classId: "class2" });
  states.set("t1", { pinShown: true });
  const kid = await client();
  assert.equal((await call(kid, "student:signin", { code: "OWLS56", studentId: "t1", pin: [6, 7, 8] })).ok, true);
  assert.equal(states.get("t1").pinStreak, 1, "signing in with the pictures counts as remembering them");

  const join = async () => {
    const j = await call(kid, "player:join", { code: room.code, me: true });
    assert.equal(j.ok, true);
    await call(kid, "player:leave");
    return j.practice || null;
  };
  states.set("t1", { pinShown: true });
  assert.deepEqual(await join(), { pin: [6, 7, 8], mode: "shown" });
  await call(kid, "player:join", { code: room.code, me: true });
  assert.deepEqual(await call(kid, "student:practised", { mode: "shown", fromMemory: true }), { ok: true });
  assert.equal(states.get("t1").pinPractised, 1);
  await call(kid, "player:leave");

  states.set("t1", { pinShown: true, pinPractised: 3, pinStreak: 0 });
  assert.equal((await join()).mode, "memory");
  clock += 3000;
  await call(kid, "player:join", { code: room.code, me: true });
  await call(kid, "student:practised", { mode: "memory", fromMemory: true });
  assert.deepEqual([states.get("t1").pinStreak, states.get("t1").pinCheckedAt], [1, clock]);
  await call(kid, "player:leave");

  states.set("t1", { pinShown: true, pinPractised: 6, pinStreak: 3, pinCheckedAt: clock });
  assert.equal(await join(), null, "knows them: straight in");
  assert.equal((await call(await client(), "player:join", { code: room.code, guestName: "Visitor" })).practice, undefined, "guests never practise");
  await call(host, "host:close");
});
