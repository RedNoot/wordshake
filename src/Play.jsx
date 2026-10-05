import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";
import { call } from "./net.js";
import { SOUND_BY_ID } from "./sounds.js";
import { PlayBoard } from "./components/PlayBoard.jsx";
import { RoundRewards } from "./Trophies.jsx";

const UP = w => w.toUpperCase();
// Every result gets an icon and words as well as a colour, so it reads without relying on red/green.
const FEEDBACK = {
  ok: (r) => ({ icon: "✓", tone: T.green, text: `${UP(r.word)}  +${r.pts}${r.bonus ? `  ⭐+${r.bonus}` : ""}` }),
  dupe: (r) => ({ icon: "↺", tone: T.amber, text: `You already have ${UP(r.word)}` }),
  short: (r, round) => ({ icon: "✂", tone: T.amber, text: `Too short. Use ${round.minLen} or more letters` }),
  board: (r) => ({ icon: "✕", tone: T.red, text: `${UP(r.word)}: those letters don't join up` }),
  notword: (r) => ({ icon: "?", tone: T.red, text: r.word ? `${UP(r.word)} isn't in our word list` : "Letters only, please" }),
  notlist: (r) => ({ icon: "📋", tone: T.amber, text: `${UP(r.word)} is a word, but it isn't on today's word list` }),
  wait: () => ({ icon: "⏳", tone: T.mist, text: "You'll play in the next round" }),
  paused: () => ({ icon: "⏸", tone: T.mist, text: "The game is paused" }),
  late: () => ({ icon: "⏰", tone: T.mist, text: "Time's up" }),
  early: () => ({ icon: "⏳", tone: T.mist, text: "Wait for the round to start" }),
  offline: () => ({ icon: "📶", tone: T.red, text: "Not sent. Check the wifi and try again" }),
};

// Remaining time, worked out from a local end time so the bar is smooth between server updates.
function useLeft(round) {
  const endAt = useRef(0);
  const [left, setLeft] = useState(round ? round.remainingMs : 0);
  useEffect(() => {
    if (!round) return;
    endAt.current = Date.now() + round.remainingMs;
    setLeft(round.remainingMs);
    if (round.state !== "playing") return;
    const id = setInterval(() => setLeft(Math.max(0, endAt.current - Date.now())), 200);
    return () => clearInterval(id);
  }, [round && round.n, round && round.state, round && round.remainingMs, round && round.clockAt]); // eslint-disable-line
  return left;
}

export function Play({ round, name, onRound }) {
  const left = useLeft(round);
  const [trace, setTrace] = useState("");
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [flash, setFlash] = useState(null);
  const timers = useRef({});
  const typeRef = useRef(null);

  useEffect(() => () => { clearTimeout(timers.current.f); clearTimeout(timers.current.b); }, []);
  useEffect(() => { setFeedback(null); setFlash(null); setTyped(""); }, [round.n]);

  const playing = round.state === "playing" && left > 0 && round.eligible;
  const timeUp = round.state === "over" || (round.state === "playing" && left <= 0);

  const send = async (word, path) => {
    const res = await call("player:word", { n: round.n, word });
    const r = res.error ? { result: "offline" } : res;
    const fb = (FEEDBACK[r.result] || FEEDBACK.notword)(r, round);
    setFeedback({ ...fb, key: Date.now() });
    clearTimeout(timers.current.f);
    timers.current.f = setTimeout(() => setFeedback(null), 2600);
    if (path) {
      setFlash({ path, ok: r.result === "ok" });
      clearTimeout(timers.current.b);
      timers.current.b = setTimeout(() => setFlash(null), 550);
    }
    if (r.result === "ok") {
      try { navigator.vibrate && navigator.vibrate(20); } catch { /* not supported */ }
      onRound(cur => cur && cur.n === round.n && !cur.words.some(w => w.word === r.word)
        ? { ...cur, words: [...cur.words, { word: r.word, pts: r.pts, bonus: r.bonus }], total: r.total } : cur);
    }
  };

  const submitTyped = e => {
    e.preventDefault();
    const w = typed.trim().toLowerCase();
    if (!w) return;
    setTyped("");
    send(w, null);
    typeRef.current && typeRef.current.focus();
  };

  const sound = round.phSound ? SOUND_BY_ID[round.phSound] : null;
  const dim = "min(92vw, 50vh, 540px)";
  const words = [...round.words].reverse();
  const frac = round.seconds ? Math.min(1, left / (round.seconds * 1000)) : 0;
  const low = left <= 10000;
  const mins = Math.floor(Math.ceil(left / 1000) / 60), secs = Math.ceil(left / 1000) % 60;

  const wordList = (
    <section aria-label="Your words" style={{ width: dim, display: "grid", gap: 8 }}>
      <div style={{ color: T.mist, fontSize: 16 }}>{round.words.length ? `Your words (${round.words.length})` : "Your words will appear here"}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {words.map(w => (
          <span key={w.word} className="ws-display" style={{ background: "rgba(87,199,133,.14)", border: "1px solid rgba(87,199,133,.45)", borderRadius: 999, padding: "4px 12px", fontSize: 19, fontWeight: 600, animation: "ws-pop .3s ease both" }}>
            {UP(w.word)} <span style={{ color: T.mist, fontSize: 15 }}>+{w.pts}{w.bonus ? ` ⭐+${w.bonus}` : ""}</span>
          </span>
        ))}
      </div>
    </section>
  );

  if (!round.eligible) {
    return (
      <div className="ws-fade" style={{ display: "grid", gap: 14, justifyItems: "center", textAlign: "center", marginTop: 30 }}>
        <div className="ws-display" style={{ fontSize: 40, fontWeight: 700 }}>You're in, <span style={{ color: T.amber }}>{name}</span>!</div>
        <div style={{ fontSize: 24, color: T.mist, maxWidth: 520, lineHeight: 1.4 }}>This round started before you joined.<br />You'll play in the next one.</div>
      </div>
    );
  }

  if (round.state === "countdown") {
    return (
      <div className="ws-fade" style={{ display: "grid", gap: 14, justifyItems: "center", textAlign: "center", marginTop: 40 }}>
        <div className="ws-display" style={{ fontSize: 52, fontWeight: 700, color: T.amber, animation: "ws-pulse 1s ease infinite" }}>Get ready, {name}!</div>
        <div style={{ fontSize: 24, color: T.mist }}>Look at the big screen.</div>
      </div>
    );
  }

  if (timeUp) {
    return (
      <div className="ws-fade" style={{ display: "grid", gap: 18, justifyItems: "center", textAlign: "center", marginTop: 20, width: "100%" }}>
        <div className="ws-display" style={{ fontSize: 46, fontWeight: 700, color: T.red }}>⏰ Time's up!</div>
        <div style={{ fontSize: 22, color: T.mist }}>Look at the big screen.</div>
        <div className="ws-display" style={{ fontSize: 28, fontWeight: 700 }}>{name}: {round.words.length} {round.words.length === 1 ? "word" : "words"}, {round.total} {round.total === 1 ? "point" : "points"}</div>
        <RoundRewards rewards={round.rewards} />
        {wordList}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", display: "grid", gap: 12, justifyItems: "center", position: "relative", userSelect: "none", WebkitUserSelect: "none" }}>
      {/* slim timer bar */}
      <div role="timer" aria-label={`${mins} minutes ${secs} seconds left`} style={{ width: dim, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
          <div style={{ width: `${frac * 100}%`, height: "100%", background: low ? T.red : T.amber, transition: "width .2s linear" }} />
        </div>
        <span className="ws-display" style={{ fontSize: 18, fontWeight: 600, color: low ? T.red : T.mist, minWidth: 44, textAlign: "right" }}>{mins}:{String(secs).padStart(2, "0")}</span>
      </div>

      <div style={{ width: dim, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="ws-display" style={{ fontSize: 22, fontWeight: 700 }}>{name}</span>
        <span className="ws-display" aria-live="polite" style={{ fontSize: 22, fontWeight: 700 }}>
          <span style={{ color: T.amber }}>{round.total}</span> {round.total === 1 ? "pt" : "pts"}
          <span style={{ color: T.mist, fontWeight: 500 }}> · {round.words.length} {round.words.length === 1 ? "word" : "words"}</span>
        </span>
      </div>

      {sound && (
        <div className="ws-display" style={{ width: dim, boxSizing: "border-box", background: T.amber, color: T.ink, borderRadius: 12, padding: "6px 14px", fontSize: 18, fontWeight: 700, textAlign: "center" }}>
          Today's sound {sound.lab} <span style={{ fontWeight: 500, opacity: 0.8 }}>· {round.phTicked.join(" · ")}{round.phBonus ? " · ⭐ +2" : ""}</span>
        </div>
      )}

      {/* the word being traced, or the last result */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {trace ? (
          <span className="ws-display" style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2, color: T.amber }}>{UP(trace)}</span>
        ) : feedback ? (
          <span key={feedback.key} role="status" className="ws-display" style={{ fontSize: 21, fontWeight: 600, color: feedback.tone, animation: "ws-pop .25s ease both", display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ fontSize: 26 }}>{feedback.icon}</span>{feedback.text}
          </span>
        ) : (
          <span style={{ color: T.mist, fontSize: 17 }}>Swipe across the letters to make a word</span>
        )}
      </div>

      <PlayBoard tiles={round.tiles} size={round.size} dim={dim} disabled={!playing} onWord={send} onTrace={setTrace} flash={flash} />

      <form onSubmit={submitTyped} style={{ width: dim, display: "flex", gap: 8 }}>
        <label htmlFor="typed" style={{ position: "absolute", left: -9999 }}>Type a word</label>
        <input id="typed" ref={typeRef} value={typed} onChange={e => setTyped(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 20))} placeholder="…or type a word"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="send" disabled={!playing}
          className="ws-display" style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 600, background: "rgba(255,255,255,.08)", color: "#EFF4F9", border: "2px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "8px 12px", textTransform: "uppercase", userSelect: "text", WebkitUserSelect: "text" }} />
        <button type="submit" disabled={!playing || !typed} className="ws-btn ws-display" style={{ fontSize: 20, fontWeight: 700, border: "none", borderRadius: 12, padding: "0 18px", cursor: "pointer", background: typed && playing ? T.amber : "rgba(255,255,255,.12)", color: typed && playing ? T.ink : "rgba(255,255,255,.4)" }}>Send</button>
      </form>

      {wordList}

      {round.state === "paused" && (
        <div role="status" style={{ position: "fixed", inset: 0, background: T.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 20 }}>
          <div className="ws-display" style={{ fontSize: 56, fontWeight: 700, color: T.amber }}>⏸ Paused</div>
          <div style={{ fontSize: 22, color: T.mist }}>Wait for your teacher.</div>
        </div>
      )}
    </div>
  );
}
