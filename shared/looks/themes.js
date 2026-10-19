/*
 * Themes: a whole device's colours. "classic" is free and is what every screen shows by default (the big screen
 * always shows it). Every other theme is bought in the shop and only ever shows on its owner's own device.
 *
 * A theme = { id, slot: "theme", name, emoji, price, unlock?, scheme: "dark" | "light", vars, css? }
 *   vars: every key in THEME_KEYS (each becomes a CSS variable --ws-<key>). Cover keys (COVER_KEYS in covers.js)
 *         are optional: a theme may set its own sticker book look, otherwise the classic one shows.
 *   css:  optional extra rules, written for the selector SEL (e.g. borders, a background pattern). Keep patterns
 *         behind the content (pointer-events:none, low opacity) and inside .ws-root so reduced motion still applies.
 * Every "-rgb" key is the same colour as its hex twin, written as "r g b". test/looks.test.js checks all of this,
 * plus contrast, for every theme.
 */
export const THEME_KEYS = [
  "ink", "ink-rgb",          // page background, and the text colour on amber/green buttons
  "text", "fg",              // main text; fg = "r g b" used for translucent fills (rgb(var(--ws-fg) / .08))
  "glow",                    // the soft spot at the top of the page background
  "well", "well-edge",       // the tray the dice sit in
  "dice", "dice-edge", "letter",   // the die face, its bottom lip and the letter on it (a dice style can override these three)
  "letter-lit",              // the letter on a die while it is traced (on amber) or just found (on green); never overridden by dice
  "amber", "amber-rgb", "amber-soft", "amber-edge",   // the highlight: scores, buttons, today's sound
  "red", "red-rgb", "green", "green-rgb",             // wrong / right feedback
  "mist", "faint",           // quieter text, hairlines
  "on-light",                // text on light fills (gold/silver stickers)
  "sticker", "bar",
  "font-body", "font-display", "display-tracking",
];

// The selector a theme's extra css is written for; looks.js swaps in the real one.
export const SEL = "[data-ws-theme=\"$id\"]";

export const THEMES = [
  {
    id: "classic", slot: "theme", name: "Classic night sky", emoji: "🌙", price: 0, scheme: "dark",
    vars: {
      ink: "#0E1A2B", "ink-rgb": "14 26 43", text: "#EFF4F9", fg: "255 255 255", glow: "#16283f",
      well: "#0F4D5C", "well-edge": "#0A3540", dice: "#F6F1E3", "dice-edge": "#DCD3BB", letter: "#1B2A41", "letter-lit": "#1B2A41",
      amber: "#FFB020", "amber-rgb": "255 176 32", "amber-soft": "#FFD27A", "amber-edge": "#B87A0A",
      red: "#FF5D5D", "red-rgb": "255 93 93", green: "#57C785", "green-rgb": "87 199 133",
      mist: "#9FB3C8", faint: "rgba(255,255,255,0.08)", "on-light": "#0E1A2B", sticker: "#3D7BD9", bar: "#3E7CA6",
      "font-body": "'Atkinson Hyperlegible',system-ui,sans-serif", "font-display": "'Fredoka','Atkinson Hyperlegible',system-ui,sans-serif",
      "display-tracking": "0",
      // the sticker book and trophy cabinet (see covers.js)
      cabinet: "#2B1D13", "cabinet-edge": "#120C07", shelf: "#A8703F", "shelf-edge": "#6B4321", silhouette: "brightness(0) invert(1) opacity(.16)", "sticker-font": "var(--ws-font-display)",
      page: "#FFFBF0", "page-muted": "#7A715F", "page-accent": "#B4560E", binding: "#3B3B3B",
    },
  },
  {
    // The RedNut design system ("Sunbaked" riso zine: warm paper, red/marigold inks, teal contrast, chunky ink borders, grain).
    // Its red is a shade deeper than rednut-tokens.css (#FF4D2E), so cream button text clears 3:1.
    id: "rednut", slot: "theme", name: "RedNut", emoji: "🌰", price: 150, scheme: "light",
    vars: {
      ink: "#FBF3E0", "ink-rgb": "251 243 224", text: "#231F1A", fg: "35 31 26", glow: "#FFF9EC",
      well: "#0FA091", "well-edge": "#231F1A", dice: "#FFFBF2", "dice-edge": "#D8C9A8", letter: "#231F1A", "letter-lit": "#231F1A",
      amber: "#FA482A", "amber-rgb": "250 72 42", "amber-soft": "#C23A12", "amber-edge": "#231F1A",
      red: "#C23A12", "red-rgb": "194 58 18", green: "#0B7A6E", "green-rgb": "11 122 110",
      mist: "#6B6459", faint: "rgba(35,31,26,0.16)", "on-light": "#231F1A", sticker: "#0FA091", bar: "#F5A300",
      "font-body": "'Work Sans',system-ui,sans-serif", "font-display": "'Syne','Work Sans',system-ui,sans-serif",
      "display-tracking": "-0.01em",
      cabinet: "#F3E3C0", "cabinet-edge": "#231F1A", shelf: "#F5A300", "shelf-edge": "#231F1A", silhouette: "brightness(0) opacity(.2)", "sticker-font": "var(--ws-font-body)",
      page: "#FFFDF7", "page-muted": "#6B6459", "page-accent": "#C23A12", binding: "#231F1A",
    },
    css: `
$SEL .ws-btn.ws-display{outline:2px solid var(--ws-text);outline-offset:-2px}
$SEL .ws-btn.ws-display:hover{filter:none;transform:translate(-1px,-1px)}
$SEL .ws-btn.ws-display:active{transform:translate(1px,1px)}
$SEL .ws-btn:focus-visible{outline:3px solid var(--ws-green);outline-offset:2px}
$SEL .ws-die{outline:2px solid var(--ws-text);outline-offset:-2px}
$SEL .ws-page{box-shadow:4px 4px 0 var(--ws-text) !important;outline:2px solid var(--ws-text)}
$SEL .ws-root::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.35;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/></svg>")}
`,
  },
];
