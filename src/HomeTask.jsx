import { useEffect, useState } from "react";
import { T } from "./theme.js";
import { authFetch } from "./auth.js";
import { HOME_SIZES, HOME_LENGTHS, HOME_TIMES } from "../shared/home.js";
import { boardLine } from "./HomeGame.jsx";

/*
 * My classes → Home game: the teacher sets one board for the whole class to play at home. Every student plays the same
 * letters, and must play it once before they can choose their own boards (server/lib/rooms.js "home games").
 * Each student's first go is listed here by name (never ranked); replays don't change it.
 */
const btn = { background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 15 };
const primary = { background: T.amber, color: T.ink, border: "none", borderRadius: 12, padding: "10px 22px", cursor: "pointer", fontSize: 17, fontWeight: 700 };
const card = { background: "rgb(var(--ws-fg) / .04)", border: `1px solid ${T.faint}`, borderRadius: 14, padding: "14px 16px" };
const th = { textAlign: "left", fontWeight: 600, color: T.mist, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, padding: "8px 10px", borderBottom: `1px solid ${T.faint}`, whiteSpace: "nowrap" };
const td = { padding: "9px 10px", borderBottom: `1px solid ${T.faint}`, fontSize: 16 };
const day = ms => new Date(ms).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

function Pick({ label, options, value, show, onPick }) {
  return (
    <div role="group" aria-label={label} style={{ display: "grid", gap: 6 }}>
      <div style={{ color: T.mist, fontSize: 14 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map(o => (
          <button key={o} type="button" className="ws-btn" aria-pressed={o === value} onClick={() => onPick(o)}
            style={{ padding: "7px 14px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `2px solid ${o === value ? T.amber : "rgb(var(--ws-fg) / .14)"}`, background: o === value ? T.amber : "transparent", color: o === value ? T.ink : T.mist }}>
            {show(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HomeTask({ cls, onBack, onChange }) {
  const [data, setData] = useState(null);   // { task, results }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState(() => (cls.homeTask ? cls.homeTask.settings : { size: 4, minLen: 3, seconds: 120 }));

  const load = async () => {
    setError("");
    try {
      const res = await authFetch(`/api/classes/${cls.id}/home-task`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setError("The home game didn't load. Check your connection and try again."); }
  };
  useEffect(() => { load(); }, [cls.id]); // eslint-disable-line

  const task = data && data.task;
  const set = async () => {
    if (task && !window.confirm("Make a new board? Everyone will need to play the new one, even students who've finished this one.")) return;
    setBusy(true); setError("");
    const res = await authFetch(`/api/classes/${cls.id}/home-task`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(board) }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return setError("The home game wasn't set. Check your connection and try again.");
    const body = await res.json();
    setData(body);
    onChange(body.task);
  };
  const off = async () => {
    if (!window.confirm("Switch off the home game? Students go straight to choosing their own boards. The rounds they've played stay on the Progress page.")) return;
    setBusy(true); setError("");
    const res = await authFetch(`/api/classes/${cls.id}/home-task`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return setError("The home game wasn't switched off. Check your connection and try again.");
    setData({ task: null, results: {} });
    onChange(null);
  };

  const students = [...cls.students].sort(byName);
  const results = (data && data.results) || {};
  const done = students.filter(s => results[s.id]).length;
  const size = task ? task.settings.size : 0;

  return (
    <div className="ws-fade" style={{ display: "grid", gap: 18, width: "min(720px, 94vw)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 32 }}>Home game <span style={{ color: T.mist, fontWeight: 500, fontSize: 20 }}>· {cls.name}</span></h1>
        <button className="ws-btn" onClick={onBack} style={btn}>← My classes</button>
      </div>
      <p style={{ margin: 0, color: T.mist, fontSize: 16.5, lineHeight: 1.5 }}>
        Set one board for the whole class to play at home. Everyone gets the same letters, so you can compare how each student did.
        Students play it once before they can choose their own boards, and it stays until you change it or switch it off.
      </p>
      {cls.homePlay === false && (
        <div role="status" style={{ ...card, borderColor: "rgb(var(--ws-amber-rgb) / .5)", background: "rgb(var(--ws-amber-rgb) / .1)" }}>
          Playing at home is switched off for this class, so students won't see this game. Turn on "Students can play at home" in Edit.
        </div>
      )}
      {error && <div role="alert" style={{ color: T.red }}>{error} <button className="ws-btn" onClick={load} style={{ ...btn, marginLeft: 8 }}>Try again</button></div>}
      {!data && !error && <div style={{ color: T.mist }}>Loading…</div>}

      {data && task && (
        <section style={{ ...card, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div aria-label="The board" style={{ display: "grid", gridTemplateColumns: `repeat(${size}, 30px)`, gap: 4, background: T.well, padding: 8, borderRadius: 10 }}>
              {task.tiles.map((t, i) => <div key={i} className="ws-display" style={{ width: 30, height: 30, borderRadius: 5, background: T.dice, color: T.letter, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: t.length > 1 ? 12 : 16 }}>{t[0] + t.slice(1).toLowerCase()}</div>)}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div className="ws-display" style={{ fontSize: 22, fontWeight: 700 }}>{boardLine(task.settings)}</div>
              <div style={{ color: T.mist, fontSize: 15 }}>Set {day(task.setAt)}</div>
              <div className="ws-display" style={{ fontSize: 20, marginTop: 6 }}><b style={{ color: T.amber }}>{done}</b> of {students.length} students have played it</div>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Name</th><th style={th}>Played</th><th style={th}>Words</th><th style={th}>Of the board</th><th style={th}>Score</th></tr></thead>
              <tbody>
                {students.map(s => {
                  const r = results[s.id];
                  return (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{s.name}</td>
                      {r ? <>
                        <td style={td}>{day(r.at)}</td>
                        <td style={td}>{r.words}{r.of ? ` of ${r.of}` : ""}</td>
                        <td style={td}>{r.of ? `${Math.round((r.words / r.of) * 100)}%` : "—"}</td>
                        <td style={td}>{r.score}</td>
                      </> : <td style={{ ...td, color: T.mist }} colSpan={4}>Not yet</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 13.5, color: T.mist }}>Each student's first go. They see the answers afterwards, so replays aren't counted here. Every round is also on the Progress page, marked as home games.</div>
        </section>
      )}

      {data && (
        <section style={{ ...card, display: "grid", gap: 14 }}>
          <div className="ws-display" style={{ fontSize: 20, fontWeight: 700 }}>{task ? "Make a new board" : "Set a home game"}</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Pick label="Board size" options={HOME_SIZES} value={board.size} show={n => `${n}×${n}`} onPick={size => setBoard(b => ({ ...b, size }))} />
            <Pick label="Shortest word" options={HOME_LENGTHS} value={board.minLen} show={n => `${n} letters`} onPick={minLen => setBoard(b => ({ ...b, minLen }))} />
            <Pick label="Time" options={HOME_TIMES} value={board.seconds} show={s => `${s / 60} min`} onPick={seconds => setBoard(b => ({ ...b, seconds }))} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button className="ws-btn ws-display" onClick={set} disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>{busy ? "Shaking…" : task ? "Shake a new board" : "Set this game"}</button>
            {task && <button className="ws-btn" onClick={off} disabled={busy} style={{ ...btn, color: T.red }}>Switch off</button>}
          </div>
        </section>
      )}
    </div>
  );
}
