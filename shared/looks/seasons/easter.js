/*
 * The easter shelf (see shared/seasons.js for when it's open, and docs/SHOP.md "Seasonal shelves").
 * Items for any slot, each written exactly as in that slot's own file (its header gives the format), plus
 * season: "easter". Helpers for theme and dice css are in ../kit.js.
 */
import { FONTS, behind, behind2, svg, round } from "../kit.js";

// An inline SVG for theme and cover patterns, written utf8 like the slot files' own ("#" goes in as %23).
const pic = s => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>")`;

// Painted eggs and little daisies scattered behind the Easter garden page: pastel, still, well behind the content.
const EGG = "<path d='M0-13C6-13 10-4 10 3C10 9 6 13 0 13C-6 13-10 9-10 3C-10-4-6-13 0-13Z'/>";
const BAND = "<path d='M-9.6 0L-6.4 3L-3.2 0L0 3L3.2 0L6.4 3L9.6 0' fill='none' stroke='white' stroke-width='1.8' stroke-linejoin='round'/>";
const GARDEN = pic(`width='260' height='260'><defs><g id='e'>${EGG}${BAND}</g>`
  + "<g id='d'><g fill='%23F4CFE3'><circle cx='0' cy='-5' r='3.2'/><circle cx='4.8' cy='-1.5' r='3.2'/><circle cx='3' cy='4' r='3.2'/><circle cx='-3' cy='4' r='3.2'/><circle cx='-4.8' cy='-1.5' r='3.2'/></g><circle r='2.6' fill='%23FFC93D'/></g></defs>"
  + "<g fill-opacity='.55'><use href='%23e' fill='%23F7B7D2' transform='translate(34 46) rotate(-14)'/>"
  + "<use href='%23e' fill='%23B9D8F5' transform='translate(176 30) rotate(12) scale(.8)'/>"
  + "<use href='%23e' fill='%23BFE8C9' transform='translate(120 138) rotate(-6) scale(1.1)'/>"
  + "<use href='%23e' fill='%23D9C6F0' transform='translate(222 196) rotate(18) scale(.85)'/>"
  + "<use href='%23e' fill='%23FFE08F' transform='translate(46 214) rotate(8) scale(.9)'/></g>"
  + "<g opacity='.8'><use href='%23d' transform='translate(96 64)'/><use href='%23d' transform='translate(220 110) scale(.8)'/>"
  + "<use href='%23d' transform='translate(20 132) scale(.7)'/><use href='%23d' transform='translate(150 232) scale(.9)'/></g>");

// The sticker book cover's pieces (as covers.js draws them): a pattern behind the cabinet, and one under the page.
const cabinet = (pattern, extra = "") =>
  `$SEL .ws-cabinet{position:relative;isolation:isolate}` +
  `$SEL .ws-cabinet::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:6px;background:${pattern};${extra}}`;
const page = (pattern, extra = "") => `$SEL .ws-page{background:${pattern}, var(--ws-page) !important;${extra}}`;

export const EASTER = [
  {
    // An autumn Easter garden: lilac-white page, a mint tray, white dice with a lilac lip, a violet highlight,
    // painted eggs and daisies scattered behind everything and a soft green lawn along the bottom.
    id: "easter-garden", slot: "theme", name: "Easter garden", emoji: "🌷", price: 100, scheme: "light", season: "easter",
    vars: {
      ink: "#FBF7FF", "ink-rgb": "251 247 255", text: "#34204A", fg: "52 32 74", glow: "#FFF4C9",
      well: "#8FD4B8", "well-edge": "#4FA586", dice: "#FFFFFF", "dice-edge": "#D6C3F0", letter: "#34204A", "letter-lit": "#FFFFFF",
      amber: "#7B45C7", "amber-rgb": "123 69 199", "amber-soft": "#5E2FA3", "amber-edge": "#45207D",
      red: "#C2321E", "red-rgb": "194 50 30", green: "#17784A", "green-rgb": "23 120 74",
      mist: "#665878", faint: "rgba(52,32,74,0.14)", "on-light": "#34204A", sticker: "#F28DB8", bar: "#6CCBA5",
      ...FONTS,
    },
    css: behind(`opacity:.85;background-image:${GARDEN}`)
      + behind2(`top:auto;height:22%;background:radial-gradient(120% 100% at 50% 100%, rgba(108,203,165,.30), rgba(108,203,165,.10) 60%, transparent 75%)`),
  },
  {
    // Dyed eggs: a buttery face with a pink zigzag band across the top and a blue one across the bottom, dots in
    // the corners, on an egg shape (a touch narrower at the top). Everything stays out of the middle, where the letter is.
    id: "easter-eggs", slot: "dice", name: "Painted eggs", emoji: "🎨", price: 100, season: "easter",
    vars: {
      dice: "#FFF1C7", "dice-edge": "#E0B65A", letter: "#3A2348",
      "dice-texture": [
        svg("<path d='M4 20L12 13L20 20L28 13L36 20L44 13L52 20L60 13L68 20L76 13L84 20L92 13L100 20' fill='none' stroke='#E85A97' stroke-width='3.6' stroke-linejoin='round' stroke-opacity='.8'/>"
          + "<path d='M0 78L8 85L16 78L24 85L32 78L40 85L48 78L56 85L64 78L72 85L80 78L88 85L96 78' fill='none' stroke='#4F98DE' stroke-width='3.6' stroke-linejoin='round' stroke-opacity='.8'/>"
          + "<g fill-opacity='.8'><circle cx='9' cy='42' r='3' fill='#5CBF85'/><circle cx='91' cy='42' r='3' fill='#A57BE0'/>"
          + "<circle cx='9' cy='58' r='3' fill='#A57BE0'/><circle cx='91' cy='58' r='3' fill='#5CBF85'/></g>"),
        "radial-gradient(ellipse 30% 14% at 36% 24%, rgba(255,255,255,.8), rgba(255,255,255,0) 100%)",
      ].join(","),
    },
    css: round("50% 50% 46% 46% / 56% 56% 44% 44%"),
  },
  // Word sparkle: the drawing is EggToss in src/effects/easter.jsx.
  { id: "easter-toss", slot: "effect", name: "Egg toss", emoji: "🥚", price: 80, season: "easter" },
  {
    // A woven basket for a cabinet (wicker criss-cross on honey brown), pale lemon pages with a few painted eggs in
    // the corners, berry headings and a lilac binding.
    id: "easter-basket", slot: "cover", name: "Egg basket", emoji: "🧺", price: 100, season: "easter",
    vars: {
      cabinet: "#8A5A2E", "cabinet-edge": "#5A3815", shelf: "#B07A42", "shelf-edge": "#6E4520",
      silhouette: "brightness(0) invert(1) opacity(.2)", "sticker-font": "var(--ws-font-display)",
      page: "#FFF9E6", "page-muted": "#66553A", "page-accent": "#A2316B", binding: "#9C74D4",
    },
    css: cabinet([
      "repeating-linear-gradient(45deg, rgba(255,226,170,.10) 0 6px, rgba(60,30,5,.16) 6px 8px, transparent 8px 14px)",
      "repeating-linear-gradient(-45deg, rgba(255,226,170,.08) 0 6px, rgba(60,30,5,.14) 6px 8px, transparent 8px 14px)",
    ].join(","), "box-shadow:inset 0 0 0 2px rgba(255,226,170,.18)")
      + page([
        pic(`width='120' height='120'><defs><g id='e'>${EGG}${BAND}</g></defs><g fill-opacity='.4'>`
          + "<use href='%23e' fill='%23F7B7D2' transform='translate(16 20) rotate(-14) scale(.8)'/>"
          + "<use href='%23e' fill='%23B9D8F5' transform='translate(80 56) rotate(10) scale(.6)'/>"
          + "<use href='%23e' fill='%23BFE8C9' transform='translate(40 100) rotate(-4) scale(.7)'/></g>") + " 0 0/120px 120px",
        "radial-gradient(ellipse at 100% 0%, rgba(156,116,212,.12), transparent 50%)",
      ].join(",")),
  },
  { id: "easter-chick", slot: "avatar", name: "Hatchling", emoji: "🐣", price: 40, season: "easter" },
  { id: "easter-bunny", slot: "avatar", name: "Easter bunny", emoji: "🐇", price: 40, season: "easter" },
  { id: "easter-chicky", slot: "avatar", name: "Little chick", emoji: "🐥", price: 30, season: "easter" },
  // The word jar (shared/looks/marbles.js, jars.js; drawn in src/jarArt.js)
  { id: "easter-egg-marbles", slot: "marble", name: "Speckled eggs", emoji: "🥚", price: 80, colours: ["#FFE680", "#A8E6A1", "#9FD3FF", "#FFB3C7", "#C9A8FF"], finish: "speckle", season: "easter" },
  { id: "easter-egg-jar", slot: "jar", name: "Egg jar", emoji: "🐣", price: 100, shape: [[0.4, 0.06], [0.4, 0.1], [0.27, 0.16], [0.16, 0.28], [0.1, 0.45], [0.1, 0.64], [0.15, 0.8], [0.25, 0.92], [0.37, 0.975]], tint: "#FFD6E7", season: "easter" },
];
