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
