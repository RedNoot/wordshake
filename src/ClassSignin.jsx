import { useEffect, useState } from "react";
import { T } from "./theme.js";
import { authFetch } from "./auth.js";
import { PICTURES } from "../shared/pictures.js";

const btn = { background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 14 };

const ago = t => {
  if (!t) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};
const clock = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/*
 * One class's sign-in: the class code, each student's secret pictures (hidden until asked for: this page may be
 * on the projector), whether they've been shown them, a wait after too many wrong tries, and their devices.
 */
export function ClassSignin({ cls, onBack, onEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(() => new Set());   // students whose pictures are showing
  const [busy, setBusy] = useState(null);

  const load = async () => {
    const res = await authFetch(`/api/classes/${cls.id}/signin`).catch(() => null);
    if (!res || !res.ok) return setError("Couldn't load sign-in details. Check your connection and try again.");
    setError("");
    setData(await res.json());
  };
  useEffect(() => { load(); }, [cls.id]); // eslint-disable-line

  const act = async (key, url, method, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    const res = await authFetch(url, { method }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) return setError("That didn't work. Check your connection and try again.");
    await load();
  };
  const toggle = id => setShown(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const base = sid => `/api/classes/${cls.id}/students/${sid}`;

  return (
    <div className="ws-fade" style={{ display: "grid", gap: 18, width: "min(860px, 94vw)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 34 }}>{cls.name} · Sign-in</h1>
        <button className="ws-btn" onClick={onBack} style={btn}>← My classes</button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", border: `1px solid ${T.faint}`, borderRadius: 14, padding: "14px 18px", background: "rgb(var(--ws-fg) / .04)" }}>
        <div>
          <div style={{ color: T.mist, fontSize: 14 }}>Class code</div>
          {data && data.code
            ? <div className="ws-display" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "0.12em", color: T.amber }}>{data.code}</div>
            : data && <div style={{ fontSize: 17 }}>Not set yet. <button className="ws-btn" onClick={onEdit} style={{ ...btn, marginLeft: 6 }}>Set a class code</button></div>}
        </div>
        <p style={{ margin: 0, flex: 1, minWidth: 240, color: T.mist, fontSize: 14.5, lineHeight: 1.5 }}>
          The first time a student taps their name in your game, their device shows them their secret pictures and remembers them.
          On a new device, or at home, they type the class code, tap their name, then tap their pictures.
        </p>
      </div>

      {error && <div role="alert" style={{ color: T.red }}>{error}</div>}
      {!data && !error && <div style={{ color: T.mist }}>Loading…</div>}

      {data && (
        <div style={{ display: "grid", gap: 8 }}>
          {data.students.map(s => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, alignItems: "center", border: `1px solid ${T.faint}`, borderRadius: 12, padding: "10px 14px" }}>
              <div className="ws-display" style={{ fontSize: 19, fontWeight: 700 }}>{s.name}</div>

              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {s.pin && shown.has(s.id)
                    ? <span aria-label={s.pin.map(i => PICTURES[i].name).join(", ")} style={{ fontSize: 26, letterSpacing: 4 }}>{s.pin.map(i => PICTURES[i].emoji).join("")}</span>
                    : <span style={{ fontSize: 22, color: T.mist, letterSpacing: 4 }}>{s.pin ? "● ● ●" : "—"}</span>}
                  {s.pin && <button className="ws-btn" onClick={() => toggle(s.id)} style={btn}>{shown.has(s.id) ? "Hide" : "Show"}</button>}
                </div>
                <div style={{ fontSize: 13, color: s.lockedUntil ? T.red : T.mist }}>
                  {s.lockedUntil ? <>Too many wrong tries: waiting until {clock(s.lockedUntil)} <button className="ws-btn" disabled={busy} onClick={() => act(`u${s.id}`, `${base(s.id)}/unlock`, "POST")} style={{ ...btn, padding: "2px 8px", fontSize: 13 }}>Let in now</button></>
                    : s.learned ? "Knows their pictures by heart" : s.shown ? "Practising their pictures each time they join" : "Sees them when they next join in class"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                {s.devices.length === 0 && <div style={{ color: T.mist }}>Not signed in on any device</div>}
                {s.devices.map(d => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1 }}>{d.device} · {ago(d.lastUsedAt)}</span>
                    <button className="ws-btn" disabled={busy} onClick={() => act(`d${d.id}`, `${base(s.id)}/devices/${d.id}`, "DELETE")} style={{ ...btn, padding: "2px 8px", fontSize: 13 }}>Sign out</button>
                  </div>
                ))}
                <div>
                  <button className="ws-btn" disabled={busy} onClick={() => act(`p${s.id}`, `${base(s.id)}/pictures`, "POST",
                    `Give ${s.name} new secret pictures? Their old ones stop working. They'll see the new ones the next time they join your game in class.`)} style={btn}>
                    {busy === `p${s.id}` ? "…" : "New pictures"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
