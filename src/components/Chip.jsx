import { T } from "../theme.js";

export const Chip = ({ active, onClick, children }) => (
  <button onClick={onClick} className="ws-btn ws-display"
    style={{
      padding: "10px 18px", borderRadius: 999, fontSize: 18, fontWeight: 600, cursor: "pointer",
      border: `2px solid ${active ? T.amber : "rgb(var(--ws-fg) / 0.18)"}`,
      background: active ? T.amber : "transparent", color: active ? T.ink : T.mist,
    }}>{children}</button>
);
