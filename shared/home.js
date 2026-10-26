// Home games (server/lib/rooms.js "home games"): the rules both the server and the screens use.

// Stars come from the first few home rounds each day; later rounds still fill the word jar and count for trophies and bests.
export const HOME_STAR_ROUNDS = 5;

// The day in Melbourne (the server's clock is UTC, where midnight falls mid-morning at school).
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" });
export const homeDay = t => DAY.format(t);

// A student's home rounds today, counting the one just played: { day, rounds, stars: whether it earns stars }.
export function countHomeRound(prev, t) {
  const day = homeDay(t);
  const rounds = (prev && prev.day === day ? prev.rounds || 0 : 0) + 1;
  return { day, rounds, stars: rounds <= HOME_STAR_ROUNDS };
}

// The boards a home game can have (a student's own, or the teacher's home game for the class).
export const HOME_SIZES = [4, 5, 6], HOME_LENGTHS = [2, 3, 4], HOME_TIMES = [60, 120, 180];
// A home board as round settings (server/lib/settings.js pickRoundSettings), or null if it isn't one of the choices.
export function homeRoundSettings(b) {
  if (!b || !HOME_SIZES.includes(b.size) || !HOME_LENGTHS.includes(b.minLen) || !HOME_TIMES.includes(b.seconds)) return null;
  return { seconds: b.seconds, size: b.size, minLen: b.minLen, phSound: null, phTicked: [], phBonus: false, hints: true, hintSeconds: 15, wordOfGame: false };
}
