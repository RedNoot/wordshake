/*
 * What the student's Shop shows for each item, worked out from the shop rules in shared/shop.js (never re-written
 * here). Kept apart from Shop.jsx so it can be tested without a browser.
 */
import { SLOTS, ITEMS, owns, balanceOf } from "../shared/shop.js";
import { SEASONS } from "../shared/seasons.js";
import { TROPHY_BY_ID } from "../shared/rewards.js";

// The default look for each slot, shown as its own card so a student can always go back to it.
// The theme slot needs none: Classic is a real (free) item.
export const DEFAULT_CARDS = {
  dice: { id: null, slot: "dice", name: "Plain dice", emoji: "🎲", price: 0 },
  effect: { id: null, slot: "effect", name: "No sparkles", emoji: "▫️", price: 0 },
  avatar: { id: null, slot: "avatar", name: "No avatar", emoji: "🙂", price: 0 },
  cover: { id: null, slot: "cover", name: "Plain book", emoji: "📒", price: 0 },
  marble: { id: null, slot: "marble", name: "Rainbow glass", emoji: "🌈", price: 0 },
  jar: { id: null, slot: "jar", name: "Glass jar", emoji: "🏺", price: 0 },
};

// What's worn in a slot, treating "nothing" and the free classic theme as the same thing.
export const wornIn = (worn, slot) => (worn && worn[slot]) || (slot === "theme" ? "classic" : null);

/*
 * One item's state for the shop card:
 *   wearing | owned | locked (unlock-only, trophy not won) | short (can't afford yet) | buy
 * plus `need` (stars still to earn) and `trophy` (the trophy's name, for locked items).
 */
export function itemState(item, wallet, trophies, worn) {
  if (wornIn(worn, item.slot) === item.id) return { state: "wearing" };
  if (item.id === null || owns(wallet, trophies, item.id)) return { state: "owned" };
  if (item.unlock) return { state: "locked", trophy: TROPHY_BY_ID[item.unlock] ? TROPHY_BY_ID[item.unlock].name : "a special" };
  const need = item.price - balanceOf(wallet);
  return need > 0 ? { state: "short", need } : { state: "buy" };
}

const cheapestFirst = (a, b) => (!!a.unlock - !!b.unlock) || (a.price - b.price) || a.name.localeCompare(b.name);

/*
 * The shop's shelves: one per slot, defaults first, then cheapest first (unlock-only items last), and one per open
 * season (seasons: ids the server says are open), first in the shop. A seasonal item sits on its season's shelf
 * while the season is open; once owned it's on its slot's shelf too, all year. Unowned ones are away off-season.
 */
export function shelves(items = ITEMS, { seasons = [], wallet = null, trophies = null } = {}) {
  const out = {};
  const mine = i => owns(wallet, trophies, i.id);
  for (const season of SEASONS) {
    if (!seasons.includes(season.id)) continue;
    out[season.id] = items.filter(i => i.season === season.id)
      .sort((a, b) => (SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)) || cheapestFirst(a, b));
  }
  for (const slot of SLOTS) {
    const list = items.filter(i => i.slot === slot && (!i.season || mine(i))).sort(cheapestFirst);
    out[slot] = DEFAULT_CARDS[slot] ? [DEFAULT_CARDS[slot], ...list] : list;
  }
  return out;
}

// The emoji for a worn avatar, or "" (the catalogue may have changed under an old id).
export const avatarOf = (worn, items = ITEMS) => {
  const id = worn && worn.avatar;
  const item = id && items.find(i => i.id === id);
  return item ? item.emoji : "";
};

// Kind words for what the server said no to. Never scary: nothing is lost when something doesn't work.
export const SHOP_ERRORS = {
  offline: "We can't reach the game. Check the wifi, then try again.",
  "not-now": "The shop is shut while a round is on. Try again after the round.",
  "not-enough": "You need a few more stars for that one. Keep playing!",
  "unlock-only": "That one comes free when you win its trophy.",
  "not-in-season": "That one's away until its season comes round again.",
  "slow-down": "One moment, then try again.",
  "not-owned": "You need to get that one first.",
};
export const shopError = code => SHOP_ERRORS[code] || "That didn't work. Try again in a moment.";
