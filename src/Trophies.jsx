import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";
import { call } from "./net.js";
import { SOUND_BY_ID } from "./sounds.js";
import { TROPHIES, TROPHY_BY_ID, TIER_NAMES, tierOf, STICKER_TIERS } from "../shared/rewards.js";

const soundLab = id => (SOUND_BY_ID[id] ? SOUND_BY_ID[id].lab : id);
const cap = s => s[0].toUpperCase() + s.slice(1);
// A small, steady number from a string, so each sticker keeps the same tilt, shape and colour every time it's drawn.
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/* ---------- stickers ---------- */

// Plain stickers come in a colour per sound, like a real sticker sheet. Silver and gold are foil.
const STICKER_INKS = ["#3D7BD9", "#E5484D", "#2FA36B", "#8E5BD9", "#F08C00", "#0FA091", "#D6409F"];
const SHAPES = ["50%", "28%", "46% 54% 50% 50% / 54% 46% 54% 46%"];
const FOIL = {
  2: "linear-gradient(135deg,#F6F9FB 0%,#AEBBC7 38%,#EEF2F5 55%,#8E9BA8 100%)",
  3: "linear-gradient(135deg,#FFF3B8 0%,#E3A21A 40%,#FFE48A 56%,#B5760B 100%)",
};

// One sticker: a white die-cut edge, a tilt, a shadow, and a moving glint on silver and gold.
export function Sticker({ g, tier = 1, sound = "", size = 64, style }) {
  const h = hash(sound + g);
  const ink = STICKER_INKS[hash(sound) % STICKER_INKS.length];
  const fs = size * (g.length <= 2 ? 0.44 : g.length === 3 ? 0.34 : 0.27);
  return (
    <span aria-hidden="true" style={{
      position: "relative", display: "inline-grid", placeItems: "center", flex: "none", boxSizing: "border-box", fontFamily: "var(--ws-sticker-font)", whiteSpace: "nowrap", letterSpacing: "-0.02em",
      width: size, height: size, borderRadius: SHAPES[h % SHAPES.length], overflow: "hidden",
      transform: `rotate(${(h % 15) - 7}deg)`,
      background: tier >= 2 ? FOIL[tier] : `radial-gradient(circle at 30% 25%, rgba(255,255,255,.4), transparent 48%), ${ink}`,
      border: `${Math.max(3, Math.round(size * 0.07))}px solid #fff`,
      boxShadow: "0 1px 1px rgba(0,0,0,.2), 0 5px 10px rgba(0,0,0,.28)",
      color: tier >= 2 ? "#2B2620" : "#fff", textShadow: tier >= 2 ? "0 1px 0 rgba(255,255,255,.6)" : "0 2px 0 rgba(0,0,0,.22)",
      fontSize: fs, fontWeight: 800, lineHeight: 1, ...style,
    }}>
      {tier >= 2 && <span style={{ position: "absolute", top: -4, bottom: -4, left: 0, width: "45%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),transparent)", transform: "translateX(-160%) skewX(-20deg)", animation: `ws-shine 3.4s ${(h % 10) / 5}s ease-in-out infinite` }} />}
      <span style={{ position: "relative" }}>{g}</span>
      {tier === 3 && <span style={{ position: "absolute", top: "7%", right: "12%", fontSize: size * 0.17, color: "#8A5A00", textShadow: "none" }}>★</span>}
    </span>
  );
}

// The gap on the page where a sticker will go.
function StickerSpot({ g, size }) {
  return (
    <span aria-hidden="true" style={{
      display: "inline-grid", placeItems: "center", flex: "none", boxSizing: "border-box", width: size, height: size, borderRadius: "50%", fontFamily: "var(--ws-sticker-font)", whiteSpace: "nowrap",
      border: "2px dashed var(--ws-page-muted)", color: "var(--ws-page-muted)", opacity: 0.6,
      fontSize: size * (g.length <= 2 ? 0.38 : 0.28), fontWeight: 700,
    }}>{g}</span>
  );
}

// One page per sound the student has met: its usual spellings, as stickers stuck in or spaces still to fill.
export function StickerBook({ stickers, compact = false }) {
  const sounds = Object.keys(stickers || {}).filter(id => Object.values(stickers[id]).some(n => n > 0));
  if (!sounds.length) return <div style={{ color: T.mist, fontSize: compact ? 14 : 17 }}>No stickers yet. Find words with today's sound to collect them!</div>;
  const size = compact ? 46 : 64, bind = compact ? 16 : 22;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 230 : 280}px, 1fr))`, gap: compact ? 12 : 18 }}>
      {sounds.map((id, pi) => {
        const def = SOUND_BY_ID[id], page = stickers[id];
        const spellings = [...new Set([...(def ? def.sp.filter(s => s[2]).map(s => s[0]) : []), ...Object.keys(page)])];
        const got = spellings.filter(g => page[g] > 0).length;
        return (
          <article key={id} className="ws-page" aria-label={`Sticker page for ${soundLab(id)}`} style={{
            position: "relative", background: "var(--ws-page)", color: "var(--ws-on-light)", borderRadius: "4px 12px 12px 4px",
            backgroundImage: "repeating-linear-gradient(180deg, transparent 0 29px, rgba(70,110,160,.14) 29px 30px)",
            padding: compact ? `10px 12px 14px ${bind + 14}px` : `14px 16px 18px ${bind + 20}px`,
            boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 8px 18px rgba(0,0,0,.25)",
            animation: compact ? "none" : `ws-turn .5s ${0.08 * pi}s ease both`,
          }}>
            {/* the spiral binding and the margin line */}
            <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: bind, background: `radial-gradient(circle at 50% 50%, var(--ws-binding) 0 ${compact ? 3 : 4}px, transparent ${compact ? 4 : 5}px) 0 0 / 100% ${compact ? 18 : 22}px repeat-y` }} />
            <span aria-hidden="true" style={{ position: "absolute", left: bind + (compact ? 6 : 9), top: 0, bottom: 0, width: 2, background: "var(--ws-page-accent)", opacity: 0.3 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div className="ws-display" style={{ fontSize: compact ? 18 : 24, fontWeight: 800, color: "var(--ws-page-accent)" }}>
                {soundLab(id)}{def && <span style={{ color: "var(--ws-page-muted)", fontWeight: 500, fontSize: "0.68em" }}> as in {def.eg}</span>}
              </div>
              <div style={{ fontSize: compact ? 12 : 14, color: "var(--ws-page-muted)", whiteSpace: "nowrap" }}>{got} of {spellings.length}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? "10px 12px" : "14px 18px", marginTop: compact ? 10 : 14 }}>
              {spellings.map(g => {
                const n = page[g] || 0, tier = tierOf(n), next = STICKER_TIERS[tier];
                const label = tier ? `${g}: ${TIER_NAMES[tier]} sticker, ${n} ${n === 1 ? "word" : "words"}${next ? `, ${next - n} more for ${TIER_NAMES[tier + 1]}` : ""}` : `${g}: not found yet`;
                return (
                  <div key={g} role="img" aria-label={label} title={label} style={{ display: "grid", justifyItems: "center", gap: 5, width: size + 8 }}>
                    {tier ? <Sticker g={g} tier={tier} sound={id} size={size} /> : <StickerSpot g={g} size={size} />}
                    {!compact && (
                      <span style={{ fontSize: 12, lineHeight: 1.1, textAlign: "center", color: "var(--ws-page-muted)" }}>
                        {!tier ? "not yet" : next ? `${n} of ${next} for ${TIER_NAMES[tier + 1]}` : "gold!"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------- the trophy shelf ---------- */

// A wooden cabinet: every row of trophies stands on a shelf plank with a brass nameplate on its front.
// Trophies not won yet are shown as shadows, so there's always something to aim for.
export function TrophyGrid({ trophies, compact = false }) {
  const [picked, setPicked] = useState(null);
  const H = compact ? 108 : 140, PLANK = compact ? 28 : 36, W = compact ? 92 : 98;
  const shelves = `repeating-linear-gradient(180deg, rgba(0,0,0,.28) 0 6px, transparent 6px ${H - PLANK}px, var(--ws-shelf) ${H - PLANK}px ${H - 6}px, var(--ws-shelf-edge) ${H - 6}px ${H}px)`;
  const sel = picked && TROPHY_BY_ID[picked];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${W}px, 1fr))`, gridAutoRows: H, padding: "0 10px",
        background: `${shelves}, var(--ws-cabinet)`, border: `${compact ? 5 : 8}px solid var(--ws-cabinet-edge)`, borderRadius: 14,
        boxShadow: "inset 0 0 26px rgba(0,0,0,.35), 0 8px 18px rgba(0,0,0,.25)",
      }}>
        {TROPHIES.map((t, i) => {
          const got = !!(trophies && trophies[t.id]);
          return (
            <button key={t.id} type="button" onClick={() => setPicked(p => (p === t.id ? null : t.id))} className="ws-btn"
              title={`${t.name}: ${t.desc}${got ? "" : " (not won yet)"}`} aria-label={`${t.name}: ${t.desc}. ${got ? "Won" : "Not won yet"}`} aria-pressed={picked === t.id}
              style={{ background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", cursor: "pointer", display: "grid", gridTemplateRows: `1fr ${PLANK}px`, justifyItems: "center", minWidth: 0, borderRadius: 8, outlineOffset: -3 }}>
              <span style={{ alignSelf: "end", display: "grid", justifyItems: "center" }}>
                <span aria-hidden="true" style={{
                  fontSize: compact ? 38 : 50, lineHeight: 1.1, filter: got ? "drop-shadow(0 5px 4px rgba(0,0,0,.35))" : "var(--ws-silhouette)",
                  animation: got && !compact && picked === t.id ? "ws-bob 1.2s ease-in-out infinite" : "none",
                }}>{t.emoji}</span>
                {/* the little plinth the trophy stands on */}
                <span aria-hidden="true" style={{ width: compact ? 40 : 52, height: compact ? 8 : 11, borderRadius: "4px 4px 0 0", background: got ? "linear-gradient(180deg,#5C5C5C,#2C2C2C)" : "rgba(0,0,0,.25)", boxShadow: got ? "inset 0 1px 0 rgba(255,255,255,.25)" : "none" }} />
              </span>
              <span className="ws-display" style={{
                alignSelf: "center", maxWidth: "90%", overflow: "hidden", boxSizing: "border-box", textAlign: "center",
                padding: compact ? "1px 5px" : "2px 7px", borderRadius: 3, fontSize: compact ? 9.5 : 11.5, fontWeight: 700, lineHeight: 1.1, marginBottom: 6, maxHeight: "2.3em",
                background: got ? "linear-gradient(180deg,#FBE9AE,#C9A043)" : "rgba(0,0,0,.18)", color: got ? "#3B2A08" : "rgb(var(--ws-fg) / .55)",
                boxShadow: got ? "0 1px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.6)" : "none",
                animation: compact ? "none" : `ws-fade .4s ${0.03 * i}s ease both`,
              }}>{t.name}</span>
            </button>
          );
        })}
      </div>
      {sel && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, background: "rgb(var(--ws-fg) / .06)", borderRadius: 12, padding: "8px 14px" }}>
          <span aria-hidden="true" style={{ fontSize: 30 }}>{sel.emoji}</span>
          <div>
            <div className="ws-display" style={{ fontWeight: 700, fontSize: compact ? 15 : 18 }}>{sel.name}{trophies && trophies[sel.id] ? "" : " (not won yet)"}</div>
            <div style={{ color: T.mist, fontSize: compact ? 13 : 15 }}>{sel.desc}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- what this round earned ---------- */

export const hasRewards = r => !!r && (r.best.length + r.trophies.length + r.stickers.length) > 0;

const CONFETTI = ["#FFB020", "#FF5D5D", "#57C785", "#3D7BD9", "#8E5BD9", "#FF4D2E", "#0FA091", "#F5A300"];
function Confetti() {
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 28 }, (_, i) => {
        const h = hash("c" + i);
        return <span key={i} style={{
          position: "absolute", top: 0, left: `${(h % 100)}%`, width: 8 + (h % 6), height: 12 + (h % 8), opacity: 0,
          borderRadius: h % 3 ? 2 : "50%", background: CONFETTI[i % CONFETTI.length],
          "--dx": `${(h % 120) - 60}px`, "--rot": `${(h % 720) - 360}deg`,
          animation: `ws-confetti ${1.8 + (h % 10) / 6}s ${(h % 12) / 20}s cubic-bezier(.2,.6,.4,1) both`,
        }} />;
      })}
    </div>
  );
}

// Pops up over "Time's up!" on the student's own device: each new trophy gets its own moment,
// then all the new stickers get slapped down together. Tap anywhere (or press the button) to carry on.
export function RewardsPopup({ rewards, onDone }) {
  const steps = [];
  if (rewards.best.length) steps.push({ kind: "best" });
  rewards.trophies.map(id => TROPHY_BY_ID[id]).filter(Boolean).forEach(t => steps.push({ kind: "trophy", t }));
  if (rewards.stickers.length) steps.push({ kind: "stickers" });
  const [i, setI] = useState(0);
  const btn = useRef(null);
  const last = i >= steps.length - 1;
  const next = () => (last ? onDone() : setI(k => Math.min(k + 1, steps.length - 1)));
  useEffect(() => { if (btn.current) btn.current.focus(); }, [i]);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);
  const step = steps[i];
  if (!step) return null;

  let label, body;
  if (step.kind === "trophy") {
    label = "New trophy!";
    body = (
      <>
        <div style={{ position: "relative", display: "grid", placeItems: "center", width: 200, height: 200 }}>
          <span aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "repeating-conic-gradient(rgb(var(--ws-amber-rgb) / .38) 0 12deg, transparent 12deg 30deg)", WebkitMaskImage: "radial-gradient(circle, #000 30%, transparent 70%)", maskImage: "radial-gradient(circle, #000 30%, transparent 70%)", animation: "ws-spin 9s linear infinite" }} />
          <span aria-hidden="true" style={{ position: "relative", fontSize: 112, lineHeight: 1, filter: "drop-shadow(0 8px 8px rgba(0,0,0,.35))", animation: "ws-slap .7s .1s ease both" }}>{step.t.emoji}</span>
        </div>
        <div className="ws-display" style={{ fontSize: 34, fontWeight: 800 }}>{step.t.name}</div>
        <div style={{ fontSize: 19, color: T.mist }}>{step.t.desc}</div>
      </>
    );
  } else if (step.kind === "stickers") {
    label = rewards.stickers.length === 1 ? "New sticker!" : `${rewards.stickers.length} new stickers!`;
    const size = rewards.stickers.length > 4 ? 76 : 96;
    body = (
      <>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "18px 20px", maxWidth: 440 }}>
          {rewards.stickers.map((s, k) => (
            <div key={`${s.sound}-${s.g}`} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", animation: `ws-slap .55s ${0.15 + 0.28 * k}s cubic-bezier(.3,1.4,.5,1) both` }}>
                <Sticker g={s.g} tier={s.tier} sound={s.sound} size={size} />
              </span>
              <span style={{ fontSize: 14, color: T.mist, animation: `ws-fade .4s ${0.35 + 0.28 * k}s ease both` }}>
                {s.tier > 1 ? <b style={{ color: T.amber }}>{cap(TIER_NAMES[s.tier])}!</b> : soundLab(s.sound)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 17, color: T.mist }}>They're in your sticker book now.</div>
      </>
    );
  } else {
    label = rewards.best.length > 1 ? "Two personal bests!" : "Personal best!";
    body = (
      <>
        <span aria-hidden="true" style={{ fontSize: 104, lineHeight: 1, animation: "ws-slap .7s .1s ease both" }}>⭐</span>
        {rewards.best.map(b => <div key={b} className="ws-display" style={{ fontSize: 26, fontWeight: 700 }}>{b === "score" ? "Your best score ever!" : "The most words you've ever found!"}</div>)}
      </>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ws-reward-title" onClick={next}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 16, background: "rgb(var(--ws-ink-rgb) / .9)", backdropFilter: "blur(3px)", cursor: "pointer" }}>
      <Confetti key={"c" + i} />
      <div key={"s" + i} className="ws-fade" style={{ position: "relative", display: "grid", justifyItems: "center", gap: 14, textAlign: "center", width: "min(100%, 480px)" }}>
        <div id="ws-reward-title" aria-live="polite" className="ws-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: T.amber }}>{label}</div>
        {body}
        <button ref={btn} type="button" className="ws-btn ws-display" onClick={e => { e.stopPropagation(); next(); }}
          style={{ marginTop: 10, fontSize: 22, fontWeight: 700, background: T.amber, color: T.ink, border: "none", borderRadius: 14, padding: "12px 34px", cursor: "pointer" }}>
          {last ? "Done!" : "Next ➜"}
        </button>
        {steps.length > 1 && (
          <div aria-hidden="true" style={{ display: "flex", gap: 7 }}>
            {steps.map((_, k) => <span key={k} style={{ width: 9, height: 9, borderRadius: "50%", background: k === i ? T.amber : "rgb(var(--ws-fg) / .25)" }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// What this round earned, kept under "Time's up!" after the pop-up closes.
export function RoundRewards({ rewards }) {
  if (!hasRewards(rewards)) return null;
  const items = [
    ...rewards.best.map(b => ({ key: "best-" + b, icon: <span style={{ fontSize: 34 }}>⭐</span>, title: b === "score" ? "New personal best score!" : "Most words you've ever found!", sub: "" })),
    ...rewards.trophies.map(id => TROPHY_BY_ID[id]).filter(Boolean).map(t => ({ key: t.id, icon: <span style={{ fontSize: 34 }}>{t.emoji}</span>, title: `Trophy: ${t.name}`, sub: t.desc })),
    ...rewards.stickers.map(s => ({ key: `${s.sound}-${s.g}`, icon: <Sticker g={s.g} tier={s.tier} sound={s.sound} size={42} />, title: s.tier === 1 ? `New sticker: ${s.g}` : `${cap(TIER_NAMES[s.tier])} sticker: ${s.g}`, sub: `for the sound ${soundLab(s.sound)}` })),
  ];
  return (
    <section aria-label="What you earned" style={{ display: "grid", gap: 10, width: "min(92vw, 540px)" }}>
      {items.map((it, i) => (
        <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgb(var(--ws-amber-rgb) / .1)", border: "1px solid rgb(var(--ws-amber-rgb) / .4)", borderRadius: 14, padding: "10px 16px", textAlign: "left", animation: `ws-pop .4s ${0.1 * i}s ease both` }}>
          <span aria-hidden="true" style={{ width: 48, flex: "none", display: "grid", placeItems: "center" }}>{it.icon}</span>
          <div>
            <div className="ws-display" style={{ fontSize: 21, fontWeight: 700 }}>{it.title}</div>
            {it.sub && <div style={{ color: T.mist, fontSize: 15 }}>{it.sub}</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------- the student's trophy room ---------- */

// Opened from the lobby while they wait.
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
    <div className="ws-fade" style={{ width: "100%", display: "grid", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 32 }}>{name}'s trophy room</h1>
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
            <h2 className="ws-display" style={{ margin: 0, fontSize: 22 }}>Trophy shelf <span style={{ color: T.mist, fontWeight: 500, fontSize: 17 }}>· {count} of {TROPHIES.length}</span></h2>
            <TrophyGrid trophies={summary.trophies} />
            <div style={{ color: T.mist, fontSize: 14 }}>Tap a trophy to see how to win it.</div>
          </section>
          <section style={{ display: "grid", gap: 10 }}>
            <h2 className="ws-display" style={{ margin: 0, fontSize: 22 }}>Sticker book</h2>
            <StickerBook stickers={summary.stickers} />
            <div style={{ color: T.mist, fontSize: 14 }}>Find a word with a spelling to get its sticker. 5 words makes it silver, 15 makes it gold.</div>
          </section>
        </>
      )}
    </div>
  );
}
