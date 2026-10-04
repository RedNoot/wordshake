import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { QUALITY } from "./lib/dice.js";
import { generateGame } from "./lib/generate.js";
import { loadDictionary } from "./lib/dictionary.js";
import { PH_STATS, SW_WORDS, resolveSound } from "./lib/phonics.js";
import { AUTH, AuthError, verifyTeacher } from "./lib/auth.js";
import { storeReady, loadTeacher, saveSettings, listClasses, getClass, countClasses, createClass, updateClass, deleteClass } from "./lib/store.js";
import { pickSettings } from "./lib/settings.js";
import { pickClass, LIMITS } from "./lib/classes.js";
import { attachRooms } from "./lib/rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
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
async function makeGame({ size = 4, minLen = 3, phSound = null, phTicked = [] }) {
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
  return generateGame(size, minLen, words, quality, phon);
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
attachRooms(io, {
  verifyTeacher: async token => {
    if (!storeReady) throw new AuthError(503, "accounts-not-configured");
    return verifyTeacher(token);
  },
  getClass,
  makeGame,
  isRealWord,
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`WordShake server listening on port ${PORT}`));
