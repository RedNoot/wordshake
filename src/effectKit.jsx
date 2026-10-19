/*
 * The pieces every word-sparkle drawing is made from (see src/effects.jsx for the rules a drawing follows).
 * Kept apart from effects.jsx so the seasonal drawings in src/effects/ can use them without an import loop.
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
export const FX_CSS = `
@keyframes ws-fx-twinkle{0%{transform:translate(0,0) scale(0) rotate(0);opacity:0}25%{opacity:1}45%{transform:translate(calc(var(--dx)*.7),calc(var(--dy)*.7)) scale(1) rotate(45deg)}75%{transform:translate(calc(var(--dx)*.92),calc(var(--dy)*.92)) scale(.85) rotate(85deg);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0) rotate(120deg);opacity:0}}
@keyframes ws-fx-rise{0%{transform:translate(0,0) scale(.3);opacity:0}20%{opacity:.95}60%{transform:translate(calc(var(--dx)*-.4),calc(var(--dy)*.6)) scale(.9)}88%{transform:translate(var(--dx),calc(var(--dy)*.95)) scale(1);opacity:.9}100%{transform:translate(var(--dx),var(--dy)) scale(1.3);opacity:0}}
@keyframes ws-fx-shoot{0%{transform:translateX(0) scaleX(.3);opacity:0}15%{opacity:1}70%{opacity:1}100%{transform:translateX(var(--dx)) scaleX(1);opacity:0}}
@keyframes ws-fx-float{0%{transform:translate(0,0) scale(.2) rotate(0);opacity:0}20%{transform:translate(calc(var(--dx)*.5),calc(var(--dy)*.5)) scale(1.15) rotate(0);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.8) rotate(var(--rot));opacity:0}}
@keyframes ws-fx-fall{0%{transform:translate(0,0) rotate(0);opacity:0}15%{opacity:1}50%{transform:translate(calc(var(--dx)*-.6),calc(var(--dy)*.45)) rotate(calc(var(--rot)*-1))}80%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}
@keyframes ws-fx-spark{0%{transform:translate(0,0) scale(1);opacity:0}8%{opacity:1}65%{transform:translate(calc(var(--dx)*.92),calc(var(--dy)*.92)) scale(.9);opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 14px)) scale(.4);opacity:0}}
@keyframes ws-fx-blip{0%{transform:scale(.2);opacity:0}30%{transform:scale(1);opacity:1}100%{transform:scale(.4) translateY(-6px);opacity:0}}
`;

// Deterministic-ish randomness: the same burst always draws the same way.
export function seeded(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (r, lo, hi) => lo + r() * (hi - lo);
export const tileAt = (i, size) => ({ x: ((i % size) + 0.5) / size * 100, y: (Math.floor(i / size) + 0.5) / size * 100 });
// The traced tiles before the last one (where the burst itself goes), at most n of them, spread along the word.
export function trail(burst, n) {
  const p = (burst.path || []).slice(0, -1);
  if (!burst.size || !p.length) return [];
  const pick = p.length <= n ? p : Array.from({ length: n }, (_, i) => p[Math.round(i * (p.length - 1) / (n - 1 || 1))]);
  return pick.map(i => tileAt(i, burst.size));
}

// One particle, centred on (x%, y%) of the board, plus an optional pixel offset.
export function Bit({ x, y, w, h = w, ox = 0, oy = 0, anim, ms, delay = 0, ease = "ease-out", vars, style, children }) {
  return (
    <span style={{
      position: "absolute", left: `${x}%`, top: `${y}%`, width: w, height: h, marginLeft: ox - w / 2, marginTop: oy - h / 2,
      animation: `${anim} ${ms}ms ${ease} ${delay}ms both`, willChange: "transform, opacity", ...vars, ...style,
    }}>{children}</span>
  );
}

export const Layer = ({ children }) => <><style>{FX_CSS}</style>{children}</>;

export const svgFill = { display: "block", width: "100%", height: "100%", overflow: "visible" };
export const StarShape = ({ fill }) => <svg viewBox="-10 -10 20 20" style={svgFill}><path d="M0-10 C1-3 3-1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3-1 -1-3 0-10Z" fill={fill} stroke="rgba(110,60,0,.5)" strokeWidth=".9" strokeLinejoin="round" /></svg>;
export const FiveStar = ({ fill }) => <svg viewBox="-10 -10 20 20" style={svgFill}><path d="M0-9.5 2.8-3.4 9.4-2.8 4.4 1.6 5.8 8.1 0 4.8-5.8 8.1-4.4 1.6-9.4-2.8-2.8-3.4Z" fill={fill} stroke="#fff" strokeWidth="1" strokeLinejoin="round" /></svg>;
export const Heart = ({ fill }) => <svg viewBox="0 0 20 18" style={svgFill}><path d="M10 17.5 C3 12.5 0 9 0 5.2 0 2.3 2.3 0 5.1 0 7.2 0 8.9 1.2 10 3 11.1 1.2 12.8 0 14.9 0 17.7 0 20 2.3 20 5.2 20 9 17 12.5 10 17.5Z" fill={fill} stroke="#fff" strokeWidth="1.2" /></svg>;
export const Leaf = ({ fill }) => <svg viewBox="0 0 20 12" style={svgFill}><path d="M0 6 C4 -1 14 -1 20 6 C14 13 4 13 0 6Z" fill={fill} /><path d="M1 6 H17" stroke="rgba(80,35,10,.55)" strokeWidth="1" /></svg>;

