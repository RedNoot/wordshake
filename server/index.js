import express from "express";
import { pickWordOfGame } from "./lib/wordOfGame.js";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { QUALITY } from "./lib/dice.js";
import { generateGame } from "./lib/generate.js";
import { loadDictionary } from "./lib/dictionary.js";
import { PH_STATS, SW_WORDS, resolveSound } from "./lib/phonics.js";
import { AUTH, AuthError, verifyTeacher } from "./lib/auth.js";
import { storeReady, loadTeacher, saveSettings, listClasses, getClass, countClasses, createClass, updateClass, deleteClass, saveRound, listGames, deleteGame, GAMES_SHOWN,
  getStudent, getWords, listSummaries, addAward, removeAward, buyItem, equipItem, liveRoomStore } from "./lib/store.js";
import { AWARD_PRESETS, CUSTOM_AWARD_EMOJI, AWARD_LABEL_MAX, AWARDS_MAX } from "../shared/rewards.js";
import { randomBytes } from "crypto";
import { pickSettings } from "./lib/settings.js";
import { pickClass, LIMITS } from "./lib/classes.js";
import { attachRooms } from "./lib/rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/*
 * Crash reports from the app's error screen, so a problem in a lesson shows up in the server log.
 * Open to anyone, so: tiny bodies only, a few per device per 10 minutes, and only short plain text is logged.
 */
const reportsFrom = new Map();
app.post("/api/client-error", express.json({ limit: "4kb" }), (req, res) => {
  const ip = (req.get("x-forwarded-for") || req.ip || "").split(",")[0].trim(), t = Date.now();
  const r = reportsFrom.get(ip);
  if (!r || r.until <= t) reportsFrom.set(ip, { count: 1, until: t + 10 * 60 * 1000 });
  else if (++r.count > 20) return res.status(429).end();
  if (reportsFrom.size > 5000) for (const [k, v] of reportsFrom) if (v.until <= t) reportsFrom.delete(k);
  const text = (v, n) => (typeof v === "string" ? v : "").replace(/[^\x20-\x7E\n]/g, "?").slice(0, n);
  const { kind, message, stack, page } = req.body || {};
  console.error(`Client ${text(kind, 10)} on ${text(page, 40)}: ${text(message, 300)}\n${text(stack, 1500)}`);
  res.status(204).end();
});

app.use(express.json());

// Kick off the dictionary load immediately so the first /api/game call doesn't stall.
const dictPromise = loadDictionary();

// Express 4 doesn't catch rejected promises, and an unhandled one would stop the server for every class.
const route = handler => (req, res) => handler(req, res).catch(e => {
  console.error(e);
  if (!res.headersSent) res.status(500).json({ error: "server-error" });
});

const teacherRoute = handler => route(async (req, res) => {
  if (!storeReady) return res.status(503).json({ error: "accounts-not-configured" });
  let teacher;
  try {
    teacher = await verifyTeacher((req.get("authorization") || "").replace(/^Bearer /, ""));
  } catch (e) {
    if (e instanceof AuthError) return res.status(e.status).json({ error: e.code });
    throw e;
  }
  await handler(req, res, teacher);
});

app.get("/api/status", route(async (req, res) => {
  const dict = await dictPromise;
  res.json({
    dictStatus: dict.status, dictCount: dict.words.length, phonicsStats: PH_STATS,
    accounts: storeReady && !!AUTH.firebase.apiKey,
  });
}));

// Builds a board and its answers, or returns { error } for bad settings.
async function makeGame({ size = 4, minLen = 3, phSound = null, phTicked = [], wordOfGame = false }) {
  if (![4, 5, 6].includes(size)) return { error: "invalid size" };
  if (![2, 3, 4].includes(minLen)) return { error: "invalid minLen" };
  const soundDef = resolveSound(phSound, phTicked);
  if (soundDef === undefined) return { error: "invalid sound" };

  // A target sound switches the whole round to the Sounds-Write word list; Off uses the full dictionary.
  let words, quality;
  if (soundDef) {
    words = SW_WORDS;
    quality = QUALITY.soundswrite[size];
  } else {
    const dict = await dictPromise;
    words = dict.words;
    quality = QUALITY[dict.status === "full" ? "full" : "fallback"][size];
  }
  const phon = soundDef && phTicked.length ? { soundId: phSound, ticked: new Set(phTicked) } : null;
  const game = generateGame(size, minLen, words, quality, phon);
  if (wordOfGame === true) game.solution.wordOfGame = pickWordOfGame(game.solution, minLen);
  return game;
}

// Any real word, used to tell a student "not on today's list" rather than "not a word" in a Sounds-Write round.
let fullDictSet = null;
const isRealWord = async w => {
  const dict = await dictPromise;
  fullDictSet ??= new Set(dict.words);
  return fullDictSet.has(w);
};

app.post("/api/game", route(async (req, res) => {
  const game = await makeGame(req.body || {});
  if (game.error) return res.status(400).json(game);
  res.json(game);
}));

app.get("/api/me", teacherRoute(async (req, res, teacher) => {
  res.json(await loadTeacher(teacher));
}));

app.put("/api/me/settings", teacherRoute(async (req, res, teacher) => {
  const settings = pickSettings(req.body);
  if (!settings) return res.status(400).json({ error: "invalid settings" });
  await saveSettings(teacher.id, settings);
  res.json({ ok: true });
}));

/* ---- class lists ---- */
const validClassId = id => /^[A-Za-z0-9]{1,40}$/.test(id);

app.get("/api/classes", teacherRoute(async (req, res, teacher) => {
  res.json(await listClasses(teacher.id));
}));

app.post("/api/classes", teacherRoute(async (req, res, teacher) => {
  if (await countClasses(teacher.id) >= LIMITS.classes) return res.status(400).json({ error: "too-many-classes" });
  const cls = pickClass(req.body);
  if (cls.error) return res.status(400).json(cls);
  res.json(await createClass(teacher.id, cls));
}));

app.put("/api/classes/:id", teacherRoute(async (req, res, teacher) => {
  const existing = validClassId(req.params.id) && await getClass(teacher.id, req.params.id);
  if (!existing) return res.status(404).json({ error: "class-not-found" });
  const cls = pickClass(req.body, existing.students);
  if (cls.error) return res.status(400).json(cls);
  res.json(await updateClass(teacher.id, existing.id, cls));
}));

app.delete("/api/classes/:id", teacherRoute(async (req, res, teacher) => {
  if (!validClassId(req.params.id)) return res.status(404).json({ error: "class-not-found" });
  await deleteClass(teacher.id, req.params.id);
  res.json({ ok: true });
}));

/* ---- progress (teacher only): finished rounds for one class ---- */
app.get("/api/classes/:id/games", teacherRoute(async (req, res, teacher) => {
  const cls = validClassId(req.params.id) && await getClass(teacher.id, req.params.id);
  if (!cls) return res.status(404).json({ error: "class-not-found" });
  const [games, summaries] = await Promise.all([listGames(teacher.id, cls.id), listSummaries(teacher.id, cls.id)]);
  res.json({ class: cls, games, summaries, limit: GAMES_SHOWN });
}));

app.delete("/api/classes/:id/games/:gameId", teacherRoute(async (req, res, teacher) => {
  if (!validClassId(req.params.id) || !validClassId(req.params.gameId)) return res.status(404).json({ error: "not-found" });
  await deleteGame(teacher.id, req.params.id, req.params.gameId);
  res.json({ ok: true });
}));

/* ---- teacher awards: given by hand from the Progress page, shown in the student's trophy cabinet ---- */
app.post("/api/classes/:id/students/:sid/awards", teacherRoute(async (req, res, teacher) => {
  const cls = validClassId(req.params.id) && await getClass(teacher.id, req.params.id);
  if (!cls || !cls.students.some(s => s.id === req.params.sid)) return res.status(404).json({ error: "student-not-found" });
  const { preset, label } = req.body || {};
  let award;
  if (preset === "custom") {
    const text = typeof label === "string" ? label.normalize("NFC").replace(/\s+/g, " ").trim() : "";
    if (!text || text.length > AWARD_LABEL_MAX) return res.status(400).json({ error: "award-label" });
    award = { emoji: CUSTOM_AWARD_EMOJI, label: text };
  } else {
    const p = AWARD_PRESETS.find(a => a.id === preset);
    if (!p) return res.status(400).json({ error: "award-label" });
    award = { emoji: p.emoji, label: p.label };
  }
  const out = await addAward(teacher.id, cls.id, req.params.sid, { id: randomBytes(6).toString("base64url"), ...award, at: Date.now() }, AWARDS_MAX);
  if (out.error) return res.status(400).json(out);
  roomsApi.rewardsChanged(teacher.id, cls.id, req.params.sid);
  res.json(out);
}));

app.delete("/api/classes/:id/students/:sid/awards/:awardId", teacherRoute(async (req, res, teacher) => {
  const { id, sid, awardId } = req.params;
  if (![id, sid].every(validClassId) || !/^[A-Za-z0-9_-]{1,20}$/.test(awardId)) return res.status(404).json({ error: "not-found" });
  await removeAward(teacher.id, id, sid, awardId);
  roomsApi.rewardsChanged(teacher.id, id, sid);
  res.json({ ok: true });
}));

// The big screen calls this every few minutes while a room is open: Render's free plan puts the server to sleep
// after 15 minutes without a web request, and a lesson's live connection alone may not count.
app.get("/api/ping", (req, res) => res.json({ ok: true }));

app.get("/check", (req, res) => res.sendFile(path.join(__dirname, "check.html")));

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

const server = http.createServer(app);
const io = new Server(server);
io.on("connection", socket => {
  socket.on("check:ping", (sentAt, ack) => { if (typeof ack === "function") ack(sentAt); });
});
const roomsApi = attachRooms(io, {
  verifyTeacher: async token => {
    if (!storeReady) throw new AuthError(503, "accounts-not-configured");
    return verifyTeacher(token);
  },
  getClass,
  makeGame,
  isRealWord,
  // Progress tracking never gets in the way of a lesson: a failed save is retried by the room in the background.
  saveRound: async (teacherId, classId, gameId, record, endedAt) => {
    if (!storeReady) return { status: "no-class" };
    return saveRound(teacherId, classId, gameId, record, endedAt);
  },
  getStudent: async (teacherId, classId, studentId) => (storeReady ? getStudent(teacherId, classId, studentId) : null),
  getWords: async (teacherId, classId, studentId) => (storeReady ? getWords(teacherId, classId, studentId) : {}),
  // The shop: without a database there are no wallets, so nothing can be bought or worn.
  buyItem: async (...a) => (storeReady ? buyItem(...a) : { error: "no-item" }),
  equipItem: async (...a) => (storeReady ? equipItem(...a) : { error: "no-item" }),
  // Open rooms are kept in the database, so a restart (a deploy, or the free plan sleeping) doesn't close them.
  liveStore: storeReady ? liveRoomStore : null,
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`WordShake server listening on port ${PORT}`));

// Render stops the server with SIGTERM (a deploy, or the free plan going to sleep) and allows 30 seconds:
// save every finished or in-progress round before going, so a restart can't make a lesson's rounds disappear.
let stopping = false;
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    console.log(`${sig}: saving open rounds before stopping`);
    const giveUp = setTimeout(() => { console.error("Stopping before every round was saved"); process.exit(1); }, 25000);
    try {
      const left = await roomsApi.shutdown();
      if (left) console.error(`${left} round(s) could not be saved before stopping`);
    } catch (err) { console.error("Saving rounds on shutdown failed:", err); }
    clearTimeout(giveUp);
    process.exit(0);
  });
}
