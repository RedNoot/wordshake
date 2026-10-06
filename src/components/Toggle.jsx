import { T } from "../theme.js";

export const Toggle = ({ on, onClick, label }) => (
  <button onClick={onClick} className="ws-btn" aria-pressed={on}
    style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", color: T.mist, fontSize: 16 }}>
    <span style={{ width: 46, height: 26, borderRadius: 999, background: on ? T.amber : "rgb(var(--ws-fg) / 0.15)", position: "relative", flex: "none" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: on ? T.ink : T.mist, transition: "left .15s" }} />
    </span>{label}
  </button>
);
