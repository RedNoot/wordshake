import { useEffect, useState } from "react";
import { T } from "./theme.js";
import { Board } from "./components/Board.jsx";
import { wordPoints } from "../shared/scoring.js";

/*
 * The big screen's end of round, in four beats: the opener ("Time's up!" beside the class's total drumming up),
 * the celebration (what the class did together), the round's stars (top scores, longest word and new personal bests,
 * by name) and the highlights (the whole board on one screen). The word lists, sound and longest-word steps follow.
 */

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Counts from 0 up to target (null: not known yet, shows 0).
export function useCountUp(target, ms = 1800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) { setV(0); return; }
    if (reducedMotion()) { setV(target); return; }
    let raf;
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* ---- 1. The opener: "Time's up!" on one half, the class's total drumming up on the other ---- */
export function Opener({ live, found, total }) {
  const target = live ? found : total;
  const n = useCountUp(target, 2000);
  return (
    <div style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", borderRadius: 24, overflow: "hidden" }}>
      <div style={{ flex: "0 0 50%", background: T.red, color: T.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, boxSizing: "border-box", textAlign: "center", animation: "ws-pop .45s ease both" }}>
        <div className="ws-display" style={{ fontSize: "min(9vw, 130px)", fontWeight: 700, lineHeight: 1, transform: "rotate(-3deg)" }}>{live ? "Time's up!" : "Pens down!"}</div>
        <div style={{ fontSize: "min(2.4vw, 24px)", fontWeight: 700, maxWidth: 440 }}>{live ? "Devices down." : "Swap books with a partner."}</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, textAlign: "center" }}>
        <div className="ws-display" aria-live="polite" style={{ fontSize: "min(17vw, 250px)", fontWeight: 700, lineHeight: 1, color: live ? T.green : T.amber, fontVariantNumeric: "tabular-nums" }}>
          {target == null ? <span style={{ animation: "ws-pulse 1s ease infinite", display: "inline-block" }}>…</span> : n}
        </div>
        <div style={{ fontSize: "min(2.8vw, 30px)", color: T.mist }}>
          {live ? (target == null ? "adding up the class's words" : target === 1 ? "word found together" : "words found together") : "words hiding in this grid"}
        </div>
      </div>
    </div>
  );
}

/* ---- 2. The celebration: the class's total as the headline, then the class's counters ---- */
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 4.6 + 2) % 100, dx: `${((i * 37) % 21) - 10}vw`, rot: `${360 + ((i * 53) % 400)}deg`,
  delay: `${(i % 7) * 0.18}s`, colour: ["var(--ws-amber)", "var(--ws-green)", "var(--ws-red)", "var(--ws-bar)", "var(--ws-amber-soft)"][i % 5],
}));

function Counter({ n, label, colour, delay }) {
  const v = useCountUp(n, 1200);
  return (
    <div style={{ flex: "1 1 180px", borderRadius: 20, background: "rgb(var(--ws-fg) / .05)", border: `1px solid ${T.faint}`, padding: "18px 14px", textAlign: "center", animation: `ws-fade .6s ${delay}s ease both` }}>
      <div className="ws-display" style={{ fontSize: "min(6vw, 7vh, 68px)", fontWeight: 700, lineHeight: 1.05, color: colour, fontVariantNumeric: "tabular-nums" }}>{n == null ? "…" : v}</div>
      <div style={{ fontSize: "min(2vw, 19px)", color: T.mist }}>{label}</div>
    </div>
  );
}

export function Celebrate({ className, found, total, coopLine, counters, onNext, nextLabel = "See the board →" }) {
  const pct = found != null && total ? Math.round((found / total) * 100) : null;
  return (
    <div style={{ position: "relative", width: "100%", flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "min(3vh, 26px)", padding: "10px 4vw", boxSizing: "border-box", borderRadius: 24, background: "radial-gradient(ellipse at 50% 30%, rgb(var(--ws-fg) / .07) 0%, transparent 65%)" }}>
      {CONFETTI.map((c, i) => (
        <i key={i} aria-hidden="true" style={{ position: "absolute", top: 0, left: `${c.left}%`, width: 14, height: 22, borderRadius: 3, background: c.colour, "--dx": c.dx, "--rot": c.rot, animation: `ws-confetti 3.4s ${c.delay} linear both`, pointerEvents: "none" }} />
      ))}
      <div style={{ fontSize: "min(2.6vw, 26px)", color: T.mist }}>{className ? `Time's up, ${className}` : "Time's up!"}</div>
      <h2 className="ws-display" style={{ margin: 0, textAlign: "center", fontSize: "min(6vw, 7vh, 72px)", fontWeight: 700, lineHeight: 1.08 }}>
        {found == null ? <>Great work, everyone!</> : (
          <>Together you found<br /><span style={{ display: "inline-block", color: T.amber, fontSize: "min(12vw, 15vh, 140px)", animation: "ws-pop .6s ease both" }}>{found}</span> different {found === 1 ? "word" : "words"}</>
        )}
      </h2>
      {pct != null && (
        <p style={{ margin: 0, fontSize: "min(2.2vw, 22px)", color: T.mist, textAlign: "center", animation: "ws-fade .6s .3s ease both" }}>
          That's {pct}% of the {total} words hiding in this board.
        </p>
      )}
      {coopLine && <p role="status" className="ws-display" style={{ margin: 0, fontSize: "min(3vw, 30px)", fontWeight: 700, color: T.green, animation: "ws-slap .8s .6s ease both" }}>{coopLine}</p>}
      {counters.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, width: "min(1100px, 100%)", justifyContent: "center" }}>
          {counters.map((c, i) => <Counter key={c.label} {...c} delay={0.6 + i * 0.2} />)}
        </div>
      )}
      <button className="ws-btn ws-display" onClick={onNext} style={{ fontSize: 22, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 14, padding: "14px 30px", cursor: "pointer", boxShadow: "0 5px 0 var(--ws-amber-edge)", animation: "ws-fade .6s 1.4s ease both" }}>
        {nextLabel}
      </button>
    </div>
  );
}

/* ---- 3. The round's stars: a podium for the top scores, the longest word found, and a line for each new personal best ---- */
const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM = [2, 1, 3];                                  // second on the left, first in the middle, third on the right
const STEP_HEIGHT = { 1: "62%", 2: "46%", 3: "34%" };
const BEST_MS = 2600;                                      // each personal best stays up this long before the next

// Cycles through the names one at a time (all at once when motion is reduced); nothing until the names arrive.
function BestLine({ names }) {
  const [i, setI] = useState(0);
  const still = reducedMotion();
  useEffect(() => {
    setI(0);
    if (!names || names.length < 2 || still) return;
    const t = setInterval(() => setI(v => (v + 1) % names.length), BEST_MS);
    return () => clearInterval(t);
  }, [names, still]);
  if (!names || !names.length) return null;
  const text = still || names.length === 1 ? names.join(", ") : names[i];
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 14, background: "rgb(var(--ws-amber-rgb) / .12)", border: "1px solid rgb(var(--ws-amber-rgb) / .5)", borderRadius: 999, padding: "min(12px, 1.4vh) 28px", animation: "ws-fade .6s ease both" }}>
      <span aria-hidden="true" style={{ fontSize: "min(4vh, 34px)" }}>🌟</span>
      <span style={{ fontSize: "min(2.8vh, 24px)", color: T.mist }}>New personal {still && names.length > 1 ? "bests" : "best"}:</span>
      <span key={text} className="ws-display" style={{ fontSize: "min(4.6vh, 42px)", fontWeight: 700, color: T.amber, display: "inline-block", animation: "ws-pop .5s ease both" }}>{text}!</span>
      {!still && names.length > 1 && <span style={{ fontSize: "min(2.2vh, 17px)", color: T.mist }}>{i + 1} of {names.length}</span>}
    </div>
  );
}

export function Stars({ standouts, bestNames, minLen, onNext }) {
  const { top, longest } = standouts;
  const byPlace = p => top.filter(r => r.place === p);
  const words = [...new Set(longest.map(l => l.word))];
  const len = words.length ? words[0].length : 0;
  const pts = len ? wordPoints(len, minLen) : 0;
  return (
    <div style={{ position: "relative", width: "100%", flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "min(3vh, 26px)", padding: "6px 3vw", boxSizing: "border-box", borderRadius: 24, background: "radial-gradient(ellipse at 50% 20%, rgb(var(--ws-amber-rgb) / .09) 0%, transparent 60%)" }}>
      {CONFETTI.map((c, i) => (
        <i key={i} aria-hidden="true" style={{ position: "absolute", top: 0, left: `${c.left}%`, width: 14, height: 22, borderRadius: 3, background: c.colour, "--dx": c.dx, "--rot": c.rot, animation: `ws-confetti 3.4s ${c.delay} linear both`, pointerEvents: "none" }} />
      ))}
      <h2 className="ws-display" style={{ margin: 0, fontSize: "min(6vw, 7vh, 64px)", fontWeight: 700, lineHeight: 1 }}>This round's <span style={{ color: T.amber }}>stars</span></h2>

      <div style={{ flex: 1, minHeight: 0, maxHeight: 440, width: "min(1200px, 100%)", display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: "min(3vw, 32px)" }}>
        <section aria-label="Top scores" style={{ ...panel, padding: "min(2vh, 18px) 20px 0", gap: 8 }}>
          <p style={label}>Top scores</p>
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, alignItems: "end" }}>
            {PODIUM.map((p, col) => {
              const rows = byPlace(p);
              return (
                <div key={p} style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {rows.length > 0 && (
                    <div style={{ textAlign: "center", minWidth: 0, maxWidth: "100%", animation: `ws-pop .6s ${1.2 - col * 0.4 + (p === 1 ? 0.8 : 0)}s ease both` }}>
                      {rows.map(r => (
                        <div key={r.name} className="ws-display" style={{ fontSize: rows.length > 1 ? "min(2.4vw, 3.4vh, 26px)" : "min(3.2vw, 4.6vh, 38px)", fontWeight: 700, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                      ))}
                      <div style={{ fontSize: "min(2vh, 17px)", color: T.mist }}>{rows[0].score} {rows[0].score === 1 ? "point" : "points"}</div>
                    </div>
                  )}
                  <div style={{ width: "100%", height: rows.length ? STEP_HEIGHT[p] : "18%", minHeight: 40, borderRadius: "14px 14px 0 0", background: rows.length ? (p === 1 ? T.amber : p === 2 ? "var(--ws-bar)" : "var(--ws-amber-soft)") : "rgb(var(--ws-fg) / .06)", display: "flex", justifyContent: "center", paddingTop: 8, boxSizing: "border-box", transformOrigin: "bottom", animation: `ws-fade .6s ${0.2 + col * 0.15}s ease both` }}>
                    <span aria-label={`place ${p}`} style={{ fontSize: "min(5vh, 46px)", lineHeight: 1 }}>{rows.length ? MEDALS[p - 1] : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-label="Longest word" style={{ ...panel, justifyContent: "center", alignItems: "center", textAlign: "center", animation: "ws-fade .6s 1.6s ease both" }}>
          <p style={{ ...label, alignSelf: "flex-start" }}>Longest word found</p>
          {words.length === 0 ? <div style={{ color: T.mist }}>—</div> : (
            <>
              {words.map(w => (
                <div key={w} className="ws-display" style={{ fontSize: words.length > 1 ? "min(3.4vw, 4.6vh, 44px)" : "min(5vw, 7.5vh, 68px)", fontWeight: 700, color: T.amber, letterSpacing: 2, lineHeight: 1.05, wordBreak: "break-word", animation: "ws-slap .8s 1.9s ease both" }}>{w.toUpperCase()}</div>
              ))}
              <div style={{ fontSize: "min(2vh, 17px)", color: T.mist }}>{len} letters · {pts} {pts === 1 ? "point" : "points"}</div>
              <div style={{ fontSize: "min(2.8vh, 24px)", fontWeight: 600, lineHeight: 1.3 }}>
                found by {longest.map(l => l.name).join(", ").replace(/, ([^,]*)$/, " and $1")}
              </div>
            </>
          )}
        </section>
      </div>

      <div style={{ minHeight: "min(7vh, 60px)", display: "flex", alignItems: "center" }}><BestLine names={bestNames} /></div>

      <button className="ws-btn ws-display" onClick={onNext} style={{ fontSize: 22, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 14, padding: "min(14px, 1.6vh) 30px", cursor: "pointer", boxShadow: "0 5px 0 var(--ws-amber-edge)", animation: "ws-fade .6s 2.2s ease both" }}>
        See the board →
      </button>
    </div>
  );
}

/* ---- 4. The highlights: the board's words, the longest word, and the class's totals, on one screen ---- */
const panel = { border: `1px solid ${T.faint}`, background: "rgb(var(--ws-fg) / .04)", borderRadius: 18, padding: "18px 20px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
const label = { margin: 0, fontSize: 14, letterSpacing: 1.6, textTransform: "uppercase", color: T.mist };

export function Highlights({ game, size, live, found, soundDef, minLen, targetSet, stats, buttons }) {
  const S = game.solution, PH = S.phonics;
  const foundSet = found ? new Set(found) : null;
  const most = Math.max(...S.lens.map(L => S.byLen[L].length));
  const longest = S.longest[0];
  const gotIt = longest && foundSet && foundSet.has(longest.word);
  const pts = wordPoints(S.maxLen, minLen);
  return (
    <div style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, overflowY: "auto" }}>
        <section style={panel}>
          <p style={label}>{soundDef ? "Sounds-Write words in this grid" : "Hiding in this grid"}</p>
          <div className="ws-display" style={{ fontSize: "min(7vw, 76px)", fontWeight: 700, color: T.amber, lineHeight: 1 }}>{S.total} <span style={{ fontSize: "0.4em", color: "var(--ws-text)" }}>{S.total === 1 ? "word" : "words"}</span></div>
          <p style={{ margin: 0, color: T.mist, fontSize: 17 }}>
            {foundSet ? <>The class found <b style={{ color: T.green }}>{foundSet.size}</b> of them between you</> : live ? "Adding up the class's words…" : "How many did you find?"}
            {PH ? <> · <b style={{ color: T.amber }}>{PH.count}</b> with today's sound {soundDef && soundDef.lab}</> : null}
          </p>
          <div style={{ display: "grid", gap: 9, marginTop: 4 }}>
            {S.lens.map(L => {
              const all = S.byLen[L].length, got = foundSet ? S.byLen[L].filter(w => foundSet.has(w)).length : null;
              return (
                <div key={L} style={{ display: "grid", gridTemplateColumns: "84px 1fr 64px", gap: 10, alignItems: "center", fontSize: 15, color: T.mist }}>
                  {L} letters
                  <div style={{ position: "relative", height: 16, borderRadius: 999, background: "rgb(var(--ws-fg) / .08)", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${(all / most) * 100}%`, borderRadius: 999, background: L === S.maxLen ? T.amber : "var(--ws-bar)", opacity: got == null ? 1 : 0.45, transformOrigin: "left", animation: "ws-grow .9s ease both" }} />
                    {got != null && <div style={{ position: "absolute", inset: 0, width: `${(got / most) * 100}%`, borderRadius: 999, background: T.green, transformOrigin: "left", animation: "ws-grow .9s .4s ease both" }} />}
                  </div>
                  <b style={{ color: "var(--ws-text)", textAlign: "right" }}>{got != null ? `${got} / ${all}` : all}</b>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ ...panel, alignItems: "center" }}>
          <p style={{ ...label, alignSelf: "flex-start" }}>{live && !gotIt ? "The one that got away" : "The longest word"}</p>
          <Board tiles={game.tiles} rots={game.rots} size={size} dim="min(26vw, 34vh)" path={longest && longest.path} pathKey="hl" targetSet={targetSet} />
          <div className="ws-display" style={{ fontSize: "min(4.4vw, 46px)", fontWeight: 700, color: T.amber, letterSpacing: 2, lineHeight: 1.1, textAlign: "center", wordBreak: "break-word" }}>{longest ? longest.word.toUpperCase() : "—"}</div>
          <p style={{ margin: "-6px 0 0", color: gotIt ? T.green : T.mist, fontSize: 16, textAlign: "center" }}>
            {S.maxLen} letters · {pts} {pts === 1 ? "point" : "points"} · {gotIt ? "found by the class!" : live ? (foundSet ? "nobody found it" : "did anyone find it?") : "did anyone find it?"}
          </p>
        </section>

        <section style={panel}>
          <p style={label}>{stats.title}</p>
          {stats.rows.map(([n, text]) => (
            <div key={text} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 0", borderTop: `1px solid ${T.faint}` }}>
              <b className="ws-display" style={{ fontSize: "min(3.4vw, 36px)", color: T.amber, minWidth: 56, fontVariantNumeric: "tabular-nums" }}>{n == null ? "…" : n}</b>
              <span style={{ fontSize: 18 }}>{text}</span>
            </div>
          ))}
          {stats.note && <p style={{ margin: "auto 0 0", fontSize: 15, color: stats.noteColour || T.mist }}>{stats.note}</p>}
        </section>
      </div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>{buttons}</div>
    </div>
  );
}
