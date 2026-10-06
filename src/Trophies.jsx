import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";
import { call } from "./net.js";
import { SOUND_BY_ID } from "./sounds.js";
import { TROPHIES, TROPHY_BY_ID, TIER_NAMES, tierOf, STICKER_TIERS } from "../shared/rewards.js";

const TIER_STYLE = [
  { bg: "rgb(var(--ws-fg) / .05)", fg: "rgb(var(--ws-fg) / .35)", border: "1px dashed rgb(var(--ws-fg) / .25)" },
  { bg: "var(--ws-sticker)", fg: "#fff", border: "none" },                   // sticker
  { bg: "linear-gradient(135deg,#E8EEF3,#A9B6C2)", fg: T.onLight, border: "none" },   // silver
  { bg: "linear-gradient(135deg,#FFE48A,#E3A21A)", fg: T.onLight, border: "none" },   // gold
];
const soundLab = id => (SOUND_BY_ID[id] ? SOUND_BY_ID[id].lab : id);

// What this round earned, shown on the student's own device under "Time's up!".
export function RoundRewards({ rewards }) {
  if (!rewards) return null;
  const items = [
    ...rewards.best.map(b => ({ key: "best-" + b, emoji: "⭐", title: b === "score" ? "New personal best score!" : "Most words you've ever found!", sub: "" })),
    ...rewards.trophies.map(id => TROPHY_BY_ID[id]).filter(Boolean).map(t => ({ key: t.id, emoji: t.emoji, title: `Trophy: ${t.name}`, sub: t.desc })),
    ...rewards.stickers.map(s => ({ key: `${s.sound}-${s.g}`, emoji: s.tier === 3 ? "🥇" : s.tier === 2 ? "🥈" : "🏷️", title: s.tier === 1 ? `New sticker: ${s.g}` : `${TIER_NAMES[s.tier][0].toUpperCase() + TIER_NAMES[s.tier].slice(1)} sticker: ${s.g}`, sub: `for the sound ${soundLab(s.sound)}` })),
  ];
  if (!items.length) return null;
  return (
    <section aria-label="What you earned" style={{ display: "grid", gap: 10, width: "min(92vw, 540px)" }}>
      {items.map((it, i) => (
        <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgb(var(--ws-amber-rgb) / .1)", border: "1px solid rgb(var(--ws-amber-rgb) / .4)", borderRadius: 14, padding: "10px 16px", textAlign: "left", animation: `ws-pop .4s ${0.15 * i}s ease both` }}>
          <span aria-hidden="true" style={{ fontSize: 34, width: 44, flex: "none", textAlign: "center" }}>{it.emoji}</span>
          <div>
            <div className="ws-display" style={{ fontSize: 21, fontWeight: 700 }}>{it.title}</div>
            {it.sub && <div style={{ color: T.mist, fontSize: 15 }}>{it.sub}</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

export function TrophyGrid({ trophies, compact = false }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 120 : 150}px, 1fr))`, gap: 10 }}>
      {TROPHIES.map(t => {
        const got = trophies && trophies[t.id];
        return (
          <div key={t.id} title={t.desc} style={{ borderRadius: 14, padding: compact ? "8px" : "12px 10px", textAlign: "center", background: got ? "rgb(var(--ws-amber-rgb) / .1)" : "rgb(var(--ws-fg) / .03)", border: `1px solid ${got ? "rgb(var(--ws-amber-rgb) / .45)" : "rgb(var(--ws-fg) / .08)"}` }}>
            <div aria-hidden="true" style={{ fontSize: compact ? 26 : 34, filter: got ? "none" : "grayscale(1)", opacity: got ? 1 : 0.3 }}>{t.emoji}</div>
            <div className="ws-display" style={{ fontWeight: 700, fontSize: compact ? 14 : 16, color: got ? "var(--ws-text)" : "rgb(var(--ws-fg) / .45)" }}>{t.name}</div>
            <div style={{ fontSize: compact ? 12 : 13, color: T.mist, opacity: got ? 1 : 0.7 }}>{got ? t.desc : `🔒 ${t.desc}`}</div>
          </div>
        );
      })}
    </div>
  );
}

// One page per sound the student has met: its usual spellings, lit up as stickers, silver and gold.
export function StickerBook({ stickers, compact = false }) {
  const sounds = Object.keys(stickers || {}).filter(id => Object.values(stickers[id]).some(n => n > 0));
  if (!sounds.length) return <div style={{ color: T.mist, fontSize: compact ? 14 : 17 }}>No stickers yet. Find words with today's sound to collect them!</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 220 : 260}px, 1fr))`, gap: 12 }}>
      {sounds.map(id => {
        const def = SOUND_BY_ID[id], page = stickers[id];
        const spellings = [...new Set([...(def ? def.sp.filter(s => s[2]).map(s => s[0]) : []), ...Object.keys(page)])];
        return (
          <div key={id} style={{ background: "rgb(var(--ws-fg) / .04)", border: "1px solid rgb(var(--ws-fg) / .08)", borderRadius: 14, padding: "10px 12px" }}>
            <div className="ws-display" style={{ fontSize: compact ? 17 : 20, fontWeight: 700 }}>
              <span style={{ color: T.amber }}>{soundLab(id)}</span>{def && <span style={{ color: T.mist, fontWeight: 500, fontSize: "0.75em" }}> as in {def.eg}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {spellings.map(g => {
                const n = page[g] || 0, tier = tierOf(n), st = TIER_STYLE[tier];
                const next = STICKER_TIERS[tier];
                return (
                  <div key={g} title={tier ? `${n} ${n === 1 ? "word" : "words"}${next ? ` · ${next - n} more for ${TIER_NAMES[tier + 1]}` : ""}` : "Not found yet"}
                    aria-label={tier ? `${g}: ${TIER_NAMES[tier]}, ${n} words` : `${g}: not found yet`}
                    className="ws-display" style={{ minWidth: compact ? 40 : 48, padding: compact ? "5px 8px" : "7px 10px", borderRadius: 10, background: st.bg, color: st.fg, border: st.border, fontWeight: 700, fontSize: compact ? 15 : 18, textAlign: "center" }}>
                    {g}
                    {!compact && tier > 0 && <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{TIER_NAMES[tier]}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The student's own cabinet, opened from the lobby while they wait.
// The last summary is shown straight away while a fresh one loads; the server allows one look every 2 seconds,
// so a quick close-and-reopen waits briefly and tries again instead of showing an error.
export function Cabinet({ name, cached, refresh, onLoaded, onClose }) {
  const [summary, setSummary] = useState(cached || null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);   // showing the last copy because a fresh one didn't load
  const shown = useRef(!!cached);
  useEffect(() => {
    let alive = true, timer = null;
    const load = retry => call("player:trophies").then(res => {
      if (!alive) return;
      if (res.ok) { shown.current = true; setSummary(res.summary); setError(""); setStale(false); if (onLoaded) onLoaded(res.summary); }
      else if (res.error === "slow-down" && retry) timer = setTimeout(() => load(false), 2100);
      else if (shown.current) setStale(true);
      else setError("Your trophies didn't load. Try again in a moment.");
    });
    load(true);
    return () => { alive = false; clearTimeout(timer); };
  }, [refresh]); // eslint-disable-line
  const count = summary ? Object.keys(summary.trophies || {}).length : 0;
  return (
    <div className="ws-fade" style={{ width: "100%", display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 32 }}>{name}'s trophies</h1>
        <button className="ws-btn ws-display" onClick={onClose} style={{ fontSize: 18, fontWeight: 600, background: "rgb(var(--ws-fg) / .1)", color: "var(--ws-text)", border: "none", borderRadius: 12, padding: "10px 18px", cursor: "pointer" }}>← Back</button>
      </div>
      {error && <div role="alert" style={{ color: T.red }}>{error}</div>}
      {stale && <div role="status" style={{ color: T.mist, fontSize: 15 }}>These might not be up to date. Close this and open it again in a moment.</div>}
      {!summary && !error && <div style={{ color: T.mist, fontSize: 20 }}>Opening the cabinet…</div>}
      {summary && (
        <>
          {summary.awards && summary.awards.length > 0 && (
            <section style={{ display: "grid", gap: 10 }}>
              <h2 className="ws-display" style={{ margin: 0, fontSize: 22 }}>From your teacher</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[...summary.awards].reverse().map(a => (
                  <div key={a.id} className="ws-display" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgb(var(--ws-green-rgb) / .14)", border: "1px solid rgb(var(--ws-green-rgb) / .45)", borderRadius: 999, padding: "8px 16px", fontSize: 19, fontWeight: 600 }}>
                    <span aria-hidden="true" style={{ fontSize: 24 }}>{a.emoji}</span>{a.label}
                  </div>
                ))}
              </div>
            </section>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[["Rounds played", summary.rounds], ["Words found", summary.words], ["Best score", summary.bestScore], ["Most words", summary.bestWords]].map(([k, v]) => (
              <div key={k} style={{ flex: "1 1 120px", background: "rgb(var(--ws-fg) / .05)", borderRadius: 14, padding: "10px 14px" }}>
                <div style={{ color: T.mist, fontSize: 14 }}>{k}</div>
                <div className="ws-display" style={{ fontSize: 30, fontWeight: 700, color: T.amber }}>{v}</div>
              </div>
            ))}
          </div>
          <section style={{ display: "grid", gap: 10 }}>
            <h2 className="ws-display" style={{ margin: 0, fontSize: 22 }}>Sound stickers</h2>
            <StickerBook stickers={summary.stickers} />
            <div style={{ color: T.mist, fontSize: 14 }}>Find a word with a spelling to get its sticker. 5 words makes it silver, 15 makes it gold.</div>
          </section>
          <section style={{ display: "grid", gap: 10 }}>
            <h2 className="ws-display" style={{ margin: 0, fontSize: 22 }}>Trophies <span style={{ color: T.mist, fontWeight: 500, fontSize: 17 }}>· {count} of {TROPHIES.length}</span></h2>
            <TrophyGrid trophies={summary.trophies} />
          </section>
        </>
      )}
    </div>
  );
}
