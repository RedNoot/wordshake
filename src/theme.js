/* ---------- look & feel ---------- */
export const T = {
  ink: "#0E1A2B", well: "#0F4D5C", wellEdge: "#0A3540", dice: "#F6F1E3", diceEdge: "#DCD3BB",
  letter: "#1B2A41", amber: "#FFB020", red: "#FF5D5D", mist: "#9FB3C8", faint: "rgba(255,255,255,0.08)",
  green: "#57C785",
};
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Atkinson+Hyperlegible:wght@400;700&display=swap');
.ws-root{font-family:'Atkinson Hyperlegible',system-ui,sans-serif;}
.ws-display{font-family:'Fredoka','Atkinson Hyperlegible',system-ui,sans-serif;}
@keyframes ws-tumble{0%{transform:translateY(-46px) rotate(var(--rt)) scale(.6);opacity:0}60%{transform:translateY(5px) rotate(var(--rt)) scale(1.05);opacity:1}100%{transform:translateY(0) rotate(var(--rt)) scale(1)}}
@keyframes ws-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes ws-pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes ws-draw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes ws-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ws-fade{animation:ws-fade .45s ease both}
@media (prefers-reduced-motion: reduce){.ws-root *{animation:none !important;transition:none !important}}
.ws-btn{transition:transform .08s ease, filter .15s ease}
.ws-btn:hover{filter:brightness(1.1)}
.ws-btn:active{transform:scale(.97)}
.ws-btn:focus-visible{outline:3px solid ${T.amber};outline-offset:2px}
`;
