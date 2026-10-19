/* ---------- look & feel ----------
 * Every colour is a CSS variable, so the whole app can switch look without re-rendering.
 * "classic" is WordShake's own night-sky look, and what the big screen always shows. Every other look (themes,
 * dice, sticker books) is bought in the shop and worn on a student's own device: see shared/looks/ and looks.js.
 */
import { LOOKS_CSS } from "./looks.js";
export { applyLooks } from "./looks.js";

export const T = {
  ink: "var(--ws-ink)",            // page background (and text on amber/green fills)
  text: "var(--ws-text)",          // main text
  well: "var(--ws-well)", wellEdge: "var(--ws-well-edge)",
  dice: "var(--ws-dice)", diceEdge: "var(--ws-dice-edge)", letter: "var(--ws-letter)", letterLit: "var(--ws-letter-lit)",
  diceTexture: "var(--ws-dice-texture, none)",   // a dice style's pattern over the face colour
  amber: "var(--ws-amber)",        // the highlight colour: scores, buttons, today's sound
  amberSoft: "var(--ws-amber-soft)", amberEdge: "var(--ws-amber-edge)",
  red: "var(--ws-red)", green: "var(--ws-green)",
  mist: "var(--ws-mist)",          // quieter text
  faint: "var(--ws-faint)",        // hairlines
  onLight: "var(--ws-on-light)",   // text on light fills (gold/silver stickers), whatever the theme
  sticker: "var(--ws-sticker)", bar: "var(--ws-bar)",
};

// The big screen: always the classic look.
export function applyTheme() {
  if (document.documentElement.dataset.wsTheme !== "classic") document.documentElement.dataset.wsTheme = "classic";
}


export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Atkinson+Hyperlegible:wght@400;700&family=Syne:wght@600;700;800&family=Work+Sans:wght@400;500;600;700&display=swap');
${LOOKS_CSS}
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
@keyframes ws-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes ws-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes ws-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ws-fade{animation:ws-fade .45s ease both}
@media (prefers-reduced-motion: reduce){.ws-root *,.ws-root::before,.ws-root::after{animation:none !important;transition:none !important}}
.ws-btn{transition:transform .08s ease, filter .15s ease}
.ws-btn:hover{filter:brightness(1.1)}
.ws-btn:active{transform:scale(.97)}
.ws-btn:focus-visible{outline:3px solid var(--ws-amber);outline-offset:2px}

`;
