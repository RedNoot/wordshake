/*
 * Helpers for writing looks, shared by the slot files and the seasonal shelves (shared/looks/seasons/).
 * Theme helpers write CSS for the "$SEL" placeholder; dice helpers too.
 */

// Every theme keeps Atkinson Hyperlegible for reading (chosen for young readers) and Fredoka for headings.
export const FONTS = {
  "font-body": "'Atkinson Hyperlegible',system-ui,sans-serif", "font-display": "'Fredoka','Atkinson Hyperlegible',system-ui,sans-serif",
  "display-tracking": "0",
};

/*
 * A background pattern behind everything. .ws-root gets its own stacking layer (isolation) so the pattern, at
 * z-index -1, paints above the page's background colour but below all the (unpositioned) content. The second
 * selector is for /preview, where one element is both the themed patch and the .ws-root. The reduced-motion rule
 * in theme.js only reaches .ws-root's children, so the pattern carries its own.
 */
export const PAT = "$SEL .ws-root::before,$SEL.ws-root::before";
export const behind = body => `
$SEL .ws-root,$SEL.ws-root{isolation:isolate}
${PAT}{content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;${body}}
@media (prefers-reduced-motion: reduce){${PAT}{animation:none !important}}
`;
// A second layer, for themes that need two speeds (or one still and one moving).
export const PAT2 = "$SEL .ws-root::after,$SEL.ws-root::after";
export const behind2 = body => `
${PAT2}{content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;${body}}
@media (prefers-reduced-motion: reduce){${PAT2}{animation:none !important}}
`;

// ---- dice ----
// A small inline SVG drawn over the whole face (no width/height, so it stretches to any die size).
export const svg = body => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${body}</svg>`)}")`;
// Rounder corners than the theme's die. The die's radius is an inline style, hence !important.
export const round = r => `$SEL .ws-die{border-radius:${r} !important}`;

// ---- jars ----
// A round side: from the opening at angle `from` (radians from the top) to `to`, round (cx, cy), rx wide.
// y is scaled by 0.8 (the box is 4:5) so it's a true circle on screen.
export const arc = (cy, rx, from, to, n = 10) => Array.from({ length: n + 1 }, (_, i) => {
  const a = from + ((to - from) * i) / n;
  return [+(0.5 - rx * Math.sin(a)).toFixed(4), +(cy - rx * 0.8 * Math.cos(a)).toFixed(4)];
});
