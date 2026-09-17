import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { QUALITY } from "./lib/dice.js";
import { generateGame } from "./lib/generate.js";
import { loadDictionary } from "./lib/dictionary.js";
import { PH_STATS } from "./lib/phonics.js";

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

  const dict = await dictPromise;
  const quality = QUALITY[dict.status === "full" ? "full" : "fallback"][size];
  const phon = phSound && phTicked.length ? { soundId: phSound, ticked: new Set(phTicked) } : null;

  const game = generateGame(size, minLen, dict.words, quality, phon);
  res.json(game);
});

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`WordShake server listening on port ${PORT}`));
