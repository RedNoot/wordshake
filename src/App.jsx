import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { T, CSS, applyTheme } from "./theme.js";
import { SOUNDS, SOUND_BY_ID } from "./sounds.js";
import { Chip } from "./components/Chip.jsx";
import { Toggle } from "./components/Toggle.jsx";
import { Hi } from "./components/Hi.jsx";
import { Board } from "./components/Board.jsx";
import { SoundCard } from "./components/SoundCard.jsx";
import { signInConfigured, initAuth, signIn, signOut, authFetch, getIdToken } from "./auth.js";
import { getSocket, call } from "./net.js";
import { ClassLists } from "./ClassLists.jsx";
import { Lobby } from "./Lobby.jsx";
import { Progress } from "./Progress.jsx";

const pts = L => (L <= 4 ? 1 : L === 5 ? 2 : L === 6 ? 3 : L === 7 ? 5 : 11);
// What joined devices are told about the big screen: in a round (countdown or playing), showing answers, or in the lobby.
const roomPhaseFor = phase => (phase === "countdown" || phase === "playing" ? "playing" : phase === "reveal" ? "reveal" : "lobby");
const ROOM_ERRORS = {
  "class-not-found": "That class list no longer exists. Pick another class.",
  offline: "Can't reach the WordShake server. Check your connection and try again.",
  "token-expired": "Your sign-in has expired. Sign out and sign in again.",
};

// The teacher's last look, remembered on this computer so the screen doesn't flash the other theme before sign-in.
const THEME_KEY = "wordshake-theme";
const savedTheme = () => { try { return localStorage.getItem(THEME_KEY) || "classic"; } catch { return "classic"; } };

/* ================= main app ================= */
export default function WordShakeWorkbook() {
  const [phase, setPhase] = useState(signInConfigured ? "loading" : "setup");
  const [settings, setSettings] = useState({ seconds: 180, size: 4, minLen: 3, sound: true, showCount: true, phSound: null, phTicked: [], phBonus: false, mode: signInConfigured ? "online" : "workbook", classId: null, theme: savedTheme() });
  const [dict, setDict] = useState({ status: "loading", count: 0 });
  const [phStats, setPhStats] = useState({ words: 0, tags: 0 });
  const [busy, setBusy] = useState(false);
  const [game, setGame] = useState(null);
  const [count, setCount] = useState(3);
  const [remaining, setRemaining] = useState(180);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(0);
  const [pathWord, setPathWord] = useState(0);
  const [accountsReady, setAccountsReady] = useState(false);
  const [account, setAccount] = useState(null);
  const [accountNote, setAccountNote] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [classes, setClasses] = useState(null);
  const [classPromptDismissed, setClassPromptDismissed] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomNote, setRoomNote] = useState("");
  const roomRef = useRef(null);
  roomRef.current = room;
  const [liveRound, setLiveRound] = useState(null);  // the room's round number while students play on devices; null for a workbook round
  const liveRef = useRef(null);
  liveRef.current = liveRound;
  const [rewardsTally, setRewardsTally] = useState(null);  // this round's class totals for the big screen (never who earned what)
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const endsAtRef = useRef(0);
  const pauseLeftRef = useRef(0);
  const audioRef = useRef(null);
  const lastTickRef = useRef(null);

  /* ---- dictionary / phonics status, from the server ---- */
  useEffect(() => {
    fetch("/api/status")
      .then(r => r.json())
      .then(({ dictStatus, dictCount, phonicsStats, accounts }) => {
        setDict({ status: dictStatus, count: dictCount });
        setPhStats(phonicsStats);
        setAccountsReady(accounts);
      })
      .catch(() => setDict({ status: "fallback", count: 0 }));
  }, []);

  /* ---- teacher sign-in: needed for online rooms, class lists and saved settings (workbook mode works signed out) ---- */
  const loadAccount = async user => {
    if (!user) return setPhase(p => (p === "loading" ? "home" : p));
    setAccountNote("");
    const res = await authFetch("/api/me").catch(() => null);
    if (!res) {
      await signOut();
      setPhase("home");
      return setAccountNote("Your sign-in has expired. Please sign in again.");
    }
    setAccount(user);
    const body = await res.json();
    if (res.ok) {
      if (body.settings) setSettings(v => ({ ...v, ...body.settings }));
      setIsNew(body.isNew);
    } else {
      setAccountNote("You're signed in, but your saved settings and classes aren't available right now.");
    }
    setPhase(p => (p === "loading" || p === "home" ? "setup" : p));
    authFetch("/api/classes").then(r => (r.ok ? r.json() : [])).then(setClasses).catch(() => setClasses([]));
    resumeRoom();
  };

  useEffect(() => {
    if (!signInConfigured) return;
    initAuth().then(loadAccount).catch(() => { setPhase("home"); setAccountNote("Google sign-in didn't finish. Please try again."); });
    // If Google can't be reached (e.g. blocked on the school network), don't leave the teacher on a loading screen.
    const t = setTimeout(() => setPhase(p => (p === "loading" ? "home" : p)), 8000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const signInHere = () => signIn().then(loadAccount).catch(e => {
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") setAccountNote("Google sign-in didn't finish. Please try again.");
  });
  const signOutHere = async () => {
    if (roomRef.current) await call("host:close");
    await signOut();
    setAccount(null); setAccountNote(""); setClasses(null); setRoom(null); setIsNew(false);
    setPhase("home");
  };

  /* ---- live room: the teacher's screen hosts it; students join on their own devices ---- */
  // After a refresh or a dropped connection, get the open room back (rooms live on the server for the lesson).
  const resumeRoom = async () => {
    const res = await call("host:resume", { idToken: await getIdToken() });
    if (res.ok) {
      setRoom(res.room);
      const r = res.round, fresh = ["setup", "loading", "home"].includes(phaseRef.current);
      if (r && res.room.phase !== "lobby" && (fresh || liveRef.current !== r.n)) {
        // A refresh mid-round: bring the board and the clock back from the server.
        const { seconds, size, minLen, phSound, phTicked, phBonus } = r.settings;
        setSettings(v => ({ ...v, seconds, size, minLen, phSound, phTicked, phBonus }));
        setGame(r.game);
        setLiveRound(r.n);
        setRemaining(r.remainingMs / 1000);
        if (r.state === "over" || res.room.phase === "reveal") { setStep(0); setPhase("reveal"); }
        else {
          const ms = r.state === "countdown" ? seconds * 1000 : r.remainingMs;
          endsAtRef.current = Date.now() + ms;
          pauseLeftRef.current = ms;
          lastTickRef.current = null;
          setPaused(r.state === "paused");
          if (r.state === "countdown") call("host:clock", { n: r.n, state: "playing", remainingMs: ms });
          setPhase("playing");
        }
      } else if (r && liveRef.current === r.n && phaseRef.current === "playing") {
        // Reconnected during our own round: the big screen's clock is the one that counts.
        call("host:clock", pausedRef.current
          ? { n: r.n, state: "paused" }
          : { n: r.n, state: "playing", remainingMs: Math.max(0, endsAtRef.current - Date.now()) });
      } else {
        setPhase(p => (p === "setup" || p === "loading" || p === "home" ? "lobby" : p));
      }
    } else if (roomRef.current) {
      setRoom(null);
      setRoomNote("The room closed while you were away. Open a new one when you're ready.");
      setPhase(p => (p === "lobby" ? "setup" : p));
    }
  };

  useEffect(() => {
    if (!account) return;
    const s = getSocket();
    const onUpdate = r => setRoom(r);
    const onReplaced = () => {
      setRoom(null);
      setRoomNote("Your room is now open in another tab or window, so this one has stopped.");
      setPhase(p => (p === "lobby" ? "setup" : p));
    };
    const onReconnect = () => { if (roomRef.current) resumeRoom(); };
    const onTally = t => { if (t.n === liveRef.current) setRewardsTally(t); };
    s.on("room:update", onUpdate);
    s.on("round:rewards-summary", onTally);
    s.on("host:replaced", onReplaced);
    s.io.on("reconnect", onReconnect);
    return () => { s.off("room:update", onUpdate); s.off("host:replaced", onReplaced); s.off("round:rewards-summary", onTally); s.io.off("reconnect", onReconnect); };
  }, [account]); // eslint-disable-line

  // The look follows the teacher's setting here, and on every device in the room.
  useEffect(() => {
    applyTheme(settings.theme);
    try { localStorage.setItem(THEME_KEY, settings.theme); } catch { /* private mode */ }
  }, [settings.theme]);
  useEffect(() => {
    if (room && room.theme && room.theme !== settings.theme) call("host:theme", { theme: settings.theme });
  }, [settings.theme, room]);

  // Tell joined devices whether a round is on.
  const sentPhaseRef = useRef(null);
  useEffect(() => {
    if (!room) { sentPhaseRef.current = null; return; }
    const p = roomPhaseFor(phase);
    if (p !== room.phase || sentPhaseRef.current !== p) {
      sentPhaseRef.current = p;
      call("host:phase", { phase: p });
    }
  }, [phase, room]);

  const saveSettingsNow = () => {
    if (account) {
      authFetch("/api/me/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) })
        .catch(() => { /* saving settings must never block a round */ });
    }
  };

  const openRoom = async () => {
    setBusy(true);
    setRoomNote("");
    saveSettingsNow();
    const classId = settings.classId && classes && classes.some(c => c.id === settings.classId) ? settings.classId : null;
    const res = await call("host:open", { idToken: await getIdToken().catch(() => ""), classId, theme: settings.theme });
    setBusy(false);
    if (!res.ok) return setRoomNote(ROOM_ERRORS[res.error] || "The room didn't open. Please try again.");
    setRoom(res.room);
    setPhase("lobby");
  };

  const closeRoom = async () => {
    if (!window.confirm("Close the room? Everyone who joined will be sent back to the join screen.")) return;
    await call("host:close");
    setRoom(null);
    setLiveRound(null);
    setPhase("setup");
  };

  const kick = playerId => call("host:kick", { playerId });
  const toSettings = () => setPhase(room ? "lobby" : "setup");

  const pickSound = id => setSettings(v => ({
    ...v, phSound: id,
    phTicked: id ? SOUND_BY_ID[id].sp.filter(s => s[2]).map(s => s[0]) : [],
  }));
  const toggleSpelling = g => setSettings(v => ({
    ...v, phTicked: v.phTicked.includes(g) ? v.phTicked.filter(x => x !== g) : [...v.phTicked, g],
  }));
  const soundDef = settings.phSound ? SOUND_BY_ID[settings.phSound] : null;
  const targetSet = useMemo(() => {
    if (!soundDef) return null;
    return new Set(settings.phTicked.filter(g => !g.includes("-")));
  }, [soundDef, settings.phTicked]);

  /* ---- audio ---- */
  const beep = useCallback((freq, dur = 0.09, vol = 0.22, type = "square") => {
    if (!settings.sound) return;
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }, [settings.sound]);
  const gong = useCallback(() => { beep(392, 0.9, 0.3, "triangle"); beep(196, 1.3, 0.3, "sine"); }, [beep]);

  /* ---- start round ---- */
  const start = async () => {
    setBusy(true);
    beep(660, 0.05, 0.001);
    saveSettingsNow();
    let g;
    if (room) {
      // Students play on their devices: the server builds the board and checks their words.
      const { seconds, size, minLen, phSound, phTicked, phBonus } = settings;
      const res = await call("host:start", { settings: { seconds, size, minLen, phSound, phTicked, phBonus } });
      if (!res.ok) {
        setBusy(false);
        setPhase("lobby");
        return setRoomNote(res.error === "offline" ? "We can't reach the game server. Check the wifi, then try again." : "The round didn't start. Please try again.");
      }
      g = res.game;
      setRewardsTally(null);
      setLiveRound(res.n);
      setRoomNote("");
    } else {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: settings.size, minLen: settings.minLen,
          phSound: settings.phSound, phTicked: settings.phTicked,
        }),
      });
      g = await res.json();
      setLiveRound(null);
    }
    setGame(g);
    setBusy(false);
    setStep(0); setPathWord(0); setPaused(false);
    setRemaining(settings.seconds);
    setCount(3);
    setPhase("countdown");
  };

  /* ---- countdown ---- */
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count > 0) beep(520 + (3 - count) * 90, 0.12);
    if (count === 0) {
      beep(880, 0.25, 0.25, "triangle");
      const t = setTimeout(() => {
        endsAtRef.current = Date.now() + settings.seconds * 1000;
        lastTickRef.current = null;
        if (liveRef.current) call("host:clock", { n: liveRef.current, state: "playing", remainingMs: settings.seconds * 1000 });
        setPhase("playing");
      }, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount(c => c - 1), 850);
    return () => clearTimeout(t);
  }, [phase, count]); // eslint-disable-line

  /* ---- game clock ---- */
  useEffect(() => {
    if (phase !== "playing" || paused) return;
    const id = setInterval(() => {
      const rem = (endsAtRef.current - Date.now()) / 1000;
      setRemaining(Math.max(0, rem));
      const whole = Math.ceil(rem);
      if (whole !== lastTickRef.current && whole <= 5 && whole >= 1) { lastTickRef.current = whole; beep(980, 0.08, 0.2); }
      if (rem <= 0) { clearInterval(id); gong(); setPhase("reveal"); setStep(0); }
    }, 150);
    return () => clearInterval(id);
  }, [phase, paused, beep, gong]);

  // Ending the round (time up, End now, back to the lobby) reaches devices through host:phase; pause and resume go here.
  const pause = () => {
    pauseLeftRef.current = endsAtRef.current - Date.now(); setPaused(true);
    if (liveRef.current) call("host:clock", { n: liveRef.current, state: "paused" });
  };
  const resume = () => {
    endsAtRef.current = Date.now() + pauseLeftRef.current; setPaused(false);
    if (liveRef.current) call("host:clock", { n: liveRef.current, state: "playing", remainingMs: pauseLeftRef.current });
  };
  const endNow = () => { gong(); setPhase("reveal"); setStep(0); };

  /* ---- reveal steps ---- */
  const steps = useMemo(() => {
    if (!game) return [];
    const S = game.solution;
    const arr = [{ t: "pens" }, { t: "stats" }];
    if (S.phonics) arr.push({ t: "phonics" });
    for (const L of S.lens) arr.push({ t: "group", L });
    arr.push({ t: "longest" }, { t: "score" });
    return arr;
  }, [game]);
  const next = useCallback(() => setStep(s => Math.min(s + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (phase !== "reveal") return;
    const h = e => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); next(); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, next, back]);

  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const S = game && game.solution;
  const PH = S && S.phonics;

  return (
    <div className="ws-root" style={{ minHeight: "100vh", background: `radial-gradient(1200px 700px at 50% -10%, var(--ws-glow) 0%, ${T.ink} 55%)`, color: "var(--ws-text)", display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      <header style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", justifyContent: "space-between", padding: "16px 26px 0" }}>
        <div className="ws-display" style={{ fontSize: 26, fontWeight: 700, letterSpacing: 0.5 }}>
          Word<span style={{ color: T.amber }}>Shake</span>
          {phase !== "home" && phase !== "loading" && (
            <span style={{ fontFamily: "'Atkinson Hyperlegible',sans-serif", fontWeight: 400, fontSize: 14, color: T.mist, marginLeft: 12 }}>
              {room ? `room ${room.code}${room.className ? ` · ${room.className}` : ""}` : settings.mode === "workbook" || !account ? "workbook round" : ""}
            </span>
          )}
        </div>
        {["countdown", "playing", "reveal"].includes(phase) && (
          <button className="ws-btn" onClick={toSettings} style={{ background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
            {room ? "✕ Back to lobby" : "✕ Quit to settings"}
          </button>
        )}
        {["setup", "classes", "progress"].includes(phase) && signInConfigured && accountsReady && (account ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontSize: 14, color: T.mist, flexWrap: "wrap" }}>
            {phase !== "classes" && <button className="ws-btn" onClick={() => setPhase("classes")} style={{ background: "none", border: `1px solid ${T.faint}`, color: "var(--ws-text)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>My classes</button>}
            {phase !== "progress" && <button className="ws-btn" onClick={() => setPhase("progress")} style={{ background: "none", border: `1px solid ${T.faint}`, color: "var(--ws-text)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>Progress</button>}
            <span>Signed in as <b style={{ color: "var(--ws-text)" }}>{account.displayName || account.email}</b></span>
            <button className="ws-btn" onClick={signOutHere} style={{ background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 14, padding: 0 }}>Sign out</button>
          </div>
        ) : (
          <button className="ws-btn" onClick={signInHere} style={{ background: "none", border: `1px solid ${T.faint}`, color: "var(--ws-text)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
            Teacher sign in
          </button>
        ))}
      </header>

      {phase === "loading" && <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.mist, fontSize: 18 }}>Loading…</main>}

      {/* ---------- HOME (signed out) ---------- */}
      {phase === "home" && (
        <main className="ws-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "30px 20px 40px" }}>
          <div style={{ textAlign: "center", maxWidth: 680 }}>
            <h1 className="ws-display" style={{ fontSize: "min(12vw, 64px)", fontWeight: 700, margin: 0 }}>Word<span style={{ color: T.amber }}>Shake</span></h1>
            <p style={{ color: T.mist, fontSize: 19, marginTop: 6 }}>Shake the dice, then race the clock to find words. A word game for the whole class.</p>
          </div>
          {accountNote && <div role="status" style={{ maxWidth: 680, background: "rgb(var(--ws-amber-rgb) / .1)", border: "1px solid rgb(var(--ws-amber-rgb) / .4)", borderRadius: 12, padding: "10px 14px", fontSize: 14.5, color: T.mist }}>{accountNote}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", width: "min(860px, 100%)" }}>
            <section style={{ flex: "1 1 340px", border: `1px solid rgb(var(--ws-amber-rgb) / .4)`, background: "rgb(var(--ws-amber-rgb) / .06)", borderRadius: 20, padding: "22px 24px", display: "grid", gap: 14, alignContent: "start" }}>
              <h2 className="ws-display" style={{ margin: 0, fontSize: 28 }}>Teachers</h2>
              <p style={{ margin: 0, color: T.mist, fontSize: 16, lineHeight: 1.5 }}>Sign in to run online games, keep class lists and have your settings remembered.</p>
              {signInConfigured ? (
                <button className="ws-btn ws-display" onClick={signInHere} style={{ fontSize: 21, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 14, padding: "14px 22px", cursor: "pointer", boxShadow: "0 5px 0 var(--ws-amber-edge)" }}>
                  Sign in with Google
                </button>
              ) : <div style={{ color: T.amber, fontSize: 15 }}>Sign-in is unavailable right now.</div>}
              <p style={{ margin: 0, color: "rgb(var(--ws-fg) / .5)", fontSize: 13.5, lineHeight: 1.5 }}>New here? Signing in for the first time creates your free account. Any Google account works, school or personal.</p>
              <button className="ws-btn" onClick={() => { setSettings(v => ({ ...v, mode: "workbook" })); setPhase("setup"); }} style={{ background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 15, padding: 0, justifySelf: "start" }}>
                Or play a workbook round without signing in →
              </button>
            </section>
            <section style={{ flex: "1 1 340px", border: `1px solid ${T.faint}`, background: "rgb(var(--ws-fg) / .04)", borderRadius: 20, padding: "22px 24px", display: "grid", gap: 14, alignContent: "start" }}>
              <h2 className="ws-display" style={{ margin: 0, fontSize: 28 }}>Students</h2>
              <p style={{ margin: 0, color: T.mist, fontSize: 16, lineHeight: 1.5 }}>Got a code from the big screen? Join your class's game here.</p>
              <a href="/join" className="ws-btn ws-display" style={{ fontSize: 21, fontWeight: 700, background: T.green, color: T.ink, borderRadius: 14, padding: "14px 22px", textAlign: "center", textDecoration: "none" }}>Join a game</a>
            </section>
          </div>
        </main>
      )}

      {/* ---------- CLASS LISTS ---------- */}
      {phase === "classes" && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 20px 40px" }}>
          <ClassLists classes={classes} setClasses={setClasses} onDone={() => setPhase("setup")} />
        </main>
      )}

      {phase === "progress" && <Progress classes={classes} onDone={() => setPhase("setup")} />}

      {/* ---------- LOBBY ---------- */}
      {phase === "lobby" && room && (
        <Lobby room={room} busy={busy} onStart={start} onSettings={() => setPhase("setup")} onClose={closeRoom} onKick={kick} startLabel="Start the round →" note={roomNote} />
      )}

      {/* today's-sound banner on every game screen */}
      {phase === "reveal" && soundDef && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div className="ws-display" style={{ display: "flex", alignItems: "center", gap: 10, background: "rgb(var(--ws-amber-rgb) / .12)", border: `1px solid rgb(var(--ws-amber-rgb) / .4)`, borderRadius: 999, padding: "6px 18px", fontSize: 17 }}>
            <span style={{ color: T.amber, fontWeight: 700 }}>Today's sound {soundDef.lab}</span>
            <span style={{ color: T.mist, fontWeight: 400 }}>{settings.phTicked.join(" · ")}</span>
            {settings.phBonus && <span style={{ color: T.green, fontWeight: 600 }}>+2 pts</span>}
          </div>
        </div>
      )}

      {/* ---------- SETUP ---------- */}
      {phase === "setup" && (
        <main className="ws-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, padding: "18px 24px 40px", overflowY: "auto" }}>
          {accountNote && (
            <div role="status" style={{ maxWidth: 680, background: "rgb(var(--ws-amber-rgb) / .1)", border: "1px solid rgb(var(--ws-amber-rgb) / .4)", borderRadius: 12, padding: "10px 14px", fontSize: 14.5, color: T.mist }}>
              {accountNote}
            </div>
          )}
          {account && classes && classes.length === 0 && !classPromptDismissed && (
            <div role="status" style={{ width: "min(760px, 94vw)", boxSizing: "border-box", background: "rgb(var(--ws-green-rgb) / .1)", border: "1px solid rgb(var(--ws-green-rgb) / .45)", borderRadius: 14, padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240, fontSize: 15.5, lineHeight: 1.45 }}>
                {isNew && <b style={{ display: "block", fontSize: 17, marginBottom: 2 }}>Welcome to WordShake, {(account.displayName || "").split(" ")[0] || "teacher"}! Your account is ready.</b>}
                Add your class list so students can join a game by tapping their name.
              </div>
              <button className="ws-btn ws-display" onClick={() => setPhase("classes")} style={{ background: T.green, color: T.ink, border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>Add a class list</button>
              <button className="ws-btn" onClick={() => setClassPromptDismissed(true)} style={{ background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 14 }}>Later</button>
            </div>
          )}
          {roomNote && (
            <div role="alert" style={{ maxWidth: 680, background: "rgb(var(--ws-red-rgb) / .1)", border: "1px solid rgb(var(--ws-red-rgb) / .45)", borderRadius: 12, padding: "10px 14px", fontSize: 14.5 }}>{roomNote}</div>
          )}
          {room && (
            <div style={{ width: "min(760px, 94vw)", boxSizing: "border-box", background: "rgb(var(--ws-amber-rgb) / .08)", border: "1px solid rgb(var(--ws-amber-rgb) / .4)", borderRadius: 14, padding: "12px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 15.5 }}>
              <span style={{ flex: 1 }}>Room <b className="ws-display" style={{ color: T.amber, letterSpacing: 2 }}>{room.code}</b> is open with {room.players.length} player{room.players.length === 1 ? "" : "s"}. New settings apply from the next round.</span>
              <button className="ws-btn" onClick={() => setPhase("lobby")} style={{ background: T.amber, color: T.ink, border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>Back to the lobby</button>
            </div>
          )}
          <div style={{ textAlign: "center", maxWidth: 680 }}>
            <h1 className="ws-display" style={{ fontSize: 42, fontWeight: 700, margin: 0 }}>Ready to shake the dice?</h1>
            <p style={{ color: T.mist, fontSize: 17, marginTop: 8 }}>
              Project this screen. Students write every word they can find in their books —
              letters must connect, and no tile can be used twice in one word.
            </p>
          </div>

          <div style={{ display: "grid", gap: 20, width: "min(760px, 94vw)" }}>
            <div>
              <div style={{ color: T.mist, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>How students play</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip active={settings.mode === "online"} onClick={() => setSettings(v => ({ ...v, mode: "online" }))}>Online: students join on devices</Chip>
                <Chip active={settings.mode === "workbook"} onClick={() => setSettings(v => ({ ...v, mode: "workbook" }))}>Workbook: paper only</Chip>
              </div>
              {settings.mode === "online" && !account && (
                <div style={{ marginTop: 10, fontSize: 14.5, color: T.mist }}>
                  Online games need a teacher account.{" "}
                  {accountsReady && <button className="ws-btn" onClick={signInHere} style={{ background: "none", border: "none", color: T.amber, textDecoration: "underline", cursor: "pointer", fontSize: 14.5, padding: 0 }}>Sign in with Google</button>}
                </div>
              )}
            </div>

            {settings.mode === "online" && account && (
              <div>
                <div style={{ color: T.mist, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>Class</div>
                {room ? (
                  <div style={{ fontSize: 15, color: T.mist }}>{room.className || "Guests only"} — close the room in the lobby to switch class.</div>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {(classes || []).map(c => (
                      <Chip key={c.id} active={settings.classId === c.id} onClick={() => setSettings(v => ({ ...v, classId: c.id }))}>{c.name}</Chip>
                    ))}
                    <Chip active={!classes || !classes.some(c => c.id === settings.classId)} onClick={() => setSettings(v => ({ ...v, classId: null }))}>Guests only</Chip>
                    <button className="ws-btn" onClick={() => setPhase("classes")} style={{ background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 14 }}>
                      {classes && classes.length ? "Manage classes" : "Add a class list"}
                    </button>
                  </div>
                )}
                {!room && <div style={{ marginTop: 8, fontSize: 13, color: "rgb(var(--ws-fg) / .45)" }}>Students tap their name from the class list. Anyone not on it can join as a guest.</div>}
              </div>
            )}
            <div>
              <div style={{ color: T.mist, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>Round time</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[60, 120, 180, 240, 300].map(s => (
                  <Chip key={s} active={settings.seconds === s} onClick={() => setSettings(v => ({ ...v, seconds: s }))}>{s / 60} min</Chip>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: T.mist, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>Board size</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[[4, "4 × 4 Classic"], [5, "5 × 5 Big"], [6, "6 × 6 Super"]].map(([n, label]) => (
                  <Chip key={n} active={settings.size === n} onClick={() => setSettings(v => ({ ...v, size: n }))}>{label}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: T.mist, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>Shortest word allowed</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[2, 3, 4].map(n => (
                  <Chip key={n} active={settings.minLen === n} onClick={() => setSettings(v => ({ ...v, minLen: n }))}>{n} letters</Chip>
                ))}
              </div>
            </div>

            {/* ---- Sounds-Write target sound ---- */}
            <div style={{ border: `1px solid ${T.faint}`, borderRadius: 16, padding: "16px 18px", background: "rgb(var(--ws-fg) / .03)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <div style={{ color: T.mist, fontSize: 13, textTransform: "uppercase", letterSpacing: 1.2 }}>Today's sound</div>
                <div style={{ color: "rgb(var(--ws-fg) / .35)", fontSize: 12 }}>Sounds-Write</div>
              </div>
              <div style={{ marginBottom: 12, borderRadius: 12, padding: "10px 14px", fontSize: 14.5, lineHeight: 1.45, color: T.mist, background: soundDef ? "rgb(var(--ws-amber-rgb) / .08)" : "rgb(var(--ws-fg) / .04)", border: `1px solid ${soundDef ? "rgb(var(--ws-amber-rgb) / .4)" : T.faint}` }}>
                {soundDef ? (
                  <><b style={{ color: T.amber }}>Sounds-Write words only.</b> The board, the answers and the scoring use just the Sounds-Write high-frequency word list{phStats.words ? ` (${phStats.words.toLocaleString()} words)` : ""}. Other dictionary words don't count this round.</>
                ) : (
                  <><b style={{ color: "var(--ws-text)" }}>Full dictionary.</b> Every word in the classroom-safe dictionary counts{dict.status === "full" ? ` (${dict.count.toLocaleString()} words)` : ""}. Pick a sound below to play with Sounds-Write high-frequency words only.</>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: soundDef ? 6 : 0 }}>
                <Chip active={!settings.phSound} onClick={() => pickSound(null)}>Off</Chip>
              </div>
              {[["icv", "Initial Code — vowels"], ["ecv", "Extended Code — vowels"], ["con", "Consonant sounds"]].map(([grp, label]) => (
                <div key={grp} style={{ marginTop: 10 }}>
                  <div style={{ color: "rgb(var(--ws-fg) / .4)", fontSize: 12, marginBottom: 6 }}>{label}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {SOUNDS.filter(s => s.grp === grp).map(s => (
                      <button key={s.id} title={s.eg} onClick={() => pickSound(s.id)} className="ws-btn ws-display"
                        style={{ padding: "6px 12px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `2px solid ${settings.phSound === s.id ? T.amber : "rgb(var(--ws-fg) / 0.14)"}`, background: settings.phSound === s.id ? T.amber : "transparent", color: settings.phSound === s.id ? T.ink : T.mist }}>
                        {s.lab}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {soundDef && (
                <div className="ws-fade" style={{ marginTop: 14, borderTop: `1px solid ${T.faint}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 15, color: T.mist, marginBottom: 8 }}>
                    Sound <b className="ws-display" style={{ color: T.amber }}>{soundDef.lab}</b> as in <i>{soundDef.eg}</i> — tick today's spellings:
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {soundDef.sp.map(([g, eg]) => {
                      const on = settings.phTicked.includes(g);
                      return (
                        <button key={g} onClick={() => toggleSpelling(g)} className="ws-btn"
                          style={{ cursor: "pointer", borderRadius: 12, padding: "7px 12px", textAlign: "center", border: `2px solid ${on ? T.amber : "rgb(var(--ws-fg) / 0.14)"}`, background: on ? "rgb(var(--ws-amber-rgb) / .15)" : "transparent", color: on ? "var(--ws-amber-soft)" : T.mist }}>
                          <span className="ws-display" style={{ fontWeight: 700, fontSize: 17 }}>{g}</span>
                          <span style={{ display: "block", fontSize: 11, opacity: 0.8 }}>{eg}</span>
                        </button>
                      );
                    })}
                  </div>
                  {settings.size === 4 && settings.phTicked.length > 4 && (
                    <div style={{ marginTop: 10, fontSize: 12.5, color: T.amber }}>
                      Heads up: guaranteeing {settings.phTicked.length} spellings on a 4 × 4 board gets tight — a bigger board (or fewer ticks) covers every spelling more reliably.
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                    <Toggle on={settings.phBonus} onClick={() => setSettings(v => ({ ...v, phBonus: !v.phBonus }))} label="+2 bonus points for target-sound words" />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12.5, color: "rgb(var(--ws-fg) / .45)" }}>
                    Every word on the board comes from the Sounds-Write list, so every answer with {soundDef.lab} in a ticked spelling is highlighted{settings.phBonus ? " and earns the +2 bonus" : ""}.
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <Toggle on={settings.sound} onClick={() => setSettings(v => ({ ...v, sound: !v.sound }))} label="Sound effects" />
              <Toggle on={settings.showCount} onClick={() => setSettings(v => ({ ...v, showCount: !v.showCount }))} label="Show how many words are hiding" />
              <Toggle on={settings.theme === "rednut"} onClick={() => setSettings(v => ({ ...v, theme: v.theme === "rednut" ? "classic" : "rednut" }))} label="RedNut look (students' devices too)" />
            </div>
          </div>

          {(() => {
            const online = settings.mode === "online";
            if (online && !account) return null;
            const [label, action, busyLabel] = !online ? ["Shake the dice →", start, "Shaking the dice…"]
              : room ? ["Back to the lobby →", () => { saveSettingsNow(); setPhase("lobby"); }, ""]
              : ["Open the room →", openRoom, "Opening the room…"];
            return (
              <button className="ws-btn ws-display" onClick={action} disabled={busy}
                style={{ fontSize: 28, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 16, padding: "18px 46px", cursor: "pointer", boxShadow: "0 6px 0 var(--ws-amber-edge)", opacity: busy ? 0.7 : 1 }}>
                {busy ? busyLabel : label}
              </button>
            );
          })()}

          <div style={{ fontSize: 13, color: T.mist, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dict.status === "loading" ? T.mist : soundDef || dict.status === "full" ? T.green : T.amber }} />
            {dict.status === "loading" && "Loading the word lists…"}
            {dict.status !== "loading" && soundDef && `Sounds-Write words only — ${phStats.words.toLocaleString()} words`}
            {!soundDef && dict.status === "full" && `Full dictionary ready — ${dict.count.toLocaleString()} words (classroom-filtered)`}
            {!soundDef && dict.status === "fallback" && `Offline — using the built-in starter list (${dict.count.toLocaleString()} common words)`}
          </div>
        </main>
      )}

      {/* ---------- COUNTDOWN + PLAYING ---------- */}
      {(phase === "countdown" || phase === "playing") && game && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "8px 20px 20px", position: "relative" }}>
          <div style={{ textAlign: "center" }}>
            <div className="ws-display" aria-live="polite" style={{
              fontSize: "min(11vw, 92px)", fontWeight: 700, lineHeight: 1,
              color: phase === "playing" && remaining <= 10 ? T.red : phase === "playing" && remaining <= 30 ? T.amber : "var(--ws-text)",
              animation: phase === "playing" && remaining <= 10 && !paused ? "ws-pulse 1s infinite" : "none",
            }}>
              {phase === "countdown" ? mmss(settings.seconds) : mmss(remaining)}
            </div>
            <div style={{ height: 6, width: "min(420px,70vw)", background: "rgb(var(--ws-fg) / .12)", borderRadius: 999, margin: "10px auto 0", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${phase === "countdown" ? 100 : (remaining / settings.seconds) * 100}%`, background: remaining <= 10 && phase === "playing" ? T.red : T.amber, borderRadius: 999, transition: "width .15s linear" }} />
            </div>
            {settings.showCount && S && (
              <div style={{ color: T.mist, marginTop: 8, fontSize: 16 }}>
                <b style={{ color: "var(--ws-text)" }}>{S.total}</b> {soundDef ? "Sounds-Write words" : "words"} are hiding in this grid
                {PH && <> · <b style={{ color: T.amber }}>{PH.count}</b> with today's sound</>}
                {" "}· shortest counts: {settings.minLen} letters
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            {soundDef && <div style={{ position: "relative", zIndex: 5, marginBottom: 14 }}><SoundCard soundDef={soundDef} ticked={settings.phTicked} bonus={settings.phBonus} /></div>}
            <div style={{ position: "relative" }}>
            <Board tiles={game.tiles} rots={game.rots} size={settings.size} dim={soundDef ? "min(90vw, 47vh)" : "min(90vw, 54vh)"} hidden={phase === "countdown"} tumble={phase === "playing"} targetSet={targetSet} />
            {phase === "countdown" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div key={count} className="ws-display" style={{ fontSize: "min(34vw,200px)", fontWeight: 700, color: count === 0 ? T.amber : "var(--ws-text)", animation: "ws-pop .5s ease both", textShadow: "0 6px 30px rgba(0,0,0,.6)" }}>
                  {count === 0 ? "GO!" : count}
                </div>
              </div>
            )}
            {paused && (
              <div style={{ position: "absolute", inset: 0, background: "rgb(var(--ws-ink-rgb) / .88)", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <div className="ws-display" style={{ fontSize: 54, fontWeight: 700 }}>Paused</div>
                <button className="ws-btn ws-display" onClick={resume} style={{ fontSize: 22, fontWeight: 600, background: T.amber, color: T.ink, border: "none", borderRadius: 12, padding: "12px 30px", cursor: "pointer" }}>Resume</button>
              </div>
            )}
            </div>
          </div>

          {phase === "playing" && (
            <div style={{ display: "flex", gap: 12 }}>
              <button className="ws-btn" onClick={() => setSettings(v => ({ ...v, sound: !v.sound }))} style={{ background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>{settings.sound ? "🔊 Sound on" : "🔇 Muted"}</button>
              {!paused && <button className="ws-btn" onClick={pause} style={{ background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>❚❚ Pause</button>}
              <button className="ws-btn" onClick={endNow} style={{ background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>End round now</button>
            </div>
          )}
        </main>
      )}

      {/* ---------- REVEAL ---------- */}
      {phase === "reveal" && game && S && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 16px", overflow: "hidden" }}>
          <div key={step} className="ws-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, overflow: "hidden", minHeight: 0 }}>

            {steps[step].t === "pens" && (
              <div style={{ textAlign: "center" }}>
                <div className="ws-display" style={{ fontSize: "min(14vw,110px)", fontWeight: 700, color: T.red }}>{liveRound ? "Time's up!" : "Pens down!"}</div>
                <p style={{ color: T.mist, fontSize: 20, marginTop: 12 }}>{liveRound ? "Devices down — let's see how this board scored." : "Time's up. Swap books with a partner — let's see how this board scored."}</p>
              </div>
            )}

            {steps[step].t === "stats" && (
              <div style={{ textAlign: "center", width: "min(720px,94vw)" }}>
                <div className="ws-display" style={{ fontSize: 30, color: T.mist }}>{soundDef ? "Sounds-Write words hiding in this grid…" : "Hiding in this grid…"}</div>
                <div className="ws-display" style={{ fontSize: "min(16vw,110px)", fontWeight: 700, color: T.amber, lineHeight: 1.05 }}>{S.total} words</div>
                {PH && <div className="ws-display" style={{ fontSize: 22, color: T.mist }}>including <b style={{ color: T.amber }}>{PH.count}</b> with today's sound {soundDef && soundDef.lab}</div>}
                <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
                  {S.lens.map(L => (
                    <div key={L} style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right", color: T.mist, fontSize: 17 }}>{L} letters</div>
                      <div style={{ height: 22, background: "rgb(var(--ws-fg) / .08)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(S.byLen[L].length / Math.max(...S.lens.map(x => S.byLen[x].length))) * 100}%`, background: L === S.maxLen ? T.amber : "var(--ws-bar)", borderRadius: 999 }} />
                      </div>
                      <div className="ws-display" style={{ fontWeight: 700, fontSize: 19, textAlign: "left" }}>{S.byLen[L].length}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {steps[step].t === "phonics" && soundDef && (
              <div style={{ width: "min(1050px,96vw)", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, justifyContent: "center", minHeight: 0 }}>
                <div className="ws-display" style={{ fontSize: 38, fontWeight: 700 }}>
                  <span style={{ color: T.amber }}>{soundDef.lab}</span> words on this board
                </div>
                <p style={{ color: T.mist, margin: 0, fontSize: 17 }}>One sound — different spellings. {liveRound ? `Did you find any? Look at each spelling of ${soundDef.lab}.` : `Sort the words in your book by their spelling of ${soundDef.lab}.`}</p>
                {PH.count === 0 && <p style={{ color: T.mist, fontSize: 18 }}>None this time — the dice were stubborn. Shake again!</p>}
                <div style={{ overflowY: "auto", width: "100%", minHeight: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, alignItems: "start", alignContent: "start", padding: "4px 2px" }}>
                  {settings.phTicked.map(g => {
                    const items = PH.bySpelling[g] || [];
                    return (
                      <div key={g} style={{ border: `1px solid ${items.length ? "rgb(var(--ws-amber-rgb) / .4)" : T.faint}`, borderRadius: 14, padding: "10px 12px", background: items.length ? "rgb(var(--ws-amber-rgb) / .06)" : "transparent", opacity: items.length ? 1 : 0.45 }}>
                        <div className="ws-display" style={{ fontSize: 22, fontWeight: 700, color: T.amber, marginBottom: 6 }}>
                          {g}<span style={{ color: T.mist, fontWeight: 400, fontSize: 13, marginLeft: 8 }}>{(soundDef.sp.find(s => s[0] === g) || [])[1]}</span>
                        </div>
                        {items.length === 0 && <div style={{ color: T.mist, fontSize: 13 }}>none on this board</div>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {items.map(it => <Hi key={it.word} word={it.word} ranges={it.ranges} fontSize={19} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {steps[step].t === "group" && (() => {
              const L = steps[step].L, group = S.byLen[L];
              return (
                <div style={{ width: "min(1000px,96vw)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, height: "100%", justifyContent: "center", minHeight: 0 }}>
                  <div className="ws-display" style={{ fontSize: 34, fontWeight: 700 }}>
                    {L}-letter words <span style={{ color: T.amber }}>· {pts(L)} pt{pts(L) > 1 ? "s" : ""} each</span>
                    <span style={{ color: T.mist, fontWeight: 400, fontSize: 22 }}> · {group.length} found by the board</span>
                  </div>
                  <p style={{ color: T.mist, margin: 0 }}>
                    {liveRound ? "How many of these did you find?" : "Tick the ones in your book — cross out anything that isn't here."}
                    {PH && <> Words with <span style={{ color: T.amber }}>today's sound</span> are underlined{settings.phBonus ? " (+2 bonus)" : ""}.</>}
                  </p>
                  <div style={{ overflowY: "auto", width: "100%", minHeight: 0, padding: "6px 4px", display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(8, L + 3)}ch, 1fr))`, gap: "10px 14px", alignContent: "start" }}>
                    {group.map(w => {
                      const ranges = PH && PH.tagMap[w];
                      return (
                        <div key={w} style={{ background: ranges ? "rgb(var(--ws-amber-rgb) / .08)" : "rgb(var(--ws-fg) / .06)", border: `1px solid ${ranges ? "rgb(var(--ws-amber-rgb) / .45)" : T.faint}`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                          {ranges ? <Hi word={w} ranges={ranges} fontSize={20} /> : <span className="ws-display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>{w.toUpperCase()}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {steps[step].t === "longest" && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "min(5vw,60px)" }}>
                <Board tiles={game.tiles} rots={game.rots} size={settings.size} dim="min(58vw, 44vh)" path={S.longest[pathWord] && S.longest[pathWord].path} pathKey={pathWord} targetSet={targetSet} />
                <div style={{ maxWidth: 420 }}>
                  <div style={{ color: T.mist, fontSize: 18, textTransform: "uppercase", letterSpacing: 2 }}>The one that got away</div>
                  <div className="ws-display" style={{ fontSize: "min(11vw,72px)", fontWeight: 700, color: T.amber, lineHeight: 1.1, wordBreak: "break-word" }}>
                    {S.longest[pathWord] ? S.longest[pathWord].word.toUpperCase() : "—"}
                  </div>
                  <div style={{ color: T.mist, marginTop: 6, fontSize: 18 }}>{S.maxLen} letters · worth {pts(S.maxLen)} points</div>
                  {S.longest.length > 1 && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ color: T.mist, fontSize: 14, marginBottom: 8 }}>Also {S.maxLen} letters — tap to trace:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {S.longest.map((x, i) => (
                          <button key={x.word} className="ws-btn ws-display" onClick={() => setPathWord(i)}
                            style={{ cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontWeight: 600, fontSize: 16, border: `2px solid ${i === pathWord ? T.amber : "rgb(var(--ws-fg) / .18)"}`, background: i === pathWord ? T.amber : "transparent", color: i === pathWord ? T.ink : T.mist }}>
                            {x.word.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {steps[step].t === "score" && (
              <div style={{ textAlign: "center", width: "min(560px,94vw)" }}>
                <div className="ws-display" style={{ fontSize: 40, fontWeight: 700 }}>{liveRound ? "How did you score?" : "Add up your score"}</div>
                <p style={{ color: T.mist, fontSize: 17, marginTop: 6 }}>{liveRound ? "Your device has added up your points. Here's how words score:" : "Only ticked words count. Teacher's call on anything unusual!"}</p>
                <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
                  {[[`${settings.minLen}–4 letters`, 1], ["5 letters", 2], ["6 letters", 3], ["7 letters", 5], ["8+ letters", 11]]
                    .filter(([label]) => !(settings.minLen > 4 && label.includes("–4")))
                    .map(([label, p]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", background: "rgb(var(--ws-fg) / .06)", border: `1px solid ${T.faint}`, borderRadius: 12, padding: "12px 20px", fontSize: 20 }}>
                        <span>{label}</span><b className="ws-display" style={{ color: T.amber }}>{p} pt{p > 1 ? "s" : ""} each</b>
                      </div>
                    ))}
                  {PH && settings.phBonus && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "rgb(var(--ws-amber-rgb) / .1)", border: `1px solid rgb(var(--ws-amber-rgb) / .45)`, borderRadius: 12, padding: "12px 20px", fontSize: 20 }}>
                      <span>Words with today's sound {soundDef && soundDef.lab}</span><b className="ws-display" style={{ color: T.green }}>+2 bonus each</b>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 30 }}>
                  <button className="ws-btn ws-display" onClick={start} style={{ fontSize: 22, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 14, padding: "14px 30px", cursor: "pointer", boxShadow: "0 5px 0 var(--ws-amber-edge)" }}>Play again ↻</button>
                  {room && <button className="ws-btn ws-display" onClick={() => setPhase("lobby")} style={{ fontSize: 22, fontWeight: 600, background: "none", color: T.mist, border: `2px solid ${T.faint}`, borderRadius: 14, padding: "14px 30px", cursor: "pointer" }}>Back to the lobby</button>}
                  <button className="ws-btn ws-display" onClick={() => setPhase("setup")} style={{ fontSize: 22, fontWeight: 600, background: "none", color: T.mist, border: `2px solid ${T.faint}`, borderRadius: 14, padding: "14px 30px", cursor: "pointer" }}>Change settings</button>
                </div>
              </div>
            )}
          </div>

          {liveRound && rewardsTally && rewardsTally.n === liveRound && (rewardsTally.trophies + rewardsTally.stickers + rewardsTally.bests > 0) && (
            <div role="status" className="ws-display" style={{ alignSelf: "center", marginTop: 8, background: "rgb(var(--ws-amber-rgb) / .12)", border: "1px solid rgb(var(--ws-amber-rgb) / .45)", borderRadius: 999, padding: "8px 22px", fontSize: 19, fontWeight: 600, animation: "ws-pop .5s ease both" }}>
              🎉 This round: {[
                rewardsTally.trophies && `${rewardsTally.trophies} new ${rewardsTally.trophies === 1 ? "trophy" : "trophies"}`,
                rewardsTally.stickers && `${rewardsTally.stickers} new ${rewardsTally.stickers === 1 ? "sticker" : "stickers"}`,
                rewardsTally.bests && `${rewardsTally.bests} personal ${rewardsTally.bests === 1 ? "best" : "bests"}`,
              ].filter(Boolean).join(" · ")}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, paddingTop: 10 }}>
            <button className="ws-btn" onClick={back} disabled={step === 0} style={{ background: "none", border: `1px solid ${T.faint}`, color: step === 0 ? "rgb(var(--ws-fg) / .25)" : T.mist, borderRadius: 10, padding: "10px 18px", cursor: step === 0 ? "default" : "pointer", fontSize: 16 }}>← Back</button>
            <div style={{ display: "flex", gap: 6 }}>
              {steps.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === step ? T.amber : "rgb(var(--ws-fg) / .2)" }} />)}
            </div>
            <button className="ws-btn ws-display" onClick={next} disabled={step === steps.length - 1}
              style={{ background: step === steps.length - 1 ? "rgb(var(--ws-fg) / .1)" : T.amber, color: step === steps.length - 1 ? "rgb(var(--ws-fg) / .35)" : T.ink, border: "none", borderRadius: 10, padding: "10px 22px", cursor: step === steps.length - 1 ? "default" : "pointer", fontSize: 17, fontWeight: 700 }}>
              Next →
            </button>
            <span style={{ color: "rgb(var(--ws-fg) / .35)", fontSize: 12 }}>arrow keys / clicker work too</span>
          </div>
        </main>
      )}
    </div>
  );
}
