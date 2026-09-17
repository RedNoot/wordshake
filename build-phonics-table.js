// Build the phoneme-accurate Sounds-Write word table.
// Uses the artifact's own (audited) aligner at BUILD time; the shipped app only does lookups.
const fs = require("fs");
const src = fs.readFileSync("wordshake-workbook-v2.jsx", "utf8");
const grab = (a, b) => src.split(a)[1].split(b)[0];
(0, eval)([
  fs.readFileSync("phonics-aligner.js", "utf8"),
  "const SOUNDS = " + grab("const SOUNDS = ", ";\nconst SOUND_BY_ID") + ";",
  "globalThis.__B = { tagWord, SOUNDS, align };",
].join("\n"));
const TW = globalThis.__B.tagWord, SOUNDS = globalThis.__B.SOUNDS, align = globalThis.__B.align;

// ---- pronunciations ----
const pron = new Map();
for (const line of fs.readFileSync("cmudict.dict", "utf8").split("\n")) {
  const p = line.trim().split(/\s+/);
  if (p.length < 2) continue;
  const w = p[0].toLowerCase();
  if (!/^[a-z]+$/.test(w) || pron.has(w)) continue;
  pron.set(w, p.slice(1).map(x => x.replace(/\d/g, "")).filter(x => /^[A-Z]+$/.test(x)));
}

// ---- classroom vocabulary: frequency list + starter list + SW example words + audit essentials ----
const bl = grab('const BLOCKLIST = new Set((', ').split(" "));').replace(/["+\n]/g, " ").split(/\s+/).filter(Boolean);
const BLOCK = new Set(bl);
const enable = new Set(fs.readFileSync("enable1.txt", "utf8").split("\n").map(w => w.trim()).filter(w => /^[a-z]+$/.test(w)));
const commons = fs.readFileSync("common10k.txt", "utf8").split("\n").map(w => w.trim());
const starter = grab("const FALLBACK_WORDS = `", "`").trim().split(/\s+/);
const essentials = ("let little kettle table candle apple metal camel pencil pistol ball tall talk walk calm gone bone have gave " +
  "bead bread great team make ace ice ode eve use cube flute tube could would should school chef ship night rain play acorn " +
  "happy fly gym saw bird cow snow book moon queen bridge catch knee wrap phone thumb dogs filled jumped wanted their dollar " +
  "scissors aught caught taught bought fork more roar four warm haul when who key ski dough journey aunt minute").split(" ");
const egWords = SOUNDS.flatMap(s => s.sp.map(x => x[1])).flatMap(x => x.split(" ")).filter(w => /^[a-z]+$/.test(w));
let vocab = [...new Set([...commons, ...starter, ...essentials, ...egWords])]
  .filter(w => w.length >= 2 && w.length <= 9 && enable.has(w) && !BLOCK.has(w) && pron.has(w));
// Derived forms: every prefix/suffix pattern is GENERATED as a candidate, then kept only
// if it is a real dictionary word with its own pronunciation. Each surviving form is
// tagged from scratch by the aligner — never by inheriting the base word's tag, which
// would mis-sort babies (y->ie), houses (s->z), leaves (f->v) and making (a-e -> a).
const PREFIXES = ["un", "re", "dis", "mis", "pre", "non", "over", "under", "out", "in", "im", "sub", "de", "fore"];
const CVC = /[^aeiouwxy][aeiou][bdglmnprtfz]$/;
function derive(w) {
  const out = [];
  const dropE = /e$/.test(w) ? w.slice(0, -1) : w;
  const consY = /[^aeiou]y$/.test(w);
  const yStem = consY ? w.slice(0, -1) + "i" : w;
  const dbl = CVC.test(w) ? w + w.slice(-1) : null;
  // plural / third person
  out.push(w + "s", w + "es");
  if (consY) out.push(w.slice(0, -1) + "ies");
  if (/fe$/.test(w)) out.push(w.slice(0, -2) + "ves");
  if (/[^f]f$/.test(w)) out.push(w.slice(0, -1) + "ves");
  // past, progressive, agent, comparative
  for (const stem of [w, dropE, yStem, dbl]) {
    if (!stem) continue;
    out.push(stem + "ed", stem + "ing", stem + "er", stem + "est", stem + "y", stem + "en");
  }
  if (consY) out.push(w.slice(0, -1) + "ied");
  out.push(w + "d", w + "r", w + "st");
  // adverb / adjective / noun suffixes
  for (const stem of [w, yStem]) out.push(stem + "ly", stem + "ness", stem + "ful", stem + "less", stem + "able", stem + "ment", stem + "ish");
  out.push(dropE + "able", dropE + "ation", dropE + "ist", dropE + "ism");
  // prefixes (and prefix + the commonest suffixes)
  for (const p of PREFIXES) out.push(p + w, p + w + "s", p + w + "ed", p + w + "ing");
  return out;
}
let vocabSet = new Set(vocab);
const derived = new Set();
for (const w of vocab) for (const c of derive(w)) {
  if (c.length < 3 || c.length > 11 || vocabSet.has(c) || derived.has(c)) continue;
  if (!enable.has(c) || BLOCK.has(c) || !pron.has(c)) continue;
  derived.add(c);
}
vocab.push(...derived);
console.log("classroom vocabulary:", vocab.length, "words (" + derived.size + " derived forms)");

// ---- tag every word once, testing all sounds against a single alignment ----
const table = {}; // sound -> spelling -> [{w, starts:[..]}]
for (const s of SOUNDS) table[s.id] = {};
const TICKED = new Map(SOUNDS.map(s => [s.id, new Set(s.sp.map(x => x[0]))]));
let tagCount = 0, aligned = 0;
for (const w of vocab) {
  const ph = pron.get(w);
  const segs = align(w, ph);
  if (!segs) continue;
  aligned++;
  for (const s of SOUNDS) {
    const hits = TW(w, ph, s.id, TICKED.get(s.id), segs);
    if (!hits) continue;
    const bySp = table[s.id];
    for (const h of hits) {
      const starts = h.ranges.map(r => r[0]);
      const arr = (bySp[h.spelling] = bySp[h.spelling] || []);
      const prev = arr.find(e => e.w === w);
      if (prev) prev.starts.push(...starts); else arr.push({ w, starts });
      tagCount++;
    }
  }
}
for (const s of SOUNDS) for (const g of Object.keys(table[s.id]))
  table[s.id][g].sort((a, b2) => a.w.length - b2.w.length || (a.w < b2.w ? -1 : 1));
console.log("aligned:", aligned, "of", vocab.length, "(" + (aligned / vocab.length * 100).toFixed(1) + "%)");
console.log("total tags:", tagCount);

// ---- certification: the audit battery must hold on the TABLE itself ----
let pass = 0, fail = 0;
const IN = (sound, sp, w) => (table[sound][sp] || []).some(e => e.w === w);
const T = (cond, msg) => { cond ? pass++ : (fail++, console.log("CERT FAIL:", msg)); };
T(!IN("l", "le", "let"), "let not in /l/ le");
T(IN("l", "l", "let"), "let in /l/ l");
T(IN("l", "le", "little") && IN("l", "le", "table") && IN("l", "le", "apple"), "little/table/apple in /l/ le");
T(!IN("l", "le", "hole"), "hole not in /l/ le");
T(IN("oe", "o-e", "hole") && IN("oe", "o-e", "bone"), "hole/bone in /oe/ o-e");
T(IN("l", "al", "metal") && !IN("l", "al", "album"), "metal yes / album no for /l/ al");
T(IN("or", "al", "talk") && IN("or", "a", "ball") && !IN("or", "al", "ball"), "talk al, ball a (not al)");
T(IN("ee", "ea", "bead") && !IN("ee", "ea", "bread") && IN("e", "ea", "bread"), "bead/bread split correctly");
T(IN("ae", "ea", "great") && !IN("ee", "ea", "great"), "great is /ae/ ea");
T(IN("ae", "a-e", "make") && !IN("ae", "a-e", "have"), "make yes / have no for a-e");
T(IN("v", "ve", "have") && !IN("v", "ve", "gave"), "have ve, gave suppressed");
T(IN("n", "ne", "gone") && !IN("n", "ne", "bone"), "gone ne, bone suppressed");
T(IN("oo_book", "oul", "could"), "could in oul");
T(IN("k", "ch", "school"), "school in /k/ ch");
T(IN("ee", "y", "happy") && IN("ie", "y", "fly") && !IN("ee", "y", "fly"), "y three-way");
T(IN("d", "ed", "filled") && IN("t", "ed", "jumped") && !IN("d", "ed", "wanted"), "ed by sound");
T(IN("air", "eir", "their") && IN("er", "ar", "dollar") && IN("z", "ss", "scissors"), "new SW spellings live");
T(IN("or", "augh", "caught"), "caught in augh");
// plurals
T(IN("oy", "oi", "coins") && IN("oy", "oy", "boys"), "coins/boys tagged /oy/");
T(IN("ie", "igh", "nights") && IN("l", "le", "tables"), "nights/tables tagged");
T(!IN("l", "le", "lets"), "lets not /l/ le");
T(IN("ee", "ie", "babies") && !IN("ee", "y", "babies"), "babies is /ee/ ie, not y (stem changed)");
T(IN("ae", "a-e", "makes"), "makes keeps a-e");
// affixes
T(IN("oy", "oi", "soiled") && IN("oy", "oi", "boiling"), "soiled/boiling tagged /oy/ oi");
T(IN("ae", "a", "making") && !IN("ae", "a-e", "making"), "making is /ae/ a (drop-e), not a-e");
T(IN("oe", "o-e", "hoped"), "hoped keeps o-e");
T(IN("u", "u", "running") && IN("ee", "y", "unhappy"), "running/unhappy tagged");
T(IN("ee", "ea", "teacher") && IN("air", "air", "unfair"), "teacher/unfair tagged");
T(IN("ie", "igh", "brightest"), "brightest tagged /ie/ igh");
T(!IN("or", "ar", "art") && !IN("or", "ar", "car"), "art/car stay /ar/, not /or/");
T(IN("or", "ar", "warm"), "warm in /or/ ar");
T(!IN("or", "al", "calm"), "calm stays /ar/, not /or/ al");
T(IN("ar", "al", "calm") && IN("ar", "ar", "car"), "calm and car in /ar/");
for (const s of SOUNDS) for (const [g] of s.sp) {
  const n = (table[s.id][g] || []).length;
  if (n === 0) console.log("  note: empty spelling set", s.id, g);
}
console.log(`certification: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// ---- emit indexed encoding (shared word pool + base36 refs) + teacher CSV ----
const pool = [], poolIdx = new Map();
const ref = w => { let i = poolIdx.get(w); if (i === undefined) { i = pool.length; pool.push(w); poolIdx.set(w, i); } return i.toString(36); };
const lines = [], csv = ["sound,label,spelling,example,count,words"];
for (const s of SOUNDS) for (const [g, eg] of s.sp) {
  const entries = table[s.id][g] || [];
  const split = g.includes("-");
  lines.push(s.id + "|" + g + "|" + entries.map(e => {
    if (!split && e.starts.length === 1 && e.w.indexOf(g) === e.starts[0] && e.w.indexOf(g, e.starts[0] + 1) === -1) return ref(e.w);
    return ref(e.w) + "." + e.starts.join(".");
  }).join(" "));
  for (const e of entries) { // round-trip: decoded positions must equal the aligner's
    const omit = !split && e.starts.length === 1 && e.w.indexOf(g) === e.starts[0] && e.w.indexOf(g, e.starts[0] + 1) === -1;
    const decoded = omit ? [e.w.indexOf(g)] : e.starts.slice();
    if (decoded.join() !== e.starts.join()) { console.log("ROUND-TRIP FAIL", s.id, g, e.w); process.exit(1); }
  }
  csv.push([s.id, '"' + s.lab + '"', g, eg.split(" ")[0], entries.length, '"' + entries.map(e => e.w).join(" ") + '"'].join(","));
}
const encoded = "W|" + pool.join(" ") + "\n" + lines.join("\n");
fs.writeFileSync("phonics-table.txt", encoded);
fs.writeFileSync("/mnt/user-data/outputs/soundswrite-word-lists.csv", csv.join("\n"));
console.log("encoded table:", Math.round(encoded.length / 1024) + "KB; pool:", pool.length, "words;", tagCount, "tags");
