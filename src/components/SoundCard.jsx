import { T } from "../theme.js";

export function SoundCard({ soundDef, ticked, bonus }) {
  return (
    <div className="ws-display" style={{
      position: "relative", zIndex: 5, transform: "rotate(-1.2deg)",
      background: T.amber, color: T.ink, borderRadius: 14, padding: "9px 24px 11px",
      boxShadow: "0 5px 0 var(--ws-amber-edge), 0 10px 22px rgba(0,0,0,.4)", textAlign: "center",
      maxWidth: "min(92vw, 680px)", margin: "0 auto",
    }}>
      <div style={{ fontSize: "clamp(20px, 3.2vh, 30px)", fontWeight: 700, lineHeight: 1.05 }}>
        Today's sound {soundDef.lab}
        <span style={{ fontWeight: 500, fontSize: "0.6em", opacity: 0.75 }}>  as in {soundDef.eg}</span>
      </div>
      <div style={{ fontSize: "clamp(15px, 2.4vh, 21px)", fontWeight: 600, marginTop: 2, letterSpacing: 0.5 }}>
        {ticked.join("  ·  ")}{bonus ? "  ·  +2 pts" : ""}
      </div>
    </div>
  );
}
