/*
 * The christmas shelf (see shared/seasons.js for when it's open, and docs/SHOP.md "Seasonal shelves").
 * Items for any slot, each written exactly as in that slot's own file (its header gives the format), plus
 * season: "christmas". Helpers for theme and dice css are in ../kit.js.
 *
 * An Australian Christmas is in summer, so the shelf leans on lights, baubles, candy canes and presents rather than
 * snow, and the sticker book goes to the beach.
 */
import { FONTS, behind, behind2, svg, round } from "../kit.js";

// The fairy lights: a drooping wire with a bulb hanging at each of six points, one tile repeated across the top.
// LIGHTS_ALL is every bulb, dim and still; LIGHTS_TWINKLE is every other bulb again, brighter, slowly pulsing.
const BULB = "<path d='M-2.4-9h4.8v4h-4.8z' fill='%23C9B27A'/><ellipse cy='1' rx='4.6' ry='6.6'/>";
const bulbs = (picks, glow) => picks.map(([x, y, c]) =>
  (glow ? `<circle cx='${x}' cy='${y + 1}' r='8' fill='${c}' fill-opacity='.22'/>` : "")
  + `<g transform='translate(${x} ${y}) scale(.7)' fill='${c}'>${BULB}</g>`).join("");
const SPOTS = [[20, 9, "%23FF5A5A"], [60, 15, "%23FFC53D"], [100, 16, "%235BD07A"], [140, 14, "%235AB0FF"], [180, 9, "%23FF8AD8"], [220, 5, "%23FFC53D"]];
const lights = (picks, glow, wire) => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='30'>${
  wire ? "<path d='M0 2Q60 19 120 11T240 2' fill='none' stroke='%23A9C4B0' stroke-opacity='.55' stroke-width='1.6'/>" : ""}${bulbs(picks, glow)}</svg>")`;
const LIGHTS_ALL = lights(SPOTS, false, true);
const LIGHTS_TWINKLE = lights(SPOTS.filter((_, i) => i % 2 === 0), true, false);
const GOLD_STARS = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260' fill='%23FFD978' fill-opacity='.22'><defs><path id='s' d='M0-6 1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5Z'/></defs><use href='%23s' transform='translate(40 90)'/><use href='%23s' transform='translate(190 60) scale(.7)'/><use href='%23s' transform='translate(120 170) scale(1.2)'/><use href='%23s' transform='translate(30 230) scale(.6)'/><use href='%23s' transform='translate(225 205) scale(.8)'/></svg>")`;

// The sticker book cover's helpers, as in covers.js.
const csvg = s => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>")`;
const cabinet = (pattern, extra = "") =>
  `$SEL .ws-cabinet{position:relative;isolation:isolate}` +
  `$SEL .ws-cabinet::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:6px;background:${pattern};${extra}}`;
const page = (pattern, extra = "") => `$SEL .ws-page{background:${pattern}, var(--ws-page) !important;${extra}}`;

export const CHRISTMAS = [
  {
    // Christmas night in the garden: a deep pine page, a cranberry tray, cream dice, star-gold highlights, a string of
    // fairy lights along the top (every other bulb slowly glows brighter) and a few faint gold stars.
    id: "christmas-lights", slot: "theme", name: "Fairy lights", emoji: "🌟", price: 120, scheme: "dark", season: "christmas",
    vars: {
      ink: "#0E2219", "ink-rgb": "14 34 25", text: "#F3F8EF", fg: "255 255 255", glow: "#1C3D2B",
      well: "#7D1E2A", "well-edge": "#4A0E16", dice: "#FBF6EA", "dice-edge": "#D8C8A4", letter: "#1A2A1F", "letter-lit": "#1A2A1F",
      amber: "#FFC53D", "amber-rgb": "255 197 61", "amber-soft": "#FFE08A", "amber-edge": "#B5850F",
      red: "#FF8A8A", "red-rgb": "255 138 138", green: "#7FE08F", "green-rgb": "127 224 143",
      mist: "#B3CBB9", faint: "rgba(255,255,255,0.08)", "on-light": "#0E2219", sticker: "#C8323C", bar: "#2F9E5B",
      ...FONTS,
    },
    css: behind(`opacity:.6;background-image:${LIGHTS_ALL},${GOLD_STARS};background-repeat:repeat-x,repeat;background-position:0 0,0 60px`)
      + behind2(`opacity:.55;background-image:${LIGHTS_TWINKLE};background-repeat:repeat-x;background-position:0 0;animation:ws-th-christmas-glow 6s ease-in-out infinite alternate`)
      + "@keyframes ws-th-christmas-glow{from{opacity:.2}to{opacity:.75}}\n",
  },
  {
    // A candy cane: a white face with red-and-white stripes round the rim (the middle stays plain for the letter).
    id: "christmas-candy", slot: "dice", name: "Candy cane", emoji: "🎀", price: 100, season: "christmas",
    vars: {
      dice: "#FFFDF8", "dice-edge": "#C42A3A", letter: "#5C0B16",
      "dice-texture": [
        svg("<defs><pattern id='c' width='12' height='12' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>"
          + "<rect width='5' height='12' fill='#D7263D'/></pattern></defs>"
          + "<path d='M0 0H100V100H0ZM9 9V91H91V9Z' fill='url(#c)' fill-rule='evenodd' fill-opacity='.7'/>"
          + "<rect x='9' y='9' width='82' height='82' rx='4' fill='none' stroke='#D7263D' stroke-width='1' stroke-opacity='.35'/>"),
        "linear-gradient(150deg, rgba(255,255,255,.7) 0%, rgba(255,255,255,0) 25%)",
      ].join(","),
    },
    css: round("14%"),
  },
  // Shiny baubles pop off the last letter and drop away, with gold stars along the word.
  { id: "christmas-baubles", slot: "effect", name: "Baubles", emoji: "🎄", price: 80, season: "christmas" },
  {
    // Christmas at the beach: a sea-blue cabinet with a string of lights along the top and gentle waves,
    // driftwood shelves, and sandy pages sprinkled with little stars and baubles.
    id: "christmas-beach", slot: "cover", name: "Beach Christmas", emoji: "🏖️", price: 100, season: "christmas",
    vars: {
      cabinet: "#125A66", "cabinet-edge": "#0A3940", shelf: "#A8825A", "shelf-edge": "#6B4F30",
      silhouette: "brightness(0) invert(1) opacity(.2)", "sticker-font": "var(--ws-font-display)",
      page: "#F7EBD0", "page-muted": "#5E4A2A", "page-accent": "#A01C2C", binding: "#C8323C",
    },
    css: cabinet([
      `${csvg(`width='120' height='30'><path d='M0 3Q30 18 60 10T120 3' fill='none' stroke='%23fff' stroke-opacity='.3' stroke-width='1.2'/><g fill-opacity='.8'><circle cx='15' cy='11' r='3' fill='%23FF6B6B'/><circle cx='45' cy='14' r='3' fill='%23FFC53D'/><circle cx='75' cy='9' r='3' fill='%2365D98A'/><circle cx='105' cy='5' r='3' fill='%2370BFFF'/></g>`)} 0 4px/120px 30px repeat-x`,
      `${csvg(`width='160' height='44'><g fill='none' stroke='%23fff' stroke-opacity='.09' stroke-width='1.5'><path d='M0 12C40 6 60 18 100 12S150 6 160 12'/><path d='M0 32C30 38 70 26 110 33S150 38 160 32'/></g>`)}`,
    ].join(","))
      + page(`${csvg(`width='90' height='90'><g fill='%23946A30' fill-opacity='.24'><circle cx='6' cy='9' r='1'/><circle cx='41' cy='12' r='1.1'/><circle cx='70' cy='60' r='.9'/><circle cx='12' cy='70' r='1'/><circle cx='52' cy='84' r='.7'/></g><path d='M28 40l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4z' fill='%23E0A82E' fill-opacity='.35'/><circle cx='74' cy='26' r='4' fill='%23C8323C' fill-opacity='.22'/><rect x='72.6' y='20.4' width='2.8' height='1.8' fill='%23946A30' fill-opacity='.3'/>`)}, radial-gradient(ellipse at 100% 100%, rgba(18,90,102,.1), transparent 55%)`),
  },
  { id: "christmas-present", slot: "avatar", name: "Present", emoji: "🎁", price: 25, season: "christmas" },
  { id: "christmas-snowman", slot: "avatar", name: "Snowman", emoji: "⛄", price: 40, season: "christmas" },
  { id: "christmas-reindeer", slot: "avatar", name: "Reindeer", emoji: "🦌", price: 60, season: "christmas" },
];
