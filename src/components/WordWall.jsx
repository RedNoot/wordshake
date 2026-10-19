import { T } from "../theme.js";

/*
 * Class together: the big screen's word wall. Every new word the class finds goes up as it's found (no names),
 * newest first, so the room can see the list filling. words: oldest first, as the server sends them.
 */
export function WordWall({ words, of, height }) {
  const newestFirst = [...words].reverse();
  return (
    <section aria-label="Words the class has found" style={{ width: "min(420px, 92vw)", maxHeight: height, display: "flex", flexDirection: "column", gap: 10, background: "rgb(var(--ws-fg) / .05)", border: `1px solid ${T.faint}`, borderRadius: 18, padding: "14px 16px", minHeight: 0 }}>
      <div role="status" className="ws-display" style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ fontSize: 26 }}>🤝</span>
        <b key={words.length} style={{ fontSize: 40, color: T.amber, lineHeight: 1, animation: words.length ? "ws-pop .4s ease both" : "none" }}>{words.length}</b>
        <span style={{ fontSize: 20, color: T.mist }}>of {of} words found together</span>
      </div>
      <div style={{ height: 8, background: "rgb(var(--ws-fg) / .1)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${of ? Math.min(100, (words.length / of) * 100) : 0}%`, background: T.green, borderRadius: 999, transition: "width .4s ease" }} />
      </div>
      {words.length === 0 && <div style={{ color: T.mist, fontSize: 17 }}>Every new word anyone finds goes up here.</div>}
      <div style={{ overflowY: "auto", minHeight: 0, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
        {newestFirst.map(w => (
          <span key={w} className="ws-display" style={{ fontSize: 19, fontWeight: 600, letterSpacing: 1, background: "rgb(var(--ws-green-rgb) / .14)", border: "1px solid rgb(var(--ws-green-rgb) / .45)", borderRadius: 10, padding: "4px 10px", animation: "ws-pop .45s ease both" }}>{w.toUpperCase()}</span>
        ))}
      </div>
    </section>
  );
}

// The end of a Class together round: the class's total, compared only with its own best on this kind of board.
export function bestLine(r) {
  if (!r.words) return "No words this time — let's go again!";
  if (r.newBest) return r.best == null ? "Our first Class together score on this board!" : `A new class best! (last best: ${r.best} words)`;
  if (r.words === r.best) return `We matched our class best of ${r.best} words!`;
  return `Our class best on this board is ${r.best} words — ${r.best - r.words + 1} more to beat it.`;
}
