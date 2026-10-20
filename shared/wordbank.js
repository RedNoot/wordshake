/*
 * The word jar (student device only): every different word a student has found in a saved round, with when they
 * first found it. Kept on the student's document as `bank` (word -> first-found time in ms), beside the summary but
 * never part of it, so it isn't sent around with the rewards. `bankBuilt` marks a bank already filled from the
 * rounds saved before the jar existed.
 *
 * The jar fills in stages: the first jar holds 100 words, the next 150, then 250, then 300 each. A full jar goes on
 * the shelf and a new one starts, so the jar on screen never holds more than 300 marbles.
 */
export const JAR_SIZES = [100, 150, 250];
export const JAR_SIZE_AFTER = 300;

// The words in `words` that aren't in the bank yet, each with time t: { word: t }.
export function newWords(bank, words, t) {
  const out = {};
  for (const w of words || []) if (!(bank && w in bank) && !(w in out)) out[w] = t;
  return out;
}

// A bank built from saved rounds: games = [{ endedAt, players: { sid: { words } } }]; the earliest time wins.
export function bankFromGames(games, sid, bank = {}) {
  const out = { ...bank };
  for (const g of games) {
    const p = g.players && g.players[sid];
    if (!p || !g.endedAt) continue;
    for (const w of p.words || []) if (!(w in out) || g.endedAt < out[w]) out[w] = g.endedAt;
  }
  return out;
}

// Where a student is with their jars, for n words: the full jars so far (each with the word count it was full at),
// and the current jar's words and size.
export function jarsFor(n) {
  const full = [];
  let start = 0, i = 0;
  for (;;) {
    const size = i < JAR_SIZES.length ? JAR_SIZES[i] : JAR_SIZE_AFTER;
    if (n < start + size) return { full, start, inJar: n - start, size };
    full.push(start + size);
    start += size;
    i++;
  }
}

// The bank as a list, oldest first (ties by word, so the order is stable).
export const bankList = bank => Object.entries(bank || {}).map(([w, t]) => ({ w, t })).sort((a, b) => a.t - b.t || (a.w < b.w ? -1 : a.w > b.w ? 1 : 0));
