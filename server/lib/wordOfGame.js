import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SW_WORDS } from "./phonics.js";

/*
 * Word of the game: one short, easy word that's on the board, shown at the top so every student has a word they
 * can find (it helps the students who find the fewest feel successful). It's scored like any other word.
 * Picked from the board's own answers, so it can always be found. In order of preference: a common everyday word
 * (data/common-words.txt) with today's sound, any common word, any Sounds-Write word (vetted, decodable, no names
 * or rude words), then any answer. Within that, the shortest lengths win (3 or 4 letters where the board has them).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMON = new Set(fs.readFileSync(path.join(__dirname, "..", "data", "common-words.txt"), "utf8")
  .split("\n").filter(l => !l.startsWith("#")).join(" ").split(/\s+/).filter(Boolean));
const EASY = new Set(SW_WORDS);

export function pickWordOfGame(solution, minLen, rand = Math.random) {
  const list = (solution.list || []).filter(w => w.length >= Math.max(3, minLen) && w.length <= 5);
  const common = list.filter(w => COMMON.has(w));
  const sound = solution.phonics && solution.phonics.tagMap ? new Set(Object.keys(solution.phonics.tagMap)) : null;
  for (const tier of [sound ? common.filter(w => sound.has(w)) : [], common, list.filter(w => EASY.has(w)), list]) {
    if (!tier.length) continue;
    const shortest = Math.min(...tier.map(w => w.length));
    const pool = tier.filter(w => w.length <= Math.max(shortest, 4));
    return pool[Math.floor(rand() * pool.length)];
  }
  return null;
}
