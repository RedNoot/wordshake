import { T } from "../theme.js";

// small: the settings drawer's size; big: the class picker on the start screen.
export const Chip = ({ active, onClick, children, small, big }) => (
  <button onClick={onClick} className="ws-btn ws-display" aria-pressed={!!active}
    style={{
      padding: small ? "8px 14px" : big ? "14px 28px" : "10px 18px", minHeight: 44, borderRadius: 999,
      fontSize: small ? 15.5 : big ? 24 : 18, fontWeight: big ? 700 : 600, cursor: "pointer", whiteSpace: "nowrap",
      border: `2px solid ${active ? T.amber : "rgb(var(--ws-fg) / 0.18)"}`,
      background: active ? T.amber : "transparent", color: active ? T.ink : T.mist,
    }}>{children}</button>
);
