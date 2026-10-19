/*
 * Found-word effects (the shop's "Word sparkles"): the drawing for each effect in shared/looks/effects.js, by id.
 *
 * Each entry is a component: ({ burst }) => JSX, drawn over the student's board for one found word.
 *   burst = { key, x, y, path, size, word, colour }
 *     x, y:   where the word ended, as percentages of the board (0-100), e.g. left: `${x}%`
 *     path:   the tiles traced, as indexes into the size × size grid (empty for a typed word: then x, y is the middle)
 *     colour: the theme's highlight colour (a CSS value), if the effect wants to match the theme
 * The layer it draws in is absolutely positioned over the board, overflow visible, pointer-events none.
 * It's removed after BURST_MS, so keep animations shorter than that. CSS animations stop by themselves under
 * reduced motion (the .ws-root rule); anything driven from JS must check prefersReducedMotion() and draw nothing.
 */
import { BURST_MS, prefersReducedMotion, seeded, between, trail, Bit, Layer, StarShape, FiveStar, Heart, Leaf } from "./effectKit.jsx";
import { SEASONAL_DRAWINGS } from "./effects/seasonal.js";

export { BURST_MS, prefersReducedMotion };

const SPARKLE_COLOURS = ["#FFFFFF", "#FF9F1C"];
// ✨ Twinkles light up along the traced word, then a ring of sparkles pops off the last letter.
function Sparkle({ burst }) {
  const r = seeded(burst.key);
  const mine = [burst.colour || "#FFC94A", ...SPARKLE_COLOURS];
  const along = trail(burst, 5).map((t, i) => (
    <Bit key={`t${i}`} {...t} w={12} anim="ws-fx-twinkle" ms={420} delay={i * 45}
      vars={{ "--dx": `${between(r, -6, 6)}px`, "--dy": `${between(r, -10, -4)}px` }}><StarShape fill={mine[i % 3]} /></Bit>
  ));
  const n = 9, ring = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + between(r, -0.25, 0.25), d = between(r, 32, 60), w = Math.round(between(r, 12, 20));
    return (
      <Bit key={`r${i}`} x={burst.x} y={burst.y} w={w} anim="ws-fx-twinkle" ms={between(r, 560, 680)} delay={between(r, 0, 60)}
        vars={{ "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px` }}><StarShape fill={mine[i % 3]} /></Bit>
    );
  });
  return <Layer>{along}{ring}</Layer>;
}

// 🫧 See-through bubbles wobble up off the last letter and pop.
function Bubbles({ burst }) {
  const r = seeded(burst.key);
  const bubbles = Array.from({ length: 9 }, (_, i) => {
    const w = Math.round(between(r, 10, 24));
    return (
      <Bit key={i} x={burst.x} y={burst.y} w={w} ox={between(r, -22, 22)} oy={between(r, -6, 10)} anim="ws-fx-rise"
        ms={between(r, 580, 700)} delay={between(r, 0, 80)} ease="ease-in-out"
        vars={{ "--dx": `${between(r, -26, 26)}px`, "--dy": `${between(r, -120, -65)}px` }}
        style={{
          borderRadius: "50%", border: "1.5px solid rgba(110,185,240,.9)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.6)",
          background: "radial-gradient(circle at 32% 30%, rgba(255,255,255,.95) 0 14%, rgba(190,235,255,.4) 18%, rgba(120,190,255,.18) 70%, rgba(255,170,235,.4) 100%)",
        }} />
    );
  });
  return <Layer>{bubbles}</Layer>;
}

const STAR_COLOURS = ["#FFD84A", "#FFF3B0", "#FFB547"];
// ⭐ A few shooting stars streak out from the last letter, tails behind them; small blips mark the traced letters.
function Stars({ burst }) {
  const r = seeded(burst.key);
  const along = trail(burst, 4).map((t, i) => (
    <Bit key={`t${i}`} {...t} w={8} anim="ws-fx-blip" ms={380} delay={i * 50}
      style={{ borderRadius: "50%", background: "#FFF3B0", boxShadow: "0 0 6px 2px rgba(255,216,74,.7)" }} />
  ));
  const n = 6, start = between(r, 0, Math.PI * 2);
  const shooters = Array.from({ length: n }, (_, i) => {
    const deg = ((start + (i / n) * Math.PI * 2 + between(r, -0.2, 0.2)) * 180) / Math.PI, d = between(r, 58, 90), c = STAR_COLOURS[i % 3];
    // The outer span points the star's way (a still rotate); the inner one flies along it.
    return (
      <span key={`s${i}`} style={{ position: "absolute", left: `${burst.x}%`, top: `${burst.y}%`, width: 0, height: 0, transform: `rotate(${deg}deg)` }}>
        <span style={{
          position: "absolute", left: -10, top: -8, width: 52, height: 16, transformOrigin: "0 50%",
          animation: `ws-fx-shoot ${Math.round(between(r, 560, 700))}ms cubic-bezier(.2,.7,.35,1) ${Math.round(between(r, 0, 80))}ms both`,
          willChange: "transform, opacity", "--dx": `${d}px`,
        }}>
          <span style={{ position: "absolute", left: 0, top: 6.5, width: 40, height: 3, borderRadius: 2, background: `linear-gradient(90deg, rgba(255,243,176,0), ${c})` }} />
          <span style={{ position: "absolute", left: 36, top: 0, width: 16, height: 16 }}><FiveStar fill={c} /></span>
        </span>
      </span>
    );
  });
  return <Layer>{along}{shooters}</Layer>;
}

const HEART_COLOURS = ["#FF5FA2", "#FF8FC1", "#E8457C", "#FFB3D1"];
// 💖 Little hearts pop out of the last letter and float up, tilting as they go.
function Hearts({ burst }) {
  const r = seeded(burst.key);
  const hearts = Array.from({ length: 8 }, (_, i) => {
    const w = Math.round(between(r, 13, 22)), side = i % 2 ? 1 : -1;
    return (
      <Bit key={i} x={burst.x} y={burst.y} w={w} h={w * 0.9} oy={-18} anim="ws-fx-float" ms={between(r, 600, 700)} delay={between(r, 0, 80)}
        vars={{ "--dx": `${side * between(r, 18, 60)}px`, "--dy": `${between(r, -110, -55)}px`, "--rot": `${side * between(r, 8, 22)}deg` }}>
        <Heart fill={HEART_COLOURS[i % 4]} />
      </Bit>
    );
  });
  return <Layer>{hearts}</Layer>;
}

const LEAF_COLOURS = ["#E8833A", "#D9572B", "#F2B33D", "#B8702A"];
// 🍂 Autumn leaves drift down from just above the last letter, rocking side to side.
function Leaves({ burst }) {
  const r = seeded(burst.key);
  const leaves = Array.from({ length: 8 }, (_, i) => {
    const w = Math.round(between(r, 16, 24)), side = i % 2 ? 1 : -1;
    return (
      <Bit key={i} x={burst.x} y={burst.y} w={w} h={w * 0.6} ox={side * between(r, 28, 55)} oy={between(r, -32, -10)}
        anim="ws-fx-fall" ms={between(r, 600, 700)} delay={between(r, 0, 80)} ease="ease-in-out"
        vars={{ "--dx": `${side * between(r, 10, 24)}px`, "--dy": `${between(r, 45, 75)}px`, "--rot": `${side * between(r, 35, 70)}deg` }}>
        <Leaf fill={LEAF_COLOURS[i % 4]} />
      </Bit>
    );
  });
  return <Layer>{leaves}</Layer>;
}

const FIREWORK_PAIRS = [["#FF5E7E", "#FFD84A"], ["#4FC3F7", "#FFFFFF"], ["#9CFF6B", "#FF8FC1"], ["#FFB547", "#B39DFF"]];
// 🎆 Sparks fizz up the traced word like a fuse, then one firework bursts in a ring over the last letter.
function Fireworks({ burst }) {
  const r = seeded(burst.key);
  const [c1, c2] = FIREWORK_PAIRS[Math.floor(r() * FIREWORK_PAIRS.length)];
  const fuse = trail(burst, 4).map((t, i) => (
    <Bit key={`f${i}`} {...t} w={7} anim="ws-fx-blip" ms={320} delay={i * 40}
      style={{ borderRadius: "50%", background: c2, boxShadow: `0 0 6px 2px ${c1}` }} />
  ));
  const n = 12, d = between(r, 52, 68), start = 120;
  const sparks = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, dd = d * (i % 2 ? 0.78 : 1);
    return (
      <Bit key={`s${i}`} x={burst.x} y={burst.y} w={7} anim="ws-fx-spark" ms={620} delay={start} ease="cubic-bezier(.15,.75,.3,1)"
        vars={{ "--dx": `${Math.cos(a) * dd}px`, "--dy": `${Math.sin(a) * dd}px` }}
        style={{ borderRadius: "50%", background: i % 2 ? c2 : c1, boxShadow: `0 0 5px 1px ${i % 2 ? c2 : c1}` }} />
    );
  });
  return <Layer>{fuse}{sparks}</Layer>;
}

export const EFFECT_DRAWINGS = { sparkle: Sparkle, bubbles: Bubbles, stars: Stars, hearts: Hearts, leaves: Leaves, fireworks: Fireworks, ...SEASONAL_DRAWINGS };

// The layer Play puts over the board. Draws nothing for no effect, an unknown one, or reduced motion.
export function WordEffect({ effect, burst }) {
  const Draw = effect && EFFECT_DRAWINGS[effect];
  if (!Draw || !burst || prefersReducedMotion()) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible", zIndex: 5 }}>
      <Draw key={burst.key} burst={burst} />
    </div>
  );
}
