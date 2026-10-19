/*
 * The shop: what a student can spend their stars on, shared by the server (which decides what can be bought and worn)
 * and the app (which shows it). Stars are never taken away: a purchase is for keeps and nothing expires.
 *
 * Each category lives in its own file under shared/looks/; this file only gathers them up.
 * Every item = { id, slot, name, emoji, price, unlock? }. A price of 0 means free for everyone (e.g. the classic theme).
 * unlock: a trophy id from shared/rewards.js. Such an item can't be bought: it's given free once that trophy is won,
 * so turning up week after week earns things too, not just high scores.
 * season: a seasonal shelf's id from shared/seasons.js. Such an item can only be bought while its season is open,
 * but once bought it's kept and worn like any other, all year.
 */
import { THEMES } from "./looks/themes.js";
import { DICE } from "./looks/dice.js";
import { EFFECTS } from "./looks/effects.js";
import { AVATARS } from "./looks/avatars.js";
import { COVERS } from "./looks/covers.js";
import { seasonOpen } from "./seasons.js";

// Each slot holds one worn item at a time; null means the default look for that slot.
export const SLOTS = ["theme", "dice", "effect", "avatar", "cover"];
export const SLOT_NAMES = { theme: "Themes", dice: "Dice", effect: "Word sparkles", avatar: "Avatars", cover: "Sticker books" };

export const ITEMS = [...THEMES, ...DICE, ...EFFECTS, ...AVATARS, ...COVERS];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// Stars for one round: the round's score, plus PLAY_BONUS just for playing, so every student earns.
export const PLAY_BONUS = 5;
export const starsForRound = score => Math.max(0, score || 0) + PLAY_BONUS;

/*
 * A student's wallet, as kept on their student document:
 *   stars:    every star ever earned (only ever goes up; counted in applyRound)
 *   spent:    stars spent in the shop
 *   owned:    item id -> time bought (or unlocked)
 *   equipped: slot -> item id (a missing slot, or null, is the default look)
 */
export const emptyWallet = () => ({ stars: 0, spent: 0, owned: {}, equipped: {} });
export const balanceOf = w => Math.max(0, ((w && w.stars) || 0) - ((w && w.spent) || 0));

// Whether a student has an item: bought it, it's free, or they've won the trophy that unlocks it.
export function owns(wallet, trophies, id) {
  const item = ITEM_BY_ID[id];
  if (!item) return false;
  if (item.unlock) return !!(trophies && trophies[item.unlock]);
  return item.price === 0 || !!(wallet && wallet.owned && wallet.owned[id]);
}

// Why an item can't be bought at time t, or null if it can.
export function cantBuy(wallet, trophies, id, t = Date.now()) {
  const item = ITEM_BY_ID[id];
  if (!item) return "no-item";
  if (owns(wallet, trophies, id)) return "owned";
  if (item.unlock) return "unlock-only";
  if (item.season && !seasonOpen(item.season, t)) return "not-in-season";
  if (balanceOf(wallet) < item.price) return "not-enough";
  return null;
}

// Why an item can't be worn in a slot, or null if it can. Wearing null (the default look) is always fine.
export function cantEquip(wallet, trophies, slot, id) {
  if (!SLOTS.includes(slot)) return "no-slot";
  if (id === null) return null;
  const item = ITEM_BY_ID[id];
  if (!item || item.slot !== slot) return "no-item";
  return owns(wallet, trophies, id) ? null : "not-owned";
}

// What a device should actually wear: only items still in the catalogue and owned, everything else the default.
export function wornLooks(wallet, trophies) {
  const out = {};
  for (const slot of SLOTS) {
    const id = wallet && wallet.equipped && wallet.equipped[slot];
    out[slot] = id && !cantEquip(wallet, trophies, slot, id) ? id : null;
  }
  return out;
}
