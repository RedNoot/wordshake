/*
 * Found-word effects: a short burst on the student's own board when a word counts. The shop entry lives here;
 * the drawing lives in src/effects.jsx under the same id.
 *
 * An effect = { id, slot: "effect", name, emoji, price, unlock? }
 * Rules for the drawing: at most ~700ms, never covers the letters for long, pointer-events:none, and it goes
 * nowhere under prefers-reduced-motion (the .ws-root rule already stops CSS animations; a JS-driven effect must check).
 */
export const EFFECTS = [];
