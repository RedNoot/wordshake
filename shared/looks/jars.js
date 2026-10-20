/*
 * Jars for the word jar (src/WordJar.jsx): the glass the marbles roll around in. The shape here is also the physics,
 * so it's shared; the lid and decorations are drawn in src/jarArt.js under the same id.
 *
 * A jar = { id, slot: "jar", name, emoji, price, unlock?, shape, tint }
 *   shape: the inside edge's left side, top to bottom, as [x, y] fractions of a 4:5 box (x up to 0.5, y always going
 *          down). The right side is its mirror image, and the bottom joins the two last points. The top stays open
 *          (between the two first points) so new words can drop in; a lid or cap is drawn over it.
 *   tint:  the glass colour (#RRGGBB), laid thinly over the page behind the marbles.
 * Keep shapes bulging outwards: a side that pinches in could trap marbles in a pocket.
 */
import { SEASONAL } from "./seasonal.js";
import { arc } from "./kit.js";

const jar = (id, name, emoji, price, shape, tint, unlock) =>
  ({ id, slot: "jar", name, emoji, price, shape, tint, ...(unlock ? { unlock } : {}) });

// The default (nothing worn): a plain glass jar.
export const DEFAULT_JAR = { id: "glass", shape: [[0.32, 0], [0.32, 0.08], [0.1, 0.16], [0.05, 0.24], [0.05, 0.9], [0.13, 0.975]], tint: "#FFFFFF" };

const BASE_JARS = [
  jar("jar-fishbowl", "Fishbowl", "🐠", 60, [[0.29, 0.18], [0.3, 0.25], ...arc(0.6, 0.46, 0.5, Math.PI * 0.9)], "#4FC3F7"),
  jar("jar-honey", "Honey pot", "🍯", 60, [[0.3, 0.12], [0.3, 0.2], [0.13, 0.29], [0.06, 0.43], [0.06, 0.8], [0.12, 0.92], [0.22, 0.975]], "#FFB020"),
  jar("jar-cookie", "Cookie jar", "🍪", 80, [[0.24, 0.16], [0.24, 0.22], [0.09, 0.27], [0.06, 0.32], [0.06, 0.93], [0.11, 0.975]], "#F3C58B"),
  jar("jar-rocket", "Rocket", "🚀", 120, [[0.37, 0.15], [0.27, 0.25], [0.21, 0.36], [0.2, 0.48], [0.2, 0.78], [0.27, 0.86]], "#9FB7FF"),
  // Won with a trophy, never sold
  jar("jar-crystal", "Crystal jar", "🔷", 0, [[0.3, 0.05], [0.3, 0.12], [0.1, 0.25], [0.08, 0.5], [0.1, 0.8], [0.27, 0.975]], "#B8E6FF", "weeks-10"),
];

// Plus this slot's items from the seasonal shelves (shared/looks/seasons/).
export const JARS = [...BASE_JARS, ...SEASONAL.filter(i => i.slot === "jar")];
