import { BLOCKLIST } from "./blocklist.js";

// Names children find hilarious; not dictionary-offensive, so they aren't in BLOCKLIST.
const SILLY = new Set(("poo poos poop poops poopy poohead poophead bum bums bumhole butt butts buttface fart farts farty " +
  "willy willies wee weewee booger boogers snot").split(" "));
// Checked anywhere inside a name, so "xXfuckXx" and "bigshit" are caught. Kept short to avoid blocking real names.
const ROOTS = ["fuck", "cunt", "nigg", "shit", "bitch", "whore", "slut", "porn", "penis", "vagina", "wank", "twat", "dildo", "pussy", "boob"];
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", "@": "a", $: "s", "!": "i", "|": "i" };

export const NAME_MAX = 12;

// A guest's typed name, tidied, or null if it isn't usable as a name on the big screen.
export function cleanGuestName(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > NAME_MAX || !/^[\p{L}][\p{L}\p{M} '-]*$/u.test(name)) return null;
  return isRude(name) ? null : name;
}

export function isRude(text) {
  const plain = text.toLowerCase().replace(/[013457@$!|8]/g, c => LEET[c]);
  // Also read v as u, so "fvck" is caught.
  return [plain, plain.replace(/v/g, "u")].some(p => {
    const words = p.split(/[^a-z]+/).filter(Boolean);
    const joined = words.join("");
    const bad = w => BLOCKLIST.has(w) || SILLY.has(w);
    return words.some(bad) || bad(joined) || ROOTS.some(r => joined.includes(r));
  });
}

// "Ava" -> "Ava 2" when Ava is already taken (case-insensitive).
export function uniqueName(name, taken) {
  const lower = new Set([...taken].map(n => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) if (!lower.has(`${name} ${i}`.toLowerCase())) return `${name} ${i}`;
}
