import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";
import { PICTURES, PIN_LEN } from "../shared/pictures.js";

// Secret pictures (shared/pictures.js), as big tiles a young student can read: the picture and its number in order.
export function PinTiles({ pin, size = 92 }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
      {pin.map((i, n) => (
        <div key={n} style={{ display: "grid", justifyItems: "center", gap: 6, animation: `ws-pop .45s ${n * 0.25}s ease both` }}>
          <div aria-label={`${n + 1}: ${PICTURES[i].name}`} role="img"
            style={{ width: size, height: size, borderRadius: 22, display: "grid", placeItems: "center", fontSize: size * 0.58, background: "rgb(var(--ws-fg) / .08)", border: `3px solid ${T.amber}` }}>
            {PICTURES[i].emoji}
          </div>
          <div className="ws-display" style={{ fontSize: 20, fontWeight: 700, color: T.amber }}>{n + 1}</div>
          <div style={{ fontSize: 16, color: T.mist }}>{PICTURES[i].name}</div>
        </div>
      ))}
    </div>
  );
}

/*
 * Tap three pictures in order. onDone(pin) gets called with the three picture numbers.
 * `reset` changes when the parent wants the pad emptied (a wrong try), and `busy` holds it while the server checks.
 */
export function PicturePad({ onDone, busy = false, reset = 0 }) {
  const [picked, setPickedState] = useState([]);
  const pickedRef = useRef([]);   // read by tap, so two quick taps before a redraw both count
  const setPicked = v => { pickedRef.current = v; setPickedState(v); };
  useEffect(() => setPicked([]), [reset]);

  const tap = i => {
    const cur = pickedRef.current;
    if (busy || cur.length >= PIN_LEN || cur.includes(i)) return;
    const next = [...cur, i];
    setPicked(next);
    if (next.length === PIN_LEN) onDone(next);
  };

  return (
    <div style={{ display: "grid", gap: 18, justifyItems: "center", width: "min(440px, 100%)" }}>
      <div aria-live="polite" aria-label={`${picked.length} of ${PIN_LEN} pictures`} style={{ display: "flex", gap: 12 }}>
        {Array.from({ length: PIN_LEN }, (_, n) => (
          <div key={n} style={{ width: 64, height: 64, borderRadius: 16, display: "grid", placeItems: "center", fontSize: 36,
            border: picked[n] != null ? `3px solid ${T.amber}` : "3px dashed rgb(var(--ws-fg) / .25)", background: picked[n] != null ? "rgb(var(--ws-amber-rgb) / .12)" : "transparent" }}>
            {picked[n] != null ? <span style={{ animation: "ws-pop .3s ease both" }}>{PICTURES[picked[n]].emoji}</span> : <span style={{ fontSize: 18, color: T.mist }}>{n + 1}</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, width: "100%" }}>
        {PICTURES.map((p, i) => {
          const used = picked.includes(i);
          return (
            <button key={i} type="button" onClick={() => tap(i)} disabled={busy || used} aria-label={p.name} className="ws-btn"
              style={{ aspectRatio: "1", borderRadius: 18, fontSize: "clamp(30px, 9vw, 44px)", cursor: busy || used ? "default" : "pointer",
                border: "2px solid rgb(var(--ws-fg) / .18)", background: "rgb(var(--ws-fg) / .08)", opacity: used ? 0.3 : 1 }}>
              {p.emoji}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => setPicked(pickedRef.current.slice(0, -1))} disabled={busy || !picked.length}
        style={{ background: "none", border: "none", color: picked.length ? T.mist : "transparent", textDecoration: "underline", cursor: "pointer", fontSize: 17, padding: 8 }}>
        Undo
      </button>
    </div>
  );
}
