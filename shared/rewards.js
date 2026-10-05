/*
 * The rewards catalogue, shared by the server (which decides what was earned) and the app (which shows it).
 * Rewards compare a student only with their own past, and nothing is ever taken away.
 */

// Sound stickers: a spelling's sticker appears with its first word, then turns silver and gold.
export const STICKER_TIERS = [1, 5, 15];
export const TIER_NAMES = ["", "sticker", "silver", "gold"];
export const tierOf = n => STICKER_TIERS.filter(x => n >= x).length;

export const TROPHIES = [
  { id: "first-round", emoji: "🎲", name: "Off we go", desc: "Played your first round" },
  { id: "first-word", emoji: "🌱", name: "First word", desc: "Found your first word" },
  { id: "sound-spotter", emoji: "🔤", name: "Sound spotter", desc: "Found a word with today's sound" },
  { id: "high-five", emoji: "🖐️", name: "High five", desc: "Found a 5-letter word" },
  { id: "long-word", emoji: "🦕", name: "Long-word hunter", desc: "Found a word with 7 or more letters" },
  { id: "ten-words", emoji: "🔟", name: "Ten in a round", desc: "Found 10 words in one round" },
  { id: "word-storm", emoji: "🌪️", name: "Word storm", desc: "Found 20 words in one round" },
  { id: "full-set", emoji: "🌈", name: "Full set", desc: "Found every spelling of the sound on one board" },
  { id: "sound-collector", emoji: "📚", name: "Sound collector", desc: "Stickers for 5 different sounds" },
  { id: "gold-sticker", emoji: "🥇", name: "Gold speller", desc: "Earned a gold sticker" },
  { id: "words-50", emoji: "🧺", name: "Word basket", desc: "50 words altogether" },
  { id: "words-100", emoji: "💯", name: "Hundred club", desc: "100 words altogether" },
  { id: "words-250", emoji: "🏔️", name: "Word mountain", desc: "250 words altogether" },
  { id: "weeks-5", emoji: "📅", name: "Regular", desc: "Played in 5 different weeks" },
  { id: "weeks-10", emoji: "🌟", name: "Keen bean", desc: "Played in 10 different weeks" },
];
export const TROPHY_BY_ID = Object.fromEntries(TROPHIES.map(t => [t.id, t]));

// Awards a teacher can give by hand, for things the game can't see.
export const AWARD_PRESETS = [
  { id: "effort", emoji: "💪", label: "Great effort" },
  { id: "kind", emoji: "🤝", label: "Kind teammate" },
  { id: "clever", emoji: "💡", label: "Clever find" },
  { id: "improved", emoji: "📈", label: "Big improvement" },
  { id: "focus", emoji: "🎯", label: "Super focus" },
  { id: "listening", emoji: "👂", label: "Great listening" },
];
export const CUSTOM_AWARD_EMOJI = "🏅";
export const AWARD_LABEL_MAX = 30;
export const AWARDS_MAX = 100;

export const emptySummary = () => ({ rounds: 0, words: 0, bestScore: 0, bestWords: 0, weeks: [], stickers: {}, trophies: {} });

// Monday-start week, e.g. "2026-W41", so "played in N weeks" ignores how many rounds were in a week.
// Counted in Australian time (shifted 12 hours from UTC), so a Monday-morning lesson isn't filed under the week before.
export function weekKey(t) {
  const x = new Date(t + 12 * 3600 * 1000);
  const d = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));   // the Thursday of this week decides the year
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/*
 * Folds one saved round (a player entry from roundRecord, plus the round's settings and spelling counts)
 * into a student's summary. Returns the new summary and what was earned this round:
 *   { trophies: [id], stickers: [{ sound, g, tier }], best: ["score" | "words"] }
 * Personal bests only start counting from a student's second round.
 */
export function applyRound(prev, p, round, t) {
  const s = { ...emptySummary(), ...(prev || {}) };
  s.weeks = [...s.weeks];
  s.trophies = { ...s.trophies };
  s.stickers = Object.fromEntries(Object.entries(s.stickers).map(([k, v]) => [k, { ...v }]));
  const earned = { trophies: [], stickers: [], best: [] };
  const award = id => { if (!s.trophies[id]) { s.trophies[id] = t; earned.trophies.push(id); } };

  const words = p.words || [], n = words.length, bySpelling = p.bySpelling || {};
  if (s.rounds > 0 && p.score > s.bestScore) earned.best.push("score");
  if (s.rounds > 0 && n > s.bestWords) earned.best.push("words");
  s.rounds += 1;
  s.words += n;
  s.bestScore = Math.max(s.bestScore, p.score);
  s.bestWords = Math.max(s.bestWords, n);
  const wk = weekKey(t);
  if (!s.weeks.includes(wk)) s.weeks.push(wk);

  const sound = round.settings && round.settings.phSound;
  if (sound) {
    for (const [g, ws] of Object.entries(bySpelling)) {
      if (!ws.length) continue;
      const page = (s.stickers[sound] ||= {});
      const before = tierOf(page[g] || 0);
      page[g] = (page[g] || 0) + ws.length;
      const after = tierOf(page[g]);
      if (after > before) earned.stickers.push({ sound, g, tier: after });
    }
  }

  award("first-round");
  if (n) award("first-word");
  if (sound && Object.values(bySpelling).some(ws => ws.length)) award("sound-spotter");
  if (words.some(w => w.length >= 5)) award("high-five");
  if (words.some(w => w.length >= 7)) award("long-word");
  if (n >= 10) award("ten-words");
  if (n >= 20) award("word-storm");
  const onBoard = Object.entries(round.available || {}).filter(([, k]) => k > 0);
  if (sound && onBoard.length >= 2 && onBoard.every(([g]) => (bySpelling[g] || []).length)) award("full-set");
  if (Object.values(s.stickers).filter(page => Object.values(page).some(k => k > 0)).length >= 5) award("sound-collector");
  if (Object.values(s.stickers).some(page => Object.values(page).some(k => tierOf(k) === 3))) award("gold-sticker");
  if (s.words >= 50) award("words-50");
  if (s.words >= 100) award("words-100");
  if (s.words >= 250) award("words-250");
  if (s.weeks.length >= 5) award("weeks-5");
  if (s.weeks.length >= 10) award("weeks-10");
  return { summary: s, earned };
}
