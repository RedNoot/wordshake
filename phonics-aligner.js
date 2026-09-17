// BUILD-TIME ONLY: the audited grapheme-phoneme aligner. Generates phonics-table.txt.
// Not shipped in the app — the app uses the certified lookup table.

const GP = {
  // vowels
  a:["AE","EY","AH","AA","AO","IH","EH"], e:["EH","IY","AH","IH",""], i:["IH","AY","IY","AH","Y"],
  o:["AA","OW","AH","AO","UH","UW","W AH"], u:["AH","UW","UH","Y UW","IH","W"], y:["IY","AY","IH","Y"],
  ai:["EY","EH","IH"], ay:["EY"], ea:["IY","EH","EY","IY AH"], ee:["IY"], ey:["IY","EY"], ei:["EY","IY","AY"],
  eigh:["EY"], igh:["AY"], ie:["AY","IY","IH","AY AH"], oa:["OW"], oe:["OW","UW"], ow:["OW","AW"],
  ou:["AW","UW","AH","UH","OW","AO"], oo:["UW","UH"], oul:["UH"], ue:["UW","Y UW"], ew:["UW","Y UW"],
  au:["AO","AA","AE"], aw:["AO"], oy:["OY"], oi:["OY"], ui:["UW","IH"],
  ar:["AA R","ER","AO R"], or:["AO R","ER","AO"], er:["ER","EH R"], ir:["ER","AY R"], ur:["ER","UH R"],
  air:["EH R"], are:["EH R","AA R"], ear:["IH R","IY R","ER","EH R"], eer:["IH R","IY R"], eir:["EH R"], ayer:["EH R"],
  ere:["IH R","EH R","ER"], ore:["AO R"], oar:["AO R"], oor:["AO R","UH R"], our:["AO R","AW ER","ER"],
  ire:["AY ER","AY R"], ure:["Y ER","ER","UH R","Y UH R"], augh:["AO","AA"], ough:["AO","AA","UW","OW","AW","AH F","AO F"],
  al:["AH L","AO","AA"], el:["AH L"], il:["AH L"], le:["AH L"], ol:["AH L"],
  // consonants
  b:["B"], bb:["B"], bt:["T"], c:["K","S"], cc:["K","K S"], ce:["S"], ch:["CH","K","SH"], ci:["SH","S"],
  ck:["K"], d:["D","JH"], dd:["D"], dge:["JH"], ed:["D","T","AH D","IH D"], f:["F"], ff:["F"],
  g:["G","JH"], ge:["JH"], gg:["G"], gh:["G","F",""], gn:["N"], gu:["G"], h:["HH",""], j:["JH"],
  k:["K"], kn:["N"], l:["L"], ll:["L"], m:["M"], mb:["M"], me:["M"], mm:["M"], mn:["M"],
  n:["N","NG"], ne:["N"], ng:["NG","N JH","NG G"], nn:["N"], p:["P"], ph:["F"], pp:["P"],
  qu:["K W","K"], r:["R"], rh:["R"], rr:["R"], s:["S","Z","SH","ZH"], sc:["S","S K"], se:["Z","S"],
  sh:["SH"], si:["SH","ZH"], ss:["S","SH","Z"], st:["S"], t:["T","CH","D"], tch:["CH"], te:["T"],
  th:["TH","DH","T"], ti:["SH","CH"], tt:["T","D"], v:["V"], ve:["V"], w:["W",""], wh:["W","HH"],
  wr:["R"], x:["K S","Z","G Z"], y2:["Y"], z:["Z"], ze:["Z"], zz:["Z"],
};
const GRAPHEMES = Object.keys(GP).filter(g => g !== "y2").sort((a, b) => b.length - a.length);
for (const g of GRAPHEMES) GP[g] = GP[g].map(s => (s ? s.split(" ") : []));

/* ---- aligner: segment spelling into graphemes matching the phone sequence ---- */
const OPT_PENALTY = { "al:AO": 1, "al:AA": 1 };
function align(word, phones) {
  // cost-minimising DP: prefer parses with fewer silent letters, then fewer segments
  const memo = new Map(); // "wi:pi" -> {cost, seg, nwi, npi} | null
  function best(wi, pi) {
    if (wi === word.length) return pi === phones.length ? { cost: 0 } : null;
    const key = wi + ":" + pi;
    if (memo.has(key)) return memo.get(key);
    memo.set(key, null); // guard against cycles
    let bestRes = null;
    for (const g of GRAPHEMES) {
      if (!word.startsWith(g, wi)) continue;
      for (const opt of GP[g]) {
        if (pi + opt.length > phones.length) continue;
        let match = true;
        for (let k = 0; k < opt.length; k++) if (phones[pi + k] !== opt[k]) { match = false; break; }
        if (!match) continue;
        const sub = best(wi + g.length, pi + opt.length);
        if (!sub) continue;
        const cost = sub.cost + 1 + (opt.length === 0 ? 3 : 0) + (OPT_PENALTY[g + ":" + opt.join(".")] || 0);
        if (!bestRes || cost < bestRes.cost) bestRes = { cost, seg: { g, start: wi, end: wi + g.length, phones: opt }, nwi: wi + g.length, npi: pi + opt.length };
      }
    }
    memo.set(key, bestRes);
    return bestRes;
  }
  const first = best(0, 0);
  if (!first) return null;
  const segs = [];
  let cur = first;
  while (cur && cur.seg) { segs.push(cur.seg); cur = memo.get(cur.nwi + ":" + cur.npi); }
  return segs;
}

/* ---- Sounds-Write sound definitions (phone patterns, as sequences) ---- */
const soundPhones = {
  ae:[["EY"]], ee:[["IY"]], ie:[["AY"]], oe:[["OW"]], ue:[["Y","UW"]],
  oo_moon:[["UW"]], oo_book:[["UH"]], ow:[["AW"]], oy:[["OY"]],
  er:[["ER"]], ar:[["AA","R"],["AA"]], or:[["AO","R"],["AO"]], air:[["EH","R"]], eer:[["IH","R"],["IY","R"]],
  a:[["AE"]], e:[["EH"]], i:[["IH"]], o:[["AA"],["AO"]], u:[["AH"]],
  s:[["S"]], z:[["Z"]], f:[["F"]], v:[["V"]], k:[["K"]], g:[["G"]], j:[["JH"]], d:[["D"]], t:[["T"]],
  m:[["M"]], n:[["N"]], ng:[["NG"]], l:[["L"],["AH","L"]], r:[["R"]], h:[["HH"]], w:[["W"]], sh:[["SH"]],
  ch:[["CH"]], th:[["TH"],["DH"]], kw:[["K","W"]],
};
const phonesEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const MERGER_OR = { phones: [["AA"]], spellings: new Set(["aw", "au", "augh", "ough"]) };

/* ---- tag a word for (sound, ticked spellings) → [{spelling, ranges}] ---- */
const CE = new Set(["ce","ge","dge","le","me","ne","se","te","ve","ze"]);
const CE_SPELL = new Set(["se","ve","ze","ce","ge","dge","ne","te"]);
const isLongV = ph => (ph.length === 1 && ["EY","IY","AY","OW","UW"].includes(ph[0])) || (ph.length === 2 && ph[0] === "Y" && ph[1] === "UW");
const CONS = new Set(["b","bb","c","cc","ch","ck","d","dd","dge","f","ff","g","gg","j","k","l","ll","m","mm","n","nn","p","pp","ph","r","rr","s","ss","sh","t","tt","tch","th","v","z","zz"]);
function tagWord(word, phones, soundId, ticked, presegs) {
  const segs = presegs || align(word, phones);
  if (!segs) return null;
  const targets = soundPhones[soundId];
  const hits = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    let isTarget = targets.some(t => phonesEq(s.phones, t));
    if (!isTarget && soundId === "or" && MERGER_OR.spellings.has(s.g)) isTarget = MERGER_OR.phones.some(t => phonesEq(s.phones, t));
    if (!isTarget) continue;
    // split digraph? vowel grapheme + single consonant seg + silent final-ish e
    const splitName = s.g + "-e";
    if (ticked.has(splitName) && "aeiou".includes(s.g)) {
      const c = segs[i + 1], e = segs[i + 2];
      if (c && e && CONS.has(c.g) && c.phones.length === 1 && e.g === "e" && e.phones.length === 0) {
        hits.push({ spelling: splitName, ranges: [[s.start, s.end], [e.start, e.end]] });
        continue;
      }
      if (c && CONS.has(c.g) && c.phones.length === 1 && e && e.g === "ed") {
        // hoped/baked: the split digraph's silent e is absorbed by the <ed> suffix
        hits.push({ spelling: splitName, ranges: [[s.start, s.end], [c.end, c.end + 1]] });
        continue;
      }
      if (c && CE.has(c.g) && c.phones.length === 1) { // consonant with folded silent e: se, ve, te, ne...
        hits.push({ spelling: splitName, ranges: [[s.start, s.end], [c.end - 1, c.end]] });
        continue;
      }
    }
    if (CE_SPELL.has(s.g)) { // in "gave"/"bone" the e is the split digraph's — not part of <ve>/<ne>
      const p = segs[i - 1];
      if (p && "aeiou".includes(p.g) && isLongV(p.phones)) continue;
    }
    if (ticked.has(s.g)) hits.push({ spelling: s.g, ranges: [[s.start, s.end]] });
  }
  return hits.length ? hits : null;
}
