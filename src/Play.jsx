import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";
import { call } from "./net.js";
import { SOUND_BY_ID } from "./sounds.js";
import { PlayBoard } from "./components/PlayBoard.jsx";
import { WordEffect, BURST_MS } from "./effects.jsx";
import { wornEffect } from "./looks.js";
import { RoundRewards, RoundSplash } from "./Trophies.jsx";
import { TeamBadge, TeamResults, winnerLine } from "./Teams.jsx";
import { bestLine } from "./components/WordWall.jsx";
import { WordOfGame } from "./components/WordOfGame.jsx";
import { useCountUp } from "./RoundEnd.jsx";

const HINT_AFTER_DEFAULT = 15000;   // a round from before the teacher could pick: the server (server/lib/round.js) has the final say

// Which round's splash this device has already shown, so a refresh doesn't play it again.
const SEEN_KEY = "wordshake-rewards-seen";
const readSeen = () => { try { return sessionStorage.getItem(SEEN_KEY) || ""; } catch { return ""; } };
// The same for the time's-up intro (the dice shake, then your words counting up), so it plays once per round.
const INTRO_KEY = "wordshake-intro-seen";
const readIntro = () => { try { return sessionStorage.getItem(INTRO_KEY) || ""; } catch { return ""; } };
const SHAKE_MS = 1700, COUNT_MS = 2500;
const reducedMotion = () => !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

export function Play({ round, name, avatar = "", guest = false, onRound }) {
  const left = useLeft(round);
  const [trace, setTrace] = useState("");
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [flash, setFlash] = useState(null);
  const [burst, setBurst] = useState(null);   // the found-word effect being drawn (see effects.jsx)
  const timers = useRef({});
  const typeRef = useRef(null);

  useEffect(() => () => { clearTimeout(timers.current.f); clearTimeout(timers.current.b); clearTimeout(timers.current.e); }, []);
  useEffect(() => { setFeedback(null); setFlash(null); setTyped(""); }, [round.n]);

  const playing = round.state === "playing" && left > 0 && round.eligible;

  // Hints: after the teacher's hint time (15 seconds unless they changed it) without finding a word, ask the server for one of the shortest words on the board.
  // The server checks the time itself and picks the word, so the answers never come to the device.
  const [hint, setHint] = useState(round.hint || null);
  const idleFrom = useRef(Date.now());
  const hintStop = useRef(false), asking = useRef(false);
  useEffect(() => { setHint(round.hint || null); hintStop.current = false; }, [round.n, round.hint]);
  useEffect(() => { idleFrom.current = Date.now(); }, [round.n, round.state]);
  useEffect(() => {
    if (!playing || round.hints === false) return;
    const after = round.hintAfterMs || HINT_AFTER_DEFAULT;
    const id = setInterval(async () => {
      if (hintStop.current || asking.current || Date.now() - idleFrom.current < after) return;
      asking.current = true;
      const res = await call("player:hint", { n: round.n });
      asking.current = false;
      if (res.result === "hint") { idleFrom.current = Date.now(); setHint(res.word); }
      else if (res.result === "wait") idleFrom.current = Date.now() - after + (res.waitMs || 1000);
      else if (res.result === "offline" || res.error) idleFrom.current = Date.now() - after + 5000;
      else hintStop.current = true;   // hints off, nothing left to suggest, or the round is over
    }, 1000);
    return () => clearInterval(id);
  }, [playing, round.n, round.hints, round.hintAfterMs]);
  const timeUp = round.state === "over" || (round.state === "playing" && left <= 0);
  // The splash appears once the round is saved (class-list students only; guests have no collection).
  const r = round.rewards;
  const rewardSig = r ? `${round.n}|${JSON.stringify([r.best, r.trophies, r.stickers])}` : "";
  const [seen, setSeen] = useState(readSeen);
  const [replay, setReplay] = useState(false);
  const closePopup = () => { setReplay(false); setSeen(rewardSig); try { sessionStorage.setItem(SEEN_KEY, rewardSig); } catch { /* private mode */ } };

  // Time's up: the dice rattle and settle ("Dice down!"), then your own words count up, then your end screen.
  // The rewards popup waits until that's done.
  const introSig = `${round.n}|${(round.tiles || []).join("")}`;
  const [intro, setIntro] = useState({ sig: null, step: "shake" });
  useEffect(() => {
    if (!timeUp || !round.eligible) return;
    const done = () => { setIntro({ sig: introSig, step: "done" }); try { sessionStorage.setItem(INTRO_KEY, introSig); } catch { /* private mode */ } };
    if (readIntro() === introSig || reducedMotion()) return done();
    setIntro({ sig: introSig, step: "shake" });
    const counting = round.words.length > 0;
    const a = counting && setTimeout(() => setIntro({ sig: introSig, step: "count" }), SHAKE_MS);
    const b = setTimeout(done, SHAKE_MS + (counting ? COUNT_MS : 0));
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [timeUp, introSig, round.eligible]); // eslint-disable-line
  const introStep = !timeUp ? "done" : intro.sig === introSig ? intro.step : readIntro() === introSig ? "done" : "shake";
  const myCount = useCountUp(introStep === "count" ? round.words.length : null, 1600);

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
      idleFrom.current = Date.now();
      if (r.word === hint) setHint(null);
      const end = path && path.length ? path[path.length - 1] : null;
      setBurst({
        key: Date.now(), path: path || [], size: round.size, word: r.word, colour: T.amber,
        x: end == null ? 50 : ((end % round.size) + 0.5) / round.size * 100, y: end == null ? 50 : (Math.floor(end / round.size) + 0.5) / round.size * 100,
      });
      clearTimeout(timers.current.e);
      timers.current.e = setTimeout(() => setBurst(null), BURST_MS);
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
          <span key={w.word} className="ws-display" style={{ background: "rgb(var(--ws-green-rgb) / .14)", border: "1px solid rgb(var(--ws-green-rgb) / .45)", borderRadius: 999, padding: "4px 12px", fontSize: 19, fontWeight: 600, animation: "ws-pop .3s ease both" }}>
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
        {round.team != null && <div style={{ fontSize: 22, color: T.mist }}>Playing for <TeamBadge team={round.team} size={22} /></div>}
        {round.coop && <div style={{ fontSize: 22, color: T.mist }}>🤝 Class together: every new word you find goes up on the big screen.</div>}
        <div style={{ fontSize: 24, color: T.mist }}>Look at the big screen.</div>
      </div>
    );
  }

  if (timeUp && introStep === "shake") {
    return (
      <div role="status" style={{ display: "grid", gap: 18, justifyItems: "center", textAlign: "center", marginTop: 10, width: "100%" }}>
        <div className="ws-display" style={{ fontSize: 34, fontWeight: 700, color: T.red }}>Time's up!</div>
        <div style={{ animation: "ws-rattle .42s ease-in-out 3" }}>
          <PlayBoard tiles={round.tiles} size={round.size} dim={dim} disabled onWord={() => {}} onTrace={() => {}} flash={null} />
        </div>
        <div className="ws-display" style={{ fontSize: 46, fontWeight: 700, animation: "ws-slap .6s 1.1s ease both" }}>Dice down!</div>
      </div>
    );
  }

  if (timeUp && introStep === "count") {
    return (
      <div role="status" className="ws-fade" style={{ display: "grid", gap: 6, justifyItems: "center", textAlign: "center", marginTop: "12vh", width: "100%" }}>
        <div style={{ fontSize: 24, color: T.mist }}>You found</div>
        <div className="ws-display" style={{ fontSize: "min(42vw, 190px)", fontWeight: 700, lineHeight: 1, color: T.amber, fontVariantNumeric: "tabular-nums" }}>{myCount}</div>
        <div className="ws-display" style={{ fontSize: 32, fontWeight: 600 }}>{round.words.length === 1 ? "word" : "words"}</div>
      </div>
    );
  }

  if (timeUp) {
    return (
      <div className="ws-fade" style={{ display: "grid", gap: 18, justifyItems: "center", textAlign: "center", marginTop: 20, width: "100%" }}>
        <div className="ws-display" style={{ fontSize: 46, fontWeight: 700, color: T.red }}>⏰ Time's up!</div>
        <div style={{ fontSize: 22, color: T.mist }}>Look at the big screen.</div>
        <div className="ws-display" style={{ fontSize: 28, fontWeight: 700 }}>{name}: {round.words.length} {round.words.length === 1 ? "word" : "words"}, {round.total} {round.total === 1 ? "point" : "points"}</div>
        {round.team != null && !round.teamResult && (
          <div style={{ fontSize: 19, color: T.mist }}>Your points go to <TeamBadge team={round.team} size={19} />. The big screen will show which team won.</div>
        )}
        {round.teamResult && (
          <section aria-label="Team scores" style={{ display: "grid", gap: 14, justifyItems: "center", width: "min(92vw, 540px)", background: "rgb(var(--ws-fg) / .05)", borderRadius: 18, padding: "16px 16px 18px", boxSizing: "border-box", animation: "ws-pop .5s ease both" }}>
            <div role="status" className="ws-display" style={{ fontSize: 30, fontWeight: 700, color: T.amber }}>{winnerLine(round.teamResult)}</div>
            <TeamResults result={round.teamResult} mine={round.team} />
          </section>
        )}
        {round.coopResult && (
          <section aria-label="Class together" style={{ display: "grid", gap: 8, justifyItems: "center", width: "min(92vw, 540px)", background: "rgb(var(--ws-fg) / .05)", borderRadius: 18, padding: "16px 16px 18px", boxSizing: "border-box", animation: "ws-pop .5s ease both" }}>
            <div className="ws-display" style={{ fontSize: 28, fontWeight: 700, color: T.amber }}>🤝 Together: {round.coopResult.words} of {round.coopResult.of} words</div>
            <div role="status" style={{ fontSize: 19, color: round.coopResult.newBest ? T.green : T.mist }}>{bestLine(round.coopResult)}</div>
          </section>
        )}
        <RoundRewards rewards={round.rewards} stars={guest || !r ? null : r.stars} />
        {r && r.summary && (
          <button type="button" className="ws-btn ws-display" onClick={() => setReplay(true)}
            style={{ fontSize: 19, fontWeight: 700, background: "none", color: T.amber, border: `2px solid ${T.amber}`, borderRadius: 14, padding: "10px 22px", cursor: "pointer" }}>
            🏆 See my progress
          </button>
        )}
        {wordList}
        {rewardSig && (seen !== rewardSig || replay) && introStep === "done" && (
          <RoundSplash rewards={r} name={name} avatar={avatar} stars={guest ? null : r.stars} words={round.words.length} points={round.total} onDone={closePopup} />
        )}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", display: "grid", gap: 12, justifyItems: "center", position: "relative", userSelect: "none", WebkitUserSelect: "none" }}>
      {/* slim timer bar */}
      <div role="timer" aria-label={`${mins} minutes ${secs} seconds left`} style={{ width: dim, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 999, background: "rgb(var(--ws-fg) / .1)", overflow: "hidden" }}>
          <div style={{ width: `${frac * 100}%`, height: "100%", background: low ? T.red : T.amber, transition: "width .2s linear" }} />
        </div>
        <span className="ws-display" style={{ fontSize: 18, fontWeight: 600, color: low ? T.red : T.mist, minWidth: 44, textAlign: "right" }}>{mins}:{String(secs).padStart(2, "0")}</span>
      </div>

      <div style={{ width: dim, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="ws-display" style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{name}{round.team != null && <TeamBadge team={round.team} size={14} />}</span>
        <span className="ws-display" aria-live="polite" style={{ fontSize: 22, fontWeight: 700 }}>
          <span style={{ color: T.amber }}>{round.total}</span> {round.total === 1 ? "pt" : "pts"}
          <span style={{ color: T.mist, fontWeight: 500 }}> · {round.words.length} {round.words.length === 1 ? "word" : "words"}</span>
        </span>
      </div>
      {round.coop && (
        <div aria-live="polite" style={{ width: dim, fontSize: 17, color: T.mist }}>
          🤝 Class: <b key={round.coop.words} style={{ color: T.green, display: "inline-block", animation: "ws-pop .4s ease both" }}>{round.coop.words}</b> of {round.coop.of} words found together
        </div>
      )}

      {sound && (
        <div className="ws-display" style={{ width: dim, boxSizing: "border-box", background: T.amber, color: T.ink, borderRadius: 12, padding: "6px 14px", fontSize: 18, fontWeight: 700, textAlign: "center" }}>
          Today's sound {sound.lab} <span style={{ fontWeight: 500, opacity: 0.8 }}>· {round.phTicked.join(" · ")}{round.phBonus ? " · ⭐ +2" : ""}</span>
        </div>
      )}

      {round.wordOfGame && (
        <WordOfGame word={round.wordOfGame} width={dim} found={round.words.some(w => w.word === round.wordOfGame)} />
      )}

      {hint && playing && (
        <div key={hint} role="status" aria-live="polite" style={{ width: dim, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap",
          background: "rgb(var(--ws-green-rgb) / .14)", border: "2px dashed rgb(var(--ws-green-rgb) / .6)", borderRadius: 14, padding: "8px 14px", animation: "ws-pop .45s ease both" }}>
          <span aria-hidden="true" style={{ fontSize: 26, animation: "ws-bob 1.6s ease-in-out infinite" }}>💡</span>
          <span style={{ fontSize: 17, color: T.mist }}>Stuck? Look for</span>
          <span className="ws-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, color: T.green }}>{UP(hint)}</span>
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

      <div style={{ position: "relative" }}>
        <PlayBoard tiles={round.tiles} size={round.size} dim={dim} disabled={!playing} onWord={send} onTrace={setTrace} flash={flash} />
        <WordEffect effect={wornEffect()} burst={burst} />
      </div>

      <form onSubmit={submitTyped} style={{ width: dim, display: "flex", gap: 8 }}>
        <label htmlFor="typed" style={{ position: "absolute", left: -9999 }}>Type a word</label>
        <input id="typed" ref={typeRef} value={typed} onChange={e => setTyped(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 20))} placeholder="…or type a word"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="send" disabled={!playing}
          className="ws-display" style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 600, background: "rgb(var(--ws-fg) / .08)", color: "var(--ws-text)", border: "2px solid rgb(var(--ws-fg) / .2)", borderRadius: 12, padding: "8px 12px", textTransform: "uppercase", userSelect: "text", WebkitUserSelect: "text" }} />
        <button type="submit" disabled={!playing || !typed} className="ws-btn ws-display" style={{ fontSize: 20, fontWeight: 700, border: "none", borderRadius: 12, padding: "0 18px", cursor: "pointer", background: typed && playing ? T.amber : "rgb(var(--ws-fg) / .12)", color: typed && playing ? T.ink : "rgb(var(--ws-fg) / .4)" }}>Send</button>
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
