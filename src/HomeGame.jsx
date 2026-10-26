import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { T } from "./theme.js";
import { SOUND_BY_ID } from "./sounds.js";
import { HOME_SIZES as SIZES, HOME_LENGTHS as LENGTHS, HOME_TIMES as TIMES } from "../shared/home.js";

/*
 * A student's own game at home (server/lib/rooms.js "home games"): their device is the big screen and a player at once.
 * Family and friends join on their own phone or tablet with the code or the QR code, as guests.
 */

const KEY = "wordshake-home-board";
const DEFAULT = { size: 4, minLen: 3, seconds: 120 };
// The board the student picked last time (remembered on this device).
export function homeBoard() {
  try {
    const b = JSON.parse(localStorage.getItem(KEY) || "null");
    if (b && SIZES.includes(b.size) && LENGTHS.includes(b.minLen) && TIMES.includes(b.seconds)) return b;
  } catch { /* private mode, or nothing saved */ }
  return DEFAULT;
}
const keepBoard = b => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* private mode */ } };
// What the server's round settings need (server/lib/settings.js pickRoundSettings).
export const roundSettings = b => ({ seconds: b.seconds, size: b.size, minLen: b.minLen, hints: true, hintSeconds: 15 });

const big = { fontSize: 24, fontWeight: 700, border: "none", borderRadius: 16, padding: "16px 28px", cursor: "pointer" };
const link = { background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 17, padding: 8 };

function Choice({ label, options, value, show, onPick }) {
  return (
    <div role="group" aria-label={label} style={{ display: "grid", gap: 6 }}>
      <div style={{ color: T.mist, fontSize: 16 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {options.map(o => {
          const on = o === value;
          return (
            <button key={o} type="button" className="ws-btn ws-display" aria-pressed={on} onClick={() => onPick(o)}
              style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: on ? 700 : 500, padding: "10px 6px", borderRadius: 12, cursor: "pointer",
                background: on ? T.amber : "rgb(var(--ws-fg) / .06)", color: on ? T.ink : "var(--ws-text)", border: `2px solid ${on ? T.amber : "rgb(var(--ws-fg) / .18)"}` }}>
              {show(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// "5×5 · 3+ letters · 2 min", and the sound when there is one: "· sound /ae/ (ai, ay)"
export const boardLine = b => `${b.size}×${b.size} · ${b.minLen}+ letters · ${b.seconds / 60} min`
  + (b.phSound && SOUND_BY_ID[b.phSound] ? ` · sound ${SOUND_BY_ID[b.phSound].lab}${b.phTicked && b.phTicked.length ? ` (${b.phTicked.join(", ")})` : ""}` : "");

// The student's lobby: pick a board (the teacher's home game first, if there is one), see who has joined, and start.
export function HomeLobby({ host, me, avatar, busy, onStart, onKick, onFinish, extras }) {
  const task = host.task;
  const [board, setBoard] = useState(homeBoard);
  const pick = patch => setBoard(b => { const n = { ...b, ...patch }; keepBoard(n); return n; });
  const joinUrl = `${window.location.origin}/join/${host.code}`;
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 360, color: { dark: "#0E1A2B", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [joinUrl]);
  const others = host.players.filter(p => p.name !== me.name || p.guest);

  return (
    <div className="ws-fade" style={{ width: "min(560px, 100%)", display: "grid", gap: 20, justifyItems: "stretch" }}>
      <div className="ws-display" style={{ fontSize: 36, fontWeight: 700, textAlign: "center" }}>{avatar}<span style={{ color: T.amber }}>{me.name}</span>'s game</div>

      {task && !task.done && (
        <section aria-label="Your teacher's game" style={{ display: "grid", gap: 10, justifyItems: "center", textAlign: "center", background: "rgb(var(--ws-amber-rgb) / .1)", border: "2px solid rgb(var(--ws-amber-rgb) / .5)", borderRadius: 18, padding: 18 }}>
          <div className="ws-display" style={{ fontSize: 26, fontWeight: 700 }}>Your teacher's game 📝</div>
          <div style={{ color: T.mist, fontSize: 17, lineHeight: 1.4 }}>Your teacher has set a board for the whole class. Play it once, then you can choose your own boards.</div>
          <div className="ws-display" style={{ fontSize: 19, fontWeight: 600 }}>{boardLine(task.settings)}</div>
          <button type="button" disabled={busy} onClick={() => onStart(null, true)} className="ws-btn ws-display"
            style={{ ...big, background: T.amber, color: T.ink, marginTop: 4 }}>{busy ? "Getting ready…" : "Play your teacher's game 🎲"}</button>
        </section>
      )}

      {(!task || task.done) && (
        <section aria-label="Your board" style={{ display: "grid", gap: 14, background: "rgb(var(--ws-fg) / .05)", borderRadius: 18, padding: 16 }}>
          <Choice label="Board size" options={SIZES} value={board.size} show={n => `${n}×${n}`} onPick={size => pick({ size })} />
          <Choice label="Shortest word" options={LENGTHS} value={board.minLen} show={n => `${n} letters`} onPick={minLen => pick({ minLen })} />
          <Choice label="Time" options={TIMES} value={board.seconds} show={s => `${s / 60} min`} onPick={seconds => pick({ seconds })} />
          <button type="button" disabled={busy} onClick={() => onStart(board)} className="ws-btn ws-display"
            style={{ ...big, background: T.green, color: T.ink, marginTop: 4 }}>{busy ? "Shaking…" : "Shake the dice! 🎲"}</button>
          {task && <button type="button" disabled={busy} onClick={() => onStart(null, true)} style={{ ...link, justifySelf: "center" }}>Play your teacher's game again</button>}
        </section>
      )}

      <section aria-label="Play with family or friends" style={{ display: "grid", gap: 10, justifyItems: "center", textAlign: "center", background: "rgb(var(--ws-fg) / .05)", borderRadius: 18, padding: 16 }}>
        <div className="ws-display" style={{ fontSize: 22, fontWeight: 700 }}>Play with family or friends</div>
        <div style={{ color: T.mist, fontSize: 16, lineHeight: 1.4 }}>On their phone or tablet, go to <b style={{ color: "var(--ws-text)" }}>{window.location.host}/join</b> and type</div>
        <div className="ws-display" aria-label={`Game code ${host.code.split("").join(" ")}`} style={{ fontSize: 56, fontWeight: 700, letterSpacing: "0.12em", color: T.amber, lineHeight: 1 }}>{host.code}</div>
        <div style={{ color: T.mist, fontSize: 15 }}>or scan this with their camera</div>
        {qr ? <img src={qr} alt={`QR code for ${joinUrl}`} style={{ width: 180, height: 180, borderRadius: 12, background: "#fff", padding: 6 }} /> : <div style={{ width: 180, height: 180 }} />}
        <div aria-live="polite" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 }}>
          {others.length === 0 && <span style={{ color: T.mist, fontSize: 16 }}>Nobody else yet. You can play on your own too!</span>}
          {others.map(p => (
            <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: p.connected ? 1 : 0.45, background: "rgb(var(--ws-fg) / .07)", borderRadius: 999, padding: "4px 4px 4px 14px", animation: "ws-pop .4s ease both" }}>
              <span className="ws-display" style={{ fontSize: 19, fontWeight: 600 }}>{p.avatar ? `${p.avatar} ` : ""}{p.name}</span>
              <button type="button" className="ws-btn" onClick={() => onKick(p)} aria-label={`Take ${p.name} out of the game`} title="Take out"
                style={{ background: "none", border: "none", color: "rgb(var(--ws-fg) / .4)", cursor: "pointer", fontSize: 15, padding: "2px 8px" }}>✕</button>
            </span>
          ))}
        </div>
      </section>

      {extras}
      <button type="button" onClick={onFinish} style={{ ...link, justifySelf: "center" }}>Finish playing</button>
    </div>
  );
}

// Under the board, for the student running the game: pause during a round; afterwards, play again or change the board.
// (Paused, Play's own pause screen has the button to carry on.)
export function HomeControls({ round, phase, busy, onPause, onAgain, onBoard }) {
  const btn = { fontSize: 19, fontWeight: 700, borderRadius: 14, padding: "12px 22px", cursor: "pointer" };
  if (phase === "reveal" && round.state === "over") {
    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", margin: "18px 0 4px" }}>
        <button type="button" disabled={busy} onClick={onAgain} className="ws-btn ws-display" style={{ ...btn, border: "none", background: T.green, color: T.ink }}>{busy ? "Shaking…" : "Play again 🎲"}</button>
        <button type="button" onClick={onBoard} className="ws-btn ws-display" style={{ ...btn, background: "none", color: "var(--ws-text)", border: "2px solid rgb(var(--ws-fg) / .25)" }}>Change the board</button>
      </div>
    );
  }
  if (round.state === "playing") return <button type="button" onClick={onPause} className="ws-btn" style={{ ...link, marginTop: 10 }}>⏸ Pause</button>;
  return null;
}

// After a home round: the words on the board you didn't find (in class, the big screen shows these).
export function Missed({ words, width }) {
  if (!words || !words.length) return null;
  return (
    <section aria-label="Words you missed" style={{ width, display: "grid", gap: 8 }}>
      <div style={{ color: T.mist, fontSize: 16 }}>Words you could have found</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {words.map(w => (
          <span key={w} className="ws-display" style={{ background: "rgb(var(--ws-fg) / .06)", border: "1px dashed rgb(var(--ws-fg) / .3)", borderRadius: 999, padding: "4px 12px", fontSize: 18, fontWeight: 600 }}>{w.toUpperCase()}</span>
        ))}
      </div>
    </section>
  );
}
