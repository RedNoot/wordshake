import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { QUALITY } from "./lib/dice.js";
import { generateGame } from "./lib/generate.js";
import { loadDictionary } from "./lib/dictionary.js";
import { PH_STATS, SW_WORDS, SOUND_BY_ID } from "./lib/phonics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// Kick off the dictionary load immediately so the first /api/game call doesn't stall.
const dictPromise = loadDictionary();

app.get("/api/status", async (req, res) => {
  const dict = await dictPromise;
  res.json({ dictStatus: dict.status, dictCount: dict.words.length, phonicsStats: PH_STATS });
});

app.post("/api/game", async (req, res) => {
  const { size = 4, minLen = 3, phSound = null, phTicked = [] } = req.body || {};
  if (![4, 5, 6].includes(size)) return res.status(400).json({ error: "invalid size" });
  if (![2, 3, 4].includes(minLen)) return res.status(400).json({ error: "invalid minLen" });
  // own-key checks: names like "__proto__" would otherwise reach the phonics lookups and crash the process
  const soundDef = phSound === null ? null : Object.hasOwn(SOUND_BY_ID, phSound) ? SOUND_BY_ID[phSound] : undefined;
  if (soundDef === undefined) return res.status(400).json({ error: "invalid sound" });
  if (!Array.isArray(phTicked) || (soundDef && !phTicked.every(g => soundDef.sp.some(s => s[0] === g)))) {
    return res.status(400).json({ error: "invalid spellings" });
  }

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
});

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`WordShake server listening on port ${PORT}`));
