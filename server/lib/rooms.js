import { randomBytes, randomInt } from "crypto";
import { cleanGuestName, uniqueName } from "./names.js";
import { pickRoundSettings } from "./settings.js";
import { newRound, setClock, remainingMs, playerView, checkWord, giveHint, roundRecord, teamResults, GRACE_MS } from "./round.js";
import { emptySummary } from "../../shared/rewards.js";
import { pickTheme } from "./settings.js";
import { MIN_TEAMS, MAX_TEAMS } from "../../shared/teams.js";

// No vowels, so a code can't spell a word; no 0/O or 1/I to confuse.
const CODE_CHARS = "BCDFGHJKLMNPQRSTVWXZ23456789";
const CODE_LEN = 4;
const PHASES = ["lobby", "playing", "reveal"];
const CLOCK_STATES = ["playing", "paused", "over"];
const HOST_GONE_MS = 2 * 60 * 60 * 1000;   // a room with no teacher for 2 hours is closed
const MAX_AGE_MS = 12 * 60 * 60 * 1000;    // and no room outlives a school day
const LOOKUP_FAILS = { max: 100, windowMs: 10 * 60 * 1000 }; // per school IP: room codes can't be guessed
const SAVE_RETRY_MS = [1000, 3000, 10000, 30000];      // a failed save is tried again after these waits...
const SAVE_RETRY_LATER_MS = 5 * 60 * 1000;            // ...then every 5 minutes for as long as the server runs

const newToken = () => randomBytes(16).toString("base64url");
const newCode = () => Array.from({ length: CODE_LEN }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
const normCode = c => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "") : "");
const obj = d => (d && typeof d === "object" ? d : {});

/*
 * Live rooms, held in server memory only (a restart closes every room).
 * room = { code, teacherId, hostSocket, classId, className, roster: [{ id, name }] | null,
 *          players: Map<playerId, { id, name, studentId, token, socketId }>, phase, createdAt, hostSeenAt,
 *          round: see round.js | null, roundNo, teams: null | { count, of: Map<playerId, team number> } }
 * Socket.IO rooms: host:CODE (the big screen), players:CODE (joined devices), lookup:CODE (devices on the name grid).
 */
export function attachRooms(io, {
  verifyTeacher, getClass, makeGame, isRealWord,
  saveRound = null, getStudent = null,
  now = Date.now, later = (fn, ms) => setTimeout(fn, ms),
}) {
  const rooms = new Map();
  const byTeacher = new Map();
  const lookupFails = new Map();

  const players = room => [...room.players.values()];
  const teamOf = (room, playerId) => (room.teams && room.teams.of.has(playerId) ? room.teams.of.get(playerId) : null);
  const hostView = room => ({
    code: room.code, className: room.className, phase: room.phase, theme: room.theme, teams: room.teams ? room.teams.count : 0,
    roster: room.roster && room.roster.map(s => ({ id: s.id, name: s.name })),
    players: players(room).map(p => ({ id: p.id, name: p.name, studentId: p.studentId, guest: !p.studentId, connected: !!p.socketId, team: teamOf(room, p.id) })),
  });
  const lookupView = room => ({
    code: room.code, className: room.className, phase: room.phase, theme: room.theme,
    roster: room.roster && room.roster.map(s => ({
      id: s.id, name: s.name, taken: players(room).some(p => p.studentId === s.id && p.socketId),
    })),
  });
  const notify = room => {
    io.to(`host:${room.code}`).emit("room:update", hostView(room));
    io.to(`lookup:${room.code}`).emit("room:roster", lookupView(room));
  };

  /*
   * Progress tracking: a finished class-list round is saved (with every student's rewards) exactly once.
   * A round is finished when the answers are shown (time up or End now) or when the server's own copy of the clock
   * runs out, so a lost message from the big screen (wifi blip, laptop asleep) can never drop a round.
   * The save waits out the grace window so a word swiped at zero is included, and is retried until the database
   * takes it. A round abandoned mid-way (back to the lobby, close the room) is never saved.
   */
  const unsaved = new Set();   // save jobs waiting for a retry, across every room (a closed room's round still counts)
  let saveRuns = Promise.resolve();

  const timeUp = round => round.state === "over" || (round.state === "playing" && now() >= round.endsAt);
  function finishRound(room, round = room.round, { grace = true } = {}) {
    if (!round || round.aborted || round.save || !room.classId || !saveRound) return;
    round.save = "pending";
    round.endedAt = round.state === "playing" ? Math.min(now(), round.endsAt) : now();
    if (round.state !== "over") setClock(round, "over", 0, now());
    if (grace) later(() => flushRound(room, round), GRACE_MS + 100);
    else flushRound(room, round);
  }
  // The server's own end-of-round: fires when its copy of the clock runs out, whatever the big screen did.
  function watchClock(room, round) {
    if (round.state !== "playing") return;
    later(() => {
      if (round.state === "playing" && now() >= round.endsAt && !round.aborted) {
        finishRound(room, round);
        finishTeams(room, round);
        if (room.round === round) io.to(`players:${room.code}`).emit("round:clock", { n: round.n, state: "over", remainingMs: 0 });
      }
    }, Math.max(0, round.endsAt - now()) + 50);
  }

  function flushRound(room, round) {
    if (round.save !== "pending") return;
    round.save = "saving";
    const record = roundRecord(round);
    if (round.cutShort) record.cutShort = true;
    if (!Object.keys(record.players).length) { round.save = "done"; return; }
    runSave({ room, round, record, tries: 0 });
  }
  // Saves run one after another (a round waiting on a retry doesn't hold up the rounds after it).
  function runSave(job) {
    const p = saveRuns.then(() => attemptSave(job)).catch(err => console.error("Saving a round:", err));
    saveRuns = p;
    return p;
  }
  async function attemptSave(job) {
    const { room, round, record } = job;
    let out;
    try { out = await saveRound(room.teacherId, room.classId, round.id, record, round.endedAt); }
    catch (err) { out = { error: err }; }
    if (!out || out.error) {
      job.tries++;
      const wait = SAVE_RETRY_MS[job.tries - 1] ?? SAVE_RETRY_LATER_MS;
      console.error(`Saving round ${round.n} for class ${room.classId} failed (try ${job.tries}), trying again in ${wait / 1000}s:`, out && out.error && out.error.message);
      if (job.tries === 1 || job.tries === SAVE_RETRY_MS.length + 1) tellHost(room, "round:saved", { n: round.n, ok: false, retrying: true });
      unsaved.add(job);
      later(() => { if (unsaved.delete(job)) runSave(job); }, wait);
      return;
    }
    round.save = "done";
    if (out.status === "no-class") return;   // the class was deleted mid-lesson
    tellHost(room, "round:saved", { n: round.n, ok: true });
    if (out.status === "saved") giveRewards(room, round, out.earned || {}, out.summaries || {});
  }
  const tellHost = (room, event, data) => { if (rooms.get(room.code) === room) io.to(`host:${room.code}`).emit(event, data); };

  // Each student's device hears only its own rewards, with its own updated collection for the end-of-round splash;
  // the big screen only ever gets totals, never who earned what.
  function giveRewards(room, round, bySid, summaries) {
    const tally = { trophies: 0, stickers: 0, bests: 0 };
    for (const e of Object.values(bySid)) {
      tally.trophies += e.trophies.length;
      tally.stickers += e.stickers.length;
      tally.bests += e.best.length ? 1 : 0;
    }
    round.rewards = new Map();
    for (const [playerId, who] of round.who || []) {
      if (!who.studentId || !bySid[who.studentId] || !round.eligible.has(playerId)) continue;
      const mine = { ...bySid[who.studentId], summary: summaries[who.studentId] || null };
      round.rewards.set(playerId, mine);
      const p = rooms.get(room.code) === room && room.players.get(playerId), s = p && p.socketId && io.sockets.sockets.get(p.socketId);
      if (s) s.emit("round:rewards", { n: round.n, ...mine });
    }
    tellHost(room, "round:rewards-summary", { n: round.n, ...tally });
  }

  /*
   * Teams mode. Teams are shared out evenly at random; anyone joining later goes into the smallest team.
   * Each device is told its own team whenever it changes.
   */
  function shareOutTeams(room, count) {
    const ids = players(room).map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    // Start from a random team, so with uneven numbers it isn't always the same team that gets the extra player.
    const first = randomInt(count);
    room.teams = { count, of: new Map(ids.map((id, i) => [id, (first + i) % count])) };
  }
  function addToTeam(room, playerId) {
    if (!room.teams || room.teams.of.has(playerId)) return;
    const sizes = Array(room.teams.count).fill(0);
    for (const t of room.teams.of.values()) sizes[t]++;
    room.teams.of.set(playerId, sizes.indexOf(Math.min(...sizes)));
  }
  function sendTeams(room) {
    for (const p of players(room)) {
      const s = p.socketId && io.sockets.sockets.get(p.socketId);
      if (s) s.emit("player:team", teamOf(room, p.id));
    }
  }
  // The team scores are added up once late words have had their grace window; devices see them when the big screen does.
  function finishTeams(room, round = room.round) {
    if (!round || !round.teams || round.teamResult || round.teamsPending) return;
    round.teamsPending = true;
    later(() => {
      round.teamResult = teamResults(round);
      if (room.round !== round) return;
      io.to(`host:${room.code}`).emit("round:teams", round.teamResult);
      if (round.teamsShown) io.to(`players:${room.code}`).emit("round:teams", round.teamResult);
    }, GRACE_MS + 100);
  }

  function closeRoom(room, reason = "closed") {
    // A finished round whose clock has run out is saved even if the room closes straight away.
    if (room.round && timeUp(room.round)) finishRound(room, room.round, { grace: false });
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
    addToTeam(room, p.id);
    return { ok: true, token: p.token, name: p.name, guest: !p.studentId || !room.classId, phase: room.phase, theme: room.theme, className: room.className, team: teamOf(room, p.id), round: roundFor(room, p.id) };
  }

  // The round a device should see: none in the lobby, otherwise its own view of the current round.
  const roundFor = (room, playerId) => (room.round && room.phase !== "lobby" ? playerView(room.round, playerId, now()) : null);
  const hostRound = room => room.round && {
    n: room.round.n, settings: room.round.settings, game: room.round.game, state: room.round.state, remainingMs: remainingMs(room.round, now()),
    teams: room.round.teams ? room.round.teams.count : 0, teamResult: room.round.teamResult || null,
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
    on("host:open", async ({ idToken, classId, theme }, ack) => {
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
        theme: pickTheme(theme), teams: null,
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
      // The last round ran out of time but the big screen's "answers" message never arrived: it still counts.
      if (room.round && timeUp(room.round)) finishRound(room, room.round);
      room.round = newRound(++room.roundNo, picked, game, [...room.players.keys()]);
      room.round.id = randomBytes(10).toString("hex");  // the saved round's id, so a retried save can't count it twice
      // Who played, captured now so the saved record doesn't depend on who is still in the room later.
      room.round.who = new Map(players(room).map(p => [p.id, { studentId: p.studentId, name: p.name }]));
      // The teams as they stand now; moving someone mid-round only counts from the next round.
      if (room.teams) room.round.teams = { count: room.teams.count, of: new Map(room.teams.of) };
      room.phase = "playing";
      sendRound(room);
      notify(room);
      ack({ ok: true, n: room.round.n, game, teams: room.round.teams ? room.round.teams.count : 0 });
    });

    // The big screen runs the clock; the server mirrors it so it knows when to stop accepting words.
    on("host:clock", async ({ n, state, remainingMs: ms }, ack) => {
      const room = hostRoom(socket);
      if (!room || !room.round || room.round.n !== n) return ack({ error: "no-round" });
      if (!CLOCK_STATES.includes(state)) return ack({ error: "invalid state" });
      // Once the server has ended a round (its clock ran out), it can't be reopened: what's saved is what was played.
      if (room.round.save) return ack({ error: "round-over" });
      setClock(room.round, state, ms, now());
      watchClock(room, room.round);
      io.to(`players:${room.code}`).emit("round:clock", { n, state, remainingMs: remainingMs(room.round, now()) });
      ack({ ok: true });
    });

    on("host:phase", async ({ phase }, ack) => {
      const room = hostRoom(socket);
      if (!room) return ack({ error: "no-room" });
      if (!PHASES.includes(phase)) return ack({ error: "invalid phase" });
      // Leaving a round early (back to the lobby) ends it for every device. If its time had already run out,
      // it finished normally (the "answers" message was lost), so it is saved, not thrown away.
      if (phase !== "playing" && room.round && room.round.state !== "over") {
        if (phase === "lobby" && !timeUp(room.round)) room.round.aborted = true;
        else finishRound(room);
        if (room.round.state !== "over") setClock(room.round, "over", 0, now());
      }
      if (phase === "reveal") { finishRound(room); if (!room.round || !room.round.aborted) finishTeams(room); }
      const changed = room.phase !== phase;
      room.phase = phase;
      io.to(`players:${room.code}`).emit("room:phase", phase);
      if (changed) sendRound(room);
      notify(room);
      ack({ ok: true });
    });

    // The teacher switched the look in Settings: every device in the room follows.
    on("host:theme", async ({ theme }, ack) => {
      const room = hostRoom(socket);
      if (!room) return ack({ error: "no-room" });
      room.theme = pickTheme(theme);
      io.to(`players:${room.code}`).to(`lookup:${room.code}`).emit("room:theme", room.theme);
      notify(room);
      ack({ ok: true });
    });

    // Teams mode on (2–6 teams, shared out afresh: also the Shuffle button) or off (0).
    on("host:teams", async ({ count }, ack) => {
      const room = hostRoom(socket);
      if (!room) return ack({ error: "no-room" });
      if (count === 0) room.teams = null;
      else if (Number.isInteger(count) && count >= MIN_TEAMS && count <= MAX_TEAMS) shareOutTeams(room, count);
      else return ack({ error: "invalid teams" });
      sendTeams(room);
      notify(room);
      ack({ ok: true });
    });

    on("host:team-move", async ({ playerId, team }, ack) => {
      const room = hostRoom(socket);
      if (!room || !room.teams) return ack({ error: "no-teams" });
      if (!room.players.has(playerId)) return ack({ error: "no-player" });
      if (!Number.isInteger(team) || team < 0 || team >= room.teams.count) return ack({ error: "invalid team" });
      room.teams.of.set(playerId, team);
      const p = room.players.get(playerId), s = p.socketId && io.sockets.sockets.get(p.socketId);
      if (s) s.emit("player:team", team);
      notify(room);
      ack({ ok: true });
    });

    // The big screen has reached "Which team won?": now the devices can see it too.
    on("host:teams-reveal", async ({ n }, ack) => {
      const room = hostRoom(socket);
      const round = room && room.round;
      if (!round || round.n !== n || !round.teams) return ack({ error: "no-round" });
      if (!round.teamsShown) {
        round.teamsShown = true;
        if (round.teamResult) io.to(`players:${room.code}`).emit("round:teams", round.teamResult);
      }
      ack({ ok: true });
    });

    on("host:kick", async ({ playerId }, ack) => {
      const room = hostRoom(socket);
      if (!room) return ack({ error: "no-room" });
      const p = room.players.get(playerId);
      if (!p) return ack({ error: "no-player" });
      room.players.delete(p.id);
      if (room.teams) room.teams.of.delete(p.id);
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

    // A stuck student's device asks for a hint; the server decides whether it's due and which word to show.
    on("player:hint", async ({ n }, ack) => {
      const ref = socket.data.player;
      const room = ref && rooms.get(ref.code);
      if (!room || !room.players.has(ref.id)) return ack({ error: "not-joined" });
      if (!room.round || room.round.n !== n || room.phase !== "playing") return ack({ result: "late" });
      ack(giveHint(room.round, ref.id, now()));
    });

    // A student's own trophies, stickers and teacher awards (never anyone else's).
    on("player:trophies", async (_, ack) => {
      const ref = socket.data.player;
      const room = ref && rooms.get(ref.code);
      const p = room && room.players.get(ref.id);
      if (!p) return ack({ error: "not-joined" });
      if (!p.studentId || !room.classId) return ack({ error: "guest" });
      if (socket.data.trophiesAt && now() - socket.data.trophiesAt < 2000) return ack({ error: "slow-down" });
      socket.data.trophiesAt = now();
      const saved = getStudent ? await Promise.resolve().then(() => getStudent(room.teacherId, room.classId, p.studentId)).catch(() => null) : null;
      ack({ ok: true, summary: { ...emptySummary(), ...(saved || {}), awards: (saved && saved.awards) || [] } });
    });

    // "That's not me": frees the name for its owner.
    on("player:leave", async (_, ack) => {
      const ref = socket.data.player;
      const room = ref && rooms.get(ref.code);
      const removed = room && room.players.delete(ref.id);
      if (removed && room.teams) room.teams.of.delete(ref.id);
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

  // The server is stopping (a deploy, or the host putting it to sleep): finish and save every round it can first.
  // A round still being played is saved as it stands, marked as cut short, rather than lost.
  async function shutdown() {
    for (const room of rooms.values()) {
      const round = room.round;
      if (!round || round.aborted || round.save || round.state === "countdown") continue;
      if (!timeUp(round)) round.cutShort = true;
      finishRound(room, round, { grace: false });
    }
    for (const room of rooms.values()) if (room.round && room.round.save === "pending") flushRound(room, room.round);
    for (const job of unsaved) { unsaved.delete(job); runSave(job); }
    await saveRuns;
    return unsaved.size;
  }

  function sweep() {
    const t = now();
    for (const room of [...rooms.values()]) {
      if (t - room.createdAt > MAX_AGE_MS || (!room.hostSocket && t - room.hostSeenAt > HOST_GONE_MS)) closeRoom(room, "expired");
    }
    for (const [ip, f] of lookupFails) if (f.until <= t) lookupFails.delete(ip);
  }
  const timer = setInterval(sweep, 10 * 60 * 1000);
  timer.unref();

  // A teacher gave or took away an award: tell that student's device, so an open trophy cabinet refreshes.
  function rewardsChanged(teacherId, classId, studentId) {
    const room = rooms.get(byTeacher.get(teacherId));
    if (!room || room.classId !== classId) return;
    for (const p of room.players.values()) {
      const s = p.studentId === studentId && p.socketId && io.sockets.sockets.get(p.socketId);
      if (s) s.emit("player:rewards-changed");
    }
  }

  return { rooms, sweep, rewardsChanged, shutdown };
}
