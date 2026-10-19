import { findPath } from "./solver.js";
import { soundsOf } from "./phonics.js";

import { wordPoints, BONUS } from "../../shared/scoring.js";

export { wordPoints, BONUS };
export const GRACE_MS = 1500;         // a word swiped in the final second still counts if it arrives just after zero
const MAX_SUBMITS = 1000;      // per player per round; stops a script hammering the server
export const HINT_AFTER_MS = 15000;   // a student who hasn't found a word for this long can be shown one

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
    idleFrom: new Map(),         // playerId -> when they last found a word or were given a hint
    hints: new Map(),            // playerId -> { word: the current hint, count, given: Set of every hint so far }
    resumedAt: 0,                // when the clock last started or resumed: time paused doesn't count as stuck
  };
}

export function remainingMs(round, t) {
  if (round.state === "playing") return Math.max(0, round.endsAt - t);
  return round.state === "over" ? 0 : round.left;
}

export function setClock(round, state, ms, t) {
  if (state === "playing") {
    if (round.state !== "playing") round.resumedAt = t;
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
    hints: settings.hints !== false, hint: currentHint(round, playerId),
    wordOfGame: game.solution.wordOfGame || null,
    rewards: (round.rewards && round.rewards.get(playerId)) || null,
    // Teams mode: this device's team for the round, and the result once the big screen has shown it.
    team: round.teams && round.teams.of.has(playerId) ? round.teams.of.get(playerId) : null,
    teamResult: (round.teamsShown && round.teamResult) || null,
  };
}

/*
 * Teams mode: each team's score is its members' points added up (players in the room when the round started).
 * winners is every team on the top score (more than one is a draw); none if nobody scored.
 */
export function teamResults(round) {
  const teams = Array.from({ length: round.teams.count }, (_, team) => ({ team, score: 0, words: 0, players: 0 }));
  for (const [playerId, t] of round.teams.of) {
    const row = teams[t];
    if (!row || !round.eligible.has(playerId)) continue;
    row.players++;
    row.score += playerTotal(round, playerId);
    row.words += (round.found.get(playerId) || new Map()).size;
  }
  const top = Math.max(0, ...teams.filter(r => r.players).map(r => r.score));
  return { n: round.n, teams, winners: top > 0 ? teams.filter(r => r.players && r.score === top).map(r => r.team) : [] };
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
    const pts = wordPoints(word.length, round.settings.minLen);
    const bonus = round.settings.phBonus && round.tagged.has(word) ? BONUS : 0;
    mine.set(word, { pts, bonus });
    round.found.set(playerId, mine);
    round.idleFrom.set(playerId, t);
    return { result: "ok", word, pts, bonus, total: playerTotal(round, playerId) };
  }
  if (!findPath(round.game.tiles, round.settings.size, word)) return { result: "board", word };
  if (round.settings.phSound && await isRealWord(word)) return { result: "notlist", word };
  return { result: "notword", word };
}

// The hint a device should still show: none once the student has found it.
function currentHint(round, playerId) {
  const h = round.hints.get(playerId);
  return h && h.word && !(round.found.get(playerId) || new Map()).has(h.word) ? h.word : null;
}

/*
 * A stuck student asks for a hint: after HINT_AFTER_MS of play without finding a word (or since the last hint),
 * the server picks one of the shortest words on the board they haven't found yet, avoiding earlier hints where it can.
 * Results: { result: "hint", word } · { result: "wait", waitMs } · { result: "off" } · { result: "none" } · { result: "late" }
 */
export function giveHint(round, playerId, t, pick = list => list[Math.floor(Math.random() * list.length)]) {
  if (round.settings.hints === false) return { result: "off" };
  if (!round.eligible.has(playerId) || round.state !== "playing" || t >= round.endsAt) return { result: "late" };
  const since = Math.max(round.idleFrom.get(playerId) || 0, round.resumedAt);
  if (t - since < HINT_AFTER_MS - 500) return { result: "wait", waitMs: HINT_AFTER_MS - (t - since) };
  const mine = round.found.get(playerId) || new Map();
  const left = [...round.words].filter(w => w.length >= round.settings.minLen && !mine.has(w));
  if (!left.length) return { result: "none" };
  const h = round.hints.get(playerId) || { word: null, count: 0, given: new Set() };
  const fresh = left.filter(w => !h.given.has(w));
  const pool = fresh.length ? fresh : left;
  const shortest = Math.min(...pool.map(w => w.length));
  const word = pick(pool.filter(w => w.length === shortest));
  h.word = word; h.count++; h.given.add(word);
  round.hints.set(playerId, h);
  round.idleFrom.set(playerId, t);
  return { result: "hint", word };
}

/*
 * What gets saved for the teacher's progress view once a round has finished: class-list students only
 * (guests and late joiners are left out), including anyone who found nothing.
 * For a Sounds-Write round, each ticked spelling records how many board words used it ("available")
 * and which of those each student found ("bySpelling": spelling -> words), so the teacher can see "found 3 of 7 ay words".
 * Every other sound's spellings in the student's words are counted too ("spotted": sound -> spelling -> words),
 * so they add to the sticker book at a slower rate (see shared/rewards.js).
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
    const bySpelling = {}, spotted = {};
    for (const w of words) for (const g of spellingsOf.get(w) || []) (bySpelling[g] ||= []).push(w);
    if (settings.phSound) {
      for (const w of words) {
        for (const [snd, g] of soundsOf(w)) {
          if (snd === settings.phSound && (spellingsOf.get(w) || []).includes(g)) continue;  // already counted as today's sound
          const page = (spotted[snd] ||= {});
          page[g] = (page[g] || 0) + 1;
        }
      }
    }
    players[who.studentId] = {
      name: who.name, words, score: playerTotal(round, playerId),
      bonusCount: [...found.values()].filter(f => f.bonus).length, bySpelling,
      hints: (round.hints.get(playerId) || { count: 0 }).count,
      ...(settings.phSound ? { spotted } : {}),
    };
  }
  return {
    roundNo: round.n,
    settings: { seconds: settings.seconds, size: settings.size, minLen: settings.minLen, phSound: settings.phSound, phTicked: [...settings.phTicked], phBonus: settings.phBonus, hints: settings.hints !== false, wordOfGame: S.wordOfGame || null },
    tiles: game.tiles, boardWords: S.list.length,
    longest: (S.longest || []).map(x => x.word).slice(0, 3),
    available, players,
  };
}
