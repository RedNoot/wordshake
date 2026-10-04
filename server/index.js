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
import { storeReady, loadTeacher, saveSettings } from "./lib/store.js";
import { pickSettings } from "./lib/settings.js";

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

app.post("/api/game", route(async (req, res) => {
  const { size = 4, minLen = 3, phSound = null, phTicked = [] } = req.body || {};
  if (![4, 5, 6].includes(size)) return res.status(400).json({ error: "invalid size" });
  if (![2, 3, 4].includes(minLen)) return res.status(400).json({ error: "invalid minLen" });
  const soundDef = resolveSound(phSound, phTicked);
  if (soundDef === undefined) return res.status(400).json({ error: "invalid sound" });

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

  res.json(generateGame(size, minLen, words, quality, phon));
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`WordShake server listening on port ${PORT}`));
