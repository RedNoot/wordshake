import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { neighborsFor } from "./solver.js";
import { BLOCKLIST } from "./blocklist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Certified Sounds-Write word table (built offline from pronunciation-aligned data;
   regenerate with build-phonics-table.js). The app only ever looks words up here.
   Loaded from disk at server start instead of embedding it in the bundle. */
const PHONICS_TABLE_SRC = fs.readFileSync(path.join(__dirname, "..", "data", "phonics-table.txt"), "utf8");

const PH_TABLE = {};   // sound -> spelling -> Map(word -> highlight ranges)
export const PH_LISTS = {};   // sound -> spelling -> [{w, ranges}] shortest-first (seed words)
const _phWords = new Set(); let _phTags = 0;
{
  const rows = PHONICS_TABLE_SRC.split("\n");
  const POOL = rows[0].slice(2).split(" ");          // shared word pool, referenced by base36 index
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    if (!line) continue;
    const bar1 = line.indexOf("|"), bar2 = line.indexOf("|", bar1 + 1);
    const sound = line.slice(0, bar1), sp = line.slice(bar1 + 1, bar2), rest = line.slice(bar2 + 1);
    const split = sp.includes("-");
    const m = new Map(), list = [];
    if (rest) for (const tok of rest.split(" ")) {
      const dot = tok.indexOf(".");
      const w = POOL[parseInt(dot === -1 ? tok : tok.slice(0, dot), 36)];
      const starts = dot === -1 ? [w.indexOf(sp)] : tok.slice(dot + 1).split(".").map(Number);
      let ranges;
      if (split) { ranges = []; for (let i = 0; i + 1 < starts.length; i += 2) ranges.push([starts[i], starts[i] + 1], [starts[i + 1], starts[i + 1] + 1]); }
      else ranges = starts.map(s0 => [s0, s0 + sp.length]);
      m.set(w, ranges); list.push({ w, ranges });
      _phWords.add(w); _phTags++;
    }
    (PH_TABLE[sound] = PH_TABLE[sound] || {})[sp] = m;
    (PH_LISTS[sound] = PH_LISTS[sound] || {})[sp] = list;
  }
}
// Re-screened so blocklist additions apply without regenerating the table.
export const SW_WORDS = [..._phWords].filter(w => !BLOCKLIST.has(w));
export const PH_STATS = { words: SW_WORDS.length, tags: _phTags };
export function tagLookup(word, soundId, ticked) {
  const bySp = PH_TABLE[soundId];
  if (!bySp) return null;
  const hits = [];
  for (const g of ticked) { const m = bySp[g], r = m && m.get(word); if (r) hits.push({ spelling: g, ranges: r }); }
  return hits.length ? hits : null;
}

/* ---- Sounds-Write sounds & spellings (primary = "first spellings", ticked by default) ---- */
export const SOUNDS = [
  // Initial Code vowels
  { id:"a", lab:"/a/", eg:"cat", grp:"icv", sp:[["a","cat",1]] },
  { id:"e", lab:"/e/", eg:"peg", grp:"icv", sp:[["e","peg",1],["ea","head",0],["ai","said",0]] },
  { id:"i", lab:"/i/", eg:"tin", grp:"icv", sp:[["i","tin",1],["y","gym",0],["ui","build",0]] },
  { id:"o", lab:"/o/", eg:"hot", grp:"icv", sp:[["o","hot",1],["a","want",0]] },
  { id:"u", lab:"/u/", eg:"cup", grp:"icv", sp:[["u","cup",1],["o","son",0],["ou","touch",0]] },
  // Extended Code vowels (Sounds-Write sequence)
  { id:"ae", lab:"/ae/", eg:"rain", grp:"ecv", sp:[["ai","rain",1],["ay","play",1],["ea","great",1],["a-e","make",1],["a","acorn",0],["ey","they",0],["ei","vein",0],["eigh","eight",0]] },
  { id:"ee", lab:"/ee/", eg:"team", grp:"ecv", sp:[["ee","see",1],["ea","team",1],["e","me",1],["e-e","these",1],["y","happy",1],["ie","chief",1],["ey","key",0],["i","ski",0]] },
  { id:"oe", lab:"/oe/", eg:"boat", grp:"ecv", sp:[["o","no",1],["oa","boat",1],["o-e","bone",1],["ow","snow",1],["oe","toe",1],["ou","shoulder",1],["ough","dough",0]] },
  { id:"er", lab:"/er/", eg:"her", grp:"ecv", sp:[["er","her",1],["ir","bird",1],["ur","turn",1],["or","word",1],["ear","learn",0],["ar","dollar",0],["our","journey",0]] },
  { id:"ow", lab:"/ow/", eg:"cow", grp:"ecv", sp:[["ou","cloud",1],["ow","cow",1]] },
  { id:"oo_moon", lab:"/oo/ moon", eg:"moon", grp:"ecv", sp:[["oo","moon",1],["ue","blue",1],["ew","flew",1],["u-e","flute",1],["ou","soup",1],["o","do",0],["ui","fruit",0]] },
  { id:"ie", lab:"/ie/", eg:"night", grp:"ecv", sp:[["i","find",1],["igh","night",1],["y","fly",1],["ie","pie",1],["i-e","time",1]] },
  { id:"oo_book", lab:"/oo/ book", eg:"book", grp:"ecv", sp:[["oo","book",1],["u","put",1],["oul","could",1]] },
  { id:"oy", lab:"/oy/", eg:"boy", grp:"ecv", sp:[["oy","boy",1],["oi","coin",1]] },
  { id:"or", lab:"/or/", eg:"fork", grp:"ecv", sp:[["or","fork",1],["aw","saw",1],["a","ball",1],["ar","warm",1],["au","haul",1],["al","talk",1],["ore","more",0],["oar","roar",0],["our","four",0],["augh","caught",0],["ough","bought",0]] },
  { id:"air", lab:"/air/", eg:"hair", grp:"ecv", sp:[["air","hair",1],["are","care",1],["ear","bear",1],["ere","there",0],["eir","their",0],["ayer","prayer",0]] },
  { id:"ar", lab:"/ar/", eg:"car", grp:"ecv", sp:[["ar","car",1],["a","father",0],["al","calm",0],["au","aunt",0]] },
  { id:"ue", lab:"/ue/", eg:"cube", grp:"ecv", sp:[["u-e","cube",1],["ue","rescue",1],["ew","few",1],["u","unit",1]] },
  { id:"eer", lab:"/eer/", eg:"deer", grp:"ecv", sp:[["eer","deer",1],["ere","here",1],["ear","hear",1]] },
  // Consonant sounds
  { id:"s", lab:"/s/", eg:"sun", grp:"con", sp:[["s","sun",1],["ss","dress",1],["c","city",0],["ce","dance",0],["se","house",0],["sc","science",0],["st","listen",0]] },
  { id:"z", lab:"/z/", eg:"zip", grp:"con", sp:[["z","zip",1],["zz","buzz",1],["s","dogs",0],["se","cheese",0],["ze","sneeze",0],["ss","scissors",0]] },
  { id:"f", lab:"/f/", eg:"fan", grp:"con", sp:[["f","fan",1],["ff","cliff",1],["ph","phone",0],["gh","laugh",0]] },
  { id:"v", lab:"/v/", eg:"van", grp:"con", sp:[["v","van",1],["ve","have",1]] },
  { id:"k", lab:"/k/", eg:"kit", grp:"con", sp:[["c","cat",1],["k","kit",1],["ck","duck",1],["ch","school",0],["cc","soccer",0]] },
  { id:"g", lab:"/g/", eg:"go", grp:"con", sp:[["g","go",1],["gg","egg",1],["gu","guest",0],["gh","ghost",0]] },
  { id:"j", lab:"/j/", eg:"jam", grp:"con", sp:[["j","jam",1],["g","gem",0],["ge","large",0],["dge","bridge",0]] },
  { id:"d", lab:"/d/", eg:"dog", grp:"con", sp:[["d","dog",1],["dd","add",1],["ed","filled",0]] },
  { id:"t", lab:"/t/", eg:"tap", grp:"con", sp:[["t","tap",1],["tt","little",1],["ed","jumped",0],["bt","doubt",0],["te","minute",0]] },
  { id:"m", lab:"/m/", eg:"map", grp:"con", sp:[["m","map",1],["mm","hammer",1],["mb","thumb",0]] },
  { id:"n", lab:"/n/", eg:"net", grp:"con", sp:[["n","net",1],["nn","funny",1],["kn","knee",0],["gn","gnat",0],["ne","gone",0]] },
  { id:"ng", lab:"/ng/", eg:"ring", grp:"con", sp:[["ng","ring",1]] },
  { id:"l", lab:"/l/", eg:"leg", grp:"con", sp:[["l","leg",1],["ll","bell",1],["le","little",0],["al","metal",0],["el","camel",0],["il","pencil",0]] },
  { id:"r", lab:"/r/", eg:"run", grp:"con", sp:[["r","run",1],["rr","carrot",1],["wr","wrap",0],["rh","rhyme",0]] },
  { id:"h", lab:"/h/", eg:"hat", grp:"con", sp:[["h","hat",1],["wh","who",0]] },
  { id:"w", lab:"/w/", eg:"wet", grp:"con", sp:[["w","wet",1],["wh","when",1]] },
  { id:"sh", lab:"/sh/", eg:"ship", grp:"con", sp:[["sh","ship",1],["ch","chef",0],["ti","station",0],["ci","special",0]] },
  { id:"ch", lab:"/ch/", eg:"chip", grp:"con", sp:[["ch","chip",1],["tch","catch",1]] },
  { id:"th", lab:"/th/", eg:"thin", grp:"con", sp:[["th","thin + then",1]] },
  { id:"kw", lab:"/kw/", eg:"queen", grp:"con", sp:[["qu","queen",1]] },
];
export const SOUND_BY_ID = Object.fromEntries(SOUNDS.map(s => [s.id, s]));
export const PH_THRESH = { 4: 6, 5: 9, 6: 12 };

/* ---- spelling-only fallback tagger (no pronunciation data) ---- */
export function tagSolution(list, phon) {
  const bySpelling = {}, tagMap = {};
  let count = 0;
  for (const w of list) {
    const hits = tagLookup(w, phon.soundId, phon.ticked);
    if (!hits) continue;
    count++;
    const allRanges = [];
    for (const h of hits) {
      (bySpelling[h.spelling] = bySpelling[h.spelling] || []).push({ word: w, ranges: h.ranges });
      for (const r of h.ranges) allRanges.push(r);
    }
    tagMap[w] = allRanges;
  }
  return { bySpelling, tagMap, count, approx: false };
}

/* ---- coverage seeding: pick the shortest table word proving a spelling, plant it as a chain ---- */
const _seedCache = new Map();
export function findSeedWord(minLen, soundId, g, dictSet) {
  const key = soundId + "|" + g + "|" + minLen;
  if (_seedCache.has(key)) return _seedCache.get(key);
  let found = null;
  for (const e of (PH_LISTS[soundId] && PH_LISTS[soundId][g]) || []) {
    const w = e.w;
    if (w.length < minLen || w.length > 6 || !dictSet.has(w)) continue;
    let tiles;
    if (g.includes("-")) tiles = w.split("").map(c => c.toUpperCase());
    else {
      const [s, e2] = e.ranges[0];
      tiles = [...w.slice(0, s).split(""), w.slice(s, e2), ...w.slice(e2).split("")].filter(Boolean).map(t => t[0].toUpperCase() + t.slice(1));
    }
    found = { word: w, tiles };
    break;
  }
  _seedCache.set(key, found);
  return found;
}
export function placeChain(tiles, size, chain) {
  const nbrs = neighborsFor(size);
  for (let attempt = 0; attempt < 40; attempt++) {
    const path = [Math.floor(Math.random() * tiles.length)];
    while (path.length < chain.length) {
      const opts = nbrs[path[path.length - 1]].filter(j => !path.includes(j));
      if (!opts.length) break;
      path.push(opts[Math.floor(Math.random() * opts.length)]);
    }
    if (path.length === chain.length) {
      for (let k = 0; k < chain.length; k++) tiles[path[k]] = chain[k];
      return tiles;
    }
  }
  return null;
}
