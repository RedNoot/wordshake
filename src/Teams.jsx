import { T } from "./theme.js";
import { TEAMS } from "../shared/teams.js";

export const teamName = t => `${TEAMS[t].emoji} ${TEAMS[t].name}`;

// "You're in the 🦊 Foxes": a pill in the team's colour.
export function TeamBadge({ team, size = 18, label = "" }) {
  if (team == null || !TEAMS[team]) return null;
  const t = TEAMS[team];
  return (
    <span className="ws-display" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: t.colour, color: "#fff", borderRadius: 999, padding: `${size * 0.25}px ${size * 0.8}px`, fontSize: size, fontWeight: 700, textShadow: "0 1px 0 rgba(0,0,0,.25)", whiteSpace: "nowrap" }}>
      <span aria-hidden="true">{t.emoji}</span>{label}{t.name}
    </span>
  );
}

export const winnerLine = result => {
  const w = result.winners;
  if (!w.length) return "No team scored this time!";
  if (w.length === 1) return `${teamName(w[0])} win!`;
  if (w.length > 2 && w.length === result.teams.filter(r => r.players).length) return "It's a draw: every team tied!";
  const names = w.map(teamName);
  return `It's a draw: ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}!`;
};

// Every team's score as a bar, biggest first, with the winners crowned. Team totals only, never who scored what.
export function TeamResults({ result, mine = null, big = false }) {
  const rows = result.teams.filter(r => r.players).sort((a, b) => b.score - a.score || a.team - b.team);
  const top = Math.max(1, ...rows.map(r => r.score));
  const won = new Set(result.winners);
  return (
    <div style={{ display: "grid", gap: big ? 14 : 10, width: "100%" }}>
      {rows.map((r, i) => {
        const t = TEAMS[r.team], isMine = r.team === mine;
        return (
          <div key={r.team} style={{ display: "grid", gridTemplateColumns: big ? "minmax(170px, auto) 1fr auto" : "auto 1fr auto", alignItems: "center", gap: big ? 18 : 10, animation: `ws-fade .5s ${0.15 * i}s ease both`,
            background: isMine ? "rgb(var(--ws-fg) / .07)" : "none", borderRadius: 14, padding: isMine ? (big ? "6px 10px" : "4px 8px") : 0, outline: isMine ? `2px solid ${t.colour}` : "none" }}>
            <div className="ws-display" style={{ fontSize: big ? 32 : 19, fontWeight: 700, textAlign: "left", whiteSpace: "nowrap" }}>
              {won.has(r.team) && <span aria-label="winner">🏆 </span>}{t.emoji} {t.name}
              {isMine && <span style={{ fontSize: "0.6em", color: T.mist, fontWeight: 500 }}> · your team</span>}
            </div>
            <div style={{ height: big ? 34 : 18, background: "rgb(var(--ws-fg) / .08)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(r.score / top) * 100}%`, minWidth: r.score ? 10 : 0, background: t.colour, borderRadius: 999, transformOrigin: "left", animation: `ws-grow .9s ${0.15 * i + 0.2}s cubic-bezier(.2,.8,.3,1) both` }} />
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <span className="ws-display" style={{ fontSize: big ? 34 : 20, fontWeight: 700, color: won.has(r.team) ? T.amber : "var(--ws-text)" }}>{r.score}</span>
              <span style={{ color: T.mist, fontSize: big ? 17 : 13 }}> pts{big ? ` · ${r.words} words · ${r.players} ${r.players === 1 ? "player" : "players"}` : ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
