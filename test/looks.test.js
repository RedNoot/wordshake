import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, THEME_KEYS } from "../shared/looks/themes.js";
import { DICE } from "../shared/looks/dice.js";
import { COVERS, COVER_KEYS } from "../shared/looks/covers.js";
import { EFFECTS } from "../shared/looks/effects.js";
import { AVATARS } from "../shared/looks/avatars.js";
import { ITEMS, SLOTS, owns, cantBuy, cantEquip, wornLooks, balanceOf, starsForRound, PLAY_BONUS } from "../shared/shop.js";
import { TROPHY_BY_ID } from "../shared/rewards.js";

/* ---- colour helpers (WCAG relative luminance and contrast ratio) ---- */
const HEX = /^#[0-9A-Fa-f]{6}$/;
const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = h => {
  const c = rgbOf(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hue = h => {
  const [r, g, b] = rgbOf(h).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
};
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };

// The minimum contrast for each pair a student reads. Letters on dice are what the game is about, so they get the most.
const THEME_PAIRS = [
  ["letter", "dice", 7, "letters on the dice"],
  ["text", "ink", 7, "main text on the page"],
  ["mist", "ink", 4.5, "quieter text on the page"],
  ["ink", "amber", 3, "button text on amber buttons"],
  ["ink", "green", 3, "button text on green buttons"],
  ["letter-lit", "amber", 3, "a traced letter"],
  ["letter-lit", "green", 3, "a just-found letter"],
  ["amber", "ink", 3, "amber text (scores, the traced word)"],
  ["green", "ink", 3, "green 'found it' text"],
  ["red", "ink", 3, "red 'not a word' text"],
];
const COVER_PAIRS = [
  ["page-muted", "page", 4.5, "quiet text on sticker book pages"],
  ["page-accent", "page", 4.5, "headings on sticker book pages"],
];
const RGB_TWINS = ["ink", "amber", "red", "green"];

function checkColours(where, vars, keys) {
  for (const k of keys) assert.ok(vars[k] !== undefined && vars[k] !== "", `${where}: missing ${k}`);
  for (const twin of RGB_TWINS) {
    if (vars[twin] === undefined) continue;
    assert.match(vars[twin], HEX, `${where}: ${twin} must be a #RRGGBB colour`);
    assert.equal(vars[`${twin}-rgb`], rgbOf(vars[twin]).join(" "), `${where}: ${twin}-rgb must match ${twin}`);
  }
}
function checkPairs(where, vars, pairs) {
  for (const [fg, bg, min, what] of pairs) {
    assert.match(vars[fg], HEX, `${where}: ${fg} must be a #RRGGBB colour`);
    assert.match(vars[bg], HEX, `${where}: ${bg} must be a #RRGGBB colour`);
    const c = contrast(vars[fg], vars[bg]);
    assert.ok(c >= min, `${where}: ${what} (${fg} on ${bg}) is ${c.toFixed(2)}:1, needs ${min}:1`);
  }
}
const coverOf = vars => Object.fromEntries(COVER_KEYS.filter(k => vars[k] !== undefined).map(k => [k, vars[k]]));

test("every item has a unique id, a known slot, a name, an emoji and a fair price", () => {
  const ids = new Set();
  for (const item of ITEMS) {
    assert.ok(/^[a-z0-9-]+$/.test(item.id), `${item.id}: ids are lower-case words and dashes`);
    assert.ok(!ids.has(item.id), `${item.id}: used twice`);
    ids.add(item.id);
    assert.ok(SLOTS.includes(item.slot), `${item.id}: unknown slot ${item.slot}`);
    assert.ok(item.name && item.name.length <= 24, `${item.id}: needs a name of 24 characters or fewer`);
    assert.ok(item.emoji, `${item.id}: needs an emoji`);
    assert.ok(Number.isInteger(item.price) && item.price >= 0 && item.price <= 1000, `${item.id}: price must be a whole number 0-1000`);
    if (item.unlock) assert.ok(TROPHY_BY_ID[item.unlock], `${item.id}: unlocked by an unknown trophy ${item.unlock}`);
  }
  for (const [list, slot] of [[THEMES, "theme"], [DICE, "dice"], [EFFECTS, "effect"], [AVATARS, "avatar"], [COVERS, "cover"]]) {
    for (const item of list) assert.equal(item.slot, slot, `${item.id} is in the ${slot} file`);
  }
});

test("classic is the free default theme", () => {
  const classic = THEMES.find(t => t.id === "classic");
  assert.ok(classic && classic.price === 0 && !classic.unlock);
  for (const k of COVER_KEYS) assert.ok(classic.vars[k] !== undefined, `classic sets the default sticker book: ${k}`);
});

for (const t of THEMES) {
  test(`theme ${t.id}: complete, matching and readable`, () => {
    assert.ok(["dark", "light"].includes(t.scheme), `${t.id}: scheme is dark or light`);
    checkColours(t.id, t.vars, THEME_KEYS);
    for (const k of Object.keys(t.vars)) assert.ok(THEME_KEYS.includes(k) || COVER_KEYS.includes(k), `${t.id}: unknown key ${k}`);
    checkPairs(t.id, t.vars, THEME_PAIRS);
    // Right and wrong carry an icon and words too, but their colours should still look different.
    assert.ok(hueGap(t.vars.red, t.vars.green) >= 60, `${t.id}: red and green are too close in colour`);
    const cover = coverOf(t.vars);
    if (Object.keys(cover).length) {
      checkColours(t.id, cover, COVER_KEYS);
      checkPairs(t.id, cover, COVER_PAIRS);
    }
    if (t.css) assert.ok(t.css.includes("$SEL"), `${t.id}: extra css must be written for $SEL`);
  });
}

for (const d of DICE) {
  test(`dice ${d.id}: readable on its own`, () => {
    for (const k of Object.keys(d.vars)) assert.ok(["dice", "dice-edge", "letter", "dice-texture"].includes(k), `${d.id}: unknown key ${k}`);
    checkPairs(d.id, d.vars, [["letter", "dice", 7, "letters on the dice"]]);
    assert.match(d.vars["dice-edge"], HEX, `${d.id}: dice-edge must be a #RRGGBB colour`);
    if (d.css) assert.ok(d.css.includes("$SEL"), `${d.id}: extra css must be written for $SEL`);
  });
}

for (const c of COVERS) {
  test(`sticker book ${c.id}: complete and readable`, () => {
    checkColours(c.id, c.vars, COVER_KEYS);
    for (const k of Object.keys(c.vars)) assert.ok(COVER_KEYS.includes(k), `${c.id}: unknown key ${k}`);
    checkPairs(c.id, c.vars, COVER_PAIRS);
    if (c.css) assert.ok(c.css.includes("$SEL"), `${c.id}: extra css must be written for $SEL`);
  });
}

// The bottom tenth of rounds so far scored about 4 points; such a student should still buy something in one lesson (3 rounds).
test("the cheapest item is within one lesson for anyone", { skip: !AVATARS.length && "no avatars yet" }, () => {
  const bought = ITEMS.filter(i => i.price > 0 && !i.unlock);
  assert.ok(Math.min(...bought.map(i => i.price)) <= 3 * starsForRound(4), `something costs ${3 * starsForRound(4)} stars or less`);
});

/* ---- the shop rules ---- */
const paid = ITEMS.find(i => i.price > 0 && !i.unlock);

test("stars: score plus the play bonus, never negative", () => {
  assert.equal(starsForRound(9), 9 + PLAY_BONUS);
  assert.equal(starsForRound(0), PLAY_BONUS);
  assert.equal(starsForRound(undefined), PLAY_BONUS);
  assert.equal(balanceOf({ stars: 30, spent: 12 }), 18);
  assert.equal(balanceOf(null), 0);
});

test("buying: enough stars, not owned yet, never an unlock-only item", { skip: !paid }, () => {
  const w = { stars: paid.price, spent: 0, owned: {}, equipped: {} };
  assert.equal(cantBuy(w, {}, paid.id), null);
  assert.equal(cantBuy({ ...w, spent: 1 }, {}, paid.id), "not-enough");
  assert.equal(cantBuy({ ...w, owned: { [paid.id]: 1 } }, {}, paid.id), "owned");
  assert.equal(cantBuy(w, {}, "no-such-thing"), "no-item");
  assert.equal(cantBuy(w, {}, "classic"), "owned", "free items are already everyone's");
});

test("wearing: only owned items, in their own slot; null is the default look", { skip: !paid }, () => {
  const w = { stars: 0, spent: 0, owned: { [paid.id]: 1 }, equipped: {} };
  assert.equal(cantEquip(w, {}, paid.slot, paid.id), null);
  assert.equal(cantEquip({ ...w, owned: {} }, {}, paid.slot, paid.id), "not-owned");
  const other = SLOTS.find(s => s !== paid.slot);
  assert.equal(cantEquip(w, {}, other, paid.id), "no-item");
  assert.equal(cantEquip(w, {}, "hat", paid.id), "no-slot");
  assert.equal(cantEquip(w, {}, paid.slot, null), null);
  assert.equal(owns(w, {}, "classic"), true);
});

test("worn looks drop anything not owned or no longer in the shop", () => {
  const w = { owned: {}, equipped: { theme: "classic", dice: "gone-from-shop", avatar: paid ? paid.id : "x" } };
  const worn = wornLooks(w, {});
  assert.deepEqual(Object.keys(worn).sort(), [...SLOTS].sort());
  assert.equal(worn.theme, "classic");
  assert.equal(worn.dice, null);
  assert.equal(worn.avatar, null);
});

test("trophy unlocks: free once the trophy is won, never for sale", () => {
  const unlock = ITEMS.find(i => i.unlock);
  if (!unlock) return;
  assert.equal(owns({}, {}, unlock.id), false);
  assert.equal(owns({}, { [unlock.unlock]: 1 }, unlock.id), true);
  assert.equal(cantBuy({ stars: 1000, spent: 0, owned: {} }, {}, unlock.id), "unlock-only");
});
