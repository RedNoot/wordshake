/*
 * Turns the shop's looks (shared/looks/*) into CSS, and puts a device's worn looks on the page.
 * Each slot is a data attribute on <html>: data-ws-theme, data-ws-dice, data-ws-cover, data-ws-effect. The selectors
 * work on any element (the /preview gallery dresses single cards), and a dice or cover rule beats the theme's own.
 * The big screen never sets any of them except the classic theme; only a student's own device wears shop items.
 */
import { THEMES, SEL as THEME_SEL } from "../shared/looks/themes.js";
import { DICE, SEL as DICE_SEL } from "../shared/looks/dice.js";
import { COVERS, SEL as COVER_SEL } from "../shared/looks/covers.js";

const block = vars => Object.entries(vars).map(([k, v]) => `--ws-${k}:${v};`).join("");
const sel = (pattern, id) => pattern.replace("$id", id);
const extra = (pattern, item) => (item.css ? item.css.split("$SEL").join(sel(pattern, item.id)) : "");

// Themes first, then covers, then dice: the same specificity, so a worn cover or dice style beats the theme's own.
export const LOOKS_CSS = [
  ...THEMES.map(t => `${t.id === "classic" ? ":root," : ""}${sel(THEME_SEL, t.id)}{${block(t.vars)}color-scheme:${t.scheme}}${extra(THEME_SEL, t)}`),
  ...COVERS.map(c => `${sel(COVER_SEL, c.id)}{${block(c.vars)}}${extra(COVER_SEL, c)}`),
  ...DICE.map(d => `${sel(DICE_SEL, d.id)}{${block(d.vars)}}${extra(DICE_SEL, d)}`),
].join("\n");

const ATTRS = { theme: "wsTheme", dice: "wsDice", cover: "wsCover", effect: "wsEffect" };
const setAttr = (key, value) => {
  const ds = document.documentElement.dataset;
  if (value) { if (ds[key] !== value) ds[key] = value; } else if (key in ds) delete ds[key];
};

/*
 * The one place a device decides how it looks. Every screen calls this instead of setting attributes itself.
 *   worn:     slot -> item id, from the server (wornLooks in shared/shop.js), or null for a guest / not joined yet
 *   ownLooks: the teacher's "Let students use their own looks" setting for this room (false: everything classic)
 */
export function applyLooks(worn, ownLooks = true) {
  const w = ownLooks && worn ? worn : {};
  setAttr(ATTRS.theme, w.theme || "classic");
  setAttr(ATTRS.dice, w.dice || null);
  setAttr(ATTRS.cover, w.cover || null);
  setAttr(ATTRS.effect, w.effect || null);
}

// The found-word effect this device is wearing (null: none). Read by Play when a word counts.
export const wornEffect = () => document.documentElement.dataset[ATTRS.effect] || null;
