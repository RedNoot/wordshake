/*
 * The seasonal shelves: a few extra shop items that can only be bought around a holiday. Anything bought stays
 * the student's for good and can be worn all year (nothing expires); only buying waits for the season.
 * The server decides what's open (by its own clock, never the device's); the Shop is told which seasons are open.
 */
export const SEASONS = [
  { id: "halloween", name: "Halloween", emoji: "🎃", when: "in October" },
  { id: "christmas", name: "Christmas", emoji: "🎄", when: "in December" },
  { id: "easter", name: "Easter", emoji: "🐣", when: "around Easter" },
];
export const SEASON_BY_ID = Object.fromEntries(SEASONS.map(s => [s.id, s]));

const DAY = 86400000;
// The date in Australian time (shifted 12 hours from UTC, as weekKey in rewards.js), as a UTC-midnight time.
const ausDay = t => { const x = new Date(t + 12 * 3600 * 1000); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };

// Easter Sunday of a year (Gregorian calendar, the "anonymous" algorithm), as a UTC-midnight time.
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

// Whether a season's shelf is open at time t: Halloween all October, Christmas all December,
// Easter from two weeks before Easter Sunday to a week after.
export function seasonOpen(id, t) {
  const day = ausDay(t), month = new Date(day).getUTCMonth();
  if (id === "halloween") return month === 9;
  if (id === "christmas") return month === 11;
  if (id === "easter") { const e = easterSunday(new Date(day).getUTCFullYear()); return day >= e - 14 * DAY && day <= e + 7 * DAY; }
  return false;
}
export const openSeasons = t => SEASONS.filter(s => seasonOpen(s.id, t)).map(s => s.id);
