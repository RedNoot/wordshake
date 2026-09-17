import { DICE } from "./dice.js";
import { rollTiles, buildTrie, filterForBoard, solve, findPath, boardIsClean } from "./solver.js";
import { tagSolution, findSeedWord, placeChain, PH_THRESH, PH_LISTS } from "./phonics.js";

/*__GEN_START__*/
export function generateGame(size, minLen, words, quality, phon) {
  const maxLen = size * size + 4;
  const evalBoard = tiles => {
    const trie = buildTrie(filterForBoard(words, tiles, minLen, maxLen));
    const found = solve(tiles, size, minLen, trie);
    const list = [...found].sort();
    const tag = phon ? tagSolution(list, phon) : null;
    const covered = phon ? [...phon.ticked].filter(g => (tag.bySpelling[g] || []).length).length : 0;
    return { tiles, list, tag, covered, score: phon ? [covered, tag.count, list.length] : [list.length] };
  };
  const better = (a, b) => { if (!b) return true; for (let i = 0; i < a.score.length; i++) if (a.score[i] !== b.score[i]) return a.score[i] > b.score[i]; return false; };

  let best = null;
  const wantCover = phon ? phon.ticked.size : 0;
  const attempts = phon ? 48 : 60;
  for (let i = 0; i < attempts; i++) {
    const tiles = rollTiles(DICE, size);
    if (!boardIsClean(tiles, size)) continue; // never even score a board a child could trace filth on
    const cand = evalBoard(tiles);
    if (better(cand, best)) best = cand;
    if (!phon && cand.list.length >= quality) { best = cand; break; }
    if (phon && cand.covered === wantCover && cand.tag.count >= PH_THRESH[size] && cand.list.length >= quality * 0.6) { best = cand; break; }
  }
  let guard = 0; // a clean board always exists — keep rolling until we hold one
  while (!best && guard++ < 300) {
    const tiles = rollTiles(DICE, size);
    if (boardIsClean(tiles, size)) best = evalBoard(tiles);
  }

  if (phon) {
    // Phase A — coverage: every ticked spelling earns at least one findable word, planted as a seed chain
    const dictSet = new Set(words);
    const unseedable = new Set();
    for (let round = 0; round < 34 && best.covered < wantCover; round++) {
      const uncovered = [...phon.ticked].filter(g => !(best.tag.bySpelling[g] || []).length && !unseedable.has(g));
      if (!uncovered.length) break;
      const g = uncovered[Math.floor(Math.random() * uncovered.length)];
      const seed = findSeedWord(minLen, phon.soundId, g, dictSet);
      if (!seed) { unseedable.add(g); continue; } // no such word exists at these settings — honest empty column
      const tiles = placeChain(best.tiles.slice(), size, seed.tiles);
      if (!tiles || !boardIsClean(tiles, size)) continue;
      const cand = evalBoard(tiles);
      if (better(cand, best)) best = cand; // covered is the first score key, so coverage is never traded away
    }
    // Phase B — quota: top up with extra sound tiles if still under the word floor
    const combos = [...phon.ticked].filter(g => !g.includes("-") && g.length >= 2);
    const singles = new Set();
    for (const g of phon.ticked) if (g.includes("-")) { singles.add(g[0].toUpperCase()); singles.add("E"); }
    for (const g of phon.ticked) if (!g.includes("-") && g.length === 1) singles.add(g.toUpperCase());
    for (let round = 0; round < 26 && best.tag.count < PH_THRESH[size]; round++) {
      if (round % 2 === 0) { // half the rounds: plant another proven table word outright
        const g2 = [...phon.ticked][Math.floor(Math.random() * phon.ticked.size)];
        const have = new Set((best.tag.bySpelling[g2] || []).map(e => e.word));
        const nxt = ((PH_LISTS[phon.soundId] && PH_LISTS[phon.soundId][g2]) || []).find(e => e.w.length >= minLen && e.w.length <= 6 && dictSet.has(e.w) && !have.has(e.w));
        if (nxt) {
          let t2;
          if (g2.includes("-")) t2 = nxt.w.split("").map(c => c.toUpperCase());
          else { const [s0, e0] = nxt.ranges[0]; t2 = [...nxt.w.slice(0, s0).split(""), nxt.w.slice(s0, e0), ...nxt.w.slice(e0).split("")].filter(Boolean).map(t => t[0].toUpperCase() + t.slice(1)); }
          const placed = placeChain(best.tiles.slice(), size, t2);
          if (placed && boardIsClean(placed, size)) {
            const c2 = evalBoard(placed);
            if (better(c2, best)) best = c2;
          }
          continue;
        }
      }
      const tiles = best.tiles.slice();
      const used = new Set();
      const put = str => { let c; do { c = Math.floor(Math.random() * tiles.length); } while (used.has(c)); used.add(c); tiles[c] = str; };
      const missing = [...singles].filter(s => !tiles.some(t => t.toUpperCase() === s));
      if (missing.length) put(missing[Math.floor(Math.random() * missing.length)]);
      const n = 1 + Math.floor(Math.random() * Math.min(3, Math.max(1, combos.length)));
      for (let k = 0; k < n && combos.length; k++) {
        const g2 = combos[Math.floor(Math.random() * combos.length)];
        put(g2[0].toUpperCase() + g2.slice(1));
      }
      if (!boardIsClean(tiles, size)) continue; // injected tiles must not create traceable filth either
      const cand = evalBoard(tiles);
      if (better(cand, best)) best = cand;
    }
  }

  const { tiles, list, tag } = best;
  const byLen = {};
  for (const w of list) (byLen[w.length] = byLen[w.length] || []).push(w);
  const lens = Object.keys(byLen).map(Number).sort((a, b) => a - b);
  const maxL = lens.length ? lens[lens.length - 1] : 0;
  const longest = (byLen[maxL] || []).slice(0, 6).map(w => ({ word: w, path: findPath(tiles, size, w) }));
  return {
    tiles,
    rots: tiles.map(() => (Math.random() * 5 - 2.5).toFixed(2)),
    solution: {
      list, byLen, lens, total: list.length, maxLen: maxL, longest,
      phonics: phon ? { soundId: phon.soundId, spellings: [...phon.ticked], covered: best.covered, ...tag } : null,
    },
  };
}
/*__GEN_END__*/
