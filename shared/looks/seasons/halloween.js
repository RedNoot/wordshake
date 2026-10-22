/*
 * The halloween shelf (see shared/seasons.js for when it's open, and docs/SHOP.md "Seasonal shelves").
 * Items for any slot, each written exactly as in that slot's own file (its header gives the format), plus
 * season: "halloween". Helpers for theme and dice css are in ../kit.js.
 *
 * Spooky-cute, never frightening (the players are 5 to 10): pumpkins, a friendly ghost, bats, the moon, soft cobwebs.
 */
import { FONTS, behind, behind2, svg, round, arc } from "../kit.js";

const season = "halloween";

// A little bat, wings out, drawn round (0,0) and about 32 wide: used by the theme's sky and the sticker pages.
const BAT = "M0-2C1-5 2.6-6 3-3.4C6-7 11-7.4 16-4.2C13-3 12-.4 12.6 2.2C10.2 .4 8 1 7 3.2C5.2 1.2 2.8 1.4 0 4.2"
  + "C-2.8 1.4-5.2 1.2-7 3.2C-8 1-10.2 .4-12.6 2.2C-12-.4-13-3-16-4.2C-11-7.4-6-7-3-3.4C-2.6-6-1-5 0-2Z";

/* ---- the sticker book helpers, as in covers.js ---- */
const coverSvg = s => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>")`;
const cabinet = (pattern, extra = "") =>
  `$SEL .ws-cabinet{position:relative;isolation:isolate}` +
  `$SEL .ws-cabinet::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:6px;background:${pattern};${extra}}`;
const page = (pattern, extra = "") => `$SEL .ws-page{background:${pattern}, var(--ws-page) !important;${extra}}`;
const WHITE_GHOST = a => `brightness(0) invert(1) opacity(${a})`;

// A soft cobweb in a top-left corner (90 × 90): four threads from the corner and three sagging rings.
const WEB = "<g fill='none' stroke='white' stroke-opacity='.2' stroke-width='1.2' stroke-linecap='round'>"
  + "<path d='M0 0L90 9.5M0 0L78.7 43.6M0 0L43.6 78.7M0 0L9.5 90'/>"
  + "<path d='M21.9 2.3Q18.1 5.7 19.2 10.7Q13.2 13.2 10.7 19.2Q5.7 18.1 2.3 21.9'/>"
  + "<path d='M43.8 4.6Q36.2 11.4 38.5 21.3Q26.3 26.3 21.3 38.5Q11.4 36.2 4.6 43.8'/>"
  + "<path d='M67.6 7.1Q55.9 17.6 59.5 33Q40.7 40.7 33 59.5Q17.6 55.9 7.1 67.6'/></g>";

export const HALLOWEEN = [
  {
    // A moonlit Halloween night: deep plum page, a candle-cream die, pumpkin-orange highlights, a big soft moon,
    // a few stars, and bats drifting slowly across far behind everything.
    id: "halloween-night", slot: "theme", name: "Pumpkin night", emoji: "🌕", price: 240, scheme: "dark", season,
    vars: {
      ink: "#1A1030", "ink-rgb": "26 16 48", text: "#F6F0FF", fg: "255 255 255", glow: "#3A2160",
      well: "#3B2563", "well-edge": "#22143D", dice: "#FFF4E2", "dice-edge": "#E0B98A", letter: "#2A1440", "letter-lit": "#2A1440",
      amber: "#FF9A2E", "amber-rgb": "255 154 46", "amber-soft": "#FFC27A", "amber-edge": "#B35F0A",
      red: "#FF6F91", "red-rgb": "255 111 145", green: "#7EE07A", "green-rgb": "126 224 122",
      mist: "#B9A8D9", faint: "rgba(255,255,255,0.09)", "on-light": "#1A1030", sticker: "#E07B1A", bar: "#8A5CD6",
      ...FONTS,
    },
    css: behind(`opacity:.75;background-repeat:no-repeat,repeat;background-position:right 4% top 3%,0 0;background-size:min(24vw,104px) auto,210px 210px;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><radialGradient id='g'><stop offset='.5' stop-color='%23FFE9A8' stop-opacity='.35'/><stop offset='1' stop-color='%23FFE9A8' stop-opacity='0'/></radialGradient></defs><circle cx='60' cy='60' r='58' fill='url(%23g)'/><circle cx='60' cy='60' r='33' fill='%23FFEDB8' fill-opacity='.9'/><g fill='%23E8C97A' fill-opacity='.3'><circle cx='49' cy='52' r='6'/><circle cx='70' cy='70' r='4.5'/><circle cx='68' cy='47' r='2.5'/></g></svg>"),
  url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='210' height='210' fill='%23E9DDFF' fill-opacity='.55'><circle cx='14' cy='22' r='1.2'/><circle cx='88' cy='54' r='.8'/><circle cx='160' cy='18' r='1.4'/><circle cx='40' cy='120' r='1'/><circle cx='122' cy='104' r='.8'/><circle cx='186' cy='150' r='1.2'/><circle cx='80' cy='186' r='1'/></svg>")`)
      + behind2(`opacity:.7;animation:ws-th-bats 90s linear infinite;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='620' height='400' fill='%23C9B6F0' fill-opacity='.2'><defs><path id='b' d='${BAT}'/></defs><use href='%23b' transform='translate(110 80) rotate(-8)'/><use href='%23b' transform='translate(430 150) scale(.7) rotate(6)'/><use href='%23b' transform='translate(270 320) scale(1.2) rotate(-4)'/><use href='%23b' transform='translate(540 330) scale(.55)'/></svg>")`)
      + "@keyframes ws-th-bats{to{background-position:620px -200px}}\n",
  },
  {
    // A pumpkin to play with: orange face, a dark letter, faint ribs down the sides and a little green stalk on top.
    id: "halloween-pumpkins", slot: "dice", name: "Pumpkins", emoji: "🎃", price: 200, season,
    vars: {
      dice: "#FFA43A", "dice-edge": "#C2610E", letter: "#2B1404",
      // the ribs keep to the sides and the stalk to the top edge, clear of the letter in the middle
      "dice-texture": [
        svg("<g fill='none' stroke='#A04A00' stroke-width='2' stroke-opacity='.22' stroke-linecap='round'>"
          + "<path d='M15 9C4 32 4 68 15 91'/><path d='M85 9C96 32 96 68 85 91'/></g>"
          + "<path d='M46 2H54L53 11H47Z' fill='#4E7A2A' fill-opacity='.9'/>"
          + "<path d='M54 6C60 1 67 3 66 9' fill='none' stroke='#4E7A2A' stroke-width='1.6' stroke-opacity='.8' stroke-linecap='round'/>"),
        "radial-gradient(ellipse 30% 12% at 32% 16%, rgba(255,240,210,.55), rgba(255,240,210,0) 100%)",
        "linear-gradient(0deg, rgba(190,80,0,.22) 0%, rgba(190,80,0,0) 32%)",
      ].join(","),
    },
    css: round("32% 32% 28% 28% / 30% 30% 34% 34%"),
  },
  { id: "halloween-bats", slot: "effect", name: "Bat flutter", emoji: "🦇", price: 160, season },
  {
    // A cabinet in the dark with soft cobwebs in its top corners; cream pages with faint pumpkins and bats.
    id: "halloween-cobwebs", slot: "cover", name: "Cobwebs", emoji: "🕸️", price: 200, season,
    vars: {
      cabinet: "#2E1F47", "cabinet-edge": "#170E26", shelf: "#A8703F", "shelf-edge": "#6B4321",
      silhouette: WHITE_GHOST(0.18), "sticker-font": "var(--ws-font-display)",
      page: "#FFF1DC", "page-muted": "#6A4A2E", "page-accent": "#B04A0A", binding: "#E07B1A",
    },
    css: cabinet([
      `${coverSvg(`width='90' height='90'>${WEB}`)} left top/90px 90px no-repeat`,
      `${coverSvg(`width='90' height='90'><g transform='translate(90 0) scale(-1 1)'>${WEB}</g>`)} right top/90px 90px no-repeat`,
      coverSvg(`width='120' height='120'><g fill='%23E9DDFF' fill-opacity='.18'><circle cx='20' cy='30' r='1.2'/><circle cx='84' cy='16' r='1'/><circle cx='60' cy='74' r='1.3'/><circle cx='104' cy='96' r='.9'/><circle cx='14' cy='104' r='1'/></g>`),
      "radial-gradient(ellipse at 50% 0%, rgba(201,182,240,.10), transparent 70%)",
    ].join(","))
      + page(coverSvg(`width='96' height='96'><g fill='%23E07B1A' fill-opacity='.2'><ellipse cx='18' cy='20' rx='7' ry='5.5'/><ellipse cx='68' cy='70' rx='6' ry='4.8'/></g><g fill='%234E7A2A' fill-opacity='.3'><rect x='17' y='12.5' width='2' height='3'/><rect x='67' y='63.5' width='2' height='3'/></g><g fill='%237A4BC2' fill-opacity='.16'><path transform='translate(72 22) scale(.55)' d='${BAT}'/><path transform='translate(24 70) scale(.45)' d='${BAT}'/></g>`)),
  },
  { id: "halloween-pumpkin", slot: "avatar", name: "Pumpkin", emoji: "🎃", price: 60, season },
  { id: "halloween-ghost", slot: "avatar", name: "Friendly ghost", emoji: "👻", price: 80, season },
  { id: "halloween-bat", slot: "avatar", name: "Bat", emoji: "🦇", price: 60, season },
  // The word jar (shared/looks/marbles.js, jars.js; drawn in src/jarArt.js)
  { id: "halloween-potion", slot: "marble", name: "Potion drops", emoji: "🧪", price: 160, colours: ["#C6FF4D", "#3DDCB0", "#FF9A2E", "#FF4FA3", "#9B5CFF"], finish: "glow", season },
  { id: "halloween-pumpkin-jar", slot: "jar", name: "Pumpkin jar", emoji: "🎃", price: 200, shape: [[0.34, 0.14], [0.34, 0.2], ...arc(0.6, 0.48, 0.75, Math.PI * 0.9)], tint: "#FF8A1F", season },
];
