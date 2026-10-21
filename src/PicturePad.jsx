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

const ALL = PICTURES.map((_, i) => i);

/*
 * Tap three pictures in order. onDone(pin) gets called with the three picture numbers.
 * `reset` changes when the parent wants the pad emptied (a wrong try), and `busy` holds it while the server checks.
 * `choices` (picture numbers, in the order shown) and `cols` make a smaller practice grid; signing in uses all 12.
 */
export function PicturePad({ onDone, busy = false, reset = 0, choices = ALL, cols = 4 }) {
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
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, width: cols === 4 ? "100%" : "min(340px, 100%)" }}>
        {choices.map(i => {
          const p = PICTURES[i];
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

// A 3x3 practice grid: the student's three pictures and six others, in a new order each time.
function practiceGrid(pin) {
  const others = ALL.filter(i => !pin.includes(i)).sort(() => Math.random() - 0.5).slice(0, 9 - pin.length);
  const grid = [...pin, ...others];
  for (let i = grid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [grid[i], grid[j]] = [grid[j], grid[i]]; }
  return grid;
}

const STAGES = { first: ["look", "copy", "grid", "full"], shown: ["copy"], memory: ["recall"] };
const TITLES = {
  copy: "Tap your secret pictures",
  grid: "Now without looking! Find your pictures",
  full: "Last one! Find them with all the pictures",
  recall: "Before you play: tap your secret pictures",
};
const HINTS = {
  copy: "In the same order as above.",
  grid: "They've moved! Tap them in order.",
  full: "This is what you'll see at home.",
  recall: "From memory. You can do it!",
};

/*
 * Learning the secret pictures (server/lib/signin.js practiceMode):
 *   first:  look at them, tap them while they show, find them on a 3x3 grid, then on all 12 (what home looks like)
 *   shown:  tap them on a 3x3 grid while they show
 *   memory: tap them on a 3x3 grid from memory ("Show me" if stuck)
 * A wrong try shows the pictures and goes again. onDone(fromMemory): right first go without looking.
 */
export function PinPractice({ pin, mode, onDone }) {
  const stages = STAGES[mode] || STAGES.shown;
  const [stage, setStage] = useState(0);
  const [peek, setPeek] = useState(false);       // the pictures are showing on a "without looking" step
  const [note, setNote] = useState("");
  const [reset, setReset] = useState(0);
  const [done, setDone] = useState(false);
  const helped = useRef(false);                  // looked, or got one wrong
  const [grid, setGrid] = useState(() => practiceGrid(pin));
  const now = stages[stage];
  const showing = now === "look" || now === "copy" || peek;

  const next = () => {
    setNote(""); setPeek(false); setReset(r => r + 1); setGrid(practiceGrid(pin));
    if (stage + 1 < stages.length) return setStage(stage + 1);
    setDone(true);
    setTimeout(() => onDone(!helped.current), 1100);
  };
  const tried = given => {
    if (given.every((p, i) => p === pin[i])) return next();
    helped.current = true;
    setNote("Not quite! Here they are. Try again.");
    setPeek(true);
    setReset(r => r + 1);
  };
  const look = () => { helped.current = true; setPeek(true); };

  if (done) {
    return (
      <div className="ws-fade" role="status" style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center", marginTop: 40 }}>
        <div style={{ fontSize: 64, animation: "ws-pop .45s ease both" }}>{"✅"}</div>
        <div className="ws-display" style={{ fontSize: 34, fontWeight: 700 }}>{helped.current || mode !== "memory" ? "Well done!" : "Great remembering!"}</div>
      </div>
    );
  }
  if (now === "look") {
    return (
      <div className="ws-fade" style={{ display: "grid", gap: 20, justifyItems: "center", textAlign: "center", marginTop: 10, maxWidth: 560 }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 36 }}>These are your <span style={{ color: T.amber }}>secret pictures</span></h1>
        <PinTiles pin={pin} />
        <div style={{ fontSize: 20, lineHeight: 1.45 }}>
          You'll need them to play at home or on a new device. Remember them <b>in order</b>. Don't show anyone!
        </div>
        <button onClick={next} className="ws-btn ws-display" style={{ fontSize: 24, fontWeight: 700, border: "none", borderRadius: 16, padding: "16px 28px", cursor: "pointer", background: T.green, color: T.ink }}>Let's practise →</button>
      </div>
    );
  }
  const steps = stages.length > 1 ? stages.length - 1 : 0;   // "look" isn't a step
  return (
    <div key={now} className="ws-fade" style={{ width: "100%", display: "grid", gap: 14, justifyItems: "center", textAlign: "center" }}>
      {steps > 0 && <div style={{ color: T.mist, fontSize: 16 }}>Practice {stage} of {steps}</div>}
      <h1 className="ws-display" style={{ margin: 0, fontSize: 30 }}>{TITLES[now]}</h1>
      {showing
        ? <PinTiles pin={pin} size={60} />
        : <div style={{ color: T.mist, fontSize: 18 }}>{HINTS[now]}</div>}
      {showing && now !== "look" && <div style={{ color: T.mist, fontSize: 17 }}>{now === "copy" ? HINTS.copy : "Remember them, then tap them in order."}</div>}
      {note && <div role="alert" style={{ color: T.red, fontSize: 18 }}>{note}</div>}
      {now === "full"
        ? <PicturePad reset={reset} onDone={tried} />
        : <PicturePad reset={reset} onDone={tried} choices={grid} cols={3} />}
      {!showing && <button onClick={look} style={{ background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 17, padding: 8 }}>Show me my pictures</button>}
    </div>
  );
}
