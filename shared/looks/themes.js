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

import { FONTS, behind, behind2 } from "./kit.js";
import { SEASONAL } from "./seasonal.js";

const STARS = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='230' height='230' fill='white'><circle cx='12' cy='20' r='1.2'/><circle cx='70' cy='60' r='.8'/><circle cx='150' cy='14' r='1.5'/><circle cx='200' cy='90' r='1'/><circle cx='40' cy='130' r='1.6'/><circle cx='110' cy='110' r='.9'/><circle cx='180' cy='170' r='1.3'/><circle cx='90' cy='200' r='1'/><circle cx='20' cy='210' r='.8'/><circle cx='130' cy='160' r='.7'/></svg>")`;

const BASE_THEMES = [
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
    id: "rednut", slot: "theme", name: "RedNut", emoji: "🌰", price: 300, scheme: "light",
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
  {
    // Under the sea: deep teal water, white-shell dice, a sunlit-gold highlight, bubbles drifting up behind everything.
    id: "ocean", slot: "theme", name: "Ocean", emoji: "🌊", price: 120, scheme: "dark",
    vars: {
      ink: "#082C3D", "ink-rgb": "8 44 61", text: "#ECF8FB", fg: "255 255 255", glow: "#0F5468",
      well: "#0B6577", "well-edge": "#05394A", dice: "#F3FBFA", "dice-edge": "#BCDCDA", letter: "#0A2A3A", "letter-lit": "#0A2A3A",
      amber: "#FFC94A", "amber-rgb": "255 201 74", "amber-soft": "#FFE08F", "amber-edge": "#B8861A",
      red: "#FF7A8A", "red-rgb": "255 122 138", green: "#5CE0A8", "green-rgb": "92 224 168",
      mist: "#A3C6D1", faint: "rgba(255,255,255,0.09)", "on-light": "#082C3D", sticker: "#1E8FB0", bar: "#2AA3B8",
      ...FONTS,
    },
    css: behind(`top:0;bottom:-320px;opacity:.5;animation:ws-th-rise 40s linear infinite;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='320' fill='white' fill-opacity='.10' stroke='white' stroke-opacity='.28' stroke-width='1.5'><circle cx='30' cy='290' r='9'/><circle cx='58' cy='240' r='4'/><circle cx='120' cy='180' r='14'/><circle cx='190' cy='280' r='6'/><circle cx='210' cy='120' r='10'/><circle cx='80' cy='70' r='6'/><circle cx='160' cy='40' r='3.5'/><circle cx='20' cy='150' r='4.5'/></svg>")`)
      + behind2(`opacity:.6;animation:ws-th-swim 80s linear infinite;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420' fill='white' fill-opacity='.16'><defs><g id='f'><ellipse rx='18' ry='9'/><path d='M-14 0L-29-10V10z'/></g></defs><use href='%23f' transform='translate(120 90)'/><use href='%23f' transform='translate(450 240) scale(.65)'/><use href='%23f' transform='translate(270 360) scale(1.3)'/><use href='%23f' transform='translate(505 268) scale(.5)'/></svg>")`)
      + "@keyframes ws-th-rise{to{transform:translateY(-320px)}}\n@keyframes ws-th-swim{to{background-position:640px 0}}\n",
  },
  {
    // A mossy wood: dark moss page, a bark-brown dice tray, birch-cream dice and an acorn-gold highlight.
    id: "forest", slot: "theme", name: "Forest", emoji: "🌲", price: 120, scheme: "dark",
    vars: {
      ink: "#15241A", "ink-rgb": "21 36 26", text: "#EEF5E8", fg: "255 255 255", glow: "#24402B",
      well: "#5C3F2A", "well-edge": "#362416", dice: "#F5EFDC", "dice-edge": "#D1C29C", letter: "#1F2A1B", "letter-lit": "#1F2A1B",
      amber: "#F5B83D", "amber-rgb": "245 184 61", "amber-soft": "#F9D88A", "amber-edge": "#9E6C10",
      red: "#FF8070", "red-rgb": "255 128 112", green: "#9BDB6E", "green-rgb": "155 219 110",
      mist: "#AEC4A7", faint: "rgba(255,255,255,0.08)", "on-light": "#15241A", sticker: "#4E8F3E", bar: "#7A9A3A",
      ...FONTS,
    },
    css: behind(`top:-240px;bottom:0;animation:ws-th-fall 70s linear infinite;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><defs><g id='l'><path d='M0 0C7-11 23-13 34-8C27 3 11 7 0 0z'/><path d='M3-1L29-7' fill='none' stroke='%2315241A' stroke-opacity='.45' stroke-width='1.3'/></g></defs><g fill='%239BDB6E' fill-opacity='.26'><use href='%23l' transform='translate(20 40) rotate(-10)'/><use href='%23l' transform='translate(150 110) rotate(35) scale(1.2)'/><use href='%23l' transform='translate(70 190) rotate(-40) scale(.9)'/></g><g fill='%23F5B83D' fill-opacity='.22'><use href='%23l' transform='translate(170 20) rotate(60) scale(.8)'/><use href='%23l' transform='translate(30 120) rotate(15) scale(.7)'/><use href='%23l' transform='translate(190 200) rotate(-70) scale(.75)'/></g></svg>")`)
      + "@keyframes ws-th-fall{to{transform:translateY(240px)}}\n",
  },
  {
    // A bright day out: pale-sky page, a sky-blue tray, a sunny glow at the top and a marigold highlight.
    // (A pure sunshine yellow can't carry text on a light page, so the highlight is a deep marigold and the yellow is the sun.)
    id: "sunny", slot: "theme", name: "Sunny Day", emoji: "☀️", price: 120, scheme: "light",
    vars: {
      ink: "#EAF5FF", "ink-rgb": "234 245 255", text: "#10314C", fg: "16 49 76", glow: "#FFF1A8",
      well: "#3B95DC", "well-edge": "#1F6AA8", dice: "#FFFFFF", "dice-edge": "#FFD84A", letter: "#10314C", "letter-lit": "#FFFFFF",
      amber: "#D96F00", "amber-rgb": "217 111 0", "amber-soft": "#A85200", "amber-edge": "#8A4300",
      red: "#C42B3A", "red-rgb": "196 43 58", green: "#1C7F3E", "green-rgb": "28 127 62",
      mist: "#4A6278", faint: "rgba(16,49,76,0.14)", "on-light": "#10314C", sticker: "#3B95DC", bar: "#FFC21A",
      ...FONTS,
    },
    css: behind(`background:radial-gradient(circle at 92% 6%, rgba(255,214,51,.55) 0 60px, rgba(255,226,102,.25) 61px 120px, transparent 121px),
    radial-gradient(ellipse 120px 34px at 12% 14%, rgba(255,255,255,.9) 98%, transparent),
    radial-gradient(ellipse 90px 26px at 18% 11%, rgba(255,255,255,.9) 98%, transparent),
    radial-gradient(ellipse 140px 36px at 70% 92%, rgba(255,255,255,.8) 98%, transparent)`),
  },
  {
    // Sweet shop: pale candy-pink page, a mint tray, white dice with a pink lip and a raspberry highlight.
    id: "bubblegum", slot: "theme", name: "Bubblegum", emoji: "🍬", price: 120, scheme: "light",
    vars: {
      ink: "#FFF0F6", "ink-rgb": "255 240 246", text: "#4A1238", fg: "74 18 56", glow: "#FFFFFF",
      well: "#7ED9C0", "well-edge": "#3FAF92", dice: "#FFFFFF", "dice-edge": "#F6BFD6", letter: "#4A1238", "letter-lit": "#FFFFFF",
      amber: "#D62F84", "amber-rgb": "214 47 132", "amber-soft": "#A81E63", "amber-edge": "#8A1650",
      red: "#B83A12", "red-rgb": "184 58 18", green: "#0E7F66", "green-rgb": "14 127 102",
      mist: "#7A4A68", faint: "rgba(74,18,56,0.14)", "on-light": "#4A1238", sticker: "#F07AB0", bar: "#4FC7A6",
      ...FONTS,
    },
    css: behind(`opacity:.9;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><circle cx='16' cy='16' r='6' fill='%23FFC4DD'/><circle cx='64' cy='64' r='6' fill='%23BDEFE0'/><circle cx='64' cy='18' r='3' fill='%23FFD9E8'/><circle cx='18' cy='66' r='3' fill='%23D6F5EC'/></svg>")`),
  },
  {
    // Deep space: near-black with a violet nebula glow, a starfield that slowly twinkles, and star-gold highlights.
    id: "space", slot: "theme", name: "Outer Space", emoji: "🚀", price: 300, scheme: "dark",
    vars: {
      ink: "#07071A", "ink-rgb": "7 7 26", text: "#F2F1FF", fg: "255 255 255", glow: "#24195A",
      well: "#2A2266", "well-edge": "#4B3FA8", dice: "#F4F3FF", "dice-edge": "#C6C1EC", letter: "#16133A", "letter-lit": "#16133A",
      amber: "#FFC93D", "amber-rgb": "255 201 61", "amber-soft": "#FFE38C", "amber-edge": "#B8861A",
      red: "#FF6F8E", "red-rgb": "255 111 142", green: "#5EE6A6", "green-rgb": "94 230 166",
      mist: "#ABA8D6", faint: "rgba(255,255,255,0.09)", "on-light": "#07071A", sticker: "#6A5CE0", bar: "#7A6BEA",
      ...FONTS,
    },
    css: behind(`background-image:${STARS},${STARS};background-position:0 0,47px 83px;background-size:auto,173px 173px;animation:ws-th-twinkle 7s ease-in-out infinite alternate`)
      + behind2(`opacity:.7;background-repeat:no-repeat;background-position:right 4% top 9%,right 6% bottom 5%;background-size:min(34vw,150px) auto,min(14vw,60px) auto;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'><defs><radialGradient id='p' cx='.35' cy='.3'><stop offset='0' stop-color='%23CFC2FF'/><stop offset='.6' stop-color='%236A5CE0'/><stop offset='1' stop-color='%232A2266'/></radialGradient></defs><g transform='rotate(-16 60 40)' fill='none' stroke='%23FFC93D' stroke-opacity='.75' stroke-width='3'><ellipse cx='60' cy='40' rx='52' ry='11'/></g><circle cx='60' cy='40' r='24' fill='url(%23p)'/><g transform='rotate(-16 60 40)' fill='none' stroke='%23FFC93D' stroke-opacity='.85' stroke-width='3'><path d='M8 40A52 11 0 0 0 112 40'/></g></svg>"),
  url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><defs><radialGradient id='m' cx='.35' cy='.3'><stop offset='0' stop-color='%23FFC2A8'/><stop offset='.7' stop-color='%23E0607E'/><stop offset='1' stop-color='%237A2A4A'/></radialGradient></defs><circle cx='25' cy='25' r='21' fill='url(%23m)'/><circle cx='18' cy='30' r='4' fill='%237A2A4A' fill-opacity='.35'/><circle cx='31' cy='17' r='2.5' fill='%237A2A4A' fill-opacity='.3'/></svg>")`)
      + "@keyframes ws-th-twinkle{from{opacity:.4}to{opacity:.95}}\n",
  },
  {
    // A volcano at night: charcoal rock, a basalt tray, lava-orange highlights and an ember glow rising from below.
    id: "volcano", slot: "theme", name: "Volcano", emoji: "🌋", price: 300, scheme: "dark",
    vars: {
      ink: "#1A1715", "ink-rgb": "26 23 21", text: "#F8F0EA", fg: "255 255 255", glow: "#3B2117",
      well: "#3A302B", "well-edge": "#FF6A1A", dice: "#F6EDE4", "dice-edge": "#D3BFAC", letter: "#241A15", "letter-lit": "#241A15",
      amber: "#FF7A1F", "amber-rgb": "255 122 31", "amber-soft": "#FFB070", "amber-edge": "#A8430A",
      red: "#FF6B9A", "red-rgb": "255 107 154", green: "#6FD98F", "green-rgb": "111 217 143",
      mist: "#BBA89C", faint: "rgba(255,255,255,0.08)", "on-light": "#1A1715", sticker: "#D9541A", bar: "#E0661F",
      ...FONTS,
    },
    css: behind(`background:radial-gradient(120% 45% at 50% 108%, rgba(255,106,26,.30), rgba(255,60,20,.10) 55%, transparent 75%);animation:ws-th-ember 9s ease-in-out infinite alternate`)
      + "@keyframes ws-th-ember{from{opacity:.65}to{opacity:1}}\n",
  },
  {
    // Polar ice: ice-white page, a glacier-blue tray, frosted dice, a deep glacier-blue highlight and a slow snowfall.
    id: "arctic", slot: "theme", name: "Arctic", emoji: "❄️", price: 300, scheme: "light",
    vars: {
      ink: "#EEF6FB", "ink-rgb": "238 246 251", text: "#0B2D44", fg: "11 45 68", glow: "#FFFFFF",
      well: "#5AA6D0", "well-edge": "#2F739A", dice: "#FFFFFF", "dice-edge": "#C4DDEC", letter: "#0B2D44", "letter-lit": "#FFFFFF",
      amber: "#1660C8", "amber-rgb": "22 96 200", "amber-soft": "#0F4C9E", "amber-edge": "#0B3A7A",
      red: "#C2321E", "red-rgb": "194 50 30", green: "#147A4A", "green-rgb": "20 122 74",
      mist: "#4C6779", faint: "rgba(11,45,68,0.14)", "on-light": "#0B2D44", sticker: "#5AA6D0", bar: "#3F8FC0",
      ...FONTS,
      cabinet: "#DCEBF5", "cabinet-edge": "#2F739A", shelf: "#A7CDE4", "shelf-edge": "#4C86A8", silhouette: "brightness(0) opacity(.2)", "sticker-font": "var(--ws-font-display)",
      page: "#F4FAFD", "page-muted": "#4C6779", "page-accent": "#1660C8", binding: "#2F739A",
    },
    css: behind(`top:-300px;bottom:0;opacity:.9;animation:ws-th-snow 45s linear infinite;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='300'><defs><path id='a' d='M0 0V-10M-3.2-7.4L0-4.8L3.2-7.4'/><g id='f'><use href='%23a'/><use href='%23a' transform='rotate(60)'/><use href='%23a' transform='rotate(120)'/><use href='%23a' transform='rotate(180)'/><use href='%23a' transform='rotate(240)'/><use href='%23a' transform='rotate(300)'/></g></defs><g fill='none' stroke='%2389BCDB' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><use href='%23f' transform='translate(28 34)'/><use href='%23f' transform='translate(168 26) scale(.7)'/><use href='%23f' transform='translate(96 92) scale(.55)'/><use href='%23f' transform='translate(145 160) scale(1.15)'/><use href='%23f' transform='translate(40 205) scale(.75)'/><use href='%23f' transform='translate(196 248) scale(.6)'/><use href='%23f' transform='translate(105 272) scale(.9)'/></g></svg>")`)
      + "@keyframes ws-th-snow{to{transform:translateY(300px)}}\n",
  },
  {
    // An arcade after dark: purple-black, dark glowing dice with cyan letters, neon-pink highlights, a retro floor grid.
    id: "neon", slot: "theme", name: "Neon Arcade", emoji: "🕹️", price: 700, scheme: "dark",
    vars: {
      ink: "#0C0718", "ink-rgb": "12 7 24", text: "#F7F2FF", fg: "255 255 255", glow: "#2D0F45",
      well: "#1A1033", "well-edge": "#FF4FB5", dice: "#18122E", "dice-edge": "#00C8E0", letter: "#7DF4FF", "letter-lit": "#0C0718",
      amber: "#FF4FB5", "amber-rgb": "255 79 181", "amber-soft": "#FF9AD6", "amber-edge": "#B0207A",
      red: "#FF8A3D", "red-rgb": "255 138 61", green: "#3DF5C0", "green-rgb": "61 245 192",
      mist: "#B4A6D6", faint: "rgba(255,255,255,0.10)", "on-light": "#0C0718", sticker: "#00C8E0", bar: "#FF4FB5",
      ...FONTS,
    },
    css: behind(`top:auto;height:38%;opacity:.25;
  background-image:linear-gradient(rgba(0,200,224,.0) 0 92%, rgba(0,200,224,.9) 92%),linear-gradient(90deg, rgba(255,79,181,.0) 0 94%, rgba(255,79,181,.9) 94%);
  background-size:100% 36px, 60px 100%;
  -webkit-mask-image:linear-gradient(transparent, #000);mask-image:linear-gradient(transparent, #000)`)
      + `$SEL .ws-die{box-shadow:inset 0 0 0 2px rgba(0,200,224,.45), inset 0 -5px 0 var(--ws-dice-edge), 0 0 10px rgba(0,200,224,.25)}
$SEL .ws-btn.ws-display{box-shadow:0 0 14px rgb(var(--ws-amber-rgb) / .35)}
`,
  },
  {
    // The Keen bean prize, in polished metal: gold dice (a touch darker low down than the contrast rule likes, on purpose),
    // a bronze tray with a bright rim, brushed-metal grain, a slow sheen sweeping across, a gold frame round the screen
    // and a velvet sticker cabinet.
    id: "golden", slot: "theme", name: "Golden", emoji: "✨", price: 0, unlock: "weeks-10", scheme: "dark",
    vars: {
      ink: "#1C1408", "ink-rgb": "28 20 8", text: "#FFF6E0", fg: "255 255 255", glow: "#4A3410",
      well: "#5A3E0E", "well-edge": "#F2C94C", dice: "#F0CC5C", "dice-edge": "#8A6410", letter: "#2A1C06", "letter-lit": "#2A1C06",
      amber: "#FFC93C", "amber-rgb": "255 201 60", "amber-soft": "#FFE28A", "amber-edge": "#B8860B",
      red: "#FF7A6E", "red-rgb": "255 122 110", green: "#8FDB7E", "green-rgb": "143 219 126",
      mist: "#D2BF98", faint: "rgba(255,230,170,0.12)", "on-light": "#1C1408", sticker: "#D9A632", bar: "#E0B040",
      ...FONTS,
      cabinet: "#3D0F1F", "cabinet-edge": "#1A050C", shelf: "#D9A632", "shelf-edge": "#8A6410", silhouette: "brightness(0) invert(1) opacity(.18)", "sticker-font": "var(--ws-font-display)",
      page: "#FFF8E7", "page-muted": "#6E5A36", "page-accent": "#8F5200", binding: "#B8860B",
    },
    css: behind(`background-image:repeating-linear-gradient(100deg, rgba(255,220,140,.035) 0 2px, transparent 2px 6px),
    linear-gradient(160deg, rgba(255,214,110,.16), transparent 45%, rgba(255,214,110,.10))`)
      + behind2(`background:linear-gradient(115deg, transparent 35%, rgba(255,226,140,.10) 45%, rgba(255,244,200,.22) 50%, rgba(255,226,140,.10) 55%, transparent 65%) no-repeat;
  background-size:300% 100%;animation:ws-th-sheen 9s ease-in-out infinite`)
      + `$SEL{--ws-dice-texture:linear-gradient(150deg, rgba(255,250,215,.95) 0%, rgba(255,250,215,0) 28%),linear-gradient(150deg, rgba(255,250,215,0) 62%, rgba(255,250,215,.55) 68%, rgba(255,250,215,0) 74%),linear-gradient(0deg, rgba(130,85,0,.38) 0%, rgba(130,85,0,0) 45%)}
$SEL .ws-root,$SEL.ws-root{box-shadow:inset 0 0 0 3px #F7D774, inset 0 0 0 7px #8A6410}
@keyframes ws-th-sheen{from{background-position:100% 0}to{background-position:0 0}}
`,
  },
];

// Plus this slot's items from the seasonal shelves (shared/looks/seasons/).
export const THEMES = [...BASE_THEMES, ...SEASONAL.filter(i => i.slot === "theme")];
