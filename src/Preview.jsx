import { useEffect, useRef, useState } from "react";
import { T, CSS, applyTheme } from "./theme.js";
import { PlayBoard } from "./components/PlayBoard.jsx";
import { WordEffect, BURST_MS } from "./effects.jsx";
import { StickerBook, TrophyGrid } from "./Trophies.jsx";
import { THEMES } from "../shared/looks/themes.js";
import { DICE } from "../shared/looks/dice.js";
import { EFFECTS } from "../shared/looks/effects.js";
import { AVATARS } from "../shared/looks/avatars.js";
import { COVERS } from "../shared/looks/covers.js";
import { SLOT_NAMES, ITEM_BY_ID } from "../shared/shop.js";
import { TROPHY_BY_ID } from "../shared/rewards.js";

/*
 * /preview: the proofing gallery. Every shop item drawn the way a student would see it, side by side, plus a
 * mix-and-match device, and a 👍/👎 and a note per item (kept in this browser) for proofing before launch.
 * Not linked from anywhere; it shows no one's data.
 */
const TILES = ["s", "h", "a", "k", "e", "t", "r", "o", "qu", "i", "n", "l", "m", "p", "d", "g"];
const SAMPLE_STICKERS = { ae: { ai: 3, ay: 1, "a-e": 16 }, ee: { ee: 6 } };
const SAMPLE_SPOTTED = { ae: { ea: 4 }, oy: { oy: 2 } };
const SAMPLE_TROPHIES = { "first-round": 1, "first-word": 1, "high-five": 1, "ten-words": 1, "gold-sticker": 1 };
const NOTES_KEY = "wordshake-proof-notes";
const loadNotes = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; } };

const TABS = [
  { id: "theme", items: THEMES }, { id: "dice", items: DICE }, { id: "effect", items: EFFECTS },
  { id: "avatar", items: AVATARS }, { id: "cover", items: COVERS }, { id: "mix", items: [] },
];
const priceLabel = item => (item.unlock ? `🔓 ${TROPHY_BY_ID[item.unlock] ? TROPHY_BY_ID[item.unlock].name : item.unlock}` : item.price ? `⭐ ${item.price}` : "free");

// A patch of the page dressed in some looks. transform keeps a theme's fixed overlays (grain, patterns) inside it.
function Look({ theme = "classic", dice, cover, children, style }) {
  return (
    <div className="ws-root" data-ws-theme={theme} data-ws-dice={dice || undefined} data-ws-cover={cover || undefined}
      style={{ position: "relative", transform: "translateZ(0)", overflow: "hidden", background: `radial-gradient(500px 300px at 50% -10%, var(--ws-glow) 0%, ${T.ink} 70%)`, color: "var(--ws-text)", borderRadius: 16, padding: 16, ...style }}>
      {children}
    </div>
  );
}

// An interactive board: swipe any 2+ letters and it counts as found, so the dice's lit states and the effect show.
function TryBoard({ effect, dim = "240px" }) {
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
function DieRow() {
  const die = (state, letter) => (
    <div className="ws-display ws-die" style={{
      width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 8, fontWeight: 700, fontSize: 24,
      backgroundColor: state === "lit" ? T.amber : state === "found" ? T.green : T.dice, backgroundImage: state ? "none" : T.diceTexture, backgroundSize: "cover",
      color: state ? T.letterLit : T.letter, boxShadow: `inset 0 -5px 0 ${state ? "rgba(0,0,0,.18)" : T.diceEdge}, 0 3px 6px rgba(0,0,0,.35)`,
    }}>{letter}</div>
  );
  return <div style={{ display: "flex", gap: 8 }}>{die(null, "Sh")}{die("lit", "a")}{die("found", "k")}</div>;
}

function ThemeSample() {
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

function CoverSample() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <TrophyGrid trophies={SAMPLE_TROPHIES} compact />
      <StickerBook stickers={SAMPLE_STICKERS} spotted={SAMPLE_SPOTTED} compact />
    </div>
  );
}

function Proof({ id, notes, setNote }) {
  const n = notes[id] || {};
  const pick = v => setNote(id, { ...n, ok: n.ok === v ? undefined : v });
  const chip = (v, label) => (
    <button onClick={() => pick(v)} aria-pressed={n.ok === v} className="ws-btn" style={{ border: "2px solid #888", borderRadius: 10, padding: "2px 10px", fontSize: 18, cursor: "pointer", background: n.ok === v ? (v ? "#2FA36B" : "#E5484D") : "transparent" }}>{label}</button>
  );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
      {chip(true, "👍")}{chip(false, "👎")}
      <input value={n.note || ""} onChange={e => setNote(id, { ...n, note: e.target.value })} placeholder="Note…" aria-label={`Note on ${id}`}
        style={{ flex: 1, minWidth: 0, fontSize: 14, padding: "4px 8px", borderRadius: 8, border: "1px solid #888", background: "transparent", color: "inherit" }} />
    </div>
  );
}

function Card({ item, notes, setNote, children }) {
  return (
    <section style={{ display: "grid", gap: 8, alignContent: "start", background: "rgb(var(--ws-fg) / .04)", border: "1px solid var(--ws-faint)", borderRadius: 18, padding: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <span className="ws-display" style={{ fontSize: 19, fontWeight: 700 }}>{item.emoji} {item.name}</span>
        <span style={{ color: T.mist, fontSize: 14, whiteSpace: "nowrap" }}>{priceLabel(item)} · <code>{item.id}</code></span>
      </header>
      {children}
      <Proof id={item.id} notes={notes} setNote={setNote} />
    </section>
  );
}

function Mix() {
  const [w, setW] = useState({ theme: "classic", dice: "", effect: "", avatar: "", cover: "" });
  const pick = (slot, list) => (
    <label style={{ display: "grid", gap: 4, fontSize: 14, color: T.mist }}>
      {SLOT_NAMES[slot]}
      <select value={w[slot]} onChange={e => setW(v => ({ ...v, [slot]: e.target.value }))} style={{ fontSize: 15, padding: 6, borderRadius: 8 }}>
        {slot !== "theme" && <option value="">(none: the default)</option>}
        {list.map(i => <option key={i.id} value={i.id}>{i.emoji} {i.name}</option>)}
      </select>
    </label>
  );
  const avatar = w.avatar && ITEM_BY_ID[w.avatar];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
        {pick("theme", THEMES)}{pick("dice", DICE)}{pick("effect", EFFECTS)}{pick("avatar", AVATARS)}{pick("cover", COVERS)}
      </div>
      <Look theme={w.theme} dice={w.dice} cover={w.cover} style={{ display: "grid", gap: 16, justifyItems: "center", padding: 24 }}>
        <div className="ws-display" style={{ fontSize: 30, fontWeight: 700 }}>{avatar && <span aria-hidden="true">{avatar.emoji} </span>}You're in, <span style={{ color: T.amber }}>Ava</span>!</div>
        <TryBoard effect={w.effect || null} dim="min(80vw, 320px)" />
        <ThemeSample />
        <div style={{ width: "min(100%, 520px)" }}><CoverSample /></div>
      </Look>
      <Look style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <span style={{ color: T.mist, width: "100%", fontSize: 14 }}>The big-screen lobby (always classic):</span>
        {["Ava", "Noah", "Mia"].map((n, i) => (
          <span key={n} className="ws-display" style={{ fontSize: 22, fontWeight: 600, background: "rgb(var(--ws-fg) / .08)", borderRadius: 999, padding: "6px 16px" }}>
            {i === 0 && avatar && <span aria-hidden="true">{avatar.emoji} </span>}{n}
          </span>
        ))}
      </Look>
    </div>
  );
}

export function Preview() {
  const [tab, setTab] = useState("theme");
  const [notes, setNotes] = useState(loadNotes);
  const [copied, setCopied] = useState(false);
  useEffect(() => { applyTheme(); }, []);
  const setNote = (id, n) => setNotes(cur => {
    const next = { ...cur, [id]: n };
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  const copy = async () => {
    const lines = Object.entries(notes).filter(([, n]) => n.ok !== undefined || n.note)
      .map(([id, n]) => `${id}: ${n.ok === true ? "👍" : n.ok === false ? "👎" : "–"}${n.note ? `  ${n.note}` : ""}`);
    try { await navigator.clipboard.writeText(lines.join("\n") || "(no notes yet)"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt("Copy your notes:", lines.join("\n")); }
  };
  const current = TABS.find(x => x.id === tab);

  return (
    <div className="ws-root" style={{ minHeight: "100vh", background: T.ink, color: "var(--ws-text)", padding: "16px 16px 60px", boxSizing: "border-box" }}>
      <style>{CSS}</style>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 26 }}>Shop proofing gallery</h1>
        <button onClick={copy} className="ws-btn ws-display" style={{ border: "none", borderRadius: 12, padding: "8px 16px", fontWeight: 700, background: T.amber, color: T.ink, cursor: "pointer" }}>{copied ? "Copied ✓" : "Copy my notes"}</button>
      </header>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {TABS.map(x => (
          <button key={x.id} onClick={() => setTab(x.id)} aria-pressed={tab === x.id} className="ws-btn ws-display"
            style={{ border: `2px solid ${tab === x.id ? T.amber : "rgb(var(--ws-fg) / .2)"}`, borderRadius: 999, padding: "6px 14px", fontSize: 16, fontWeight: 600, cursor: "pointer", background: tab === x.id ? "rgb(var(--ws-amber-rgb) / .15)" : "transparent", color: "var(--ws-text)" }}>
            {x.id === "mix" ? "Mix & match" : SLOT_NAMES[x.id]}{x.id !== "mix" && ` (${x.items.length})`}
          </button>
        ))}
      </nav>

      {tab === "mix" && <Mix />}
      {tab !== "mix" && !current.items.length && <p style={{ color: T.mist }}>Nothing in this part of the shop yet.</p>}
      {tab !== "mix" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          {current.items.map(item => (
            <Card key={item.id} item={item} notes={notes} setNote={setNote}>
              {tab === "theme" && <Look theme={item.id} style={{ display: "grid", gap: 12 }}><ThemeSample /><TryBoard dim="220px" /></Look>}
              {tab === "dice" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {["classic", "rednut"].map(th => <Look key={th} theme={th} dice={item.id} style={{ padding: 10, display: "grid", gap: 8, justifyItems: "center" }}><TryBoard dim="140px" /><DieRow /></Look>)}
                </div>
              )}
              {tab === "effect" && <Look style={{ display: "grid", justifyItems: "center", gap: 6 }}><TryBoard effect={item.id} dim="220px" /><span style={{ color: T.mist, fontSize: 13 }}>Swipe any letters to see it</span></Look>}
              {tab === "avatar" && (
                <Look style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">{item.emoji}</span>
                  <span className="ws-display" style={{ fontSize: 22, fontWeight: 600, background: "rgb(var(--ws-fg) / .08)", borderRadius: 999, padding: "6px 16px" }}>{item.emoji} Ava</span>
                </Look>
              )}
              {tab === "cover" && <Look cover={item.id}><CoverSample /></Look>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
