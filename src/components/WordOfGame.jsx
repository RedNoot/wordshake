import { T } from "../theme.js";

/*
 * The word of the game banner, at the top of the board on the big screen and on every device: one easy word that's
 * definitely on the board. On a device, finding it turns the banner into a celebration (it scores like any word).
 */
export function WordOfGame({ word, found = false, width, big = false }) {
  if (!word) return null;
  return (
    <div key={found ? "found" : "look"} role="status" aria-live="polite" className="ws-display" style={{
      width, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: big ? 14 : 10, flexWrap: "wrap",
      borderRadius: 14, padding: big ? "8px 22px" : "6px 14px", textAlign: "center",
      background: found ? "rgb(var(--ws-green-rgb) / .18)" : "rgb(var(--ws-amber-rgb) / .14)",
      border: `2px solid ${found ? T.green : T.amber}`, animation: found ? "ws-pop .5s ease both" : undefined,
    }}>
      {found ? (
        <>
          <span aria-hidden="true" style={{ fontSize: big ? 34 : 26, animation: "ws-bob 1.4s ease-in-out 2" }}>🎉</span>
          <span style={{ fontSize: big ? 26 : 19, fontWeight: 700 }}>You found the word of the game!</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: big ? 24 : 17, fontWeight: 600, color: T.mist }}>The word of the game is</span>
          <span style={{ fontSize: big ? 40 : 26, fontWeight: 800, letterSpacing: 3, color: T.amber }}>{word.toUpperCase()}</span>
        </>
      )}
    </div>
  );
}
