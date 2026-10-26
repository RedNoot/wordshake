import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { T, CSS, applyTheme } from "./theme.js";
import { SOUNDS, SOUND_BY_ID } from "./sounds.js";
import { Chip } from "./components/Chip.jsx";
import { GameSettings, settingsSummary, loadOpen, saveOpen } from "./GameSettings.jsx";
import { Hi } from "./components/Hi.jsx";
import { Board } from "./components/Board.jsx";
import { WordOfGame } from "./components/WordOfGame.jsx";
import { WordWall, bestLine } from "./components/WordWall.jsx";
import { SoundCard } from "./components/SoundCard.jsx";
import { signInConfigured, initAuth, signIn, signOut, authFetch, getIdToken } from "./auth.js";
import { getSocket, call } from "./net.js";
import { ClassLists } from "./ClassLists.jsx";
import { Lobby } from "./Lobby.jsx";
import { TeamResults, winnerLine } from "./Teams.jsx";
import { Progress } from "./Progress.jsx";
import { Guide, guideDone, markGuideDone } from "./Guide.jsx";
import { Opener, Celebrate, Highlights } from "./RoundEnd.jsx";

import { wordPoints, BONUS } from "../shared/scoring.js";
// What joined devices are told about the big screen: in a round (countdown or playing), showing answers, or in the lobby.
const roomPhaseFor = phase => (phase === "countdown" || phase === "playing" ? "playing" : phase === "reveal" ? "reveal" : "lobby");
const ROOM_ERRORS = {
  "class-not-found": "That class list no longer exists. Pick another class.",
  offline: "Can't reach the WordShake server. Check your connection and try again.",
  "token-expired": "Your sign-in has expired. Sign out and sign in again.",
};

/* ================= main app ================= */
const studentDevice = () => { try { return !!localStorage.getItem("wordshake-student"); } catch { return false; } };

// The splash's dice: dropped in one by one, then a little wobble now and then.
const SPLASH_CSS = `
.ws-splash-die { width: min(15vw, 66px); height: min(15vw, 66px); display: grid; place-items: center; border-radius: 14px;
  font-size: min(9vw, 40px); font-weight: 700; box-shadow: 0 5px 0 rgb(0 0 0 / .3); transform: rotate(var(--tilt));
  animation: ws-splash-drop .5s cubic-bezier(.3,1.5,.6,1) both, ws-splash-wobble 6s 1.2s ease-in-out infinite; }
@keyframes ws-splash-drop { from { opacity: 0; transform: translateY(-40px) rotate(-20deg); } to { opacity: 1; transform: rotate(var(--tilt)); } }
@keyframes ws-splash-wobble { 0%, 90%, 100% { transform: rotate(var(--tilt)); } 93% { transform: rotate(calc(var(--tilt) + 9deg)); } 96% { transform: rotate(calc(var(--tilt) - 7deg)); } }
@media (prefers-reduced-motion: reduce) { .ws-splash-die { animation: none; } }
`;

export default function WordShakeWorkbook() {
  const [phase, setPhase] = useState(signInConfigured ? "loading" : "setup");
  const [settings, setSettings] = useState({ seconds: 180, size: 4, minLen: 3, sound: true, showCount: true, phSound: null, phTicked: [], phBonus: false, hints: true, hintSeconds: 15, wordOfGame: false, mode: signInConfigured ? "online" : "workbook", classId: null, ownLooks: true });
  const [dict, setDict] = useState({ status: "loading", count: 0 });
  const [phStats, setPhStats] = useState({ words: 0, tags: 0 });
  const [busy, setBusy] = useState(false);
  // The settings drawer and which of its sections are open: remembered on this computer (see GameSettings.jsx).
  const [drawer, setDrawerNow] = useState(() => { try { return localStorage.getItem("ws-settings-drawer") !== "0"; } catch { return true; } });
  const setDrawer = on => { setDrawerNow(on); try { localStorage.setItem("ws-settings-drawer", on ? "1" : "0"); } catch { /* private mode */ } };
  const [openSecs, setOpenSecsNow] = useState(loadOpen);
  const setOpenSecs = f => setOpenSecsNow(o => { const next = f(o); saveOpen(next); return next; });
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
  const [guide, setGuide] = useState(null);  // the getting-started steps: null = show them to a teacher who hasn't set up yet
  const showGuide = guide ?? (!!account && !!classes && (isNew || classes.length === 0) && !guideDone());
  const hideGuide = () => { markGuideDone(); setGuide(false); };
  const [room, setRoom] = useState(null);
  const [roomNote, setRoomNote] = useState("");
  const roomRef = useRef(null);
  roomRef.current = room;
  const [liveRound, setLiveRound] = useState(null);  // the room's round number while students play on devices; null for a workbook round
  const liveRef = useRef(null);
  liveRef.current = liveRound;
  const [rewardsTally, setRewardsTally] = useState(null);  // this round's class totals for the big screen (never who earned what)
  const [roundTeams, setRoundTeams] = useState(0);         // how many teams played this round (0: no teams)
  const [teamResult, setTeamResult] = useState(null);      // the team scores, once the server has added them up
  const [wall, setWall] = useState(null);                  // Class together: { words, counts, of } found by the class so far (null: not this round)
  const [coopResult, setCoopResult] = useState(null);      // Class together: the class's total once the round is over
  const [classFound, setClassFound] = useState(null);      // { n, words }: every different word the class found, once the round is over
  const [saveStatus, setSaveStatus] = useState(null);  // { n, ok, retrying }: whether this round reached the class's progress
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
    if (!user) {
      // A device a student has signed in on goes straight to their own home screen (Join.jsx keeps the pass).
      if (studentDevice()) return window.location.replace("/join");
      return setPhase(p => (p === "loading" ? "home" : p));
    }
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
      // Settings saved before the shop may still hold a theme: the big screen is always classic now, so it's dropped.
      if (body.settings) { const { theme, ...saved } = body.settings; setSettings(v => ({ ...v, ...saved })); } // eslint-disable-line no-unused-vars
      setIsNew(body.isNew);
    } else {
      setAccountNote("You're signed in, but your saved settings and classes aren't available right now.");
    }
    setPhase(p => (p === "loading" || p === "home" ? "setup" : p));
    // A teacher with one class gets it picked for them, so a room can't open as Guests only (and save nothing) by accident.
    authFetch("/api/classes").then(r => (r.ok ? r.json() : [])).then(cs => {
      setClasses(cs);
      setSettings(v => (cs.length === 1 && !cs.some(c => c.id === v.classId) ? { ...v, classId: cs[0].id } : v));
    }).catch(() => setClasses([]));
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
        const { seconds, size, minLen, phSound, phTicked, phBonus, hints = true, wordOfGame = false } = r.settings;
        setSettings(v => ({ ...v, seconds, size, minLen, phSound, phTicked, phBonus, hints, wordOfGame }));
        setGame(r.game);
        setLiveRound(r.n);
        setRoundTeams(r.teams || 0);
        setTeamResult(r.teamResult || null);
        setWall(r.wall ? { words: r.wall.words, counts: r.wall.counts, of: r.wall.of } : null);
        setCoopResult(r.coopResult || null);
        setClassFound(r.classFound ? { n: r.n, words: r.classFound } : null);
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
      } else if (r && liveRef.current === r.n && phaseRef.current === "playing" && r.state === "over") {
        // The server's clock ran out while we were away, so it has ended (and saved) the round: show the answers.
        setStep(0); setPhase("reveal");
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
      setLiveRound(null);
      setRoomNote("The room closed while you were away (the game server restarted or lost its connection). Rounds that had finished were saved. Open a new room when you're ready.");
      setPhase(p => (["lobby", "countdown", "playing", "reveal"].includes(p) ? "setup" : p));
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
    const onTeams = r => { if (r.n === liveRef.current) setTeamResult(r); };
    s.on("round:teams", onTeams);
    const onWall = w => { if (w.n === liveRef.current) setWall({ words: w.words, counts: w.counts, of: w.of }); };
    const onCoopResult = r => { if (r.n === liveRef.current) setCoopResult(r); };
    const onClassFound = f => { if (f.n === liveRef.current) setClassFound(f); };
    s.on("round:wall", onWall);
    s.on("round:coop-result", onCoopResult);
    s.on("round:class-found", onClassFound);
    // A warning stays up until that round is saved, even if the next round has started.
    const onSaved = st => setSaveStatus(prev => (st.n === liveRef.current || !st.ok || (prev && prev.n === st.n) ? st : prev));
    s.on("room:update", onUpdate);
    s.on("round:rewards-summary", onTally);
    s.on("round:saved", onSaved);
    s.on("host:replaced", onReplaced);
    s.io.on("reconnect", onReconnect);
    return () => {
      s.off("room:update", onUpdate); s.off("host:replaced", onReplaced); s.off("round:rewards-summary", onTally); s.off("round:saved", onSaved);
      s.off("round:teams", onTeams); s.off("round:wall", onWall); s.off("round:coop-result", onCoopResult); s.off("round:class-found", onClassFound);
      s.io.off("reconnect", onReconnect);
    };
  }, [account]); // eslint-disable-line

  // The big screen is always the classic look; shop looks only ever show on a student's own device.
  useEffect(() => { applyTheme(); }, []);
  // "Let students use their own looks": sent with host:open, and changed live when the teacher flips it.
  // room changes on every roster update, so only send when the value really differs from what the room has.
  const sentOwnLooks = useRef(null);
  useEffect(() => {
    if (!room) { sentOwnLooks.current = null; return; }
    const has = typeof room.ownLooks === "boolean" ? room.ownLooks : sentOwnLooks.current;
    if (has === settings.ownLooks) return;
    sentOwnLooks.current = settings.ownLooks;
    call("host:own-looks", { on: settings.ownLooks }).then(res => { if (!res.ok) sentOwnLooks.current = null; });
  }, [settings.ownLooks, room]);

  // Tell joined devices whether a round is on. A message that doesn't get through (wifi blip) is sent again.
  // While a round is starting, the server has already moved the room to "playing" but this screen is still on the lobby:
  // sending "lobby" then would abandon the new round (so it would never be saved, rewarded or team-scored).
  const sentPhaseRef = useRef(null);
  const startingRef = useRef(false);
  const [phaseRetry, setPhaseRetry] = useState(0);
  useEffect(() => {
    if (!room) { sentPhaseRef.current = null; return; }
    if (startingRef.current) return;
    const p = roomPhaseFor(phase);
    if (p !== room.phase || sentPhaseRef.current !== p) {
      sentPhaseRef.current = p;
      call("host:phase", { phase: p }).then(res => {
        if (res.ok || sentPhaseRef.current !== p) return;
        sentPhaseRef.current = null;
        setTimeout(() => setPhaseRetry(n => n + 1), 3000);
      });
    }
  }, [phase, room, phaseRetry]);

  // Keep the server awake for the whole lesson (Render's free plan sleeps after 15 minutes without a web request).
  const roomOpen = !!room;
  useEffect(() => {
    if (!roomOpen) return;
    const id = setInterval(() => { fetch("/api/ping").catch(() => { /* offline: the socket reconnect handles it */ }); }, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [roomOpen]);

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
    const res = await call("host:open", { idToken: await getIdToken().catch(() => ""), classId, ownLooks: settings.ownLooks !== false });
    setBusy(false);
    if (!res.ok) return setRoomNote(ROOM_ERRORS[res.error] || "The room didn't open. Please try again.");
    sentOwnLooks.current = settings.ownLooks !== false;
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
  const setTeams = count => call("host:teams", { count });
  const moveTeam = (playerId, team) => call("host:team-move", { playerId, team });
  const setCoop = on => call("host:coop", { on });
  const toSettings = () => setPhase(room ? "lobby" : "setup");

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
      // First make sure the server knows how the last round ended (answers shown, or abandoned), so it's saved or not.
      await call("host:phase", { phase: roomPhaseFor(phaseRef.current) });
      const { seconds, size, minLen, phSound, phTicked, phBonus, hints, hintSeconds, wordOfGame } = settings;
      startingRef.current = true;
      const res = await call("host:start", { settings: { seconds, size, minLen, phSound, phTicked, phBonus, hints, hintSeconds, wordOfGame: !!wordOfGame } });
      if (!res.ok) {
        startingRef.current = false;
        setBusy(false);
        setPhase("lobby");
        return setRoomNote(res.error === "offline" ? "We can't reach the game server. Check the wifi, then try again." : "The round didn't start. Please try again.");
      }
      g = res.game;
      setRewardsTally(null);
      setRoundTeams(res.teams || 0);
      setTeamResult(null);
      setWall(res.coop ? { words: [], counts: [], of: res.game.solution.total } : null);
      setCoopResult(null);
      setClassFound(null);
      setSaveStatus(st => (st && !st.ok ? st : null));
      setLiveRound(res.n);
      setRoomNote("");
    } else {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: settings.size, minLen: settings.minLen,
          phSound: settings.phSound, phTicked: settings.phTicked, wordOfGame: !!settings.wordOfGame,
        }),
      });
      g = await res.json();
      setLiveRound(null);
      setRoundTeams(0);
      setWall(null);
      setClassFound(null);
    }
    setGame(g);
    setBusy(false);
    setStep(0); setPathWord(0); setPaused(false);
    setRemaining(settings.seconds);
    setCount(3);
    setPhase("countdown");
    startingRef.current = false;
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

  /* ---- reveal steps ----
   * Time's up (with the class's total), the class's celebration (device rounds only), which team won, then the
   * highlights on one screen. After that, for going through the answers: today's sound, each word length, the longest
   * word, and how to add up a paper score.
   */
  const live = !!liveRound;
  const steps = useMemo(() => {
    if (!game) return [];
    const S = game.solution;
    const arr = [{ t: "open" }];
    if (live) arr.push({ t: "cheer" });
    if (roundTeams) arr.push({ t: "teams" });
    arr.push({ t: "sum" });
    if (S.phonics) arr.push({ t: "phonics" });
    for (const L of S.lens) arr.push({ t: "group", L });
    arr.push({ t: "longest" });
    if (!live) arr.push({ t: "score" });
    return arr;
  }, [game, roundTeams, live]);
  const next = useCallback(() => setStep(s => Math.min(s + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  // The opener moves on by itself once the class's total has drummed up (or after a few seconds if it never comes).
  const foundNow = live && classFound && classFound.n === liveRound ? classFound.words : null;
  const foundReady = !live || !!foundNow;
  useEffect(() => {
    if (phase !== "reveal" || step !== 0 || !steps[0] || steps[0].t !== "open") return;
    const t = setTimeout(() => setStep(s => (s === 0 ? 1 : s)), foundReady ? 3400 : 5000);
    return () => clearTimeout(t);
  }, [phase, step, steps, foundReady]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const h = e => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); next(); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, next, back]);

  // Reaching "Which team won?" on the big screen lets the devices show it too.
  const teamsRevealedRef = useRef(null);
  useEffect(() => {
    if (phase === "reveal" && liveRound && steps[step] && steps[step].t === "teams" && teamsRevealedRef.current !== liveRound) {
      teamsRevealedRef.current = liveRound;
      call("host:teams-reveal", { n: liveRound });
    }
  }, [phase, step, steps, liveRound]);

  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const S = game && game.solution;
  const PH = S && S.phonics;

  // What the celebration and highlights show: class totals only. A class-list room adds this round's trophies,
  // stickers and personal bests once the round is saved; a guests-only room shows what the class found instead.
  const foundSet = foundNow ? new Set(foundNow) : wall ? new Set(wall.words) : null;
  const tallyNow = live && rewardsTally && rewardsTally.n === liveRound ? rewardsTally : null;
  const classRoom = live && !!(room && room.roster);
  const longestFound = foundNow ? foundNow.reduce((m, w) => Math.max(m, w.length), 0) : null;
  const soundFound = foundNow && PH ? foundNow.filter(w => PH.tagMap[w]).length : null;
  const counters = !live ? [] : classRoom ? [
    { n: tallyNow ? tallyNow.trophies : null, label: tallyNow && tallyNow.trophies === 1 ? "new trophy" : "new trophies", colour: T.amber },
    { n: tallyNow ? tallyNow.stickers : null, label: tallyNow && tallyNow.stickers === 1 ? "new sticker" : "new stickers", colour: T.green },
    { n: tallyNow ? tallyNow.bests : null, label: tallyNow && tallyNow.bests === 1 ? "personal best" : "personal bests", colour: T.amberSoft },
    { n: longestFound, label: "letters in the longest word found", colour: T.text },
  ] : [
    { n: longestFound, label: "letters in the longest word found", colour: T.amber },
    { n: foundNow ? foundNow.filter(w => w.length >= 5).length : null, label: "words with 5 or more letters", colour: T.green },
    ...(PH ? [{ n: soundFound, label: "words with today's sound", colour: T.amberSoft }] : []),
  ];
  const sumStats = !live ? {
    title: "How words score",
    rows: [0, 1, 2].map(extra => [wordPoints(settings.minLen + extra, settings.minLen), `${settings.minLen + extra}-letter words`])
      .concat(PH && settings.phBonus ? [[`+${BONUS}`, "for today's sound"]] : []),
    note: "Only ticked words count. The word lists come next.",
  } : {
    title: "This round, between you",
    rows: classRoom
      ? [[tallyNow ? tallyNow.trophies : null, "new trophies"], [tallyNow ? tallyNow.stickers : null, "new stickers"], [tallyNow ? tallyNow.bests : null, "personal bests"]]
        .concat(PH ? [[soundFound, `words with today's sound ${soundDef ? soundDef.lab : ""}`]] : [])
      : [[foundNow ? foundNow.length : null, "different words found"], [longestFound, "letters in the longest word found"]]
        .concat(PH ? [[soundFound, "words with today's sound"]] : []),
    note: room && room.roster && saveStatus && saveStatus.n === liveRound ? (saveStatus.ok ? `Saved to ${room.className || "class"} progress` : null) : null,
    noteColour: T.green,
  };
  const endButtons = (
    <>
      <button className="ws-btn ws-display" onClick={start} style={{ fontSize: 21, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 14, padding: "12px 28px", cursor: "pointer", boxShadow: "0 5px 0 var(--ws-amber-edge)" }}>Play again ↻</button>
      {room && <button className="ws-btn ws-display" onClick={() => setPhase("lobby")} style={{ fontSize: 21, fontWeight: 600, background: "none", color: T.mist, border: `2px solid ${T.faint}`, borderRadius: 14, padding: "12px 28px", cursor: "pointer" }}>Back to the lobby</button>}
      <button className="ws-btn ws-display" onClick={() => setPhase("setup")} style={{ fontSize: 21, fontWeight: 600, background: "none", color: T.mist, border: `2px solid ${T.faint}`, borderRadius: 14, padding: "12px 28px", cursor: "pointer" }}>Change settings</button>
    </>
  );

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
            {phase !== "setup" || !showGuide ? <button className="ws-btn" onClick={() => { setGuide(true); setPhase("setup"); }} style={{ background: "none", border: `1px solid ${T.faint}`, color: "var(--ws-text)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>How it works</button> : null}
            {phase !== "classes" && <button className="ws-btn" onClick={() => setPhase("classes")} style={{ background: "none", border: `1px solid ${T.faint}`, color: "var(--ws-text)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>My classes</button>}
            {phase !== "progress" && <button className="ws-btn" onClick={() => setPhase("progress")} style={{ background: "none", border: `1px solid ${T.faint}`, color: "var(--ws-text)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>Progress</button>}
            <a href="/privacy" style={{ color: T.mist, fontSize: 14 }}>Privacy</a>
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

      {/* ---------- HOME (signed out): students first, teachers underneath ---------- */}
      {phase === "home" && (
        <main className="ws-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, padding: "24px 16px 40px" }}>
          <style>{SPLASH_CSS}</style>
          <div aria-label="WordShake" role="img" style={{ display: "grid", gap: 8, justifyItems: "center", marginTop: "min(4vh, 30px)" }}>
            {["WORD", "SHAKE"].map((w, row) => (
              <div key={w} style={{ display: "flex", gap: "min(2vw, 10px)" }}>
                {w.split("").map((ch, i) => (
                  <span key={i} className="ws-display ws-splash-die" aria-hidden="true"
                    style={{ "--tilt": `${((row * 5 + i) % 3 - 1) * 4}deg`, animationDelay: `${(row * 4 + i) * 0.07}s`, background: row ? T.amber : "var(--ws-text)", color: T.ink }}>{ch}</span>
                ))}
              </div>
            ))}
          </div>
          <p style={{ color: T.mist, fontSize: 19, margin: 0, textAlign: "center", maxWidth: 520 }}>Shake the dice, then race the clock to find words.</p>
          {accountNote && <div role="status" style={{ maxWidth: 680, background: "rgb(var(--ws-amber-rgb) / .1)", border: "1px solid rgb(var(--ws-amber-rgb) / .4)", borderRadius: 12, padding: "10px 14px", fontSize: 14.5, color: T.mist }}>{accountNote}</div>}

          <a href="/join" className="ws-btn ws-display" style={{ width: "min(460px, 100%)", boxSizing: "border-box", display: "grid", gap: 4, justifyItems: "center", background: T.green, color: T.ink, borderRadius: 24, padding: "26px 20px", textDecoration: "none", boxShadow: "0 7px 0 rgb(0 0 0 / .25)" }}>
            <span style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">🎒</span>
            <span style={{ fontSize: 34, fontWeight: 700 }}>I'm a student</span>
            <span style={{ fontFamily: "'Atkinson Hyperlegible',sans-serif", fontSize: 16 }}>Sign in, or join your class's game</span>
          </a>

          <section style={{ width: "min(460px, 100%)", boxSizing: "border-box", border: `1px solid ${T.faint}`, background: "rgb(var(--ws-fg) / .04)", borderRadius: 18, padding: "16px 20px", display: "grid", gap: 10 }}>
            <h2 className="ws-display" style={{ margin: 0, fontSize: 22 }}>Teachers</h2>
            <p style={{ margin: 0, color: T.mist, fontSize: 15, lineHeight: 1.5 }}>Sign in to run class games, keep class lists and see progress. Any Google account works, school or personal.</p>
            {signInConfigured ? (
              <button className="ws-btn ws-display" onClick={signInHere} style={{ fontSize: 19, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 12, padding: "11px 18px", cursor: "pointer", boxShadow: "0 4px 0 var(--ws-amber-edge)" }}>
                Sign in with Google
              </button>
            ) : <div style={{ color: T.amber, fontSize: 15 }}>Sign-in is unavailable right now.</div>}
            <button className="ws-btn" onClick={() => { setSettings(v => ({ ...v, mode: "workbook" })); setPhase("setup"); }} style={{ background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 14.5, padding: 0, justifySelf: "start" }}>
              Or play a workbook round without signing in →
            </button>
          </section>
          <a href="/privacy" style={{ color: T.mist, fontSize: 14 }}>Privacy</a>
        </main>
      )}

      {/* ---------- CLASS LISTS ---------- */}
      {phase === "classes" && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 20px 40px" }}>
          <ClassLists classes={classes} setClasses={setClasses} onCreated={id => setSettings(v => ({ ...v, classId: id }))} onDone={() => setPhase("setup")}
            onAccountDeleted={async () => { roomRef.current = null; await signOutHere(); setAccountNote("Your WordShake account and all its classes have been deleted."); }} />
        </main>
      )}

      {phase === "progress" && <Progress classes={classes} onDone={() => setPhase("setup")} />}

      {/* ---------- LOBBY ---------- */}
      {phase === "lobby" && room && (
        <Lobby room={room} busy={busy} onStart={start} onSettings={() => setPhase("setup")} onClose={closeRoom} onKick={kick} onTeams={setTeams} onMoveTeam={moveTeam} onCoop={setCoop} startLabel="Start the round →" note={roomNote} />
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
      {phase === "setup" && (() => {
        const online = settings.mode === "online";
        const showSettings = id => { setDrawer(true); if (id) setOpenSecs(o => ({ ...o, [id]: true })); };
        const [label, action, busyLabel] = !online ? ["Shake the dice →", start, "Shaking the dice…"]
          : room ? ["Back to the lobby →", () => { saveSettingsNow(); setPhase("lobby"); }, ""]
          : ["Open the room →", openRoom, "Opening the room…"];
        const link = { background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 15, minHeight: 44 };
        return (
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
            <main className="ws-fade" style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 24, padding: "min(9vh, 90px) 24px 40px", boxSizing: "border-box" }}>
              {accountNote && (
                <div role="status" style={{ maxWidth: 680, background: "rgb(var(--ws-amber-rgb) / .1)", border: "1px solid rgb(var(--ws-amber-rgb) / .4)", borderRadius: 12, padding: "10px 14px", fontSize: 14.5, color: T.mist }}>
                  {accountNote}
                </div>
              )}
              {account && showGuide && (
                <Guide name={(account.displayName || "").split(" ")[0]} isNew={isNew} classes={classes} onAddClass={() => setPhase("classes")} onClose={hideGuide} />
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
                <h1 className="ws-display" style={{ fontSize: 46, fontWeight: 700, margin: 0 }}>Ready to shake the dice?</h1>
                {!online && (
                  <p style={{ color: T.mist, fontSize: 17, marginTop: 8 }}>
                    Project this screen. Students write every word they can find in their books —
                    letters must connect, and no tile can be used twice in one word.
                  </p>
                )}
              </div>

              {online && !account && (
                <div style={{ fontSize: 16, color: T.mist, textAlign: "center" }}>
                  Online games need a teacher account.{" "}
                  {accountsReady && <button className="ws-btn" onClick={signInHere} style={{ ...link, color: T.amber, fontSize: 16, padding: 0, minHeight: 0 }}>Sign in with Google</button>}
                </div>
              )}

              {online && account && (room ? (
                <div style={{ fontSize: 16, color: T.mist }}>{room.className || "Guests only"} — close the room in the lobby to switch class.</div>
              ) : (
                <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
                  <div role="group" aria-label="Class" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                    {(classes || []).map(c => (
                      <Chip key={c.id} big active={settings.classId === c.id} onClick={() => setSettings(v => ({ ...v, classId: c.id }))}>{c.name}</Chip>
                    ))}
                    <Chip big active={!classes || !classes.some(c => c.id === settings.classId)} onClick={() => setSettings(v => ({ ...v, classId: null }))}>Guests only</Chip>
                  </div>
                  <div style={{ fontSize: 13.5, color: T.mist, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                    Students tap their name from the class list. Anyone not on it can join as a guest.
                    <button className="ws-btn" onClick={() => setPhase("classes")} style={{ ...link, fontSize: 13.5 }}>
                      {classes && classes.length ? "Manage classes" : "Add a class list"}
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 640 }}>
                {settingsSummary(settings, soundDef, online).map(([text, id]) => (
                  <button key={text} className="ws-btn ws-display" onClick={() => showSettings(id)} title="Change in game settings"
                    style={{ fontSize: 15.5, fontWeight: 600, padding: "8px 14px", minHeight: 40, borderRadius: 999, border: "none", background: "rgb(var(--ws-fg) / .08)", color: "var(--ws-text)", cursor: "pointer" }}>
                    {text}
                  </button>
                ))}
                {!drawer && (
                  <button className="ws-btn ws-display" onClick={() => showSettings()} aria-expanded={false}
                    style={{ fontSize: 15.5, fontWeight: 600, padding: "8px 14px", minHeight: 40, borderRadius: 999, border: `1px solid ${T.faint}`, background: "none", color: T.amber, cursor: "pointer" }}>
                    Game settings
                  </button>
                )}
              </div>

              {(!online || account) && (
                <button className="ws-btn ws-display" onClick={action} disabled={busy}
                  style={{ fontSize: 32, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 18, padding: "22px 58px", cursor: "pointer", boxShadow: "0 7px 0 var(--ws-amber-edge)", opacity: busy ? 0.7 : 1 }}>
                  {busy ? busyLabel : label}
                </button>
              )}

              {!room && (
                <button className="ws-btn" onClick={() => setSettings(v => ({ ...v, mode: online ? "workbook" : "online" }))} style={link}>
                  {online ? "Playing on paper? Start a workbook game" : "Students on devices? Play online instead"}
                </button>
              )}

              <div style={{ fontSize: 13, color: T.mist, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dict.status === "loading" ? T.mist : soundDef || dict.status === "full" ? T.green : T.amber }} />
                {dict.status === "loading" && "Loading the word lists…"}
                {dict.status !== "loading" && soundDef && `Sounds-Write words only — ${phStats.words.toLocaleString()} words`}
                {!soundDef && dict.status === "full" && `Full dictionary ready — ${dict.count.toLocaleString()} words (classroom-filtered)`}
                {!soundDef && dict.status === "fallback" && `Offline — using the built-in starter list (${dict.count.toLocaleString()} common words)`}
              </div>
            </main>
            {drawer && (
              <GameSettings settings={settings} setSettings={setSettings} soundDef={soundDef}
                phStats={phStats} dict={dict} online={online} open={openSecs} setOpen={setOpenSecs} onClose={() => setDrawer(false)} />
            )}
          </div>
        );
      })()}

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

          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "center", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {soundDef && <div style={{ position: "relative", zIndex: 5, marginBottom: 14 }}><SoundCard soundDef={soundDef} ticked={settings.phTicked} bonus={settings.phBonus} /></div>}
            {S && S.wordOfGame && phase !== "countdown" && <div style={{ marginBottom: 14 }}><WordOfGame word={S.wordOfGame} big /></div>}
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
          {wall && phase === "playing" && <WordWall words={wall.words} counts={wall.counts} of={wall.of} height="min(66vh, 620px)" />}
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

            {steps[step].t === "open" && <Opener live={live} found={foundNow ? foundNow.length : null} total={S.total} />}

            {steps[step].t === "cheer" && (
              <Celebrate className={room && room.className} found={foundNow ? foundNow.length : null} total={S.total}
                coopLine={coopResult ? bestLine(coopResult) : null} counters={counters} onNext={next} />
            )}

            {steps[step].t === "sum" && (
              <Highlights game={game} size={settings.size} live={live} found={foundNow} soundDef={soundDef} minLen={settings.minLen} targetSet={targetSet} stats={sumStats}
                buttons={<>
                  {endButtons}
                  <button className="ws-btn ws-display" onClick={next} style={{ fontSize: 21, fontWeight: 600, background: "none", color: "var(--ws-text)", border: `2px solid ${T.amber}`, borderRadius: 14, padding: "12px 28px", cursor: "pointer" }}>Go through the words →</button>
                </>} />
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
                    {L}-letter words <span style={{ color: T.amber }}>· {wordPoints(L, settings.minLen)} pt{wordPoints(L, settings.minLen) > 1 ? "s" : ""} each</span>
                    <span style={{ color: T.mist, fontWeight: 400, fontSize: 22 }}> · {group.length} found by the board</span>
                  </div>
                  <p style={{ color: T.mist, margin: 0 }}>
                    {foundSet ? `Together you found ${group.filter(w => foundSet.has(w)).length} of these (ticked).` : liveRound ? "How many of these did you find?" : "Tick the ones in your book — cross out anything that isn't here."}
                    {PH && <> Words with <span style={{ color: T.amber }}>today's sound</span> are underlined{settings.phBonus ? " (+2 bonus)" : ""}.</>}
                  </p>
                  <div style={{ overflowY: "auto", width: "100%", minHeight: 0, padding: "6px 4px", display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(8, L + 3)}ch, 1fr))`, gap: "10px 14px", alignContent: "start" }}>
                    {group.map(w => {
                      const ranges = PH && PH.tagMap[w];
                      const ours = foundSet && foundSet.has(w);   // found by someone in the class
                      return (
                        <div key={w} style={{ position: "relative", background: ours ? "rgb(var(--ws-green-rgb) / .14)" : ranges ? "rgb(var(--ws-amber-rgb) / .08)" : "rgb(var(--ws-fg) / .06)", border: `1px solid ${ours ? "rgb(var(--ws-green-rgb) / .5)" : ranges ? "rgb(var(--ws-amber-rgb) / .45)" : T.faint}`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                          {ours && <span aria-label="found by the class" style={{ position: "absolute", top: 2, right: 6, color: T.green, fontSize: 14, fontWeight: 700 }}>✓</span>}
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
                  <div style={{ color: T.mist, marginTop: 6, fontSize: 18 }}>{S.maxLen} letters · worth {wordPoints(S.maxLen, settings.minLen)} {wordPoints(S.maxLen, settings.minLen) === 1 ? "point" : "points"}</div>
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
                  {[0, 1, 2, 3].map(extra => [`${settings.minLen + extra} letters`, wordPoints(settings.minLen + extra, settings.minLen)])
                    .concat([["Every extra letter", "+1"]])
                    .map(([label, p]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", background: "rgb(var(--ws-fg) / .06)", border: `1px solid ${T.faint}`, borderRadius: 12, padding: "12px 20px", fontSize: 20 }}>
                        <span>{label}</span><b className="ws-display" style={{ color: T.amber }}>{typeof p === "string" ? `${p} pt` : `${p} pt${p > 1 ? "s" : ""} each`}</b>
                      </div>
                    ))}
                  {PH && settings.phBonus && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "rgb(var(--ws-amber-rgb) / .1)", border: `1px solid rgb(var(--ws-amber-rgb) / .45)`, borderRadius: 12, padding: "12px 20px", fontSize: 20 }}>
                      <span>Words with today's sound {soundDef && soundDef.lab}</span><b className="ws-display" style={{ color: T.green }}>+{BONUS} bonus each</b>
                    </div>
                  )}
                </div>
              </div>
            )}

            {steps[step].t === "teams" && (
              <div style={{ textAlign: "center", width: "min(980px,94vw)", display: "grid", gap: 22, justifyItems: "center" }}>
                <div className="ws-display" style={{ fontSize: 30, color: T.mist }}>Which team won?</div>
                {!teamResult && <div style={{ color: T.mist, fontSize: 22 }}>Adding up the team scores…</div>}
                {teamResult && (
                  <>
                    <TeamResults result={teamResult} big />
                    {/* the winner lands once the bars have grown */}
                    <div role="status" className="ws-display" style={{ fontSize: "min(9vw,76px)", fontWeight: 700, color: T.amber, lineHeight: 1.1, animation: `ws-slap .8s ${0.15 * teamResult.teams.length + 1.1}s ease both` }}>{winnerLine(teamResult)}</div>
                    <p style={{ color: T.mist, fontSize: 17, margin: 0 }}>A team's score is all its players' points added up. Everyone's trophies and stickers still count for them.</p>
                  </>
                )}
              </div>
            )}

            {step === steps.length - 1 && (
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>{endButtons}</div>
            )}
          </div>

          {/* the opener, celebration and highlights show the class's totals themselves */}
          {!["open", "cheer", "sum"].includes(steps[step].t) && liveRound && rewardsTally && rewardsTally.n === liveRound && (rewardsTally.trophies + rewardsTally.stickers + rewardsTally.bests > 0) && (
            <div role="status" className="ws-display" style={{ alignSelf: "center", marginTop: 8, background: "rgb(var(--ws-amber-rgb) / .12)", border: "1px solid rgb(var(--ws-amber-rgb) / .45)", borderRadius: 999, padding: "8px 22px", fontSize: 19, fontWeight: 600, animation: "ws-pop .5s ease both" }}>
              🎉 This round: {[
                rewardsTally.trophies && `${rewardsTally.trophies} new ${rewardsTally.trophies === 1 ? "trophy" : "trophies"}`,
                rewardsTally.stickers && `${rewardsTally.stickers} new ${rewardsTally.stickers === 1 ? "sticker" : "stickers"}`,
                rewardsTally.bests && `${rewardsTally.bests} personal ${rewardsTally.bests === 1 ? "best" : "bests"}`,
              ].filter(Boolean).join(" · ")}
            </div>
          )}

          {liveRound && room && room.roster && saveStatus && (saveStatus.n === liveRound || !saveStatus.ok) && (!saveStatus.ok || !["open", "sum"].includes(steps[step].t)) && (
            <div role={saveStatus.ok ? "status" : "alert"} style={{ alignSelf: "center", marginTop: 6, fontSize: 14.5, color: saveStatus.ok ? T.green : T.red }}>
              {saveStatus.ok
                ? "✓ Saved to class progress"
                : `⚠ Round ${saveStatus.n} hasn't reached class progress yet — it's being retried automatically. Keep this room open.`}
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
