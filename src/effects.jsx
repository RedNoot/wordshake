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
export const BURST_MS = 900;
export const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

/*
 * How the drawings below are made: a handful (≤ 16) of small particles, each a CSS animation of transform and
 * opacity only (cheap on old iPads), all finished by ~800ms. They start at the end of the word and move off it,
 * so a letter is only ever under a particle for a blink. Nothing flashes or fills the board. Every keyframe starts
 * from nothing visible and fades out, so a burst cut short by the next word just disappears.
 * Each particle's --dx/--dy (and --rot) say where it goes; the keyframes are shared.
 */
const FX_CSS = `
@keyframes ws-fx-twinkle{0%{transform:translate(0,0) scale(0) rotate(0);opacity:0}25%{opacity:1}45%{transform:translate(calc(var(--dx)*.7),calc(var(--dy)*.7)) scale(1) rotate(45deg)}75%{transform:translate(calc(var(--dx)*.92),calc(var(--dy)*.92)) scale(.85) rotate(85deg);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0) rotate(120deg);opacity:0}}
@keyframes ws-fx-rise{0%{transform:translate(0,0) scale(.3);opacity:0}20%{opacity:.95}60%{transform:translate(calc(var(--dx)*-.4),calc(var(--dy)*.6)) scale(.9)}88%{transform:translate(var(--dx),calc(var(--dy)*.95)) scale(1);opacity:.9}100%{transform:translate(var(--dx),var(--dy)) scale(1.3);opacity:0}}
@keyframes ws-fx-shoot{0%{transform:translateX(0) scaleX(.3);opacity:0}15%{opacity:1}70%{opacity:1}100%{transform:translateX(var(--dx)) scaleX(1);opacity:0}}
@keyframes ws-fx-float{0%{transform:translate(0,0) scale(.2) rotate(0);opacity:0}20%{transform:translate(calc(var(--dx)*.5),calc(var(--dy)*.5)) scale(1.15) rotate(0);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.8) rotate(var(--rot));opacity:0}}
@keyframes ws-fx-fall{0%{transform:translate(0,0) rotate(0);opacity:0}15%{opacity:1}50%{transform:translate(calc(var(--dx)*-.6),calc(var(--dy)*.45)) rotate(calc(var(--rot)*-1))}80%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}
@keyframes ws-fx-spark{0%{transform:translate(0,0) scale(1);opacity:0}8%{opacity:1}65%{transform:translate(calc(var(--dx)*.92),calc(var(--dy)*.92)) scale(.9);opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 14px)) scale(.4);opacity:0}}
@keyframes ws-fx-blip{0%{transform:scale(.2);opacity:0}30%{transform:scale(1);opacity:1}100%{transform:scale(.4) translateY(-6px);opacity:0}}
`;

// Deterministic-ish randomness: the same burst always draws the same way.
function seeded(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, lo, hi) => lo + r() * (hi - lo);
const tileAt = (i, size) => ({ x: ((i % size) + 0.5) / size * 100, y: (Math.floor(i / size) + 0.5) / size * 100 });
// The traced tiles before the last one (where the burst itself goes), at most n of them, spread along the word.
function trail(burst, n) {
  const p = (burst.path || []).slice(0, -1);
  if (!burst.size || !p.length) return [];
  const pick = p.length <= n ? p : Array.from({ length: n }, (_, i) => p[Math.round(i * (p.length - 1) / (n - 1 || 1))]);
  return pick.map(i => tileAt(i, burst.size));
}

// One particle, centred on (x%, y%) of the board, plus an optional pixel offset.
function Bit({ x, y, w, h = w, ox = 0, oy = 0, anim, ms, delay = 0, ease = "ease-out", vars, style, children }) {
  return (
    <span style={{
      position: "absolute", left: `${x}%`, top: `${y}%`, width: w, height: h, marginLeft: ox - w / 2, marginTop: oy - h / 2,
      animation: `${anim} ${ms}ms ${ease} ${delay}ms both`, willChange: "transform, opacity", ...vars, ...style,
    }}>{children}</span>
  );
}

const Layer = ({ children }) => <><style>{FX_CSS}</style>{children}</>;

const svgFill = { display: "block", width: "100%", height: "100%", overflow: "visible" };
const StarShape = ({ fill }) => <svg viewBox="-10 -10 20 20" style={svgFill}><path d="M0-10 C1-3 3-1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3-1 -1-3 0-10Z" fill={fill} stroke="rgba(110,60,0,.5)" strokeWidth=".9" strokeLinejoin="round" /></svg>;
const FiveStar = ({ fill }) => <svg viewBox="-10 -10 20 20" style={svgFill}><path d="M0-9.5 2.8-3.4 9.4-2.8 4.4 1.6 5.8 8.1 0 4.8-5.8 8.1-4.4 1.6-9.4-2.8-2.8-3.4Z" fill={fill} stroke="#fff" strokeWidth="1" strokeLinejoin="round" /></svg>;
const Heart = ({ fill }) => <svg viewBox="0 0 20 18" style={svgFill}><path d="M10 17.5 C3 12.5 0 9 0 5.2 0 2.3 2.3 0 5.1 0 7.2 0 8.9 1.2 10 3 11.1 1.2 12.8 0 14.9 0 17.7 0 20 2.3 20 5.2 20 9 17 12.5 10 17.5Z" fill={fill} stroke="#fff" strokeWidth="1.2" /></svg>;
const Leaf = ({ fill }) => <svg viewBox="0 0 20 12" style={svgFill}><path d="M0 6 C4 -1 14 -1 20 6 C14 13 4 13 0 6Z" fill={fill} /><path d="M1 6 H17" stroke="rgba(80,35,10,.55)" strokeWidth="1" /></svg>;

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

export const EFFECT_DRAWINGS = { sparkle: Sparkle, bubbles: Bubbles, stars: Stars, hearts: Hearts, leaves: Leaves, fireworks: Fireworks };

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
