import { randomBytes, randomInt } from "crypto";
import { cleanGuestName, uniqueName } from "./names.js";
import { pickRoundSettings } from "./settings.js";
import { newRound, setClock, remainingMs, playerView, checkWord, roundRecord, GRACE_MS } from "./round.js";

// No vowels, so a code can't spell a word; no 0/O or 1/I to confuse.
const CODE_CHARS = "BCDFGHJKLMNPQRSTVWXZ23456789";
const CODE_LEN = 4;
const PHASES = ["lobby", "playing", "reveal"];
const CLOCK_STATES = ["playing", "paused", "over"];
const HOST_GONE_MS = 2 * 60 * 60 * 1000;   // a room with no teacher for 2 hours is closed
const MAX_AGE_MS = 12 * 60 * 60 * 1000;    // and no room outlives a school day
const LOOKUP_FAILS = { max: 100, windowMs: 10 * 60 * 1000 }; // per school IP: room codes can't be guessed

const newToken = () => randomBytes(16).toString("base64url");
const newCode = () => Array.from({ length: CODE_LEN }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
const normCode = c => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "") : "");
const obj = d => (d && typeof d === "object" ? d : {});

/*
 * Live rooms, held in server memory only (a restart closes every room).
 * room = { code, teacherId, hostSocket, classId, className, roster: [{ id, name }] | null,
 *          players: Map<playerId, { id, name, studentId, token, socketId }>, phase, createdAt, hostSeenAt,
 *          round: see round.js | null, roundNo }
 * Socket.IO rooms: host:CODE (the big screen), players:CODE (joined devices), lookup:CODE (devices on the name grid).
 */
export function attachRooms(io, { verifyTeacher, getClass, makeGame, isRealWord, saveRound = null, now = Date.now, later = (fn, ms) => setTimeout(fn, ms) }) {
  const rooms = new Map();
  const byTeacher = new Map();
  const lookupFails = new Map();

  const players = room => [...room.players.values()];
  const hostView = room => ({
    code: room.code, className: room.className, phase: room.phase,
    roster: room.roster && room.roster.map(s => ({ id: s.id, name: s.name })),
    players: players(room).map(p => ({ id: p.id, name: p.name, studentId: p.studentId, guest: !p.studentId, connected: !!p.socketId })),
  });
  const lookupView = room => ({
    code: room.code, className: room.className, phase: room.phase,
    roster: room.roster && room.roster.map(s => ({
      id: s.id, name: s.name, taken: players(room).some(p => p.studentId === s.id && p.socketId),
    })),
  });
  const notify = room => {
    io.to(`host:${room.code}`).emit("room:update", hostView(room));
    io.to(`lookup:${room.code}`).emit("room:roster", lookupView(room));
  };

  /*
   * Progress tracking: a finished round (time up or End now, so the big screen shows the answers) is saved for
   * class-list rooms. The save waits out the grace window so a word swiped at zero is included.
   * A round abandoned mid-way (back to the lobby, quit) is never saved.
   */
  function finishRound(room) {
    const round = room.round;
    if (!round || round.aborted || round.save || !room.classId || !saveRound) return;
    round.save = "pending";
    later(() => flushRound(room, round), GRACE_MS + 100);
  }
  function flushRound(room, round) {
    if (round.save !== "pending") return;
    round.save = "done";
    const record = roundRecord(round);
    if (!Object.keys(record.players).length) return;
    Promise.resolve()
      .then(() => saveRound(room.teacherId, room.classId, record))
      .catch(err => console.error("Saving a round failed:", err.message));
  }

  function closeRoom(room, reason = "closed") {
    if (room.round && room.round.save === "pending") flushRound(room, room.round);
    io.to(`players:${room.code}`).to(`lookup:${room.code}`).emit("room:closed", reason);
    for (const r of ["host", "players", "lookup"]) io.socketsLeave(`${r}:${room.code}`);
    for (const p of players(room)) { const s = p.socketId && io.sockets.sockets.get(p.socketId); if (s) s.data.player = null; }
    rooms.delete(room.code);
    if (byTeacher.get(room.teacherId) === room.code) byTeacher.delete(room.teacherId);
  }

  function attachHost(socket, room) {
    const old = room.hostSocket && room.hostSocket !== socket.id && io.sockets.sockets.get(room.hostSocket);
    if (old) { old.emit("host:replaced"); old.leave(`host:${room.code}`); old.data.hostOf = null; }
    room.hostSocket = socket.id;
    room.hostSeenAt = now();
    socket.data.hostOf = room.code;
    socket.join(`host:${room.code}`);
  }

  function detachPlayer(socket) {
    const ref = socket.data.player;
    socket.data.player = null;
    const room = ref && rooms.get(ref.code);
    if (!room) return;
    socket.leave(`players:${room.code}`);
    const p = room.players.get(ref.id);
    if (p && p.socketId === socket.id) { p.socketId = null; notify(room); }
  }

  function attachPlayer(socket, room, p) {
    detachPlayer(socket);
    const old = p.socketId && p.socketId !== socket.id && io.sockets.sockets.get(p.socketId);
    if (old) { old.emit("room:replaced"); old.leave(`players:${room.code}`); old.data.player = null; }
    p.socketId = socket.id;
    socket.data.player = { code: room.code, id: p.id };
    socket.leave(`lookup:${room.code}`);
    socket.join(`players:${room.code}`);
    notify(room);
    return { ok: true, token: p.token, name: p.name, phase: room.phase, className: room.className, round: roundFor(room, p.id) };
  }

  // The round a device should see: none in the lobby, otherwise its own view of the current round.
  const roundFor = (room, playerId) => (room.round && room.phase !== "lobby" ? playerView(room.round, playerId, now()) : null);
  const hostRound = room => room.round && {
    n: room.round.n, settings: room.round.settings, game: room.round.game, state: room.round.state, remainingMs: remainingMs(room.round, now()),
  };
  // Each device gets its own copy (its own words, and whether it joined in time to play).
  function sendRound(room) {
    for (const p of players(room)) {
      const s = p.socketId && io.sockets.sockets.get(p.socketId);
      if (s) s.emit("round:state", roundFor(room, p.id));
    }
  }

  const clientIp = socket => (socket.handshake.headers["x-forwarded-for"] || socket.handshake.address || "").split(",")[0].trim();
  function tooManyFails(ip) {
    const f = lookupFails.get(ip);
    return f && f.until > now() && f.count >= LOOKUP_FAILS.max;
  }
  function recordFail(ip) {
    const f = lookupFails.get(ip);
    if (!f || f.until <= now()) lookupFails.set(ip, { count: 1, until: now() + LOOKUP_FAILS.windowMs });
    else f.count++;
  }

  // Every student message names a room code, so all of them count towards the guessing limit.
  const studentRoom = (socket, code) => {
    const ip = clientIp(socket);
    if (tooManyFails(ip)) return { error: "too-many" };
    const room = rooms.get(normCode(code));
    if (!room) { recordFail(ip); return { error: "no-room" }; }
    return { room };
  };

  const hostRoom = socket => {
    const room = socket.data.hostOf && rooms.get(socket.data.hostOf);
    if (room && room.hostSocket === socket.id) { room.hostSeenAt = now(); return room; }
    return null;
  };

  io.on("connection", socket => {
    // Every handler gets a validated payload and an ack it can always call; errors never reach the event loop.
    const on = (event, handler) => socket.on(event, async (...args) => {
      // A message sent with no data arrives as just the reply callback.
      const ack = args.findLast(a => typeof a === "function");
      const data = typeof args[0] === "function" ? undefined : args[0];
      const reply = ack || (() => {});
      try { await handler(obj(data), reply); }
      catch (e) {
        if (e && e.code && e.status) return reply({ error: e.code });
        console.error(`${event}:`, e);
        reply({ error: "server-error" });
      }
    });

    /* ---- the teacher's big screen ---- */
    on("host:open", async ({ idToken, classId }, ack) => {
      const teacher = await verifyTeacher(String(idToken || ""));
      let cls = null;
      if (classId != null) {
        if (typeof classId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(classId)) return ack({ error: "class-not-found" });
        cls = await getClass(teacher.id, classId);
        if (!cls) return ack({ error: "class-not-found" });
      }
      const existing = rooms.get(byTeacher.get(teacher.id));
      if (existing) closeRoom(existing, "replaced");
      let code;
      do code = newCode(); while (rooms.has(code));
      const room = {
        code, teacherId: teacher.id, hostSocket: null, classId: cls ? classId : null, className: cls ? cls.name : null,
        roster: cls ? cls.students.map(s => ({ id: s.id, name: s.name })) : null,
        players: new Map(), phase: "lobby", createdAt: now(), hostSeenAt: now(), round: null, roundNo: 0,
      };
      rooms.set(code, room);
      byTeacher.set(teacher.id, code);
      attachHost(socket, room);
      ack({ ok: true, room: hostView(room) });
    });

    // After a refresh or a dropped connection, the signed-in teacher gets their open room back.
    on("host:resume", async ({ idToken }, ack) => {
      const teacher = await verifyTeacher(String(idToken || ""));
      const room = rooms.get(byTeacher.get(teacher.id));
      if (!room) return ack({ error: "no-room" });
      attachHost(socket, room);
      ack({ ok: true, room: hostView(room), round: hostRound(room) });
    });

    // A new round: the server builds the board and keeps the answers; devices get the letters only.
    on("host:start", async ({ settings }, ack) => {
      const room = hostRoom(socket);
      if (!room) return ack({ error: "no-room" });
      const picked = pickRoundSettings(settings);
      if (!picked) return ack({ error: "invalid settings" });
      const game = await makeGame(picked);
      if (game.error) return ack({ error: game.error });
      room.round = newRound(++room.roundNo, picked, game, [...room.players.keys()]);
      // Who played, captured now so the saved record doesn't depend on who is still in the room later.
      room.round.who = new Map(players(room).map(p => [p.id, { studentId: p.studentId, name: p.name }]));
      room.phase = "playing";
      sendRound(room);
      notify(room);
      ack({ ok: true, n: room.round.n, game });
    });

    // The big screen runs the clock; the server mirrors it so it knows when to stop accepting words.
    on("host:clock", async ({ n, state, remainingMs: ms }, ack) => {
      const room = hostRoom(socket);
      if (!room || !room.round || room.round.n !== n) return ack({ error: "no-round" });
      if (!CLOCK_STATES.includes(state)) return ack({ error: "invalid state" });
      setClock(room.round, state, ms, now());
      io.to(`players:${room.code}`).emit("round:clock", { n, state, remainingMs: remainingMs(room.round, now()) });
      ack({ ok: true });
    });

    on("host:phase", async ({ phase }, ack) => {
      const room = hostRoom(socket);
      if (!room) return ack({ error: "no-room" });
      if (!PHASES.includes(phase)) return ack({ error: "invalid phase" });
      // Leaving a round early (back to the lobby) ends it for every device.
      if (phase !== "playing" && room.round && room.round.state !== "over") {
        setClock(room.round, "over", 0, now());
        if (phase !== "reveal") room.round.aborted = true;
      }
      if (phase === "reveal") finishRound(room);
      const changed = room.phase !== phase;
      room.phase = phase;
      io.to(`players:${room.code}`).emit("room:phase", phase);
      if (changed) sendRound(room);
      notify(room);
      ack({ ok: true });
    });

    on("host:kick", async ({ playerId }, ack) => {
      const room = hostRoom(socket);
      if (!room) return ack({ error: "no-room" });
      const p = room.players.get(playerId);
      if (!p) return ack({ error: "no-player" });
      room.players.delete(p.id);
      if (room.round) { room.round.found.delete(p.id); room.round.eligible.delete(p.id); room.round.who && room.round.who.delete(p.id); }
      const s = p.socketId && io.sockets.sockets.get(p.socketId);
      if (s) { s.emit("room:kicked"); s.leave(`players:${room.code}`); s.data.player = null; }
      notify(room);
      ack({ ok: true });
    });

    on("host:close", async (_, ack) => {
      const room = hostRoom(socket);
      if (room) closeRoom(room);
      socket.data.hostOf = null;
      ack({ ok: true });
    });

    /* ---- student devices ---- */
    on("player:lookup", async ({ code }, ack) => {
      const { room, error } = studentRoom(socket, code);
      if (error) return ack({ error });
      socket.join(`lookup:${room.code}`);
      ack({ ok: true, room: lookupView(room) });
    });

    on("player:join", async ({ code, studentId, guestName }, ack) => {
      const { room, error } = studentRoom(socket, code);
      if (error) return ack({ error });
      if (studentId != null) {
        const student = room.roster && room.roster.find(s => s.id === studentId);
        if (!student) return ack({ error: "no-student" });
        const existing = players(room).find(p => p.studentId === student.id);
        // One device per name. A device that dropped out can be replaced by a new one, which takes over the name.
        if (existing && existing.socketId && existing.socketId !== socket.id) return ack({ error: "already-in" });
        if (existing) { existing.token = newToken(); return ack(attachPlayer(socket, room, existing)); }
        const p = { id: newToken(), name: student.name, studentId: student.id, token: newToken(), socketId: null };
        room.players.set(p.id, p);
        return ack(attachPlayer(socket, room, p));
      }
      const clean = cleanGuestName(guestName);
      if (!clean) return ack({ error: "bad-name" });
      const taken = [...players(room).map(p => p.name), ...(room.roster || []).map(s => s.name)];
      const p = { id: newToken(), name: uniqueName(clean, taken), studentId: null, token: newToken(), socketId: null };
      room.players.set(p.id, p);
      ack(attachPlayer(socket, room, p));
    });

    // A device that joined before (saved token) comes straight back, e.g. after the iPad slept.
    on("player:rejoin", async ({ code, token }, ack) => {
      const { room, error } = studentRoom(socket, code);
      if (error) return ack({ error });
      const p = typeof token === "string" && players(room).find(x => x.token === token);
      if (!p) return ack({ error: "no-player" });
      ack(attachPlayer(socket, room, p));
    });

    on("player:word", async ({ n, word }, ack) => {
      const ref = socket.data.player;
      const room = ref && rooms.get(ref.code);
      if (!room || !room.players.has(ref.id)) return ack({ error: "not-joined" });
      // Still allowed just after the answers appear: checkWord's grace window decides whether it counts.
      if (!room.round || room.round.n !== n || room.phase === "lobby") return ack({ result: "late" });
      ack(await checkWord(room.round, ref.id, word, now(), isRealWord));
    });

    // "That's not me": frees the name for its owner.
    on("player:leave", async (_, ack) => {
      const ref = socket.data.player;
      const room = ref && rooms.get(ref.code);
      const removed = room && room.players.delete(ref.id);
      detachPlayer(socket);
      if (removed) notify(room);
      ack({ ok: true });
    });

    socket.on("disconnect", () => {
      detachPlayer(socket);
      const room = socket.data.hostOf && rooms.get(socket.data.hostOf);
      if (room && room.hostSocket === socket.id) { room.hostSocket = null; room.hostSeenAt = now(); }
    });
  });

  function sweep() {
    const t = now();
    for (const room of [...rooms.values()]) {
      if (t - room.createdAt > MAX_AGE_MS || (!room.hostSocket && t - room.hostSeenAt > HOST_GONE_MS)) closeRoom(room, "expired");
    }
    for (const [ip, f] of lookupFails) if (f.until <= t) lookupFails.delete(ip);
  }
  const timer = setInterval(sweep, 10 * 60 * 1000);
  timer.unref();

  return { rooms, sweep };
}
