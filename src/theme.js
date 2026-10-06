/* ---------- look & feel ----------
 * Every colour is a CSS variable, so the whole app can switch look without re-rendering.
 * "classic" is WordShake's own night-sky look; "rednut" is the RedNut design system ("Sunbaked" riso zine:
 * warm paper, red/marigold inks, teal contrast, chunky ink borders, grain), from rednut-tokens.css v1.0.
 * The teacher picks one in Settings; the big screen and every joined device follow it.
 */
export const THEMES = ["classic", "rednut"];

export const T = {
  ink: "var(--ws-ink)",            // page background (and text on amber/green fills)
  text: "var(--ws-text)",          // main text
  well: "var(--ws-well)", wellEdge: "var(--ws-well-edge)",
  dice: "var(--ws-dice)", diceEdge: "var(--ws-dice-edge)", letter: "var(--ws-letter)",
  amber: "var(--ws-amber)",        // the highlight colour: scores, buttons, today's sound
  amberSoft: "var(--ws-amber-soft)", amberEdge: "var(--ws-amber-edge)",
  red: "var(--ws-red)", green: "var(--ws-green)",
  mist: "var(--ws-mist)",          // quieter text
  faint: "var(--ws-faint)",        // hairlines
  onLight: "var(--ws-on-light)",   // text on light fills (gold/silver stickers), whatever the theme
  sticker: "var(--ws-sticker)", bar: "var(--ws-bar)",
};

// Apply a theme to the whole page (the <html> element), so the page background follows too.
export function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : "classic";
  if (document.documentElement.dataset.wsTheme !== t) document.documentElement.dataset.wsTheme = t;
}

const VARS = {
  classic: {
    ink: "#0E1A2B", "ink-rgb": "14 26 43", text: "#EFF4F9", fg: "255 255 255", glow: "#16283f",
    well: "#0F4D5C", "well-edge": "#0A3540", dice: "#F6F1E3", "dice-edge": "#DCD3BB", letter: "#1B2A41",
    amber: "#FFB020", "amber-rgb": "255 176 32", "amber-soft": "#FFD27A", "amber-edge": "#B87A0A",
    red: "#FF5D5D", "red-rgb": "255 93 93", green: "#57C785", "green-rgb": "87 199 133",
    mist: "#9FB3C8", faint: "rgba(255,255,255,0.08)", "on-light": "#0E1A2B", sticker: "#3D7BD9", bar: "#3E7CA6",
    "font-body": "'Atkinson Hyperlegible',system-ui,sans-serif", "font-display": "'Fredoka','Atkinson Hyperlegible',system-ui,sans-serif",
    "display-tracking": "0",
    cabinet: "#2B1D13", "cabinet-edge": "#120C07", shelf: "#A8703F", "shelf-edge": "#6B4321", silhouette: "brightness(0) invert(1) opacity(.16)", "sticker-font": "var(--ws-font-display)",
    page: "#FFFBF0", "page-muted": "#7A715F", "page-accent": "#B4560E", binding: "#3B3B3B",
  },
  rednut: {
    ink: "#FBF3E0", "ink-rgb": "251 243 224", text: "#231F1A", fg: "35 31 26", glow: "#FFF9EC",
    well: "#0FA091", "well-edge": "#231F1A", dice: "#FFFBF2", "dice-edge": "#D8C9A8", letter: "#231F1A",
    amber: "#FF4D2E", "amber-rgb": "255 77 46", "amber-soft": "#C23A12", "amber-edge": "#231F1A",
    red: "#C23A12", "red-rgb": "194 58 18", green: "#0B7A6E", "green-rgb": "15 160 145",
    mist: "#6B6459", faint: "rgba(35,31,26,0.16)", "on-light": "#231F1A", sticker: "#0FA091", bar: "#F5A300",
    "font-body": "'Work Sans',system-ui,sans-serif", "font-display": "'Syne','Work Sans',system-ui,sans-serif",
    "display-tracking": "-0.01em",
    cabinet: "#F3E3C0", "cabinet-edge": "#231F1A", shelf: "#F5A300", "shelf-edge": "#231F1A", silhouette: "brightness(0) opacity(.2)", "sticker-font": "var(--ws-font-body)",
    page: "#FFFDF7", "page-muted": "#6B6459", "page-accent": "#C23A12", binding: "#231F1A",
  },
};
const block = vars => Object.entries(vars).map(([k, v]) => `--ws-${k}:${v};`).join("");

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Atkinson+Hyperlegible:wght@400;700&family=Syne:wght@600;700;800&family=Work+Sans:wght@400;500;600;700&display=swap');
:root,:root[data-ws-theme="classic"]{${block(VARS.classic)}color-scheme:dark}
:root[data-ws-theme="rednut"]{${block(VARS.rednut)}color-scheme:light}
html,body{background:var(--ws-ink)}
.ws-root{font-family:var(--ws-font-body);}
.ws-display{font-family:var(--ws-font-display);letter-spacing:var(--ws-display-tracking);}
@keyframes ws-tumble{0%{transform:translateY(-46px) rotate(var(--rt)) scale(.6);opacity:0}60%{transform:translateY(5px) rotate(var(--rt)) scale(1.05);opacity:1}100%{transform:translateY(0) rotate(var(--rt)) scale(1)}}
@keyframes ws-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes ws-pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes ws-draw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes ws-spin{to{transform:rotate(360deg)}}
@keyframes ws-slap{0%{transform:scale(2.3) rotate(-16deg);opacity:0}45%{transform:scale(.9) rotate(4deg);opacity:1}70%{transform:scale(1.05) rotate(-1deg)}100%{transform:scale(1) rotate(0)}}
@keyframes ws-confetti{0%{transform:translate3d(0,-10vh,0) rotate(0);opacity:1}100%{transform:translate3d(var(--dx),105vh,0) rotate(var(--rot));opacity:0}}
@keyframes ws-shine{0%,55%{transform:translateX(-160%) skewX(-20deg)}100%{transform:translateX(260%) skewX(-20deg)}}
@keyframes ws-turn{from{transform:perspective(1000px) rotateY(-60deg);transform-origin:left center;opacity:0}to{transform:none;opacity:1}}
@keyframes ws-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes ws-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ws-fade{animation:ws-fade .45s ease both}
@media (prefers-reduced-motion: reduce){.ws-root *{animation:none !important;transition:none !important}}
.ws-btn{transition:transform .08s ease, filter .15s ease}
.ws-btn:hover{filter:brightness(1.1)}
.ws-btn:active{transform:scale(.97)}
.ws-btn:focus-visible{outline:3px solid var(--ws-amber);outline-offset:2px}

/* RedNut extras: chunky ink borders, the ink-stamp press, and paper grain. */
:root[data-ws-theme="rednut"] .ws-btn.ws-display{outline:2px solid var(--ws-text);outline-offset:-2px}
:root[data-ws-theme="rednut"] .ws-btn.ws-display:hover{filter:none;transform:translate(-1px,-1px)}
:root[data-ws-theme="rednut"] .ws-btn.ws-display:active{transform:translate(1px,1px)}
:root[data-ws-theme="rednut"] .ws-btn:focus-visible{outline:3px solid var(--ws-green);outline-offset:2px}
:root[data-ws-theme="rednut"] .ws-die{outline:2px solid var(--ws-text);outline-offset:-2px}
:root[data-ws-theme="rednut"] .ws-page{box-shadow:4px 4px 0 var(--ws-text) !important;outline:2px solid var(--ws-text)}
:root[data-ws-theme="rednut"] .ws-root::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.35;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/></svg>")}
`;
