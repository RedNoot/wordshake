import { useEffect, useRef, useState } from "react";
import { T } from "../theme.js";
import { PlayBoard } from "./PlayBoard.jsx";
import { WordEffect, BURST_MS } from "../effects.jsx";
import { StickerBook, TrophyGrid, Sticker } from "../Trophies.jsx";

/*
 * Small live samples of the shop's looks, drawn the way a student sees them: used by the /preview proofing gallery
 * and by the student's Shop. Look dresses just a patch of the page, so many can sit side by side.
 */
export const TILES = ["s", "h", "a", "k", "e", "t", "r", "o", "qu", "i", "n", "l", "m", "p", "d", "g"];
export const SAMPLE_STICKERS = { ae: { ai: 3, ay: 1, "a-e": 16 }, ee: { ee: 6 } };
export const SAMPLE_SPOTTED = { ae: { ea: 4 }, oy: { oy: 2 } };
export const SAMPLE_TROPHIES = { "first-round": 1, "first-word": 1, "high-five": 1, "ten-words": 1, "gold-sticker": 1 };
// A patch of the page dressed in some looks. transform keeps a theme's fixed overlays (grain, patterns) inside it.
export function Look({ theme = "classic", dice, cover, children, style }) {
  return (
    <div className="ws-root" data-ws-theme={theme} data-ws-dice={dice || undefined} data-ws-cover={cover || undefined}
      style={{ position: "relative", transform: "translateZ(0)", overflow: "hidden", background: `radial-gradient(500px 300px at 50% -10%, var(--ws-glow) 0%, ${T.ink} 70%)`, color: "var(--ws-text)", borderRadius: 16, padding: 16, ...style }}>
      {children}
    </div>
  );
}

// An interactive board: swipe any 2+ letters and it counts as found, so the dice's lit states and the effect show.
export function TryBoard({ effect, dim = "240px" }) {
  const [flash, setFlash] = useState(null);
  const [burst, setBurst] = useState(null);
  const t = useRef({});
  useEffect(() => () => { clearTimeout(t.current.a); clearTimeout(t.current.b); }, []);
  const found = (word, path) => {
    setFlash({ path, ok: true });
    const end = path[path.length - 1];
    setBurst({ key: Date.now(), path, size: 4, word, colour: T.amber, x: ((end % 4) + 0.5) / 4 * 100, y: (Math.floor(end / 4) + 0.5) / 4 * 100 });
    clearTimeout(t.current.a); clearTimeout(t.current.b);
    t.current.a = setTimeout(() => setFlash(null), 550);
    t.current.b = setTimeout(() => setBurst(null), BURST_MS);
  };
  return (
    <div style={{ position: "relative", width: "fit-content" }}>
      <PlayBoard tiles={TILES} size={4} dim={dim} onWord={found} onTrace={() => {}} flash={flash} />
      <WordEffect effect={effect} burst={burst} />
    </div>
  );
}

// A die at rest, traced and just found, the three states a student sees.
export function DieRow() {
  const die = (state, letter) => (
    <div className="ws-display ws-die" style={{
      width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 8, fontWeight: 700, fontSize: 24,
      backgroundColor: state === "lit" ? T.amber : state === "found" ? T.green : T.dice, backgroundImage: state ? "none" : T.diceTexture, backgroundSize: "cover",
      color: state ? T.letterLit : T.letter, boxShadow: `inset 0 -5px 0 ${state ? "rgba(0,0,0,.18)" : T.diceEdge}, 0 3px 6px rgba(0,0,0,.35)`,
    }}>{letter}</div>
  );
  return <div style={{ display: "flex", gap: 8 }}>{die(null, "Sh")}{die("lit", "a")}{die("found", "k")}</div>;
}

export function ThemeSample() {
  const btn = bg => ({ border: "none", borderRadius: 12, padding: "8px 14px", fontWeight: 700, fontSize: 16, background: bg, color: T.ink, cursor: "pointer" });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="ws-display" style={{ fontSize: 24, fontWeight: 700 }}>You're in, <span style={{ color: T.amber }}>Ava</span>!</div>
      <div style={{ color: T.mist, fontSize: 15 }}>Wait for your teacher to start the game.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="ws-btn ws-display" style={btn(T.amber)}>Go →</button>
        <button className="ws-btn ws-display" style={btn(T.green)}>Yes, that's me</button>
        <button className="ws-btn ws-display" style={{ ...btn("rgb(var(--ws-fg) / .1)"), color: "var(--ws-text)" }}>No, go back</button>
      </div>
      <div className="ws-display" style={{ fontSize: 16, fontWeight: 600, display: "grid", gap: 2 }}>
        <span style={{ color: T.green }}>✓ SHAKE +3</span>
        <span style={{ color: T.red }}>✕ QOT isn't in our word list</span>
        <span style={{ color: T.amber }}>↺ You already have TREK</span>
      </div>
      <DieRow />
    </div>
  );
}

export function CoverSample() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <TrophyGrid trophies={SAMPLE_TROPHIES} compact />
      <StickerBook stickers={SAMPLE_STICKERS} spotted={SAMPLE_SPOTTED} compact />
    </div>
  );
}


// A small, still picture of a sticker book cover (the Shop's cards): a cabinet shelf and a corner of a sticker page.
export function CoverMini() {
  return (
    <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateRows: "1fr 12px", background: "var(--ws-cabinet)", border: "4px solid var(--ws-cabinet-edge)", borderRadius: 10, height: 72, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "end", gap: 4, fontSize: 26, lineHeight: 1 }}>
          <span>🏆</span><span style={{ filter: "var(--ws-silhouette)" }}>🎯</span>
        </div>
        <div style={{ background: "var(--ws-shelf)", borderBottom: "4px solid var(--ws-shelf-edge)" }} />
      </div>
      <div className="ws-page" style={{ position: "relative", height: 72, boxSizing: "border-box", background: "var(--ws-page)", borderRadius: "3px 10px 10px 3px", borderLeft: "8px solid var(--ws-binding)", padding: "6px 8px", display: "grid", alignContent: "start", gap: 4 }}>
        <span className="ws-display" style={{ fontSize: 13, fontWeight: 800, color: "var(--ws-page-accent)", whiteSpace: "nowrap", overflow: "hidden" }}>Stickers</span>
        <span style={{ display: "flex", gap: 4 }}><Sticker g="ai" sound="ae" size={30} /><Sticker g="ay" tier={3} sound="ae" size={30} /></span>
      </div>
    </div>
  );
}
