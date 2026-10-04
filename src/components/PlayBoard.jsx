import { useMemo, useRef, useState } from "react";
import { T } from "../theme.js";

const neighbours = size => Array.from({ length: size * size }, (_, i) => {
  const r = Math.floor(i / size), c = i % size, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((dr || dc) && rr >= 0 && rr < size && cc >= 0 && cc < size) out.push(rr * size + cc);
  }
  return out;
});
const HIT = 0.42;  // while dragging, a tile only counts inside this fraction of its width from the centre, so diagonals don't clip neighbours
export const tileText = t => t[0].toUpperCase() + t.slice(1).toLowerCase();

/*
 * The student's board: swipe on a touchscreen, click-and-drag with a mouse or trackpad (both are pointer events).
 * Drag back onto the previous tile to undo it. Letting go sends the word.
 */
export function PlayBoard({ tiles, size, dim, disabled, onWord, onTrace, flash }) {
  const [path, setPath] = useState([]);
  const pathRef = useRef([]);
  const tileRefs = useRef([]);
  const rects = useRef([]);
  const last = useRef(null);
  const nbrs = useMemo(() => neighbours(size), [size]);

  const set = p => {
    pathRef.current = p;
    setPath(p);
    onTrace && onTrace(p.map(i => tiles[i].toLowerCase()).join(""));
  };

  const tileAt = (x, y, strict) => {
    for (let i = 0; i < rects.current.length; i++) {
      const r = rects.current[i];
      if (strict) {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (Math.hypot(x - cx, y - cy) <= r.width * HIT) return i;
      } else if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };

  const extend = i => {
    const p = pathRef.current, end = p[p.length - 1];
    if (i == null || i === end) return;
    if (p.length > 1 && i === p[p.length - 2]) return set(p.slice(0, -1));
    if (!p.includes(i) && nbrs[end].includes(i)) set([...p, i]);
  };

  const down = e => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    rects.current = tileRefs.current.map(el => el.getBoundingClientRect());
    const i = tileAt(e.clientX, e.clientY, false);
    if (i == null) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* keep going without capture */ }
    last.current = { x: e.clientX, y: e.clientY };
    set([i]);
  };

  const move = e => {
    if (!pathRef.current.length || !last.current) return;
    // A quick swipe can jump past a tile between two move events; walk the gap so it isn't skipped.
    const { x: x0, y: y0 } = last.current;
    const step = (rects.current[0] ? rects.current[0].width : 40) / 5;
    const n = Math.max(1, Math.ceil(Math.hypot(e.clientX - x0, e.clientY - y0) / step));
    for (let k = 1; k <= n; k++) extend(tileAt(x0 + (e.clientX - x0) * k / n, y0 + (e.clientY - y0) * k / n, true));
    last.current = { x: e.clientX, y: e.clientY };
  };

  const up = () => {
    const p = pathRef.current;
    last.current = null;
    if (!p.length) return;
    const word = p.map(i => tiles[i].toLowerCase()).join("");
    set([]);
    if (word.length >= 2) onWord(word, p);
  };

  const shown = path.length ? path : (flash && flash.path) || [];
  const colour = path.length ? T.amber : flash && flash.ok ? T.green : flash ? "rgba(255,255,255,.55)" : T.amber;
  const centres = shown.map(i => ({ x: ((i % size) + 0.5) / size * 100, y: (Math.floor(i / size) + 0.5) / size * 100 }));

  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ width: dim, height: dim, position: "relative", background: T.well, borderRadius: `calc(${dim} * 0.04)`, padding: `calc(${dim} * 0.028)`, boxSizing: "border-box",
        boxShadow: `inset 0 4px 18px rgba(0,0,0,.45), 0 0 0 4px ${T.wellEdge}`, touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }}>
      <div role="grid" aria-label="Letter board" style={{ display: "grid", gridTemplateColumns: `repeat(${size},1fr)`, gap: `calc(${dim} * 0.018)`, width: "100%", height: "100%" }}>
        {tiles.map((t, i) => {
          const on = shown.includes(i);
          return (
            <div key={i} ref={el => { tileRefs.current[i] = el; }} role="gridcell" aria-label={tileText(t)} className="ws-display"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: `calc(${dim} * 0.02)`, fontWeight: 700,
                fontSize: `calc(${dim} / ${size} * ${t.length > 2 ? 0.26 : t.length > 1 ? 0.34 : 0.5})`,
                background: on ? colour : T.dice, color: T.letter, transform: on ? "scale(1.05)" : "none", transition: "transform .08s, background .08s",
                boxShadow: `inset 0 -5px 0 ${on ? "rgba(0,0,0,.18)" : T.diceEdge}, 0 3px 6px rgba(0,0,0,.35)` }}>
              {tileText(t)}
            </div>
          );
        })}
      </div>
      {centres.length > 1 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
          style={{ position: "absolute", inset: `calc(${dim} * 0.028)`, width: `calc(100% - ${dim} * 0.056)`, height: `calc(100% - ${dim} * 0.056)`, pointerEvents: "none" }}>
          <polyline points={centres.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={colour} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
        </svg>
      )}
    </div>
  );
}
