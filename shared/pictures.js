/*
 * Student sign-in: the class code and the secret pictures.
 * A student is given three different pictures, in order, from these twelve (12 × 11 × 10 = 1320 possible).
 * That's small, so the server limits wrong tries per student and per device address (server/lib/signin.js).
 * Emoji must stay below U+1FA70: Windows 10 shows newer ones as boxes (test/looks.test.js checks).
 */
export const PICTURES = [
  { emoji: "🐶", name: "dog" },
  { emoji: "🐸", name: "frog" },
  { emoji: "🐢", name: "turtle" },
  { emoji: "🐙", name: "octopus" },
  { emoji: "🍕", name: "pizza" },
  { emoji: "🍎", name: "apple" },
  { emoji: "🚀", name: "rocket" },
  { emoji: "⚽", name: "ball" },
  { emoji: "🎸", name: "guitar" },
  { emoji: "🌈", name: "rainbow" },
  { emoji: "⭐", name: "star" },
  { emoji: "🌵", name: "cactus" },
];
export const PIN_LEN = 3;

export const validPin = pin => Array.isArray(pin) && pin.length === PIN_LEN && new Set(pin).size === PIN_LEN
  && pin.every(i => Number.isInteger(i) && i >= 0 && i < PICTURES.length);

// Class codes are typed by students: letters and numbers only, and longer than a 4-character game code,
// so one box on the join screen can tell the two apart.
export const CLASS_CODE_MIN = 5;
export const CLASS_CODE_MAX = 10;
export const cleanClassCode = s => (typeof s === "string" ? s.toUpperCase().replace(/[^A-Z0-9]/g, "") : "");
export const validClassCode = c => typeof c === "string" && c.length >= CLASS_CODE_MIN && c.length <= CLASS_CODE_MAX && /^[A-Z0-9]+$/.test(c);

// A suggestion for a new class's code (the teacher can change it): no vowels, so it can't spell a word; no 0/O or 1/I.
const SUGGEST_CHARS = "BCDFGHJKLMNPQRSTVWXZ23456789";
export function suggestClassCode() {
  const r = new Uint32Array(6);
  globalThis.crypto.getRandomValues(r);
  return [...r].map(n => SUGGEST_CHARS[n % SUGGEST_CHARS.length]).join("");
}
