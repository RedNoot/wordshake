import { findPath } from "./solver.js";

// Same table as the workbook round: 1/2/3/5/11 by length.
export const wordPoints = L => (L <= 4 ? 1 : L === 5 ? 2 : L === 6 ? 3 : L === 7 ? 5 : 11);
export const BONUS = 2;
export const GRACE_MS = 1500;         // a word swiped in the final second still counts if it arrives just after zero
const MAX_SUBMITS = 1000;      // per player per round; stops a script hammering the server

/*
 * One live round in a room. The answers stay on the server; devices only ever get the letters.
 * state: countdown -> playing <-> paused -> over
 */
export function newRound(n, settings, game, playerIds) {
  const ph = game.solution.phonics;
  return {
    n, settings, game,
    words: new Set(game.solution.list),
    tagged: new Set(ph ? Object.keys(ph.tagMap) : []),
    state: "countdown", endsAt: 0, left: settings.seconds * 1000,
    found: new Map(),            // playerId -> Map(word -> { pts, bonus })
    submits: new Map(),          // playerId -> count
    eligible: new Set(playerIds), // players in the room when the round started; late joiners wait for the next one
  };
}

export function remainingMs(round, t) {
  if (round.state === "playing") return Math.max(0, round.endsAt - t);
  return round.state === "over" ? 0 : round.left;
}

export function setClock(round, state, ms, t) {
  if (state === "playing") {
    round.left = Math.max(0, Math.min(Number(ms) || 0, round.settings.seconds * 1000));
    round.endsAt = t + round.left;
  } else if (state === "paused") {
    round.left = remainingMs(round, t);
  } else {
    // Ending a running round keeps the grace window, so a word swiped as the big screen hits zero still counts.
    round.endsAt = round.state === "playing" ? Math.min(round.endsAt, t) : 0;
    round.left = 0;
  }
  round.state = state;
}

export const playerTotal = (round, playerId) => {
  let total = 0;
  for (const { pts, bonus } of (round.found.get(playerId) || new Map()).values()) total += pts + bonus;
  return total;
};

// What one device needs to draw the round: letters, timer and that student's own words. Never the answers.
export function playerView(round, playerId, t) {
  const { settings, game } = round;
  return {
    n: round.n, tiles: game.tiles, rots: game.rots, size: settings.size, minLen: settings.minLen, seconds: settings.seconds,
    phSound: settings.phSound, phTicked: settings.phTicked, phBonus: settings.phBonus,
    state: round.state, remainingMs: remainingMs(round, t), eligible: round.eligible.has(playerId),
    words: [...(round.found.get(playerId) || new Map())].map(([word, s]) => ({ word, ...s })),
    total: playerTotal(round, playerId),
    rewards: (round.rewards && round.rewards.get(playerId)) || null,
  };
}

/*
 * Checks one submitted word. Results:
 *   ok (with pts, bonus) · dupe (already found) · short · board (can't be traced) · notword
 *   notlist (a real word, but not on the Sounds-Write list this round) · wait (joined late) · paused · late · early
 */
export async function checkWord(round, playerId, raw, t, isRealWord) {
  if (!round.eligible.has(playerId)) return { result: "wait" };
  if (round.state === "countdown") return { result: "early" };
  if (round.state === "paused") return { result: "paused" };
  if (t > round.endsAt + GRACE_MS) return { result: "late" };

  const count = (round.submits.get(playerId) || 0) + 1;
  round.submits.set(playerId, count);
  if (count > MAX_SUBMITS) return { result: "late" };

  const word = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!/^[a-z]{1,40}$/.test(word)) return { result: "notword", word };
  const mine = round.found.get(playerId) || new Map();
  if (mine.has(word)) return { result: "dupe", word };
  if (word.length < round.settings.minLen) return { result: "short", word };
  if (round.words.has(word)) {
    const pts = wordPoints(word.length);
    const bonus = round.settings.phBonus && round.tagged.has(word) ? BONUS : 0;
    mine.set(word, { pts, bonus });
    round.found.set(playerId, mine);
    return { result: "ok", word, pts, bonus, total: playerTotal(round, playerId) };
  }
  if (!findPath(round.game.tiles, round.settings.size, word)) return { result: "board", word };
  if (round.settings.phSound && await isRealWord(word)) return { result: "notlist", word };
  return { result: "notword", word };
}

/*
 * What gets saved for the teacher's progress view once a round has finished: class-list students only
 * (guests and late joiners are left out), including anyone who found nothing.
 * For a Sounds-Write round, each ticked spelling records how many board words used it ("available")
 * and which of those each student found ("bySpelling": spelling -> words), so the teacher can see "found 3 of 7 ay words".
 */
export function roundRecord(round) {
  const { settings, game } = round;
  const S = game.solution, ph = S.phonics;
  const spellingsOf = new Map(), available = {};
  if (ph && settings.phSound) {
    for (const g of settings.phTicked) {
      const items = ph.bySpelling[g] || [];
      available[g] = items.length;
      for (const { word } of items) spellingsOf.set(word, [...(spellingsOf.get(word) || []), g]);
    }
  }
  const players = {};
  for (const [playerId, who] of round.who || []) {
    if (!who.studentId || !round.eligible.has(playerId)) continue;
    const found = round.found.get(playerId) || new Map();
    const words = [...found.keys()];
    const prev = players[who.studentId];
    if (prev && prev.words.length > words.length) continue;
    const bySpelling = {};
    for (const w of words) for (const g of spellingsOf.get(w) || []) (bySpelling[g] ||= []).push(w);
    players[who.studentId] = {
      name: who.name, words, score: playerTotal(round, playerId),
      bonusCount: [...found.values()].filter(f => f.bonus).length, bySpelling,
    };
  }
  return {
    roundNo: round.n,
    settings: { seconds: settings.seconds, size: settings.size, minLen: settings.minLen, phSound: settings.phSound, phTicked: [...settings.phTicked], phBonus: settings.phBonus },
    tiles: game.tiles, boardWords: S.list.length,
    longest: (S.longest || []).map(x => x.word).slice(0, 3),
    available, players,
  };
}
