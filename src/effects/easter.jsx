// The easter shelf's word-sparkle drawing(s), by effect id. Rules: see src/effects.jsx; pieces: src/effectKit.jsx.
import { seeded, between, trail, Bit, Layer, svgFill } from "../effectKit.jsx";

/*
 * A toss: pops out of the letter, flies out to (--dx, --dy), slowing, then drops a little as it fades. Transform
 * and opacity only, starting and ending unseen. --rot is the tumble.
 */
const HOP_CSS = `
@keyframes ws-fx-easter-hop{0%{transform:translate(0,0) scale(.3) rotate(0);opacity:0}18%{opacity:1}45%{transform:translate(calc(var(--dx)*.72),calc(var(--dy)*.85)) scale(1) rotate(calc(var(--rot)*.5))}75%{opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 22px)) scale(.85) rotate(var(--rot));opacity:0}}
`;

// [shell, band] pairs: pastel shells, a deeper band of zigzag, a dark-ish outline so they show on light boards too.
const EGG_COLOURS = [["#F9B8D3", "#E0508E"], ["#B9DAF7", "#3F86D1"], ["#C4ECCD", "#2E9A5A"], ["#FFE38F", "#E09A10"], ["#DCC8F4", "#7B45C7"]];
const Egg = ({ shell, band }) => (
  <svg viewBox="-11 -14 22 28" style={svgFill}>
    <path d="M0-13C6-13 10-4 10 3C10 9 6 13 0 13C-6 13-10 9-10 3C-10-4-6-13 0-13Z" fill={shell} stroke="rgba(70,40,90,.55)" strokeWidth="1.2" />
    <path d="M-9.6 0L-6.4 3L-3.2 0L0 3L3.2 0L6.4 3L9.6 0" fill="none" stroke={band} strokeWidth="2" strokeLinejoin="round" />
    <circle cx="-3.5" cy="-7" r="1.6" fill="#fff" fillOpacity=".8" />
  </svg>
);

// 🥚 Little pastel dots pip along the traced word, then painted eggs hop out of the last letter and tumble away.
function EggToss({ burst }) {
  const r = seeded(burst.key);
  const along = trail(burst, 4).map((t, i) => (
    <Bit key={`t${i}`} {...t} w={8} anim="ws-fx-blip" ms={380} delay={i * 45}
      style={{ borderRadius: "50%", background: EGG_COLOURS[i % 5][0], boxShadow: `0 0 0 1.5px ${EGG_COLOURS[i % 5][1]}` }} />
  ));
  const n = 9;
  const eggs = Array.from({ length: n }, (_, i) => {
    // A fan over the top half, spread evenly so the eggs fly apart rather than clump.
    const a = (-165 + (150 * i) / (n - 1) + between(r, -8, 8)) * Math.PI / 180, d = between(r, 72, 105);
    const w = Math.round(between(r, 14, 20)), [shell, band] = EGG_COLOURS[i % 5], side = Math.cos(a) < 0 ? -1 : 1;
    return (
      <Bit key={`e${i}`} x={burst.x} y={burst.y} w={w} h={Math.round(w * 1.27)} anim="ws-fx-easter-hop"
        ms={between(r, 600, 680)} delay={between(r, 0, 70)} ease="cubic-bezier(.2,.7,.4,1)"
        vars={{ "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px`, "--rot": `${side * between(r, 60, 160)}deg` }}>
        <Egg shell={shell} band={band} />
      </Bit>
    );
  });
  return <Layer><style>{HOP_CSS}</style>{along}{eggs}</Layer>;
}

export const EASTER_DRAWINGS = { "easter-toss": EggToss };
