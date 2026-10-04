import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { attachRooms } from "../server/lib/rooms.js";
import { AuthError } from "../server/lib/auth.js";

const CLASS = { id: "class1", name: "3/4B", students: [{ id: "s1", name: "Ava" }, { id: "s2", name: "Ben" }, { id: "s3", name: "Chloe" }] };
const TEACHERS = { "tok-a": { id: "teacherA", name: "A" }, "tok-b": { id: "teacherB", name: "B" } };

let server, url, roomsApi, clock = 1_000_000;
const sockets = [];

before(async () => {
  server = http.createServer();
  const io = new Server(server);
  roomsApi = attachRooms(io, {
    verifyTeacher: async t => { if (!TEACHERS[t]) throw new AuthError(401, "token-invalid"); return TEACHERS[t]; },
    getClass: async (tid, cid) => (tid === "teacherA" && cid === "class1" ? CLASS : null),
    now: () => clock,
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
