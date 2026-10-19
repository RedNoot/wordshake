/*
 * Sticker book covers: the trophy cabinet and the sticker book pages ("My trophies" on the student's device).
 * With no cover worn, the theme's own cabinet and pages show (or the classic ones, if the theme sets none).
 *
 * A cover = { id, slot: "cover", name, emoji, price, unlock?, vars, css? }
 *   vars: every key in COVER_KEYS.
 *   css:  optional extra rules for the selector SEL ($SEL in the string), e.g. a pattern on the cabinet or pages.
 *         The cabinet and pages are drawn in src/Trophies.jsx (Cabinet, StickerBook, the .ws-page class).
 */
import { SEASONAL } from "./seasonal.js";
export const COVER_KEYS = [
  "cabinet", "cabinet-edge",       // the trophy cabinet's back and frame
  "shelf", "shelf-edge",           // the shelf planks
  "silhouette",                    // a CSS filter for trophies not won yet
  "sticker-font",                  // the font on stickers (a CSS font-family or var(--ws-font-…))
  "page", "page-muted", "page-accent", "binding",   // sticker book paper, quiet text, headings, spiral binding
];

export const SEL = "[data-ws-cover=\"$id\"]";

/*
 * How the patterns are drawn:
 *  - Shelf planks stay a mid-tone (close to classic's #A8703F): the "not won yet" nameplates use the theme's own text
 *    colour (white on classic, dark on light themes), so a mid-tone plank keeps them readable under any theme.
 *  - The cabinet's pattern sits in .ws-cabinet::before, above the cabinet colour and behind the trophies.
 *  - A page's pattern replaces the page background (its colour stays var(--ws-page)), kept faint behind the writing.
 */
const svg = s => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>")`;
const cabinet = (pattern, extra = "") =>
  `$SEL .ws-cabinet{position:relative;isolation:isolate}` +
  `$SEL .ws-cabinet::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:6px;background:${pattern};${extra}}`;
const page = (pattern, extra = "") => `$SEL .ws-page{background:${pattern}, var(--ws-page) !important;${extra}}`;
const noise = (freq, alpha) => svg(`width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.24 0 0 0 0 0.1 0 0 0 ${alpha} 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/>`);
const WHITE_GHOST = a => `brightness(0) invert(1) opacity(${a})`;

const BASE_COVERS = [
  {
    id: "treehouse", slot: "cover", name: "Treehouse", emoji: "🌳", price: 60,
    vars: {
      cabinet: "#2D5A27", "cabinet-edge": "#5B3B1E", shelf: "#A8703F", "shelf-edge": "#6B4321",
      silhouette: WHITE_GHOST(0.18), "sticker-font": "var(--ws-font-display)",
      page: "#E9D3A8", "page-muted": "#5A3F22", "page-accent": "#2B5F27", binding: "#6B4321",
    },
    css: cabinet(svg(`width='72' height='72'><g fill='%2396C878' fill-opacity='.2'><ellipse cx='14' cy='16' rx='10' ry='4.5' transform='rotate(-35 14 16)'/><ellipse cx='50' cy='38' rx='11' ry='5' transform='rotate(28 50 38)'/><ellipse cx='26' cy='60' rx='8' ry='3.5' transform='rotate(-12 26 60)'/><ellipse cx='64' cy='8' rx='7' ry='3' transform='rotate(40 64 8)'/></g>`))
      + page(`${noise(0.6, 0.28)}, linear-gradient(180deg, rgba(255,255,255,.18), transparent 40%)`),
  },
  {
    id: "castle", slot: "cover", name: "Castle", emoji: "🏰", price: 100,
    vars: {
      cabinet: "#575B62", "cabinet-edge": "#33363B", shelf: "#9C7A52", "shelf-edge": "#5E4930",
      silhouette: WHITE_GHOST(0.2), "sticker-font": "var(--ws-font-display)",
      page: "#F3E4C0", "page-muted": "#6A5532", "page-accent": "#8E1F1F", binding: "#4A4036",
    },
    css: cabinet(`${svg(`width='88' height='48'><g fill='none' stroke-width='2'><path d='M0 1H88M0 25H88M44 1V25M22 25V48M66 25V48' stroke='%23000' stroke-opacity='.25'/><path d='M0 3H88M0 27H88' stroke='%23fff' stroke-opacity='.07'/></g>`)}, radial-gradient(ellipse at 30% 0%, rgba(255,255,255,.08), transparent 60%)`)
      + page(`radial-gradient(ellipse at 15% 8%, rgba(255,255,255,.55), transparent 55%), radial-gradient(ellipse at 95% 100%, rgba(150,105,40,.2), transparent 60%), ${noise(0.04, 0.12)}`),
  },
  {
    id: "station", slot: "cover", name: "Space station", emoji: "🚀", price: 100,
    vars: {
      cabinet: "#3A4452", "cabinet-edge": "#7F8B9A", shelf: "#8A96A5", "shelf-edge": "#4B5563",
      silhouette: WHITE_GHOST(0.2), "sticker-font": "var(--ws-font-display)",
      page: "#E9EEF4", "page-muted": "#4A5666", "page-accent": "#1C5AA3", binding: "#5B6675",
    },
    css: cabinet([
      // rivets round the frame, panel seams, brushed metal
      "radial-gradient(circle, #C9D1DB 0 2px, #1E242C 2.6px 3.2px, transparent 3.8px) 0 2px/26px 12px repeat-x",
      "radial-gradient(circle, #C9D1DB 0 2px, #1E242C 2.6px 3.2px, transparent 3.8px) 0 calc(100% - 2px)/26px 12px repeat-x",
      "radial-gradient(circle, #C9D1DB 0 2px, #1E242C 2.6px 3.2px, transparent 3.8px) 2px 0/12px 26px repeat-y",
      "radial-gradient(circle, #C9D1DB 0 2px, #1E242C 2.6px 3.2px, transparent 3.8px) calc(100% - 2px) 0/12px 26px repeat-y",
      "repeating-linear-gradient(90deg, rgba(0,0,0,.25) 0 1px, rgba(255,255,255,.06) 1px 2px, transparent 2px 120px)",
      "repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px)",
    ].join(","), "box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)")
      + page([
        "linear-gradient(rgba(40,90,160,.16) 1px, transparent 1px) 0 0/70px 70px",
        "linear-gradient(90deg, rgba(40,90,160,.16) 1px, transparent 1px) 0 0/70px 70px",
        "linear-gradient(rgba(40,90,160,.08) 1px, transparent 1px) 0 0/14px 14px",
        "linear-gradient(90deg, rgba(40,90,160,.08) 1px, transparent 1px) 0 0/14px 14px",
      ].join(",")),
  },
  {
    id: "seaside", slot: "cover", name: "Seaside", emoji: "🌊", price: 60,
    vars: {
      cabinet: "#6B5F51", "cabinet-edge": "#433A30", shelf: "#A89070", "shelf-edge": "#6A5A44",
      silhouette: WHITE_GHOST(0.22), "sticker-font": "var(--ws-font-display)",
      page: "#F3E3C3", "page-muted": "#665233", "page-accent": "#0C6884", binding: "#0C6884",
    },
    css: cabinet(`${svg(`width='160' height='40'><g fill='none' stroke='%23fff' stroke-opacity='.09' stroke-width='1.5'><path d='M0 8C40 4 60 14 100 9S150 5 160 8'/><path d='M0 22C30 26 70 17 110 23S150 27 160 22'/><path d='M0 34C50 31 80 38 120 33S150 32 160 34'/></g>`)}, repeating-linear-gradient(180deg, rgba(0,0,0,.08) 0 1px, transparent 1px 9px)`)
      + page(`${svg(`width='64' height='64'><g fill='%23946A30' fill-opacity='.28'><circle cx='6' cy='9' r='1'/><circle cx='22' cy='30' r='.8'/><circle cx='41' cy='12' r='1.1'/><circle cx='56' cy='44' r='.9'/><circle cx='12' cy='52' r='1'/><circle cx='34' cy='58' r='.7'/><circle cx='50' cy='24' r='.7'/><circle cx='28' cy='5' r='.6'/></g>`)}, radial-gradient(ellipse at 100% 100%, rgba(12,104,132,.1), transparent 55%)`),
  },
  {
    id: "sweets", slot: "cover", name: "Sweet shop", emoji: "🍭", price: 100,
    vars: {
      cabinet: "#A8336A", "cabinet-edge": "#F4BBD4", shelf: "#C0803F", "shelf-edge": "#7A4A1C",
      silhouette: WHITE_GHOST(0.26), "sticker-font": "var(--ws-font-display)",
      page: "#FCEFF7", "page-muted": "#7A4763", "page-accent": "#A3195B", binding: "#E07AAE",
    },
    css: cabinet("repeating-linear-gradient(135deg, rgba(255,255,255,.14) 0 16px, transparent 16px 32px)")
      + page(svg(`width='72' height='72'><g fill-opacity='.35'><circle cx='10' cy='12' r='3' fill='%238FD6B4'/><circle cx='44' cy='20' r='2.5' fill='%23FFD36E'/><circle cx='26' cy='46' r='3' fill='%238EC5F0'/><circle cx='62' cy='54' r='2.5' fill='%23C9A4F0'/><circle cx='54' cy='4' r='2' fill='%238EC5F0'/><circle cx='6' cy='64' r='2' fill='%23FFD36E'/></g>`)),
  },
  {
    id: "notebook", slot: "cover", name: "Spotty notebook", emoji: "📒", price: 150,
    vars: {
      cabinet: "#17747D", "cabinet-edge": "#F5B700", shelf: "#D0703A", "shelf-edge": "#8E3E17",
      silhouette: WHITE_GHOST(0.2), "sticker-font": "var(--ws-font-display)",
      page: "#FFFDF6", "page-muted": "#5A5370", "page-accent": "#C0185A", binding: "#E5484D",
    },
    css: cabinet("radial-gradient(circle, rgba(255,255,255,.13) 0 6px, transparent 6.5px) 0 0/34px 34px, radial-gradient(circle, rgba(245,183,0,.16) 0 4px, transparent 4.5px) 17px 17px/34px 34px")
      + page([
        "radial-gradient(circle, rgba(90,83,112,.22) 0 1.2px, transparent 1.7px) 0 0/16px 16px",
        "radial-gradient(circle at 100% 0%, rgba(245,183,0,.16) 0 46px, transparent 47px)",
        "radial-gradient(circle at 0% 100%, rgba(23,116,125,.12) 0 38px, transparent 39px)",
      ].join(","))
      // a strip of washi tape across the top edge
      + `$SEL .ws-page::after{content:"";position:absolute;top:-7px;left:42%;width:58px;height:15px;transform:rotate(-4deg);pointer-events:none;border-radius:2px;opacity:.85;
  background:repeating-linear-gradient(90deg, #FF8FB1 0 6px, #FFD36E 6px 12px)}`,
  },
  {
    id: "library", slot: "cover", name: "Library", emoji: "📚", price: 0, unlock: "sound-collector",
    vars: {
      cabinet: "#4A1C17", "cabinet-edge": "#2A0F0B", shelf: "#9A6838", "shelf-edge": "#5C3A1A",
      silhouette: WHITE_GHOST(0.17), "sticker-font": "var(--ws-font-display)",
      page: "#F6EDD6", "page-muted": "#5E4F36", "page-accent": "#7A1F1A", binding: "#B08A2E",
    },
    css: cabinet(`${noise(0.5, 0.35)}, radial-gradient(ellipse at 50% 0%, rgba(255,220,180,.08), transparent 70%)`,
      // gold tooling: a double rule just inside the frame
      "inset:4px;border:2px solid rgba(214,175,85,.5);outline:1px solid rgba(214,175,85,.32);outline-offset:-6px")
      + page("linear-gradient(90deg, rgba(120,80,20,.1), transparent 18%, transparent 82%, rgba(120,80,20,.08)), radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.4), transparent 60%)",
        "box-shadow:inset 0 0 0 4px var(--ws-page), inset 0 0 0 5px rgba(176,138,46,.55), 0 1px 0 rgba(0,0,0,.06), 0 8px 18px rgba(0,0,0,.25) !important"),
  },
];

// Plus this slot's items from the seasonal shelves (shared/looks/seasons/).
export const COVERS = [...BASE_COVERS, ...SEASONAL.filter(i => i.slot === "cover")];
