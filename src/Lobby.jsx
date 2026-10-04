import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { T } from "./theme.js";

const btn = { background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 15 };

export function Lobby({ room, onStart, onSettings, onClose, onKick, busy, startLabel }) {
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

  return (
    <main className="ws-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "14px 24px 30px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "28px 48px", justifyContent: "center", alignItems: "flex-start", width: "100%", maxWidth: 1200 }}>
        {/* how to join */}
        <section aria-label="How to join" style={{ textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
          <div style={{ color: T.mist, fontSize: 20 }}>Go to <b style={{ color: "#EFF4F9" }}>{joinHost}/join</b> and type</div>
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
          {room.players.length === 0 && <div style={{ color: T.mist, fontSize: 20, padding: "30px 0" }}>Waiting for players…</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {room.players.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, animation: "ws-pop .45s ease both", opacity: p.connected ? 1 : 0.45, background: p.guest ? "rgba(255,255,255,.06)" : "rgba(255,176,32,.12)", border: `1px solid ${p.guest ? T.faint : "rgba(255,176,32,.4)"}`, borderRadius: 999, padding: "6px 6px 6px 16px" }}>
                <span className="ws-display" style={{ fontSize: 22, fontWeight: 600 }}>{p.name}</span>
                {p.guest && <span style={{ fontSize: 12, color: T.mist }}>guest</span>}
                {!p.connected && <span style={{ fontSize: 12, color: T.mist }}>reconnecting</span>}
                <button className="ws-btn" onClick={() => kick(p)} aria-label={`Remove ${p.name}`} title="Remove from game" style={{ background: "none", border: "none", color: "rgba(255,255,255,.35)", cursor: "pointer", fontSize: 15, padding: "2px 8px" }}>✕</button>
              </div>
            ))}
          </div>
          {room.roster && missing.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button className="ws-btn" onClick={() => setShowMissing(v => !v)} style={{ ...btn, fontSize: 14, padding: "6px 12px" }}>
                {showMissing ? "Hide" : "Show"} who's not here yet ({missing.length})
              </button>
              {showMissing && <div style={{ color: T.mist, marginTop: 8, fontSize: 16, lineHeight: 1.6 }}>{missing.map(s => s.name).join(" · ")}</div>}
            </div>
          )}
          {room.players.length > 0 && <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13.5, marginTop: 16 }}>Wrong name? Press ✕ to remove it, and the student can join again.</p>}
        </section>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 6 }}>
        <button className="ws-btn ws-display" onClick={onStart} disabled={busy}
          style={{ fontSize: 28, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 16, padding: "16px 42px", cursor: "pointer", boxShadow: "0 6px 0 #B87A0A", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Shaking the dice…" : startLabel}
        </button>
        <button className="ws-btn" onClick={onSettings} style={btn}>Change settings</button>
        <button className="ws-btn" onClick={onClose} style={btn}>Close room</button>
      </div>
      <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13.5, margin: 0, textAlign: "center", maxWidth: 640 }}>
        This round is played in workbooks: students write their words on paper and their device shows when the round starts and ends.
      </p>
    </main>
  );
}
