/*
 * Found-word effects: a short burst on the student's own board when a word counts. The shop entry lives here;
 * the drawing lives in src/effects.jsx under the same id.
 *
 * An effect = { id, slot: "effect", name, emoji, price, unlock? }
 * Rules for the drawing: at most ~700ms, never covers the letters for long, pointer-events:none, and it goes
 * nowhere under prefers-reduced-motion (the .ws-root rule already stops CSS animations; a JS-driven effect must check).
 */
import { SEASONAL } from "./seasonal.js";
const effect = (id, name, emoji, price) => ({ id, slot: "effect", name, emoji, price });

const BASE_EFFECTS = [
  effect("sparkle", "Sparkle", "✨", 80),
  effect("bubbles", "Bubbles", "🧼", 120),
  effect("stars", "Shooting stars", "⭐", 120),
  effect("hearts", "Hearts", "💖", 160),
  effect("leaves", "Falling leaves", "🍂", 160),
  effect("fireworks", "Fireworks", "🎆", 240),
];

// Plus this slot's items from the seasonal shelves (shared/looks/seasons/).
export const EFFECTS = [...BASE_EFFECTS, ...SEASONAL.filter(i => i.slot === "effect")];
