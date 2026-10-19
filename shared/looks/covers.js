/*
 * Sticker book covers: the trophy cabinet and the sticker book pages ("My trophies" on the student's device).
 * With no cover worn, the theme's own cabinet and pages show (or the classic ones, if the theme sets none).
 *
 * A cover = { id, slot: "cover", name, emoji, price, unlock?, vars, css? }
 *   vars: every key in COVER_KEYS.
 *   css:  optional extra rules for the selector SEL ($SEL in the string), e.g. a pattern on the cabinet or pages.
 *         The cabinet and pages are drawn in src/Trophies.jsx (Cabinet, StickerBook, the .ws-page class).
 */
export const COVER_KEYS = [
  "cabinet", "cabinet-edge",       // the trophy cabinet's back and frame
  "shelf", "shelf-edge",           // the shelf planks
  "silhouette",                    // a CSS filter for trophies not won yet
  "sticker-font",                  // the font on stickers (a CSS font-family or var(--ws-font-…))
  "page", "page-muted", "page-accent", "binding",   // sticker book paper, quiet text, headings, spiral binding
];

export const SEL = "[data-ws-cover=\"$id\"]";

export const COVERS = [];
