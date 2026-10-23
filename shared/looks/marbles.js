/*
 * Marble sets for the word jar (src/WordJar.jsx): how every marble looks. The drawing lives in src/jarArt.js.
 *
 * A marble set = { id, slot: "marble", name, emoji, price, unlock?, colours, finish }
 *   colours: five #RRGGBB, for words of 3, 4, 5, 6 and 7+ letters. The jar's key shows them, so they must stay
 *            easy to tell apart (test/looks.test.js checks): a set changes the look, never what the colours mean.
 *   finish:  how each marble is drawn, one of FINISHES.
 */
import { SEASONAL } from "./seasonal.js";

export const FINISHES = ["glass", "swirl", "pearl", "speckle", "glow", "gem", "metal", "bauble"];

const marble = (id, name, emoji, price, colours, finish, unlock) =>
  ({ id, slot: "marble", name, emoji, price, colours, finish, ...(unlock ? { unlock } : {}) });

// The default (nothing worn): the jar's own rainbow, in plain glass.
export const DEFAULT_MARBLES = { colours: ["#4FA3F7", "#57C785", "#FFB020", "#FF6F91", "#B48CFF"], finish: "glass" };

const BASE_MARBLES = [
  marble("marbles-sea-glass", "Sea glass", "🌊", 80, ["#A6F0D8", "#3FC8D8", "#1E8BD6", "#2F55C9", "#13307A"], "glass"),
  marble("marbles-sweets", "Sweet shop", "🍬", 120, ["#FFF07A", "#9EF0C4", "#9CCBFF", "#FFA8D0", "#D3A6FF"], "pearl"),
  marble("marbles-cats-eye", "Cat's-eyes", "🌀", 160, ["#38B6FF", "#3DDC84", "#FFC93C", "#FF5E7E", "#A774FF"], "swirl"),
  marble("marbles-galaxy", "Galaxy", "🌌", 200, ["#5DA9FF", "#3ECFB2", "#B892FF", "#F25FB5", "#4A3AB8"], "speckle"),
  marble("marbles-glow", "Glow sticks", "💡", 240, ["#4DF3FF", "#7CFF6B", "#FFE94D", "#FF5CC8", "#B66BFF"], "glow"),
  marble("marbles-gems", "Gems", "💎", 300, ["#7FD8FF", "#36D17C", "#FFC233", "#F0446A", "#9B5CF6"], "gem"),
  // Won with a trophy, never sold
  marble("marbles-treasure", "Treasure", "🏅", 0, ["#E2E8EE", "#7FB3D9", "#FFD24A", "#E6957A", "#B87333"], "metal", "words-250"),
];

// Plus this slot's items from the seasonal shelves (shared/looks/seasons/).
export const MARBLES = [...BASE_MARBLES, ...SEASONAL.filter(i => i.slot === "marble")];
