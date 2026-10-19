// The halloween shelf's word-sparkle drawing(s), by effect id. Rules: see src/effects.jsx; pieces: src/effectKit.jsx.
import { seeded, between, trail, Bit, Layer, svgFill } from "../effectKit.jsx";

// Wings beat by squashing the bat up and down (transform only), a few times while it flies.
const FLAP_CSS = "@keyframes ws-fx-flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.45)}}";

// A small friendly bat: round wings, two pointy ears, little white eyes, and a white outline so it shows on any board.
const Bat = ({ fill }) => (
  <svg viewBox="-17 -9 34 18" style={svgFill}>
    <path d="M0-2C1-5 2.6-6 3-3.4C6-7 11-7.4 16-4.2C13-3 12-.4 12.6 2.2C10.2 .4 8 1 7 3.2C5.2 1.2 2.8 1.4 0 4.2C-2.8 1.4-5.2 1.2-7 3.2C-8 1-10.2 .4-12.6 2.2C-12-.4-13-3-16-4.2C-11-7.4-6-7-3-3.4C-2.6-6-1-5 0-2Z"
      fill={fill} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
    <path d="M-2.4-3.2L-2-6.6L-.6-3.6M2.4-3.2L2-6.6L.6-3.6" fill={fill} stroke="#fff" strokeWidth=".7" strokeLinejoin="round" />
    <circle cx="-1.1" cy="-1.4" r=".75" fill="#fff" /><circle cx="1.1" cy="-1.4" r=".75" fill="#fff" />
  </svg>
);

const BAT_COLOURS = ["#7A4BC2", "#9C6FE4", "#5B3A99"];
const CANDY_COLOURS = ["#FF9A2E", "#FFD84A", "#B98CFF", "#7EE07A"];
// 🦇 Little round sweets pop along the traced word, then a flutter of friendly bats flaps up and away off the last letter.
function Bats({ burst }) {
  const r = seeded(burst.key);
  const along = trail(burst, 4).map((t, i) => (
    <Bit key={`t${i}`} {...t} w={8} anim="ws-fx-blip" ms={380} delay={i * 50}
      style={{ borderRadius: "50%", background: CANDY_COLOURS[i % 4], boxShadow: "0 0 0 1.5px #fff" }} />
  ));
  const bats = Array.from({ length: 8 }, (_, i) => {
    const w = Math.round(between(r, 26, 34)), side = i % 2 ? 1 : -1, ms = Math.round(between(r, 620, 720));
    return (
      <Bit key={`b${i}`} x={burst.x} y={burst.y} w={w} h={w * 0.53} ox={side * between(r, 0, 10)} oy={-10} anim="ws-fx-float" ms={ms}
        delay={between(r, 0, 70)} vars={{ "--dx": `${side * between(r, 34, 84)}px`, "--dy": `${between(r, -115, -55)}px`, "--rot": `${side * between(r, 4, 14)}deg` }}>
        <span style={{ display: "block", width: "100%", height: "100%", animation: `ws-fx-flap ${Math.round(between(r, 150, 190))}ms ease-in-out 4`, willChange: "transform" }}>
          <Bat fill={BAT_COLOURS[i % 3]} />
        </span>
      </Bit>
    );
  });
  return <Layer><style>{FLAP_CSS}</style>{along}{bats}</Layer>;
}

export const HALLOWEEN_DRAWINGS = { "halloween-bats": Bats };
