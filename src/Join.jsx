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

const CODE_LEN = 4;
const ERRORS = {
  "no-room": "We can't find a game with that code. Check the code on the big screen.",
  "too-many": "Too many wrong codes have been tried. Wait a few minutes, then try again.",
  "bad-name": "Please type your first name, using letters only.",
  "no-student": "That name isn't on the list any more. Ask your teacher.",
  offline: "We can't reach the game. Check the wifi, then try again.",
};
const ENDED = {
  closed: "This game has ended.",
  expired: "This game has ended.",
  replaced: "Your teacher started a new game. Type the new code.",
  kicked: "Your teacher took you out of the game. You can join again.",
  elsewhere: "You joined on another device, so this one has stopped.",
};

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};
const tokenKey = code => `wordshake-join-${code}`;
const cleanCode = s => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN);

const big = { fontSize: 24, fontWeight: 700, border: "none", borderRadius: 16, padding: "16px 28px", cursor: "pointer" };
const lobbyBtn = { ...big, fontSize: 21, padding: "12px 24px", background: "rgb(var(--ws-amber-rgb) / .14)", color: "var(--ws-text)", border: `2px solid ${T.amber}` };
const link = { background: "none", border: "none", color: T.mist, textDecoration: "underline", cursor: "pointer", fontSize: 17, padding: 8 };

export function Join({ initialCode }) {
  const [code, setCode] = useState(cleanCode(initialCode || ""));
  const [step, setStep] = useState(initialCode ? "loading" : "code"); // code | loading | names | confirm | guest | joined
  const [room, setRoom] = useState(null);           // { code, className, roster, phase }
  const [chosen, setChosen] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [me, setMe] = useState(null);               // { name, guest }
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
    setMe({ name: res.name, guest: !!res.guest });
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
    setMessage("");
    setStep("joined");
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
      const res = await call("player:rejoin", { code: c, token });
      if (res.ok) return joined(c, res);
      if (res.error !== "offline") store.del(tokenKey(c));
    }
    return lookup(c);
  };

  useEffect(() => {
    const s = getSocket();
    const onRoster = r => setRoom(r);
    // The teacher turned students' own looks on or off: follow it straight away.
    const onLooks = ({ ownLooks: on } = {}) => dress(wornRef.current, on !== false);
    // The trophy cabinet and the shop close when a round starts.
    const onPhase = p => { setPhase(p); if (p !== "lobby") { setCabinet(false); setJar(false); setShop(false); } };
    const onRoundState = r => { setRound(r ? { ...r, clockAt: Date.now() } : null); if (r) { setCabinet(false); setJar(false); setShop(false); } };
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
      setMe(null);
      setRound(null);
      undress();
      setMessage(ENDED[reason] || ENDED.closed);
      if (reason === "kicked") lookup(codeRef.current, true); else { setStep("code"); setCode(""); window.history.replaceState(null, "", "/join"); }
    };
    const onClosed = reason => end(reason)();
    const onKicked = end("kicked");
    const onReplaced = () => { setMe(null); undress(); setMessage(ENDED.elsewhere); setStep("code"); };
    // After the wifi drops or the iPad sleeps, quietly pick up where we were.
    const onReconnect = () => { if (stepRef.current === "joined") enter(codeRef.current); else if (["names", "confirm", "guest"].includes(stepRef.current)) call("player:lookup", { code: codeRef.current }).then(r => r.ok && setRoom(r.room)); };
    s.on("room:roster", onRoster);
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
    s.io.on("reconnect", onReconnect);
    if (initialCode) enter(cleanCode(initialCode));
    return () => {
      s.off("room:roster", onRoster); s.off("room:looks", onLooks); s.off("room:phase", onPhase); s.off("room:closed", onClosed);
      s.off("round:state", onRoundState); s.off("round:clock", onClock); s.off("round:rewards", onRewards); s.off("player:rewards-changed", onRewardsChanged); s.off("player:team", onTeam); s.off("round:teams", onTeams);
      s.off("round:coop", onCoop); s.off("round:coop-result", onCoopResult);
      s.off("room:kicked", onKicked); s.off("room:replaced", onReplaced); s.io.off("reconnect", onReconnect);
    };
  }, []); // eslint-disable-line

  // The worn avatar sits beside the name (it shows even when the teacher has looks turned off).
  const avatarEmoji = avatarOf(worn);
  const avatar = avatarEmoji ? <span aria-hidden="true">{avatarEmoji} </span> : null;

  const submitCode = e => { e.preventDefault(); if (code.length === CODE_LEN) enter(code); };

  const joinAs = async payload => {
    setBusy(true);
    const res = await call("player:join", { code: room.code, ...payload });
    setBusy(false);
    if (res.ok) return joined(room.code, res);
    if (res.error === "already-in") { setMessage(`${chosen.name} is already in this game on another device. If that's not you, tell your teacher.`); setStep("names"); return; }
    setMessage(ERRORS[res.error] || ERRORS.offline);
    if (res.error === "no-room") setStep("code");
  };

  const notMe = async () => {
    await call("player:leave");
    store.del(tokenKey(room ? room.code : code));
    setMe(null);
    undress();
    lookup(room ? room.code : code);
  };

  return (
    <div className="ws-root" style={{ minHeight: "100vh", background: `radial-gradient(900px 600px at 50% -10%, var(--ws-glow) 0%, ${T.ink} 60%)`, color: "var(--ws-text)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{CSS}</style>
      <header className="ws-display" style={{ fontSize: 26, fontWeight: 700, padding: "16px 0 4px" }}>Word<span style={{ color: T.amber }}>Shake</span></header>
      <main style={{ flex: 1, width: "min(900px, 100%)", padding: "16px 16px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, boxSizing: "border-box" }}>
        {message && <div role="alert" style={{ background: "rgb(var(--ws-red-rgb) / .12)", border: "1px solid rgb(var(--ws-red-rgb) / .45)", borderRadius: 14, padding: "12px 18px", fontSize: 19, textAlign: "center", maxWidth: 560 }}>{message}</div>}

        {step === "loading" && <div style={{ color: T.mist, fontSize: 22, marginTop: 40 }}>Finding your game…</div>}

        {step === "code" && (
          <form onSubmit={submitCode} className="ws-fade" style={{ display: "grid", gap: 18, justifyItems: "center", marginTop: 20 }}>
            <label htmlFor="code" className="ws-display" style={{ fontSize: 32, fontWeight: 700, textAlign: "center" }}>Type the code from the big screen</label>
            <input id="code" value={code} onChange={e => setCode(cleanCode(e.target.value))} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
              inputMode="text" maxLength={CODE_LEN} aria-describedby="code-help"
              className="ws-display" style={{ width: "5.2em", textAlign: "center", fontSize: 64, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", background: "rgb(var(--ws-fg) / .08)", color: T.amber, border: `3px solid ${code.length === CODE_LEN ? T.amber : "rgb(var(--ws-fg) / .25)"}`, borderRadius: 18, padding: "8px 0" }} />
            <div id="code-help" style={{ color: T.mist, fontSize: 16 }}>{CODE_LEN} letters and numbers</div>
            <button type="submit" disabled={code.length !== CODE_LEN || busy} className="ws-btn ws-display" style={{ ...big, background: code.length === CODE_LEN ? T.amber : "rgb(var(--ws-fg) / .12)", color: code.length === CODE_LEN ? T.ink : "rgb(var(--ws-fg) / .4)" }}>
              {busy ? "Looking…" : "Go →"}
            </button>
          </form>
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

        {step === "joined" && me && round && <Play round={round} name={me.name} avatar={avatarEmoji} guest={me.guest} onRound={setRound} />}

        {step === "joined" && me && !round && cabinet && <Cabinet name={me.name} cached={cabinetCache.current} refresh={cabinetFresh} onLoaded={s => { cabinetCache.current = s; }} onClose={() => setCabinet(false)} />}

        {step === "joined" && me && !round && jar && <WordJar name={me.name} cached={jarCache.current} onLoaded={b => { jarCache.current = b; }} onClose={() => setJar(false)} />}

        {step === "joined" && me && !round && shop && !cabinet && !jar && <Shop name={me.name} cached={shopData} ownLooks={ownLooks} onLoaded={gotShop} onWorn={onWorn} onClose={() => setShop(false)} />}

        {step === "joined" && me && !round && !cabinet && !jar && !shop && (
          <div className="ws-fade" style={{ display: "grid", gap: 16, justifyItems: "center", textAlign: "center", marginTop: 30 }}>
            <div className="ws-display" style={{ fontSize: 44, fontWeight: 700 }}>{phase === "lobby" ? <>You're in, {avatar}<span style={{ color: T.amber }}>{me.name}</span>!</> : <>{avatar}{me.name}</>}</div>
            <div aria-live="polite" style={{ fontSize: 24, color: T.mist, maxWidth: 520, lineHeight: 1.4 }}>
              {phase === "lobby" && "Wait for your teacher to start the game."}
              {phase !== "lobby" && "Look at the big screen."}
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
