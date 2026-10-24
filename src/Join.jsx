import { useEffect, useRef, useState } from "react";
import { T, CSS } from "./theme.js";
import { applyLooks } from "./looks.js";
import { getSocket, call } from "./net.js";
import { Play } from "./Play.jsx";
import { Cabinet } from "./Trophies.jsx";
import { WordJar } from "./WordJar.jsx";
import { TeamBadge } from "./Teams.jsx";
import { Shop } from "./Shop.jsx";
import { balanceOf } from "../shared/shop.js";
import { avatarOf } from "./shopView.js";
import { PicturePad, PinPractice } from "./PicturePad.jsx";
import { CLASS_CODE_MAX, CLASS_CODE_MIN } from "../shared/pictures.js";
import { HomeLobby, HomeControls, homeBoard, roundSettings } from "./HomeGame.jsx";

const CODE_LEN = 4;
const ERRORS = {
  "no-room": "We can't find a game with that code. Check the code on the big screen.",
  "too-many": "Too many wrong codes have been tried. Wait a few minutes, then try again.",
  "bad-name": "Please type your first name, using letters only.",
  "no-student": "That name isn't on the list any more. Ask your teacher.",
  offline: "We can't reach the game. Check the wifi, then try again.",
  "no-class": "We can't find a class with that code. Check it with your teacher.",
  "first-in-class": "The first time, you sign in at school. Ask your teacher to open the game on the big screen, then tap your name again.",
  "wrong-pin": "Not quite. Try again!",
  locked: "Too many wrong tries. Wait 15 minutes, or ask your teacher.",
  "signed-out": "You've been signed out. Type your class code to sign in again.",
  "home-off": "Your teacher has turned off playing at home for now.",
};
const ENDED = {
  closed: "This game has ended.",
  expired: "This game has ended.",
  replaced: "Your teacher started a new game. Type the new code.",
  kicked: "Your teacher took you out of the game. You can join again.",
  homeKicked: "You were taken out of the game. You can join again.",
  elsewhere: "You joined on another device, so this one has stopped.",
};

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};
const tokenKey = code => `wordshake-join-${code}`;
// One box takes either: a game code (4, from the big screen) or a class code (5 to 10, from the teacher).
const cleanCode = s => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CLASS_CODE_MAX);
const codeReady = c => c.length === CODE_LEN || c.length >= CLASS_CODE_MIN;

/*
 * A signed-in device keeps its pass here and, through the server, in a cookie (Safari can clear what a page
 * saves itself after a week without a visit; the cookie is what keeps a student who only plays now and then signed in).
 */
const PASS_KEY = "wordshake-student";
const post = url => body => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).catch(() => {});
const keepPass = pass => { store.set(PASS_KEY, pass); post("/api/student/remember")({ pass }); };
const dropPass = () => { store.del(PASS_KEY); post("/api/student/forget")(); };

const big = { fontSize: 24, fontWeight: 700, border: "none", borderRadius: 16, padding: "16px 28px", cursor: "pointer" };
const lobbyBtn = { ...big, fontSize: 21, padding: "12px 24px", background: "rgb(var(--ws-amber-rgb) / .14)", color: "var(--ws-text)", border: `2px solid ${T.amber}` };
const link = { background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 17, padding: 8 };

export function Join({ initialCode }) {
  const [code, setCode] = useState(cleanCode(initialCode || ""));
  // code | loading | names | confirm | guest | joined   (a game, from its code)
  // classNames | pin | home                            (signing in with the class code; home = signed in, no game)
  const [step, setStep] = useState("loading");
  const [student, setStudent] = useState(null);     // the student this device is signed in as: { name, className, pass } | null
  const studentRef = useRef(null);
  studentRef.current = student;
  const [classPick, setClassPick] = useState(null); // signing in: { code, className, roster }
  const [practice, setPractice] = useState(null);   // practising the secret pictures on joining: { pin, mode } | null
  const firstPractice = useRef(null);               // signed in for the very first time: shown once the game is joined
  const [padReset, setPadReset] = useState(0);
  const [room, setRoom] = useState(null);           // { code, className, roster, phase }
  const [chosen, setChosen] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [me, setMe] = useState(null);               // { name, guest, home: { host } in a home game | null }
  const [hosting, setHosting] = useState(null);     // running my own home game: the host's view { code, players } | null
  const hostingRef = useRef(null);
  hostingRef.current = hosting;
  const inHomeGame = useRef(false);                 // the game this device is in is someone's home game
  const [cabinet, setCabinet] = useState(false);    // showing "My trophies"
  const cabinetCache = useRef(null);                // the last trophies loaded, shown at once next time
  const [cabinetFresh, setCabinetFresh] = useState(0); // bumped when the student's rewards change, so an open cabinet reloads
  const [jar, setJar] = useState(false);            // showing "My word jar"
  const jarCache = useRef(null);                     // the last word bank loaded, shown at once next time
  const [shop, setShop] = useState(false);          // showing the Shop
  const [shopData, setShopData] = useState(null);    // the last player:shop reply ({ wallet, trophies, worn }), for the lobby's balance
  const [balance, setBalance] = useState(null);      // stars to spend (null: not known yet)
  const [worn, setWorn] = useState(null);            // slot -> item id, from the server (null: guest / not joined)
  const [ownLooks, setOwnLooks] = useState(true);    // the teacher's "Let students use their own looks"
  const wornRef = useRef(null), ownLooksRef = useRef(true);
  const [phase, setPhase] = useState("lobby");
  const [team, setTeam] = useState(null);           // teams mode: this device's team in the lobby (null: no teams)
  const [round, setRound] = useState(null);         // this device's view of the current round (letters only, never the answers)
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const justSignedOut = useRef(false);
  const codeRef = useRef(code);
  codeRef.current = code;

  // The one place this device puts its looks on: what it wears (from the server) and whether the teacher allows it.
  const dress = (w, on) => {
    wornRef.current = w; ownLooksRef.current = on;
    setWorn(w); setOwnLooks(on);
    applyLooks(w, on);
  };
  const undress = () => dress(null, true);   // back to classic: not joined, or between games
  const gotShop = d => { setShopData(d); setBalance(balanceOf(d.wallet)); };
  const onWorn = w => { if (w) dress(w, ownLooksRef.current); };

  // Everything tied to one room is reset here: wallets belong to a class, so a new room starts fresh.
  const joined = (c, res) => {
    store.set(tokenKey(c), res.token);
    codeRef.current = c;   // a signed-in device may have joined without typing it: reconnecting needs it
    setCode(c);
    setMe({ name: res.name, guest: !!res.guest, home: res.home || null });
    inHomeGame.current = !!res.home;
    setTeam(res.team == null ? null : res.team);
    dress(res.guest ? null : res.looks || null, res.ownLooks !== false);
    setCabinet(false);
    setJar(false);
    setShop(false);
    setShopData(null);
    setBalance(typeof res.balance === "number" ? res.balance : null);
    cabinetCache.current = null;
    jarCache.current = null;
    setPhase(res.phase);
    setRound(res.round ? { ...res.round, clockAt: Date.now() } : null);
    setPractice(takeFirst() || res.practice || null);
    setMessage("");
    setStep("joined");
  };
  const takeFirst = () => { const f = firstPractice.current; firstPractice.current = null; return f; };
  const practiceDone = fromMemory => {
    if (practice) call("student:practised", { mode: practice.mode, fromMemory });
    setPractice(null);
  };

  // Signed in (by class code and pictures, by tapping a name in class, or remembered from last time).
  const signedIn = res => {
    keepPass(res.pass);
    setStudent({ name: res.name, className: res.className, pass: res.pass });
    if (typeof res.balance === "number") setBalance(res.balance);
    if (res.looks !== undefined) dress(res.looks || null, res.ownLooks !== false);
  };
  const signOut = async () => {
    await call("student:signout", { pass: studentRef.current && studentRef.current.pass });
    dropPass();
    setStudent(null);
    setBalance(null);
    undress();
  };

  // Home: signed in, not in a game. If the class's game is open, go straight into it.
  const goHome = async roomCode => {
    setCabinet(false); setJar(false); setShop(false);
    setHosting(null);
    if (roomCode) {
      setStep("loading");
      const res = await call("player:join", { code: roomCode, me: true });
      if (res.ok) return joined(roomCode, res);
      if (res.error === "already-in") setMessage("You're already in the game on another device. If that's not you, tell your teacher.");
    }
    window.history.replaceState(null, "", "/join");
    const first = takeFirst();
    if (first) setPractice(first);
    setStep("home");
  };

  const lookup = async (c, keepMessage = false) => {
    setBusy(true);
    const res = await call("player:lookup", { code: c });
    setBusy(false);
    if (res.error) { setMessage(ERRORS[res.error] || ERRORS.offline); setStep("code"); return; }
    window.history.replaceState(null, "", `/join/${c}`);
    setRoom(res.room);
    undress();
    if (!keepMessage) setMessage("");
    setStep(res.room.roster ? "names" : "guest");
  };

  // Rejoin with this device's saved pass if there is one, otherwise show the name list.
  const enter = async c => {
    const token = store.get(tokenKey(c));
    if (token) {
      setStep("loading");
      const res = await call("player:rejoin", { code: c, token, remember: !studentRef.current });
      if (res.ok) {
        if (res.pass) signedIn({ pass: res.pass, name: res.name, className: res.className });
        return joined(c, res);
      }
      if (res.error !== "offline") store.del(tokenKey(c));
    }
    if (studentRef.current) {
      setStep("loading");
      const res = await call("player:join", { code: c, me: true });
      if (res.ok) return joined(c, res);
      if (res.error === "already-in") { setMessage(`${studentRef.current.name} is already in this game on another device. If that's not you, tell your teacher.`); setStep("home"); return; }
      if (res.error === "no-room" || res.error === "too-many") { setMessage(ERRORS[res.error]); setStep("code"); return; }
    }
    return lookup(c);
  };

  // Is this device signed in? (Its saved pass, or the cookie if the browser cleared that.) Then on to a game or home.
  const resume = async () => {
    const res = await call("student:resume", { pass: store.get(PASS_KEY) || undefined });
    if (res.ok) { signedIn(res); return res; }
    if (res.error === "signed-out") { if (store.get(PASS_KEY)) dropPass(); setStudent(null); }
    return res;
  };

  /* ---- my own game at home (HomeGame.jsx) ---- */
  const openHome = async () => {
    setBusy(true);
    const res = await call("home:open");
    setBusy(false);
    if (!res.ok) { setMessage(ERRORS[res.error] || ERRORS.offline); return false; }
    setHosting(res.host);
    joined(res.code, res);
    window.history.replaceState(null, "", "/join");
    return true;
  };
  const startHome = async board => {
    setBusy(true);
    const res = await call("host:start", { settings: roundSettings(board) });
    setBusy(false);
    if (!res.ok && res.error !== "slow-down") setMessage(ERRORS.offline);
  };
  // The clock as this device sees it, for pausing (the server keeps the real one).
  const leftNow = r => Math.max(0, r.remainingMs - (r.state === "playing" ? Date.now() - r.clockAt : 0));
  const pauseHome = state => round && call("host:clock", { n: round.n, state, remainingMs: leftNow(round) });
  const kickHome = p => { if (window.confirm(`Take ${p.name} out of the game? They can join again.`)) call("host:kick", { playerId: p.id }); };
  const finishHome = async () => {
    await call("host:close");
    setMe(null); setRound(null); setHosting(null);
    await goHome(null);
    setMessage("");   // the game closing isn't news to the student who closed it
  };

  /* ---- signing in with the class code ---- */
  const findClass = async c => {
    setBusy(true);
    const res = await call("student:class", { code: c });
    setBusy(false);
    if (res.error) { setMessage(ERRORS[res.error] || ERRORS.offline); setStep("code"); return; }
    setClassPick({ code: c, className: res.className, roster: res.roster });
    setMessage("");
    setStep("classNames");
  };
  const trySignIn = async (studentId, pin) => {
    setBusy(true);
    const res = await call("student:signin", { code: classPick.code, studentId, pin });
    setBusy(false);
    if (res.ok) {
      signedIn(res);
      setMessage("");
      if (res.practice) firstPractice.current = res.practice;   // the very first time (the class's game is open)
      return goHome(res.room);
    }
    if (res.error === "need-pin") { setMessage(""); setPadReset(k => k + 1); setStep("pin"); return; }
    if (res.error === "wrong-pin") { setPadReset(k => k + 1); setMessage(res.left <= 2 ? `Not quite. ${res.left} more ${res.left === 1 ? "try" : "tries"}, then you'll have to wait.` : ERRORS["wrong-pin"]); return; }
    setMessage(ERRORS[res.error] || ERRORS.offline);
    if (res.error === "no-class") setStep("code");
    else setStep("classNames");
  };

  useEffect(() => {
    const s = getSocket();
    const onRoster = r => setRoom(r);
    // Running my own home game: who has joined.
    const onHostView = v => { if (hostingRef.current && v && v.code === hostingRef.current.code) setHosting(v); };
    // The teacher turned students' own looks on or off: follow it straight away.
    const onLooks = ({ ownLooks: on } = {}) => dress(wornRef.current, on !== false);
    // The trophy cabinet and the shop close when a round starts.
    // Picture practice is only for the lobby: a round starting ends it (it's not counted).
    const onPhase = p => { setPhase(p); if (p !== "lobby") { setCabinet(false); setJar(false); setShop(false); setPractice(null); } };
    const onRoundState = r => { setRound(r ? { ...r, clockAt: Date.now() } : null); if (r) { setCabinet(false); setJar(false); setShop(false); setPractice(null); } };
    // Arrives just after the answers start, once the round is saved. It brings the stars earned and the new balance.
    const onRewards = ({ n, ...rewards }) => {
      cabinetCache.current = null;
      jarCache.current = null;   // the round's new words are in the bank now
      if (typeof rewards.balance === "number") setBalance(rewards.balance);
      setRound(cur => cur && cur.n === n ? { ...cur, rewards } : cur);
    };
    // Teams mode: the teacher put this device in a team (or turned teams off), and later, which team won.
    const onTeam = t => setTeam(t == null ? null : t);
    const onTeams = result => setRound(cur => cur && cur.n === result.n ? { ...cur, teamResult: result } : cur);
    // Class together: how many words the whole class has found so far, and the class's total at the end.
    const onCoop = c => setRound(cur => cur && cur.n === c.n ? { ...cur, coop: { words: c.words, of: c.of } } : cur);
    const onCoopResult = result => setRound(cur => cur && cur.n === result.n ? { ...cur, coopResult: result } : cur);
    const onRewardsChanged = () => { cabinetCache.current = null; setCabinetFresh(k => k + 1); };
    const onClock = c => setRound(cur => cur && cur.n === c.n ? { ...cur, state: c.state, remainingMs: c.remainingMs, clockAt: Date.now() } : cur);
    const end = reason => () => {
      store.del(tokenKey(codeRef.current));
      const why = reason === "kicked" && inHomeGame.current ? "homeKicked" : reason;
      setMe(null);
      setHosting(null);
      setRound(null);
      setPractice(null);
      // Signed out while running a home game: the game closes straight after, so say why.
      setMessage(justSignedOut.current ? ERRORS["signed-out"] : ENDED[why] || ENDED.closed);
      justSignedOut.current = false;
      // A signed-in student goes back to their home screen, still dressed in their own looks.
      if (studentRef.current) { setCode(""); goHome(null); return; }
      undress();
      if (reason === "kicked") lookup(codeRef.current, true); else { setStep("code"); setCode(""); window.history.replaceState(null, "", "/join"); }
    };
    const onClosed = reason => end(reason)();
    const onKicked = end("kicked");
    const onReplaced = () => { setMe(null); setMessage(ENDED.elsewhere); if (studentRef.current) { setStep("home"); return; } undress(); setStep("code"); };
    // A signed-in student on their home screen: their class's game has just opened.
    const onClassRoom = ({ code: c } = {}) => { if (c && stepRef.current === "home") goHome(c); };
    // The teacher signed this device out.
    const onSignedOut = () => {
      dropPass();
      studentRef.current = null;   // the home game's "closed" can arrive before the next render
      justSignedOut.current = inHomeGame.current && stepRef.current === "joined";
      setStudent(null);
      setPractice(null);
      if (stepRef.current === "home" || ["pin", "classNames"].includes(stepRef.current)) { undress(); setBalance(null); setMessage(ERRORS["signed-out"]); setStep("code"); }
    };
    // After the wifi drops or the iPad sleeps, quietly pick up where we were (signed in first, then the game).
    const onReconnect = async () => {
      if (studentRef.current) await call("student:resume", { pass: studentRef.current.pass }).then(r => { if (r.error === "signed-out") onSignedOut(); else if (r.ok && r.room && stepRef.current === "home") goHome(r.room); });
      if (stepRef.current === "joined" && hostingRef.current) { const r = await call("home:open"); if (r.ok) { setHosting(r.host); joined(r.code, r); } else goHome(null); }
      else if (stepRef.current === "joined") enter(codeRef.current);
      else if (["names", "confirm", "guest"].includes(stepRef.current)) call("player:lookup", { code: codeRef.current }).then(r => r.ok && setRoom(r.room));
    };
    s.on("room:roster", onRoster);
    s.on("room:update", onHostView);
    s.on("room:looks", onLooks);
    s.on("room:phase", onPhase);
    s.on("round:state", onRoundState);
    s.on("round:clock", onClock);
    s.on("round:rewards", onRewards);
    s.on("player:team", onTeam);
    s.on("round:teams", onTeams);
    s.on("round:coop", onCoop);
    s.on("round:coop-result", onCoopResult);
    s.on("player:rewards-changed", onRewardsChanged);
    s.on("room:closed", onClosed);
    s.on("room:kicked", onKicked);
    s.on("room:replaced", onReplaced);
    s.on("class:room", onClassRoom);
    s.on("student:signed-out", onSignedOut);
    s.io.on("reconnect", onReconnect);
    resume().then(res => {
      if (initialCode) return enter(cleanCode(initialCode));
      if (res.ok) return goHome(res.room);
      if (res.error !== "signed-out") setMessage(ERRORS.offline);
      setStep("code");
    });
    return () => {
      s.off("room:roster", onRoster); s.off("room:update", onHostView); s.off("room:looks", onLooks); s.off("room:phase", onPhase); s.off("room:closed", onClosed);
      s.off("round:state", onRoundState); s.off("round:clock", onClock); s.off("round:rewards", onRewards); s.off("player:rewards-changed", onRewardsChanged); s.off("player:team", onTeam); s.off("round:teams", onTeams);
      s.off("round:coop", onCoop); s.off("round:coop-result", onCoopResult);
      s.off("room:kicked", onKicked); s.off("room:replaced", onReplaced); s.off("class:room", onClassRoom); s.off("student:signed-out", onSignedOut); s.io.off("reconnect", onReconnect);
    };
  }, []); // eslint-disable-line

  // The worn avatar sits beside the name (it shows even when the teacher has looks turned off).
  const avatarEmoji = avatarOf(worn);
  const avatar = avatarEmoji ? <span aria-hidden="true">{avatarEmoji} </span> : null;

  const submitCode = e => { e.preventDefault(); if (!codeReady(code)) return; if (code.length === CODE_LEN) enter(code); else findClass(code); };

  const joinAs = async payload => {
    setBusy(true);
    // Tapping a name on a device that isn't signed in: it's remembered from now on (the teacher is in the room).
    const res = await call("player:join", { code: room.code, ...payload, remember: !!payload.studentId && !studentRef.current });
    setBusy(false);
    if (res.ok) {
      if (res.pass) signedIn({ pass: res.pass, name: res.name, className: res.className });
      return joined(room.code, res);
    }
    if (res.error === "already-in") { setMessage(`${chosen.name} is already in this game on another device. If that's not you, tell your teacher.`); setStep("names"); return; }
    setMessage(ERRORS[res.error] || ERRORS.offline);
    if (res.error === "no-room") setStep("code");
  };

  // "Not Mia?": leaves the game and, if the device is signed in, signs it out (so the real Mia's stars are safe).
  const notMe = async () => {
    const c = me ? codeRef.current : room ? room.code : code;
    if (me) await call("player:leave");
    store.del(tokenKey(c));
    setMe(null);
    setRound(null);
    setPractice(null);
    if (studentRef.current) await signOut();
    undress();
    if (phase === "lobby" && step === "joined") return lookup(c);
    setCode("");
    setMessage("");
    window.history.replaceState(null, "", "/join");
    setStep("code");
  };
  const myName = me ? me.name : student ? student.name : "";
  // The trophy cabinet, word jar and shop: in a game's lobby, or on the home screen.
  const practising = !!practice && ((step === "joined" && me && !round) || step === "home");
  const lounge = !practising && ((step === "joined" && me && !round && !me.guest) || step === "home");

  return (
    <div className="ws-root" style={{ minHeight: "100vh", background: `radial-gradient(900px 600px at 50% -10%, var(--ws-glow) 0%, ${T.ink} 60%)`, color: "var(--ws-text)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{CSS}</style>
      <header className="ws-display" style={{ fontSize: 26, fontWeight: 700, padding: "16px 0 4px" }}>Word<span style={{ color: T.amber }}>Shake</span></header>
      <main style={{ flex: 1, width: "min(900px, 100%)", padding: "16px 16px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, boxSizing: "border-box" }}>
        {message && <div role="alert" style={{ background: "rgb(var(--ws-red-rgb) / .12)", border: "1px solid rgb(var(--ws-red-rgb) / .45)", borderRadius: 14, padding: "12px 18px", fontSize: 19, textAlign: "center", maxWidth: 560 }}>{message}</div>}

        {step === "loading" && <div style={{ color: T.mist, fontSize: 22, marginTop: 40 }}>Finding your game…</div>}

        {step === "code" && (
          <form onSubmit={submitCode} className="ws-fade" style={{ display: "grid", gap: 18, justifyItems: "center", marginTop: 20 }}>
            <label htmlFor="code" className="ws-display" style={{ fontSize: 32, fontWeight: 700, textAlign: "center" }}>{student ? "Type the code from the big screen" : "Type your class code"}</label>
            <input id="code" value={code} onChange={e => setCode(cleanCode(e.target.value))} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
              inputMode="text" maxLength={CLASS_CODE_MAX} aria-describedby="code-help"
              className="ws-display" style={{ width: `min(${Math.max(CODE_LEN, code.length) * 0.9 + 1.6}em, 88vw)`, boxSizing: "border-box", textAlign: "center", fontSize: code.length > 6 ? 48 : 64, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "rgb(var(--ws-fg) / .08)", color: T.amber, border: `3px solid ${codeReady(code) ? T.amber : "rgb(var(--ws-fg) / .25)"}`, borderRadius: 18, padding: "8px 0" }} />
            <div id="code-help" style={{ color: T.mist, fontSize: 16, textAlign: "center", maxWidth: 420 }}>{student ? `${CODE_LEN} letters and numbers` : "Your teacher gives you this. Or type the game code from the big screen."}</div>
            <button type="submit" disabled={!codeReady(code) || busy} className="ws-btn ws-display" style={{ ...big, background: codeReady(code) ? T.amber : "rgb(var(--ws-fg) / .12)", color: codeReady(code) ? T.ink : "rgb(var(--ws-fg) / .4)" }}>
              {busy ? "Looking…" : "Go →"}
            </button>
            {student ? <button type="button" onClick={() => { setMessage(""); setCode(""); setStep("home"); }} style={link}>Back</button>
              : <a href="/" style={{ ...link, textDecoration: "underline" }}>Back</a>}
          </form>
        )}

        {step === "classNames" && classPick && (
          <div className="ws-fade" style={{ width: "100%", display: "grid", gap: 16, justifyItems: "center" }}>
            <h1 className="ws-display" style={{ margin: 0, fontSize: 34, textAlign: "center" }}>Tap your name</h1>
            <div style={{ color: T.mist, fontSize: 17 }}>{classPick.className}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, width: "100%" }}>
              {classPick.roster.map(s => (
                <button key={s.id} disabled={busy} onClick={() => { setChosen(s); setMessage(""); trySignIn(s.id); }} className="ws-btn ws-display"
                  style={{ fontSize: 23, fontWeight: 600, padding: "18px 10px", borderRadius: 16, cursor: "pointer", border: "2px solid rgb(var(--ws-fg) / .18)", background: "rgb(var(--ws-fg) / .08)", color: "var(--ws-text)" }}>
                  {s.name}
                </button>
              ))}
            </div>
            <button onClick={() => { setMessage(""); setStep("code"); }} style={link}>That's not my class</button>
          </div>
        )}

        {step === "pin" && chosen && (
          <div className="ws-fade" style={{ width: "100%", display: "grid", gap: 14, justifyItems: "center" }}>
            <h1 className="ws-display" style={{ margin: 0, fontSize: 32, textAlign: "center" }}>Hi <span style={{ color: T.amber }}>{chosen.name}</span>! Tap your secret pictures</h1>
            <div style={{ color: T.mist, fontSize: 17 }}>In the right order</div>
            <PicturePad busy={busy} reset={padReset} onDone={pin => trySignIn(chosen.id, pin)} />
            <button onClick={() => { setMessage(""); setStep("classNames"); }} style={link}>Not {chosen.name}? Go back</button>
          </div>
        )}

        {practising && <PinPractice key={practice.mode + practice.pin.join()} pin={practice.pin} mode={practice.mode} onDone={practiceDone} />}

        {step === "home" && student && !practising && !cabinet && !jar && !shop && (
          <div className="ws-fade" style={{ display: "grid", gap: 16, justifyItems: "center", textAlign: "center", marginTop: 30 }}>
            <div className="ws-display" style={{ fontSize: 44, fontWeight: 700 }}>Hi {avatar}<span style={{ color: T.amber }}>{student.name}</span>!</div>
            <div style={{ fontSize: 18, color: T.mist }}>{student.className}</div>
            <button onClick={openHome} disabled={busy} className="ws-btn ws-display" style={{ ...big, background: T.green, color: T.ink, marginTop: 6 }}>{busy ? "Getting ready…" : "Play a game 🎲"}</button>
            <div aria-live="polite" style={{ fontSize: 18, color: T.mist, maxWidth: 520, lineHeight: 1.4 }}>
              At school, your class's game starts here when your teacher opens it.
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 10 }}>
              {balance != null && (
                <span className="ws-display" role="status" aria-label={`${balance} ${balance === 1 ? "star" : "stars"} to spend`} style={{ fontSize: 24, fontWeight: 800, padding: "8px 16px", borderRadius: 999, background: "rgb(var(--ws-fg) / .07)" }}>⭐ {balance}</span>
              )}
              <button onClick={() => setCabinet(true)} className="ws-btn ws-display" style={lobbyBtn}>My trophies 🏆</button>
              <button onClick={() => setJar(true)} className="ws-btn ws-display" style={lobbyBtn}>My word jar 🏺</button>
              <button onClick={() => setShop(true)} className="ws-btn ws-display" style={lobbyBtn}>Shop 🛍️</button>
            </div>
            <button onClick={() => { setMessage(""); setCode(""); setStep("code"); }} style={{ ...link, marginTop: 14 }}>Got a code from the big screen?</button>
            <button onClick={notMe} style={link}>Not {student.name}? Sign out</button>
          </div>
        )}

        {step === "names" && room && (
          <div className="ws-fade" style={{ width: "100%", display: "grid", gap: 16, justifyItems: "center" }}>
            <h1 className="ws-display" style={{ margin: 0, fontSize: 34, textAlign: "center" }}>Tap your name</h1>
            <div style={{ color: T.mist, fontSize: 17 }}>{room.className}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, width: "100%" }}>
              {room.roster.map(s => (
                <button key={s.id} disabled={s.taken} onClick={() => { setChosen(s); setMessage(""); setStep("confirm"); }} className="ws-btn ws-display"
                  aria-label={s.taken ? `${s.name}, already in the game` : s.name}
                  style={{ fontSize: 23, fontWeight: 600, padding: "18px 10px", borderRadius: 16, cursor: s.taken ? "default" : "pointer", border: `2px solid ${s.taken ? "transparent" : "rgb(var(--ws-fg) / .18)"}`, background: s.taken ? "rgb(var(--ws-fg) / .03)" : "rgb(var(--ws-fg) / .08)", color: s.taken ? "rgb(var(--ws-fg) / .3)" : "var(--ws-text)" }}>
                  {s.name}{s.taken && <span style={{ display: "block", fontSize: 13, fontWeight: 400 }}>✓ already in</span>}
                </button>
              ))}
            </div>
            <button onClick={() => { setMessage(""); setStep("guest"); }} style={link}>My name isn't here</button>
          </div>
        )}

        {step === "confirm" && chosen && (
          <div className="ws-fade" style={{ display: "grid", gap: 22, justifyItems: "center", marginTop: 30 }}>
            <div className="ws-display" style={{ fontSize: 40, fontWeight: 700, textAlign: "center" }}>Are you <span style={{ color: T.amber }}>{chosen.name}</span>?</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={() => joinAs({ studentId: chosen.id })} disabled={busy} className="ws-btn ws-display" style={{ ...big, background: T.green, color: T.ink, minWidth: 160 }}>{busy ? "Joining…" : "Yes, that's me"}</button>
              <button onClick={() => setStep("names")} className="ws-btn ws-display" style={{ ...big, background: "rgb(var(--ws-fg) / .1)", color: "var(--ws-text)", minWidth: 160 }}>No, go back</button>
            </div>
          </div>
        )}

        {step === "guest" && room && (
          <form onSubmit={e => { e.preventDefault(); if (guestName.trim().length >= 2) joinAs({ guestName }); }} className="ws-fade" style={{ display: "grid", gap: 18, justifyItems: "center", marginTop: 20 }}>
            <label htmlFor="guest" className="ws-display" style={{ fontSize: 32, fontWeight: 700, textAlign: "center" }}>Type your first name</label>
            <input id="guest" value={guestName} onChange={e => setGuestName(e.target.value)} maxLength={12} autoFocus autoComplete="off" autoCorrect="off" spellCheck={false}
              className="ws-display" style={{ width: "min(320px, 80vw)", textAlign: "center", fontSize: 34, fontWeight: 600, background: "rgb(var(--ws-fg) / .08)", color: "var(--ws-text)", border: "3px solid rgb(var(--ws-fg) / .25)", borderRadius: 16, padding: "10px 12px" }} />
            <button type="submit" disabled={guestName.trim().length < 2 || busy} className="ws-btn ws-display" style={{ ...big, background: guestName.trim().length >= 2 ? T.amber : "rgb(var(--ws-fg) / .12)", color: guestName.trim().length >= 2 ? T.ink : "rgb(var(--ws-fg) / .4)" }}>
              {busy ? "Joining…" : "Join →"}
            </button>
            {room.roster && <button type="button" onClick={() => { setMessage(""); setStep("names"); }} style={link}>Back to the name list</button>}
          </form>
        )}

        {step === "joined" && me && round && <Play round={round} name={me.name} avatar={avatarEmoji} guest={me.guest} home={me.home} onResume={hosting ? () => pauseHome("playing") : null} onRound={setRound} />}
        {step === "joined" && me && round && hosting && (
          <HomeControls round={round} phase={phase} busy={busy} onPause={() => pauseHome("paused")}
            onAgain={() => startHome(homeBoard())} onBoard={() => call("host:phase", { phase: "lobby" })} />
        )}
        {step === "joined" && me && round && me.home && !hosting && round.state === "over" && (
          <div style={{ fontSize: 20, color: T.mist, marginTop: 14 }}>Wait for {me.home.host} to start the next round.</div>
        )}

        {step === "joined" && me && !round && hosting && !practising && !cabinet && !jar && !shop && (
          <HomeLobby host={hosting} me={me} avatar={avatar} busy={busy} onStart={startHome} onKick={kickHome} onFinish={finishHome}
            extras={(
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
                {balance != null && (
                  <span className="ws-display" role="status" aria-label={`${balance} ${balance === 1 ? "star" : "stars"} to spend`} style={{ fontSize: 24, fontWeight: 800, padding: "8px 16px", borderRadius: 999, background: "rgb(var(--ws-fg) / .07)" }}>⭐ {balance}</span>
                )}
                <button onClick={() => setCabinet(true)} className="ws-btn ws-display" style={lobbyBtn}>My trophies 🏆</button>
                <button onClick={() => setJar(true)} className="ws-btn ws-display" style={lobbyBtn}>My word jar 🏺</button>
                <button onClick={() => setShop(true)} className="ws-btn ws-display" style={lobbyBtn}>Shop 🛍️</button>
              </div>
            )} />
        )}

        {lounge && cabinet && <Cabinet name={myName} cached={cabinetCache.current} refresh={cabinetFresh} onLoaded={s => { cabinetCache.current = s; }} onClose={() => setCabinet(false)} />}

        {lounge && jar && <WordJar name={myName} cached={jarCache.current} onLoaded={b => { jarCache.current = b; }} onClose={() => setJar(false)} />}

        {lounge && shop && !cabinet && !jar && <Shop name={myName} cached={shopData} ownLooks={ownLooks} onLoaded={gotShop} onWorn={onWorn} onClose={() => setShop(false)} />}

        {step === "joined" && me && !round && !hosting && !practising && !cabinet && !jar && !shop && (
          <div className="ws-fade" style={{ display: "grid", gap: 16, justifyItems: "center", textAlign: "center", marginTop: 30 }}>
            <div className="ws-display" style={{ fontSize: 44, fontWeight: 700 }}>{phase === "lobby" ? <>You're in, {avatar}<span style={{ color: T.amber }}>{me.name}</span>!</> : <>{avatar}{me.name}</>}</div>
            <div aria-live="polite" style={{ fontSize: 24, color: T.mist, maxWidth: 520, lineHeight: 1.4 }}>
              {phase === "lobby" && (me.home ? `Wait for ${me.home.host} to start the game.` : "Wait for your teacher to start the game.")}
              {phase !== "lobby" && (me.home ? "Wait for the next round." : "Look at the big screen.")}
            </div>
            {team != null && (
              <div aria-live="polite" style={{ fontSize: 22, color: T.mist, display: "grid", gap: 10, justifyItems: "center" }}>
                Your team
                <span key={team} style={{ animation: "ws-pop .45s ease both" }}><TeamBadge team={team} size={30} /></span>
              </div>
            )}
            {phase === "lobby" && !me.guest && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 10 }}>
                {balance != null && (
                  <span className="ws-display" role="status" aria-label={`${balance} ${balance === 1 ? "star" : "stars"} to spend`} style={{ fontSize: 24, fontWeight: 800, padding: "8px 16px", borderRadius: 999, background: "rgb(var(--ws-fg) / .07)" }}>⭐ {balance}</span>
                )}
                <button onClick={() => setCabinet(true)} className="ws-btn ws-display" style={lobbyBtn}>My trophies 🏆</button>
                <button onClick={() => setJar(true)} className="ws-btn ws-display" style={lobbyBtn}>My word jar 🏺</button>
                <button onClick={() => setShop(true)} className="ws-btn ws-display" style={lobbyBtn}>Shop 🛍️</button>
              </div>
            )}
            {phase === "lobby" && <button onClick={notMe} style={{ ...link, marginTop: 20 }}>Not {me.name}? Tap here</button>}
          </div>
        )}
      </main>
    </div>
  );
}
