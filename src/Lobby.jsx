import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { T } from "./theme.js";
import { TEAMS, MIN_TEAMS, MAX_TEAMS } from "../shared/teams.js";

const btn = { background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 15 };

export function Lobby({ room, onStart, onSettings, onClose, onKick, onTeams, onMoveTeam, onCoop, busy, startLabel, note }) {
  const joinHost = window.location.host;
  const joinUrl = `${window.location.origin}/join/${room.code}`;
  const [qr, setQr] = useState("");
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 440, color: { dark: "#0E1A2B", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [joinUrl]);

  const missing = room.roster ? room.roster.filter(s => !room.players.some(p => p.studentId === s.id)) : [];
  const studentsIn = room.players.filter(p => !p.guest).length;
  const guests = room.players.filter(p => p.guest).length;

  const kick = p => { if (window.confirm(`Remove ${p.name} from the game? They can join again.`)) onKick(p.id); };
  const teams = room.teams || 0;
  const coop = !!room.coop;

  // A student's worn avatar (from the shop) goes before their name; the one shop look the whole class sees.
  const face = p => (p.avatar ? <span aria-hidden="true">{p.avatar} </span> : null);
  const chip = (p, team = null) => (
    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, animation: "ws-pop .45s ease both", opacity: p.connected ? 1 : 0.45, background: p.guest ? "rgb(var(--ws-fg) / .06)" : "rgb(var(--ws-amber-rgb) / .12)", border: `1px solid ${p.guest ? T.faint : "rgb(var(--ws-amber-rgb) / .4)"}`, borderRadius: 999, padding: team == null ? "6px 6px 6px 16px" : "2px 4px 2px 4px" }}>
      {team == null
        ? <span className="ws-display" style={{ fontSize: 22, fontWeight: 600 }}>{face(p)}{p.name}</span>
        : (
          // In teams mode, tapping a name moves that student along to the next team.
          <button className="ws-btn ws-display" onClick={() => onMoveTeam(p.id, (team + 1) % teams)} title={`Move to ${TEAMS[(team + 1) % teams].name}`}
            aria-label={`${p.name}, in ${TEAMS[team].name}. Move to ${TEAMS[(team + 1) % teams].name}`}
            style={{ background: "none", border: "none", color: "var(--ws-text)", cursor: "pointer", fontSize: 20, fontWeight: 600, padding: "4px 4px 4px 12px" }}>{face(p)}{p.name}</button>
        )}
      {p.guest && <span style={{ fontSize: 12, color: T.mist }}>guest</span>}
      {!p.connected && <span style={{ fontSize: 12, color: T.mist }}>reconnecting</span>}
      <button className="ws-btn" onClick={() => kick(p)} aria-label={`Remove ${p.name}`} title="Remove from game" style={{ background: "none", border: "none", color: "rgb(var(--ws-fg) / .35)", cursor: "pointer", fontSize: 15, padding: "2px 8px" }}>✕</button>
    </div>
  );

  return (
    <main className="ws-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "14px 24px 30px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "28px 48px", justifyContent: "center", alignItems: "flex-start", width: "100%", maxWidth: 1200 }}>
        {/* how to join */}
        <section aria-label="How to join" style={{ textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
          <div style={{ color: T.mist, fontSize: 20 }}>Go to <b style={{ color: "var(--ws-text)" }}>{joinHost}/join</b> and type</div>
          <div className="ws-display" aria-label={`Room code ${room.code.split("").join(" ")}`} style={{ fontSize: "min(15vw, 120px)", fontWeight: 700, letterSpacing: "0.12em", color: T.amber, lineHeight: 1 }}>{room.code}</div>
          <div style={{ color: T.mist, fontSize: 16 }}>or scan with the camera</div>
          {qr ? <img src={qr} alt={`QR code for ${joinUrl}`} style={{ width: "min(36vh, 260px)", height: "min(36vh, 260px)", borderRadius: 14, background: "#fff", padding: 8 }} />
            : <div style={{ width: 260, height: 260 }} />}
        </section>

        {/* who's here */}
        <section aria-label="Players" aria-live="polite" style={{ flex: 1, minWidth: "min(480px, 92vw)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <h1 className="ws-display" style={{ margin: 0, fontSize: 36 }}>{room.className || "Guests only"}</h1>
            <span style={{ color: T.mist, fontSize: 19 }}>
              {room.roster ? `${studentsIn} of ${room.roster.length} here` : `${room.players.length} joined`}
              {room.roster && guests > 0 && ` · ${guests} guest${guests > 1 ? "s" : ""}`}
            </span>
          </div>
          {/* how the round is played: on your own, in teams, or the whole class together */}
          <div role="group" aria-label="Teams" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ color: T.mist, fontSize: 16, marginRight: 4 }}>Teams:</span>
            {[0, ...Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => i + MIN_TEAMS)].map(n => {
              const on = !coop && n === teams;
              return (
                <button key={n} className="ws-btn" onClick={() => { if (coop && n === 0) onCoop(false); else if (!on) onTeams(n); }} aria-pressed={on}
                  style={{ ...btn, fontSize: 15, padding: "6px 13px", background: on ? T.amber : "none", color: on ? T.ink : T.mist, border: `1px solid ${on ? T.amber : T.faint}`, fontWeight: on ? 700 : 400 }}>
                  {n === 0 ? "No teams" : n}
                </button>
              );
            })}
            <button className="ws-btn" onClick={() => !coop && onCoop(true)} aria-pressed={coop}
              style={{ ...btn, fontSize: 15, padding: "6px 13px", background: coop ? T.amber : "none", color: coop ? T.ink : T.mist, border: `1px solid ${coop ? T.amber : T.faint}`, fontWeight: coop ? 700 : 400 }}>
              🤝 Class together
            </button>
            {teams > 0 && <button className="ws-btn" onClick={() => onTeams(teams)} style={{ ...btn, fontSize: 15, padding: "6px 13px" }}>🔀 Shuffle</button>}
          </div>
          {room.players.length === 0 && <div style={{ color: T.mist, fontSize: 20, padding: "30px 0" }}>Waiting for players…</div>}
          {teams === 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{room.players.map(p => chip(p))}</div>}
          {teams > 0 && room.players.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${teams > 3 ? 190 : 230}px, 1fr))`, gap: 12 }}>
              {Array.from({ length: teams }, (_, t) => {
                const members = room.players.filter(p => p.team === t);
                return (
                  <section key={t} aria-label={`${TEAMS[t].name}, ${members.length} players`} style={{ borderRadius: 16, border: `2px solid ${TEAMS[t].colour}`, background: "rgb(var(--ws-fg) / .03)", overflow: "hidden" }}>
                    <div className="ws-display" style={{ background: TEAMS[t].colour, color: "#fff", fontSize: 21, fontWeight: 700, padding: "6px 14px", display: "flex", justifyContent: "space-between", textShadow: "0 1px 0 rgba(0,0,0,.25)" }}>
                      <span>{TEAMS[t].emoji} {TEAMS[t].name}</span><span>{members.length}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 10 }}>{members.map(p => chip(p, t))}</div>
                  </section>
                );
              })}
            </div>
          )}
          {room.roster && missing.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button className="ws-btn" onClick={() => setShowMissing(v => !v)} style={{ ...btn, fontSize: 14, padding: "6px 12px" }}>
                {showMissing ? "Hide" : "Show"} who's not here yet ({missing.length})
              </button>
              {showMissing && <div style={{ color: T.mist, marginTop: 8, fontSize: 16, lineHeight: 1.6 }}>{missing.map(s => s.name).join(" · ")}</div>}
            </div>
          )}
          {room.players.length > 0 && <p style={{ color: "rgb(var(--ws-fg) / .45)", fontSize: 13.5, marginTop: 16 }}>Wrong name? Press ✕ to remove it, and the student can join again.{teams > 0 && " Tap a name to move that student to the next team. Anyone who joins later goes into the smallest team."}</p>}
        </section>
      </div>

      {note && <div role="alert" style={{ background: "rgb(var(--ws-red-rgb) / .12)", border: "1px solid rgb(var(--ws-red-rgb) / .45)", borderRadius: 12, padding: "10px 16px", fontSize: 16 }}>{note}</div>}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 6 }}>
        <button className="ws-btn ws-display" onClick={onStart} disabled={busy}
          style={{ fontSize: 28, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 16, padding: "16px 42px", cursor: "pointer", boxShadow: "0 6px 0 var(--ws-amber-edge)", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Shaking the dice…" : startLabel}
        </button>
        <button className="ws-btn" onClick={onSettings} style={btn}>Change settings</button>
        <button className="ws-btn" onClick={onClose} style={btn}>Close room</button>
      </div>
      <p style={{ color: "rgb(var(--ws-fg) / .45)", fontSize: 13.5, margin: 0, textAlign: "center", maxWidth: 640 }}>
        Students swipe words on their own device and see only their own words and score{teams > 0 ? ". A team's score is all its players' points added up, revealed at the end" : ""}{coop ? ". Class together: every new word anyone finds goes up on this screen (no names), and the class tries to beat its own best" : ""}. Anyone who joins after the start plays from the next round.
      </p>
    </main>
  );
}
