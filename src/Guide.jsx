import { T } from "./theme.js";

const GUIDE_KEY = "wordshake-guide-done";
export const guideDone = () => { try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch { return false; } };
export const markGuideDone = () => { try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* private mode */ } };

// Getting started: shown to a new teacher (or one with no class yet), and again from "How it works" in the header.
export function Guide({ name, isNew, classes, onAddClass, onClose }) {
  const host = window.location.host;
  const hasClass = !!(classes && classes.length);
  const steps = [
    {
      title: "Add your class list",
      body: "Type or paste your students' first names. They join by tapping their own name, and their words, stickers and trophies are saved for the Progress page.",
      done: hasClass && `${classes.length} class${classes.length === 1 ? "" : "es"} ready`,
      action: !hasClass && ["Add a class list", onAddClass],
    },
    { title: "Open a room", body: "Below, pick your class and press Open the room. Round time, board size, today's sound and the rest are in Game settings on the right. Put this screen on the projector." },
    { title: "Students join", body: <>On their devices they go to <b style={{ color: T.text }}>{host}/join</b> and type the room code, or scan the QR code on the big screen. Then they tap their name.</> },
    { title: "Shake and play", body: "Press Start. Students swipe words on their devices; when time's up, the big screen shows the answers and everyone's points are saved." },
  ];
  return (
    <section aria-label="Getting started" className="ws-fade" style={{ width: "min(760px, 94vw)", boxSizing: "border-box", background: "rgb(var(--ws-green-rgb) / .08)", border: "1px solid rgb(var(--ws-green-rgb) / .45)", borderRadius: 18, padding: "18px 22px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 className="ws-display" style={{ margin: 0, fontSize: 24, flex: 1 }}>
          {isNew ? `Welcome to WordShake, ${name || "teacher"}!` : "How WordShake works"}
        </h2>
        <button className="ws-btn" onClick={onClose} style={{ background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 14 }}>
          {isNew ? "Got it, hide this" : "Hide"}
        </button>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
        {steps.map((s, i) => (
          <li key={s.title} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 12, alignItems: "start" }}>
            <span aria-hidden="true" className="ws-display" style={{ width: 36, height: 36, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 18,
              background: s.done ? T.green : "rgb(var(--ws-fg) / .08)", color: s.done ? T.ink : T.text }}>{s.done ? "✓" : i + 1}</span>
            <div style={{ display: "grid", gap: 4 }}>
              <div className="ws-display" style={{ fontSize: 18, fontWeight: 700 }}>
                {s.title}{s.done && <span style={{ color: T.green, fontSize: 14, fontWeight: 500, marginLeft: 8 }}>{s.done}</span>}
              </div>
              <div style={{ color: T.mist, fontSize: 15, lineHeight: 1.45 }}>{s.body}</div>
              {s.action && (
                <button className="ws-btn ws-display" onClick={s.action[1]} style={{ justifySelf: "start", marginTop: 4, background: T.green, color: T.ink, border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>
                  {s.action[0]}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div style={{ fontSize: 13.5, color: T.mist }}>No devices today? Choose <b style={{ color: T.text }}>Workbook</b> and students write their words in their books.</div>
    </section>
  );
}
