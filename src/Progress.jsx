import { useEffect, useMemo, useState } from "react";
import { T } from "./theme.js";
import { authFetch } from "./auth.js";
import { SOUND_BY_ID } from "./sounds.js";
import { TrophyGrid, StickerBook } from "./Trophies.jsx";
import { TROPHIES, AWARD_PRESETS, AWARD_LABEL_MAX, stickerPages, tierOf } from "../shared/rewards.js";
import { ITEM_BY_ID, balanceOf } from "../shared/shop.js";

/*
 * Teacher-only progress for one class, built from the rounds saved at the end of each class-list game.
 * Everything is listed by name, never ranked: this screen is often the one on the projector.
 */
const btn = { background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 15 };
const card = { background: "rgb(var(--ws-fg) / .04)", border: `1px solid ${T.faint}`, borderRadius: 14, padding: "14px 16px" };
const th = { textAlign: "left", fontWeight: 600, color: T.mist, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, padding: "8px 10px", borderBottom: `1px solid ${T.faint}`, whiteSpace: "nowrap" };
const td = { padding: "10px", borderBottom: `1px solid ${T.faint}`, fontSize: 16, verticalAlign: "top" };
const rowBtn = { cursor: "pointer" };
// Class games and home games are told apart by colour and always by a label too (projectors and colour-blind eyes).
const HOME = "#6FB2F2";
const kindOf = g => (g.home ? (g.task ? ["Teacher's home game", HOME] : ["Home", HOME]) : ["Class", T.green]);
function Where({ g }) {
  const [label, colour] = kindOf(g);
  return <span style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: colour, border: `1.5px solid ${colour}`, borderRadius: 999, padding: "1px 9px", whiteSpace: "nowrap" }}>{label}</span>;
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
const when = ms => ms ? new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "just now";
const day = ms => ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
const soundName = id => (id && SOUND_BY_ID[id] ? `${SOUND_BY_ID[id].lab} as in ${SOUND_BY_ID[id].eg}` : "All words");
const avg = xs => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const UP = w => w.toUpperCase();
const pct = x => `${Math.round(x * 100)}%`;
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const DAY = 86400000;

/*
 * How a student is doing, against their own earlier rounds only. The measure is the share of each board's words they
 * found, so a 3×3 one-minute round and a 5×5 five-minute round compare fairly.
 *   below:  the last two rounds both under 80% of their usual (the 5 rounds before those)
 *   up:     the last three rounds average over 120% of the 5 before them
 *   lately: nothing in the 14 days before the class's latest round
 */
const shareOf = r => (r.game.boardWords ? r.p.words.length / r.game.boardWords : null);
function trendOf(s, lastAt) {
  const xs = s.rounds.map(shareOf).filter(x => x != null), n = xs.length;
  const lastPlayed = s.rounds.length ? s.rounds[s.rounds.length - 1].game.endedAt : null;
  const out = { latest: n ? xs[n - 1] : null, usual: null, recent: null, lastPlayed };
  if (!s.current) return { ...out, kind: "gone" };
  if (!s.rounds.length) return { ...out, kind: "none" };
  if (lastAt - lastPlayed > 14 * DAY) return { ...out, kind: "lately" };
  if (n < 5) return { ...out, kind: "new" };
  const usual = mean(xs.slice(-7, -2));
  if (usual > 0 && xs[n - 1] < usual * 0.8 && xs[n - 2] < usual * 0.8) return { ...out, usual, kind: "below" };
  if (n >= 6) {
    const before = mean(xs.slice(-8, -3)), recent = mean(xs.slice(-3));
    if (before > 0 && recent > before * 1.2) return { ...out, usual: before, recent, kind: "up" };
  }
  return { ...out, usual, kind: "steady" };
}
const TAGS = {
  up: ["Going up", T.green], steady: ["Steady", T.mist], new: ["Just started", T.mist],
  below: ["Below their usual", T.amber], lately: ["Not played lately", T.amberSoft], none: ["Not played yet", T.amberSoft],
  gone: ["No longer in class", T.mist],
};
const FLAGGED = new Set(["below", "lately", "none"]);

// True on a screen too narrow for the name list beside a student's page.
function useNarrow(q = "(max-width: 820px)") {
  const get = () => { try { return window.matchMedia(q).matches; } catch { return false; } };
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    try {
      const m = window.matchMedia(q), on = () => setNarrow(m.matches);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    } catch { return undefined; }
  }, [q]);
  return narrow;
}

// A small bar per round, oldest on the left.
function Trend({ points, height = 34, width = 150, colour = T.amber, label = "Scores", fmt = v => v }) {
  if (!points.length) return <span style={{ color: T.mist }}>—</span>;
  const pts = points.slice(-12), max = Math.max(1, ...pts.map(p => p.v)), w = Math.min(width / pts.length, height / 2);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMax meet" style={{ maxWidth: "100%", height: "auto", display: "block" }} role="img" aria-label={`${label}, oldest to newest: ${pts.map(p => fmt(p.v)).join(", ")}`}>
      {pts.map((p, i) => {
        const h = Math.max(2, (p.v / max) * (height - 2));
        return <rect key={i} x={i * w + 1} y={height - h} width={Math.max(2, w - 3)} height={h} rx="2" style={{ fill: p.home ? HOME : colour }} opacity={0.45 + 0.55 * ((i + 1) / pts.length)}><title>{`${day(p.t)}${p.home ? " (home)" : ""}: ${fmt(p.v)}`}</title></rect>;
      })}
    </svg>
  );
}
const sharePoints = rounds => rounds.filter(r => shareOf(r) != null).map(r => ({ v: Math.round(shareOf(r) * 100), t: r.game.endedAt, home: !!r.game.home }));

// A section of a student's page that folds away, with a one-line summary beside its title (as in the settings drawer).
function Fold({ title, note, open: startOpen = false, children }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <section style={{ ...card, padding: 0 }}>
      <h3 style={{ margin: 0 }}>
        <button className="ws-btn ws-display" aria-expanded={open} onClick={() => setOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, padding: "10px 16px", background: "none", border: "none", color: "var(--ws-text)", fontSize: 19, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={open ? T.amber : T.mist} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flex: "none", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span style={{ flex: "none" }}>{title}</span>
          {note != null && <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--ws-font-body)", fontWeight: 400, fontSize: 15, color: T.mist }}>· {note}</span>}
        </button>
      </h3>
      {open && <div className="ws-fade" style={{ display: "grid", gap: 12, padding: "0 16px 16px" }}>{children}</div>}
    </section>
  );
}

function StudentCard({ s, trend, rewards, onOpen }) {
  const [label, colour] = TAGS[trend.kind], flag = FLAGGED.has(trend.kind);
  return (
    <button className="ws-btn" onClick={onOpen}
      style={{ ...card, border: `2px solid ${flag ? "rgb(var(--ws-amber-rgb) / .55)" : T.faint}`, display: "grid", gap: 10, alignContent: "start", textAlign: "left", cursor: "pointer", color: "var(--ws-text)", fontFamily: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span className="ws-display" style={{ fontSize: 21, fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }}>{s.name}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: colour, textAlign: "right" }}>{label}</span>
      </div>
      <div style={{ height: 34 }}><Trend points={sharePoints(s.rounds).slice(-8)} width={140} colour={T.green} label="Share of the board found" fmt={v => `${v}%`} /></div>
      <div style={{ fontSize: 15 }}>
        {trend.latest == null ? <span style={{ color: T.mist }}>No rounds yet</span>
          : <><b className="ws-display" style={{ fontSize: 20, color: T.amber }}>{pct(trend.latest)}</b> of the board last round <span style={{ color: T.mist }}>· {plural(s.rounds.length, "round")}</span></>}
      </div>
      <div style={{ fontSize: 14, color: T.mist, minHeight: 18 }}>{rewards}</div>
    </button>
  );
}

function Bar({ found, available }) {
  const pct = available ? Math.min(100, (found / available) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 10, borderRadius: 999, background: "rgb(var(--ws-fg) / .08)", overflow: "hidden", minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: T.green }} />
      </div>
      <span style={{ fontSize: 14, color: T.mist, whiteSpace: "nowrap" }}>{found} of {available}</span>
    </div>
  );
}

export function Progress({ classes, onDone }) {
  const [classId, setClassId] = useState(classes && classes.length ? classes[0].id : null);
  const [data, setData] = useState(null);       // { class, games, summaries, limit }
  const [error, setError] = useState("");
  const [view, setView] = useState("students");  // students | rounds
  const [studentId, setStudentId] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [find, setFind] = useState("");
  const [where, setWhere] = useState("all");     // all | class | home
  const narrow = useNarrow();
  // The rounds the page is about: everything below (students, trends, the rounds list) is built from these.
  const games = useMemo(() => (data ? data.games.filter(g => where === "all" || (where === "home") === !!g.home) : []), [data, where]);

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
    for (const g of [...games].reverse()) {
      for (const [sid, p] of Object.entries(g.players || {})) {
        if (!map.has(sid)) map.set(sid, { id: sid, name: p.name, current: false, rounds: [] });
        map.get(sid).rounds.push({ game: g, p });
      }
    }
    return [...map.values()].sort(byName);
  }, [data, games]);

  const removeGame = async g => {
    if (!window.confirm(`Delete the round from ${when(g.endedAt)}? It will disappear from the round history and charts. Trophies and stickers already earned are kept. This can't be undone.`)) return;
    const res = await authFetch(`/api/classes/${classId}/games/${g.id}${g.home ? "?home=1" : ""}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) return setError("That round wasn't deleted. Check your connection and try again.");
    setGameId(null);
    setData(d => ({ ...d, games: d.games.filter(x => x.id !== g.id) }));
  };

  const summaryOf = sid => (data && data.summaries && data.summaries[sid]) || null;
  const trophyCount = sid => Object.keys((summaryOf(sid) || {}).trophies || {}).length;
  const awardCount = sid => ((summaryOf(sid) || {}).awards || []).length;

  // Teacher awards: kept beside the student's game rewards and shown in their trophy cabinet.
  const setAwards = (sid, fn) => setData(d => {
    const cur = (d.summaries && d.summaries[sid]) || {};
    return { ...d, summaries: { ...d.summaries, [sid]: { ...cur, awards: fn(cur.awards || []) } } };
  });
  const giveAward = async (sid, payload) => {
    const res = await authFetch(`/api/classes/${classId}/students/${sid}/awards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setError(body.error === "too-many-awards" ? "That student has the most awards they can hold. Remove an old one first." : "The award wasn't given. Check your connection and try again.");
      return false;
    }
    setError("");
    setAwards(sid, a => [...a, body.award]);
    return true;
  };
  const removeAward = async (sid, award) => {
    if (!window.confirm(`Take away "${award.label}"?`)) return;
    const res = await authFetch(`/api/classes/${classId}/students/${sid}/awards/${award.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) return setError("The award wasn't removed. Check your connection and try again.");
    setAwards(sid, a => a.filter(x => x.id !== award.id));
  };

  const student = studentId && students.find(s => s.id === studentId);
  const game = gameId && data && data.games.find(g => g.id === gameId);

  const trends = useMemo(() => {
    const lastAt = games.length ? games[0].endedAt : 0;   // games come newest first
    return Object.fromEntries(students.map(s => [s.id, trendOf(s, lastAt)]));
  }, [students, games]);
  const weekAgo = Date.now() - 7 * DAY;
  const FILTERS = [
    ["all", "Everyone", () => true],
    ["below", "Below their usual", s => trends[s.id].kind === "below"],
    ["lately", "Not played lately", s => trends[s.id].kind === "lately" || trends[s.id].kind === "none"],
    ["trophy", "New trophy this week", s => Object.values((summaryOf(s.id) || {}).trophies || {}).some(t => t >= weekAgo)],
    ["noaward", "No award from you yet", s => s.current && !awardCount(s.id)],
  ];
  const test = (FILTERS.find(f => f[0] === filter) || FILTERS[0])[2];
  const shown = students.filter(s => test(s) && (!find.trim() || s.name.toLowerCase().includes(find.trim().toLowerCase())));
  const rewardsOf = sid => {
    const t = trophyCount(sid), a = awardCount(sid);
    return [t && `${t} ${t === 1 ? "trophy" : "trophies"}`, a && plural(a, "award")].filter(Boolean).join(" · ");
  };
  const chip = on => ({ padding: "7px 14px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `2px solid ${on ? T.amber : "rgb(var(--ws-fg) / .14)"}`, background: on ? T.amber : "transparent", color: on ? T.ink : T.mist });

  return (
    <main style={{ flex: 1, minWidth: 0, padding: "16px 24px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ width: "min(1200px, 96vw)", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 className="ws-display" style={{ margin: 0, fontSize: 34 }}>Progress{data && <span style={{ color: T.mist, fontWeight: 500, fontSize: 20 }}> · {data.class.name}</span>}</h1>
          <button className="ws-btn" onClick={onDone} style={btn}>← Back</button>
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
                    style={{ padding: "7px 14px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `2px solid ${c.id === classId ? T.amber : "rgb(var(--ws-fg) / .14)"}`, background: c.id === classId ? T.amber : "transparent", color: c.id === classId ? T.ink : T.mist }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {error && <div role="alert" style={{ ...card, borderColor: "rgb(var(--ws-red-rgb) / .45)", background: "rgb(var(--ws-red-rgb) / .1)" }}>{error} <button className="ws-btn" onClick={() => load(classId)} style={{ ...btn, marginLeft: 8 }}>Try again</button></div>}
            {!data && !error && <div style={{ color: T.mist }}>Loading…</div>}

            {data && !data.games.length && (
              <div style={card}>No rounds saved for {data.class.name} yet. A round is saved when you open a room with this class and it reaches the answers (the timer runs out, or you press End round now). Rounds students play at home are saved too. Guests aren't saved.</div>
            )}

            {data && data.games.length > 0 && !game && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} role="group" aria-label="Which games">
                {[["all", "All games", data.games.length], ["class", "Class games", data.games.filter(g => !g.home).length], ["home", "Home games", data.games.filter(g => g.home).length]].map(([k, label, n]) => (
                  <button key={k} className="ws-btn" aria-pressed={where === k} onClick={() => setWhere(k)} style={chip(where === k)}>{label} {n}</button>
                ))}
                <span style={{ fontSize: 13.5, color: T.mist, display: "flex", gap: 12, marginLeft: 6 }}>
                  <span><span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: T.green, marginRight: 5 }} />Class</span>
                  <span><span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: HOME, marginRight: 5 }} />Home</span>
                </span>
              </div>
            )}

            {data && data.games.length > 0 && !games.length && !student && !game && (
              <div style={card}>No {where === "home" ? "home" : "class"} games saved for {data.class.name} yet.</div>
            )}

            {data && games.length > 0 && !student && !game && (
              <>
                <div style={{ display: "flex", gap: 8 }} role="tablist">
                  {[["students", `Students (${students.length})`], ["rounds", `Rounds (${games.length})`]].map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={view === k} className="ws-btn ws-display" onClick={() => setView(k)}
                      style={{ fontSize: 17, fontWeight: 600, padding: "8px 18px", borderRadius: 10, cursor: "pointer", border: "none", background: view === k ? "rgb(var(--ws-fg) / .14)" : "transparent", color: view === k ? "var(--ws-text)" : T.mist }}>
                      {label}
                    </button>
                  ))}
                </div>
                {data.games.filter(g => !g.home).length >= data.limit && where !== "home" && <div style={{ fontSize: 14, color: T.mist }}>Showing the most recent {data.limit} class rounds.</div>}
                {data.games.filter(g => g.home).length >= data.limit && where !== "class" && <div style={{ fontSize: 14, color: T.mist }}>Showing the most recent {data.limit} home rounds.</div>}

                {view === "students" && (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div role="group" aria-label="Show" style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                        {FILTERS.map(([k, label, f]) => (
                          <button key={k} className="ws-btn" aria-pressed={filter === k} onClick={() => setFilter(k)} style={chip(filter === k)}>
                            {label} {students.filter(f).length}
                          </button>
                        ))}
                      </div>
                      <input value={find} onChange={e => setFind(e.target.value)} placeholder="Find a name" aria-label="Find a name"
                        style={{ width: 180, background: "rgb(var(--ws-fg) / .06)", border: `1px solid ${T.faint}`, borderRadius: 10, color: "var(--ws-text)", fontSize: 15, padding: "8px 12px" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
                      {shown.map(s => <StudentCard key={s.id} s={s} trend={trends[s.id]} rewards={rewardsOf(s.id)} onOpen={() => setStudentId(s.id)} />)}
                    </div>
                    {!shown.length && <div style={{ color: T.mist }}>Nobody here right now.</div>}
                    <div style={{ fontSize: 14, color: T.mist }}>The bars show the share of each board's words found in the last 8 rounds, so a 3×3 round and a 5×5 round compare fairly: green for class games, blue for home games. Each student is only compared with their own past. An orange edge means worth a look.</div>
                  </>
                )}

                {view === "rounds" && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr><th style={th}>When</th><th style={th}>Where</th><th style={th}>Sound</th><th style={th}>Board</th><th style={th}>Students</th><th style={th}>Avg score</th><th style={th}>Words on board</th></tr></thead>
                      <tbody>
                        {games.map(g => {
                          const ps = Object.values(g.players || {});
                          return (
                            <tr key={g.id} onClick={() => setGameId(g.id)} style={rowBtn}>
                              <td style={td}><button className="ws-btn" onClick={() => setGameId(g.id)} style={{ background: "none", border: "none", color: "var(--ws-text)", fontSize: 16, fontWeight: 700, padding: 0, cursor: "pointer", textAlign: "left" }}>{when(g.endedAt)}</button></td>
                              <td style={td}><Where g={g} /></td>
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

            {student && (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                {!narrow && <nav aria-label="Students" style={{ ...card, flex: "0 0 250px", padding: 6, display: "grid", gap: 2 }}>
                  {students.map(s => {
                    const t = trends[s.id], on = s.id === studentId;
                    const dot = t.kind === "below" ? T.amber : FLAGGED.has(t.kind) || t.kind === "gone" ? "rgb(var(--ws-fg) / .25)" : T.green;
                    return (
                      <button key={s.id} className="ws-btn" aria-current={on ? "true" : undefined} onClick={() => setStudentId(s.id)} title={TAGS[t.kind][0]}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, border: "none", background: on ? "rgb(var(--ws-fg) / .12)" : "transparent", color: "var(--ws-text)", fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: dot, flex: "none" }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                        <span style={{ fontSize: 14, color: T.mist, fontWeight: 400 }}>{t.latest == null ? "—" : pct(t.latest)}</span>
                      </button>
                    );
                  })}
                  <div style={{ fontSize: 13, color: T.mist, padding: "8px 10px 4px" }}>Orange: below their usual. Grey: not played lately.</div>
                </nav>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <StudentDetail key={student.id} s={student} trend={trends[student.id]} summary={summaryOf(student.id)} onGive={p => giveAward(student.id, p)} onRemove={a => removeAward(student.id, a)} onBack={() => setStudentId(null)} onRound={id => { setStudentId(null); setGameId(id); }} />
                </div>
              </div>
            )}
            {game && <RoundDetail g={game} students={students} onBack={() => setGameId(null)} onDelete={() => removeGame(game)} onStudent={id => { setGameId(null); setStudentId(id); }} />}
          </>
        )}
      </div>
    </main>
  );
}

// One student's shop stars and what they've got with them. Only ever in this one-student view, never the class
// table: stars aren't for comparing.
function Wallet({ summary }) {
  const stars = (summary && summary.stars) || 0, owned = Object.keys((summary && summary.owned) || {});
  const items = owned.map(id => ITEM_BY_ID[id]).filter(Boolean);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="ws-display" style={{ fontSize: 20, fontWeight: 700 }}>
        ⭐ {balanceOf(summary)} to spend <span style={{ color: T.mist, fontWeight: 500, fontSize: 16 }}>· {stars} earned</span>
      </div>
      {items.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map(i => (
            <span key={i.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgb(var(--ws-fg) / .06)", borderRadius: 999, padding: "4px 12px", fontSize: 15 }}>
              <span aria-hidden="true">{i.emoji}</span>{i.name}
            </span>
          ))}
        </div>
      ) : <div style={{ color: T.mist, fontSize: 15 }}>Nothing from the shop yet. Every round played earns stars to spend there.</div>}
    </div>
  );
}

function stickerNote(tiers) {
  if (!tiers.length) return "none yet";
  const silver = tiers.filter(t => t === 2).length, gold = tiers.filter(t => t === 3).length;
  return plural(tiers.length, "sticker") + (silver || gold ? ` (${[gold && `${gold} gold`, silver && `${silver} silver`].filter(Boolean).join(", ")})` : "");
}

// The sentence at the top of a student's page, when there's something worth saying. Only ever against their own past.
function trendLine(name, t) {
  if (t.kind === "below") return `${name} found ${pct(t.latest)} of the board last round. Their usual is ${pct(t.usual)}, and it's dipped two rounds running.`;
  if (t.kind === "up") return `${name} is finding more of the board: ${pct(t.recent)} over the last 3 rounds, up from ${pct(t.usual)} before that.`;
  if (t.kind === "lately") return `No rounds since ${day(t.lastPlayed)}. Away, or joining as a guest?`;
  if (t.kind === "none") return `${name} hasn't played a round with this class yet.`;
  return null;
}

function StudentDetail({ s, trend, summary, onGive, onRemove, onBack, onRound }) {
  const rounds = s.rounds;   // oldest first
  const allWords = rounds.flatMap(r => r.p.words);
  const longest = allWords.reduce((best, w) => (w.length > best.length ? w : best), "");
  const shares = rounds.map(shareOf).filter(x => x != null);
  const perMin = rounds.filter(r => r.game.settings.seconds).map(r => r.p.words.length / (r.game.settings.seconds / 60));
  const tiers = Object.values(stickerPages(summary && summary.stickers, summary && summary.spotted)).flatMap(pg => Object.values(pg).map(tierOf));
  const trophies = Object.keys((summary && summary.trophies) || {}).length;
  const awards = (summary && summary.awards) || [];
  const line = trendLine(s.name, trend);

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
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <button className="ws-btn" onClick={onBack} style={btn}>← All students</button>
        <h2 className="ws-display" style={{ margin: 0, fontSize: 32 }}>{s.name}</h2>
        {!s.current && <span style={{ color: T.mist }}>no longer in class</span>}
      </div>

      {line && <div style={{ ...card, borderColor: trend.kind === "up" ? "rgb(var(--ws-green-rgb) / .45)" : "rgb(var(--ws-amber-rgb) / .4)", background: trend.kind === "up" ? "rgb(var(--ws-green-rgb) / .08)" : "rgb(var(--ws-amber-rgb) / .08)", fontSize: 16 }}>{line}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          ["Of the board", shares.length ? pct(mean(shares)) : "—", shares.length ? `average over ${plural(rounds.length, "round")}` : "no rounds yet"],
          ["Words a minute", perMin.length ? avg(perMin) : "—", perMin.length ? `best ${avg([Math.max(...perMin)])}` : ""],
          ["Longest word", longest ? UP(longest) : "—", longest ? `${longest.length} letters` : ""],
          ["Different words", new Set(allWords).size, "found in these rounds"],
        ].map(([k, v, sub]) => (
          <div key={k} style={card}>
            <div style={{ color: T.mist, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
            <div className="ws-display" style={{ fontSize: 28, fontWeight: 700, color: T.amber, wordBreak: "break-word" }}>{v}</div>
            {sub && <div style={{ color: T.mist, fontSize: 13 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {shares.length > 0 && (
        <Fold title="Each round" open>
          <Trend points={sharePoints(rounds)} height={80} width={Math.min(560, 46 * Math.min(12, shares.length))} colour={T.green} label="Share of the board found" fmt={v => `${v}%`} />
          <div style={{ fontSize: 13, color: T.mist }}>The share of the board's words found in each of the last 12 rounds, oldest on the left: green for class games, blue for home games. Hover a bar for its date.</div>
        </Fold>
      )}

      <Fold title="Trophies" note={`${trophies} of ${TROPHIES.length}`}>
        <TrophyGrid trophies={summary && summary.trophies} compact />
      </Fold>

      <Fold title="Sticker book" note={stickerNote(tiers)}>
        <StickerBook stickers={summary && summary.stickers} spotted={summary && summary.spotted} compact />
        <div style={{ fontSize: 13, color: T.mist }}>In Sounds-Write rounds every spelling found counts. A spelling's sticker comes with the first word found and turns silver at 5 words with today's sound (or 25 found any other time) and gold at 15 (or 75). This is what {s.name} sees on their device.</div>
      </Fold>

      <Fold title="Sounds practised" note={sounds.length ? sounds.map(snd => (SOUND_BY_ID[snd.id] ? SOUND_BY_ID[snd.id].lab : snd.id)).join(", ") : "none yet"}>
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
      </Fold>

      {s.current && (
        <Fold title="Awards from you" note={awards.length ? plural(awards.length, "award") : "none yet"}>
          <Awards name={s.name} awards={awards} onGive={onGive} onRemove={onRemove} />
        </Fold>
      )}

      <Fold title="Shop and stars" note={`${balanceOf(summary)} to spend`}>
        <Wallet summary={summary} />
      </Fold>

      {rounds.length > 0 && <Fold title="Every round and its words" note={rounds.length}>
        {[...rounds].reverse().map(({ game, p }) => (
          <div key={game.id} style={{ ...card, display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <button className="ws-btn" onClick={() => onRound(game.id)} style={{ background: "none", border: "none", color: "var(--ws-text)", fontWeight: 700, fontSize: 16, padding: 0, cursor: "pointer" }}>{when(game.endedAt)} · {soundName(game.settings.phSound)}</button>
                <Where g={game} />
              </span>
              <span><b style={{ color: T.amber }}>{p.score}</b> pts · {plural(p.words.length, "word")}</span>
            </div>
            <div style={{ fontSize: 15, color: p.words.length ? "var(--ws-text)" : T.mist }}>{p.words.length ? p.words.map(UP).join(", ") : "No words this round"}</div>
          </div>
        ))}
      </Fold>}
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
          <Where g={g} />
        </div>
        <button className="ws-btn" onClick={onDelete} style={{ ...btn, color: T.red }}>Delete this round</button>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div aria-label="The board" style={{ display: "grid", gridTemplateColumns: `repeat(${size}, 30px)`, gap: 4, background: T.well, padding: 8, borderRadius: 10 }}>
          {(g.tiles || []).map((t, i) => <div key={i} className="ws-display" style={{ width: 30, height: 30, borderRadius: 5, background: T.dice, color: T.letter, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: t.length > 1 ? 12 : 16 }}>{t[0] + t.slice(1).toLowerCase()}</div>)}
        </div>
        <div style={{ display: "grid", gap: 4, fontSize: 15, color: T.mist }}>
          <div><b style={{ color: "var(--ws-text)" }}>{soundName(g.settings.phSound)}</b>{g.settings.phBonus ? " · +2 bonus on" : ""}</div>
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
                <td style={td}><button className="ws-btn" onClick={() => onStudent(r.sid)} style={{ background: "none", border: "none", color: "var(--ws-text)", fontSize: 16, fontWeight: 700, padding: 0, cursor: "pointer", textAlign: "left" }}>{r.name}</button></td>
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

function Awards({ name, awards, onGive, onRemove }) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const give = async payload => {
    setBusy(true);
    const ok = await onGive(payload);
    setBusy(false);
    if (ok && payload.preset === "custom") setCustom("");
  };
  const chip = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "6px 12px", fontSize: 15, fontWeight: 600 };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {awards.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[...awards].reverse().map(a => (
            <span key={a.id} style={{ ...chip, background: "rgb(var(--ws-green-rgb) / .14)", border: "1px solid rgb(var(--ws-green-rgb) / .45)" }}>
              <span aria-hidden="true">{a.emoji}</span>{a.label}
              <span style={{ color: T.mist, fontWeight: 400, fontSize: 13 }}>{day(a.at)}</span>
              <button className="ws-btn" onClick={() => onRemove(a)} aria-label={`Remove ${a.label}`} title="Remove" style={{ background: "none", border: "none", color: T.mist, cursor: "pointer", fontSize: 15, padding: "0 2px" }}>✕</button>
            </span>
          ))}
        </div>
      ) : <div style={{ color: T.mist, fontSize: 15 }}>None yet. Awards are for things the game can't see, and {name} will find them in their trophy cabinet.</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {AWARD_PRESETS.map(p => (
          <button key={p.id} className="ws-btn" disabled={busy} onClick={() => give({ preset: p.id })}
            style={{ ...chip, cursor: busy ? "default" : "pointer", background: "rgb(var(--ws-fg) / .06)", border: `1px solid ${T.faint}`, color: "var(--ws-text)" }}>
            <span aria-hidden="true">{p.emoji}</span>{p.label}
          </button>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); if (custom.trim()) give({ preset: "custom", label: custom }); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={custom} onChange={e => setCustom(e.target.value)} maxLength={AWARD_LABEL_MAX} placeholder="Or write your own…" aria-label="Your own award"
          style={{ flex: "1 1 220px", background: "rgb(var(--ws-fg) / .06)", border: `1px solid ${T.faint}`, borderRadius: 10, color: "var(--ws-text)", fontSize: 15, padding: "8px 12px" }} />
        <button type="submit" className="ws-btn" disabled={busy || !custom.trim()} style={{ ...btn, color: custom.trim() ? T.ink : T.mist, background: custom.trim() ? T.amber : "none", fontWeight: 700 }}>Give 🏅</button>
      </form>
    </div>
  );
}
