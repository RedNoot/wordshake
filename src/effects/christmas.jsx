// The christmas shelf's word-sparkle drawing(s), by effect id. Rules: see src/effects.jsx; pieces: src/effectKit.jsx.
import { seeded, between, trail, Bit, Layer, FiveStar, svgFill } from "../effectKit.jsx";

const BAUBLE_COLOURS = ["#E8314A", "#FFC53D", "#2FB863", "#4AA3FF", "#E8314A", "#D9E3EC"];
// One bauble: a coloured ball with a gold cap and a white shine (flat fills, so many on screen share no ids).
const Bauble = ({ fill }) => (
  <svg viewBox="-10 -13 20 23" style={svgFill}>
    <rect x="-3" y="-12.5" width="6" height="4" rx="1" fill="#D9B44A" stroke="rgba(90,60,0,.55)" strokeWidth=".8" />
    <circle r="9.2" fill={fill} stroke="rgba(40,20,10,.35)" strokeWidth=".9" />
    <ellipse cx="-3.4" cy="-3.6" rx="2.8" ry="1.7" transform="rotate(-35 -3.4 -3.6)" fill="#fff" fillOpacity=".8" />
  </svg>
);

// 🎄 Little gold stars twinkle along the traced word, then shiny baubles pop off the last letter and drop away.
function Baubles({ burst }) {
  const r = seeded(burst.key);
  const along = trail(burst, 4).map((t, i) => (
    <Bit key={`t${i}`} {...t} w={11} anim="ws-fx-twinkle" ms={420} delay={i * 45}
      vars={{ "--dx": `${between(r, -6, 6)}px`, "--dy": `${between(r, -10, -4)}px` }}><FiveStar fill="#FFD24A" /></Bit>
  ));
  const n = 9, start = between(r, 0, Math.PI * 2);
  const baubles = Array.from({ length: n }, (_, i) => {
    const a = start + (i / n) * Math.PI * 2 + between(r, -0.2, 0.2), d = between(r, 40, 66), w = Math.round(between(r, 15, 20));
    return (
      <Bit key={`b${i}`} x={burst.x} y={burst.y} w={w} h={w * 1.15} anim="ws-fx-spark" ms={between(r, 580, 680)} delay={between(r, 0, 70)}
        ease="cubic-bezier(.15,.75,.3,1)" vars={{ "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px` }}>
        <Bauble fill={BAUBLE_COLOURS[i % BAUBLE_COLOURS.length]} />
      </Bit>
    );
  });
  return <Layer>{along}{baubles}</Layer>;
}

export const CHRISTMAS_DRAWINGS = { "christmas-baubles": Baubles };
