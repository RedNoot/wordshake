import { useEffect, useMemo, useState } from "react";
import { T } from "./theme.js";
import { authFetch } from "./auth.js";
import { SOUND_BY_ID } from "./sounds.js";

/*
 * Teacher-only progress for one class, built from the rounds saved at the end of each class-list game.
 * Everything is listed by name, never ranked: this screen is often the one on the projector.
 */
const btn = { background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 15 };
const card = { background: "rgba(255,255,255,.04)", border: `1px solid ${T.faint}`, borderRadius: 14, padding: "14px 16px" };
const th = { textAlign: "left", fontWeight: 600, color: T.mist, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, padding: "8px 10px", borderBottom: `1px solid ${T.faint}`, whiteSpace: "nowrap" };
const td = { padding: "10px", borderBottom: `1px solid ${T.faint}`, fontSize: 16, verticalAlign: "top" };
const rowBtn = { cursor: "pointer" };

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
const when = ms => ms ? new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "just now";
const day = ms => ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
const soundName = id => (id && SOUND_BY_ID[id] ? `${SOUND_BY_ID[id].lab} as in ${SOUND_BY_ID[id].eg}` : "All words");
const avg = xs => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const UP = w => w.toUpperCase();

// A small bar per round, oldest on the left.
function Trend({ points, height = 34, width = 150 }) {
  if (!points.length) return <span style={{ color: T.mist }}>—</span>;
  const pts = points.slice(-12), max = Math.max(1, ...pts.map(p => p.v)), w = Math.min(width / pts.length, height / 2);
  return (
    <svg width={width} height={height} role="img" aria-label={`Scores, oldest to newest: ${pts.map(p => p.v).join(", ")}`}>
      {pts.map((p, i) => {
        const h = Math.max(2, (p.v / max) * (height - 2));
        return <rect key={i} x={i * w + 1} y={height - h} width={Math.max(2, w - 3)} height={h} rx="2" fill={T.amber} opacity={0.45 + 0.55 * ((i + 1) / pts.length)}><title>{`${day(p.t)}: ${p.v}`}</title></rect>;
      })}
    </svg>
  );
}

function Bar({ found, available }) {
  const pct = available ? Math.min(100, (found / available) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 10, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden", minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: T.green }} />
      </div>
      <span style={{ fontSize: 14, color: T.mist, whiteSpace: "nowrap" }}>{found} of {available}</span>
    </div>
  );
}

export function Progress({ classes, onDone }) {
  const [classId, setClassId] = useState(classes && classes.length ? classes[0].id : null);
  const [data, setData] = useState(null);       // { class, games, limit }
  const [error, setError] = useState("");
  const [view, setView] = useState("students");  // students | rounds
  const [studentId, setStudentId] = useState(null);
  const [gameId, setGameId] = useState(null);

  const load = async id => {
    setData(null); setError(""); setStudentId(null); setGameId(null);
    try {
      const res = await authFetch(`/api/classes/${id}/games`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body);
    } catch {
      setError("Progress didn't load. Check your connection and try again.");
    }
  };
  useEffect(() => { if (classId) load(classId); }, [classId]); // eslint-disable-line

  // Everyone who is on the list now, plus anyone with saved rounds who has since been removed.
  const students = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.class.students.map(s => [s.id, { id: s.id, name: s.name, current: true, rounds: [] }]));
    for (const g of [...data.games].reverse()) {
      for (const [sid, p] of Object.entries(g.players || {})) {
        if (!map.has(sid)) map.set(sid, { id: sid, name: p.name, current: false, rounds: [] });
        map.get(sid).rounds.push({ game: g, p });
      }
    }
    return [...map.values()].sort(byName);
  }, [data]);

  const removeGame = async g => {
    if (!window.confirm(`Delete the round from ${when(g.endedAt)}? It will disappear from every student's progress. This can't be undone.`)) return;
    const res = await authFetch(`/api/classes/${classId}/games/${g.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) return setError("That round wasn't deleted. Check your connection and try again.");
    setGameId(null);
    setData(d => ({ ...d, games: d.games.filter(x => x.id !== g.id) }));
  };

  const student = studentId && students.find(s => s.id === studentId);
  const game = gameId && data && data.games.find(g => g.id === gameId);

  return (
    <main style={{ flex: 1, padding: "16px 24px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ width: "min(1000px, 96vw)", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 className="ws-display" style={{ margin: 0, fontSize: 34 }}>Progress</h1>
          <button className="ws-btn" onClick={onDone} style={btn}>← Back to settings</button>
        </div>
        <div style={{ fontSize: 14, color: T.mist }}>🔒 Only you can see this. It shows student names and scores, so check it isn't on the projector.</div>

        {!classes || !classes.length ? (
          <div style={card}>Progress is saved for games played with a class list. Add a class in <b>My classes</b>, open a room with it, and each finished round will appear here.</div>
        ) : (
          <>
            {classes.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Class">
                {classes.map(c => (
                  <button key={c.id} className="ws-btn" onClick={() => setClassId(c.id)} aria-pressed={c.id === classId}
                    style={{ padding: "7px 14px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `2px solid ${c.id === classId ? T.amber : "rgba(255,255,255,.14)"}`, background: c.id === classId ? T.amber : "transparent", color: c.id === classId ? T.ink : T.mist }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {error && <div role="alert" style={{ ...card, borderColor: "rgba(255,93,93,.45)", background: "rgba(255,93,93,.1)" }}>{error} <button className="ws-btn" onClick={() => load(classId)} style={{ ...btn, marginLeft: 8 }}>Try again</button></div>}
            {!data && !error && <div style={{ color: T.mist }}>Loading…</div>}

            {data && !data.games.length && (
              <div style={card}>No rounds saved for {data.class.name} yet. A round is saved when you open a room with this class and it reaches the answers (the timer runs out, or you press End round now). Guests aren't saved.</div>
            )}

            {data && data.games.length > 0 && !student && !game && (
              <>
                <div style={{ display: "flex", gap: 8 }} role="tablist">
                  {[["students", `Students (${students.length})`], ["rounds", `Rounds (${data.games.length})`]].map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={view === k} className="ws-btn ws-display" onClick={() => setView(k)}
                      style={{ fontSize: 17, fontWeight: 600, padding: "8px 18px", borderRadius: 10, cursor: "pointer", border: "none", background: view === k ? "rgba(255,255,255,.14)" : "transparent", color: view === k ? "#EFF4F9" : T.mist }}>
                      {label}
                    </button>
                  ))}
                </div>
                {data.games.length >= data.limit && <div style={{ fontSize: 14, color: T.mist }}>Showing the most recent {data.limit} rounds.</div>}

                {view === "students" && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr><th style={th}>Name</th><th style={th}>Rounds</th><th style={th}>Avg score</th><th style={th}>Avg words</th><th style={th}>Recent scores</th></tr></thead>
                      <tbody>
                        {students.map(s => (
                          <tr key={s.id} onClick={() => s.rounds.length && setStudentId(s.id)} style={s.rounds.length ? rowBtn : undefined}>
                            <td style={td}>
                              {s.rounds.length ? <button className="ws-btn" onClick={() => setStudentId(s.id)} style={{ background: "none", border: "none", color: "#EFF4F9", fontSize: 16, fontWeight: 700, padding: 0, cursor: "pointer", textAlign: "left" }}>{s.name}</button> : <span style={{ fontWeight: 700 }}>{s.name}</span>}
                              {!s.current && <span style={{ color: T.mist, fontSize: 13 }}> · no longer in class</span>}
                            </td>
                            <td style={td}>{s.rounds.length || <span style={{ color: T.mist }}>not played yet</span>}</td>
                            <td style={td}>{s.rounds.length ? avg(s.rounds.map(r => r.p.score)) : ""}</td>
                            <td style={td}>{s.rounds.length ? avg(s.rounds.map(r => r.p.words.length)) : ""}</td>
                            <td style={td}><Trend points={s.rounds.map(r => ({ v: r.p.score, t: r.game.endedAt }))} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {view === "rounds" && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr><th style={th}>When</th><th style={th}>Sound</th><th style={th}>Board</th><th style={th}>Students</th><th style={th}>Avg score</th><th style={th}>Words on board</th></tr></thead>
                      <tbody>
                        {data.games.map(g => {
                          const ps = Object.values(g.players || {});
                          return (
                            <tr key={g.id} onClick={() => setGameId(g.id)} style={rowBtn}>
                              <td style={td}><button className="ws-btn" onClick={() => setGameId(g.id)} style={{ background: "none", border: "none", color: "#EFF4F9", fontSize: 16, fontWeight: 700, padding: 0, cursor: "pointer", textAlign: "left" }}>{when(g.endedAt)}</button></td>
                              <td style={td}>{soundName(g.settings.phSound)}</td>
                              <td style={td}>{g.settings.size}×{g.settings.size} · {g.settings.seconds / 60} min</td>
                              <td style={td}>{ps.length}</td>
                              <td style={td}>{avg(ps.map(p => p.score))}</td>
                              <td style={td}>{g.boardWords}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {student && <StudentDetail s={student} onBack={() => setStudentId(null)} onRound={id => { setStudentId(null); setGameId(id); }} />}
            {game && <RoundDetail g={game} students={students} onBack={() => setGameId(null)} onDelete={() => removeGame(game)} onStudent={id => { setGameId(null); setStudentId(id); }} />}
          </>
        )}
      </div>
    </main>
  );
}

function StudentDetail({ s, onBack, onRound }) {
  const rounds = s.rounds;   // oldest first
  const allWords = rounds.flatMap(r => r.p.words);
  const longest = allWords.reduce((best, w) => (w.length > best.length ? w : best), "");

  // Per sound: across the rounds this student played, how many words of each spelling they found vs. what the boards held.
  const sounds = useMemo(() => {
    const out = new Map();
    for (const { game, p } of rounds) {
      const id = game.settings.phSound;
      if (!id) continue;
      if (!out.has(id)) out.set(id, { id, rounds: 0, sp: new Map() });
      const o = out.get(id);
      o.rounds++;
      for (const [g, available] of Object.entries(game.available || {})) {
        if (!o.sp.has(g)) o.sp.set(g, { g, found: 0, available: 0, words: new Set() });
        const x = o.sp.get(g), words = (p.bySpelling || {})[g] || [];
        x.available += available;
        x.found += words.length;
        words.forEach(w => x.words.add(w));
      }
    }
    return [...out.values()];
  }, [rounds]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <button className="ws-btn" onClick={onBack} style={btn}>← All students</button>
        <h2 className="ws-display" style={{ margin: 0, fontSize: 30 }}>{s.name}</h2>
        {!s.current && <span style={{ color: T.mist }}>no longer in class</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {[["Rounds played", rounds.length], ["Average score", avg(rounds.map(r => r.p.score))], ["Average words", avg(rounds.map(r => r.p.words.length))], ["Longest word", longest ? UP(longest) : "—"]].map(([k, v]) => (
          <div key={k} style={card}><div style={{ color: T.mist, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>{k}</div><div className="ws-display" style={{ fontSize: 28, fontWeight: 700, color: T.amber, wordBreak: "break-word" }}>{v}</div></div>
        ))}
      </div>

      <div style={card}>
        <div style={{ color: T.mist, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Score each round (oldest → newest)</div>
        <Trend points={rounds.map(r => ({ v: r.p.score, t: r.game.endedAt }))} height={70} width={Math.min(560, 46 * Math.min(12, rounds.length))} />
      </div>

      <section style={{ display: "grid", gap: 12 }}>
        <h3 className="ws-display" style={{ margin: 0, fontSize: 22 }}>Sounds practised</h3>
        {!sounds.length && <div style={{ color: T.mist }}>No Sounds-Write rounds yet. Pick a sound in the settings and its spellings are tracked here.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {sounds.map(snd => (
            <div key={snd.id} style={card}>
              <div className="ws-display" style={{ fontSize: 20, fontWeight: 700 }}><span style={{ color: T.amber }}>{SOUND_BY_ID[snd.id] ? SOUND_BY_ID[snd.id].lab : snd.id}</span> <span style={{ color: T.mist, fontWeight: 500, fontSize: 15 }}>· {plural(snd.rounds, "round")}</span></div>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {[...snd.sp.values()].map(x => (
                  <div key={x.g}>
                    <div style={{ display: "grid", gridTemplateColumns: "54px 1fr", alignItems: "center", gap: 10 }}>
                      <b className="ws-display" style={{ fontSize: 18, color: T.amber }}>{x.g}</b>
                      <Bar found={x.found} available={x.available} />
                    </div>
                    {x.words.size > 0 && <div style={{ marginLeft: 64, fontSize: 14, color: T.mist, marginTop: 3 }}>{[...x.words].map(UP).join(", ")}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {sounds.length > 0 && <div style={{ fontSize: 13, color: T.mist }}>"3 of 7" means the boards in those rounds held 7 words with that spelling and {s.name} found 3.</div>}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 className="ws-display" style={{ margin: 0, fontSize: 22 }}>Rounds</h3>
        {[...rounds].reverse().map(({ game, p }) => (
          <div key={game.id} style={{ ...card, display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <button className="ws-btn" onClick={() => onRound(game.id)} style={{ background: "none", border: "none", color: "#EFF4F9", fontWeight: 700, fontSize: 16, padding: 0, cursor: "pointer" }}>{when(game.endedAt)} · {soundName(game.settings.phSound)}</button>
              <span><b style={{ color: T.amber }}>{p.score}</b> pts · {plural(p.words.length, "word")}</span>
            </div>
            <div style={{ fontSize: 15, color: p.words.length ? "#EFF4F9" : T.mist }}>{p.words.length ? p.words.map(UP).join(", ") : "No words this round"}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

function RoundDetail({ g, students, onBack, onDelete, onStudent }) {
  const rows = Object.entries(g.players || {}).map(([sid, p]) => {
    const now = students.find(s => s.id === sid);
    return { sid, ...p, name: now ? now.name : p.name };
  }).sort(byName);
  const spellings = Object.keys(g.available || {});
  const size = g.settings.size;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <button className="ws-btn" onClick={onBack} style={btn}>← All rounds</button>
          <h2 className="ws-display" style={{ margin: 0, fontSize: 28 }}>{when(g.endedAt)}</h2>
        </div>
        <button className="ws-btn" onClick={onDelete} style={{ ...btn, color: T.red }}>Delete this round</button>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div aria-label="The board" style={{ display: "grid", gridTemplateColumns: `repeat(${size}, 30px)`, gap: 4, background: T.well, padding: 8, borderRadius: 10 }}>
          {(g.tiles || []).map((t, i) => <div key={i} className="ws-display" style={{ width: 30, height: 30, borderRadius: 5, background: T.dice, color: T.letter, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: t.length > 1 ? 12 : 16 }}>{t[0] + t.slice(1).toLowerCase()}</div>)}
        </div>
        <div style={{ display: "grid", gap: 4, fontSize: 15, color: T.mist }}>
          <div><b style={{ color: "#EFF4F9" }}>{soundName(g.settings.phSound)}</b>{g.settings.phBonus ? " · +2 bonus on" : ""}</div>
          <div>{size}×{size} board · {g.settings.seconds / 60} min · words of {g.settings.minLen}+ letters</div>
          <div>{g.boardWords} words on the board{g.longest && g.longest.length ? ` · longest: ${g.longest.map(UP).join(", ")}` : ""}</div>
          {spellings.length > 0 && <div>On the board: {spellings.map(sp => `${sp} ×${g.available[sp]}`).join(" · ")}</div>}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Score</th><th style={th}>Words</th>{spellings.map(sp => <th key={sp} style={th}>{sp}</th>)}<th style={th}>Found</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.sid}>
                <td style={td}><button className="ws-btn" onClick={() => onStudent(r.sid)} style={{ background: "none", border: "none", color: "#EFF4F9", fontSize: 16, fontWeight: 700, padding: 0, cursor: "pointer", textAlign: "left" }}>{r.name}</button></td>
                <td style={td}>{r.score}</td>
                <td style={td}>{r.words.length}</td>
                {spellings.map(sp => <td key={sp} style={td}>{((r.bySpelling || {})[sp] || []).length} / {g.available[sp]}</td>)}
                <td style={{ ...td, fontSize: 14, color: T.mist, maxWidth: 380 }}>{r.words.length ? r.words.map(UP).join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
