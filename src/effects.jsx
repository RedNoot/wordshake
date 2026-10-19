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

export const EFFECT_DRAWINGS = {};

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
