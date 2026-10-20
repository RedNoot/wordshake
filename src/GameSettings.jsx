import { T } from "./theme.js";
import { SOUNDS } from "./sounds.js";
import { Chip } from "./components/Chip.jsx";
import { Toggle } from "./components/Toggle.jsx";

/*
 * The teacher's settings drawer beside the start screen: Basics, Today's sound and Advanced, each folding away
 * with a one-line summary, so starting a game is just class + Open the room. Which sections are open is
 * remembered on this computer only.
 */
export const HINT_SECONDS = [10, 15, 20, 30];   // matches server/lib/settings.js
const OPEN_KEY = "ws-settings-open";
export const loadOpen = () => {
  try { return { basics: true, sound: false, advanced: false, ...JSON.parse(localStorage.getItem(OPEN_KEY) || "{}") }; }
  catch { return { basics: true, sound: false, advanced: false }; }
};
export const saveOpen = open => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(open)); } catch { /* private mode */ } };

const Label = ({ children }) => (
  <div style={{ color: T.mist, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>{children}</div>
);

function Section({ id, title, summary, open, onToggle, children }) {
  return (
    <section style={{ borderTop: `1px solid ${T.faint}` }}>
      <h3 style={{ margin: 0 }}>
        <button className="ws-btn ws-display" aria-expanded={open} aria-controls={`ws-set-${id}`} onClick={onToggle}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 56, padding: "12px 2px", background: "none", border: "none", color: "var(--ws-text)", fontSize: 19, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={open ? T.amber : T.mist} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flex: "none", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span style={{ flex: "none" }}>{title}</span>
          {!open && summary && (
            <span style={{ marginLeft: "auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--ws-font-body)", fontWeight: 400, fontSize: 14, color: T.mist }}>{summary}</span>
          )}
        </button>
      </h3>
      {open && <div id={`ws-set-${id}`} className="ws-fade" style={{ display: "grid", gap: 18, padding: "0 0 20px 30px" }}>{children}</div>}
    </section>
  );
}

// Summary chips for the start screen: each opens the drawer at its own section.
export function settingsSummary(settings, soundDef, online) {
  return [
    [`${settings.seconds / 60} min`, "basics"],
    [`${settings.size} × ${settings.size} board`, "basics"],
    [soundDef ? `Sound ${soundDef.lab}` : "Sound: off", "sound"],
    online && [settings.hints ? `Hints after ${settings.hintSeconds} s` : "No hints", "advanced"],
    settings.wordOfGame && ["Word of the game", "advanced"],
    settings.minLen !== 3 && [`${settings.minLen}+ letters`, "advanced"],
  ].filter(Boolean);
}

export function GameSettings({ settings, setSettings, soundDef, pickSound, toggleSpelling, phStats, dict, online, open, setOpen, onClose }) {
  const set = patch => setSettings(v => ({ ...v, ...patch }));
  const flip = id => setOpen(o => ({ ...o, [id]: !o[id] }));
  const advanced = [
    online && (settings.hints ? `hints ${settings.hintSeconds} s` : "no hints"),
    settings.wordOfGame && "word of the game",
    `${settings.minLen}+ letters`,
  ].filter(Boolean).join(" · ");

  return (
    <aside aria-label="Game settings" style={{ flex: "1 1 360px", boxSizing: "border-box", borderLeft: `1px solid ${T.faint}`, background: "rgb(var(--ws-fg) / .03)", padding: "18px 24px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <h2 className="ws-display" style={{ margin: 0, fontSize: 24, flex: 1 }}>Game settings</h2>
        <button className="ws-btn" onClick={onClose} style={{ background: "none", border: `1px solid ${T.faint}`, color: "var(--ws-text)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>Close</button>
      </div>

      <Section id="basics" title="Basics" summary={`${settings.seconds / 60} min · ${settings.size} × ${settings.size}`} open={open.basics} onToggle={() => flip("basics")}>
        <div>
          <Label>Round time</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[60, 120, 180, 240, 300].map(s => <Chip key={s} small active={settings.seconds === s} onClick={() => set({ seconds: s })}>{s / 60} min</Chip>)}
          </div>
        </div>
        <div>
          <Label>Board size</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[[4, "4 × 4 Classic"], [5, "5 × 5 Big"], [6, "6 × 6 Super"]].map(([n, label]) => <Chip key={n} small active={settings.size === n} onClick={() => set({ size: n })}>{label}</Chip>)}
          </div>
        </div>
      </Section>

      {/* ---- Sounds-Write target sound ---- */}
      <Section id="sound" title="Today's sound" summary={soundDef ? `${soundDef.lab} · ${settings.phTicked.join(", ") || "no spellings ticked"}` : "Off"} open={open.sound} onToggle={() => flip("sound")}>
        <div style={{ borderRadius: 12, padding: "10px 14px", fontSize: 14.5, lineHeight: 1.45, color: T.mist, background: soundDef ? "rgb(var(--ws-amber-rgb) / .08)" : "rgb(var(--ws-fg) / .04)", border: `1px solid ${soundDef ? "rgb(var(--ws-amber-rgb) / .4)" : T.faint}` }}>
          {soundDef ? (
            <><b style={{ color: T.amber }}>Sounds-Write words only.</b> The board, the answers and the scoring use just the Sounds-Write high-frequency word list{phStats.words ? ` (${phStats.words.toLocaleString()} words)` : ""}. Other dictionary words don't count this round.</>
          ) : (
            <><b style={{ color: "var(--ws-text)" }}>Full dictionary.</b> Every word in the classroom-safe dictionary counts{dict.status === "full" ? ` (${dict.count.toLocaleString()} words)` : ""}. Pick a sound below to play with Sounds-Write high-frequency words only.</>
          )}
        </div>
        <div>
          <Chip small active={!settings.phSound} onClick={() => pickSound(null)}>Off</Chip>
          {[["icv", "Initial Code — vowels"], ["ecv", "Extended Code — vowels"], ["con", "Consonant sounds"]].map(([grp, label]) => (
            <div key={grp} style={{ marginTop: 12 }}>
              <div style={{ color: "rgb(var(--ws-fg) / .55)", fontSize: 12.5, marginBottom: 6 }}>{label}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SOUNDS.filter(s => s.grp === grp).map(s => (
                  <button key={s.id} title={s.eg} onClick={() => pickSound(s.id)} className="ws-btn ws-display" aria-pressed={settings.phSound === s.id}
                    style={{ padding: "6px 12px", minHeight: 40, borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `2px solid ${settings.phSound === s.id ? T.amber : "rgb(var(--ws-fg) / 0.14)"}`, background: settings.phSound === s.id ? T.amber : "transparent", color: settings.phSound === s.id ? T.ink : T.mist }}>
                    {s.lab}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {soundDef && (
          <div className="ws-fade" style={{ borderTop: `1px solid ${T.faint}`, paddingTop: 12 }}>
            <div style={{ fontSize: 15, color: T.mist, marginBottom: 8 }}>
              Sound <b className="ws-display" style={{ color: T.amber }}>{soundDef.lab}</b> as in <i>{soundDef.eg}</i> — tick today's spellings:
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {soundDef.sp.map(([g, eg]) => {
                const on = settings.phTicked.includes(g);
                return (
                  <button key={g} onClick={() => toggleSpelling(g)} className="ws-btn" aria-pressed={on}
                    style={{ cursor: "pointer", borderRadius: 12, padding: "7px 12px", textAlign: "center", border: `2px solid ${on ? T.amber : "rgb(var(--ws-fg) / 0.14)"}`, background: on ? "rgb(var(--ws-amber-rgb) / .15)" : "transparent", color: on ? "var(--ws-amber-soft)" : T.mist }}>
                    <span className="ws-display" style={{ fontWeight: 700, fontSize: 17 }}>{g}</span>
                    <span style={{ display: "block", fontSize: 11, opacity: 0.8 }}>{eg}</span>
                  </button>
                );
              })}
            </div>
            {settings.size === 4 && settings.phTicked.length > 4 && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: T.amber }}>
                Heads up: guaranteeing {settings.phTicked.length} spellings on a 4 × 4 board gets tight — a bigger board (or fewer ticks) covers every spelling more reliably.
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <Toggle on={settings.phBonus} onClick={() => set({ phBonus: !settings.phBonus })} label="+2 bonus points for target-sound words" />
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: "rgb(var(--ws-fg) / .55)" }}>
              Every word on the board comes from the Sounds-Write list, so every answer with {soundDef.lab} in a ticked spelling is highlighted{settings.phBonus ? " and earns the +2 bonus" : ""}.
            </div>
          </div>
        )}
      </Section>

      <Section id="advanced" title="Advanced" summary={advanced} open={open.advanced} onToggle={() => flip("advanced")}>
        {online && (
          <div>
            <Label>Hints for anyone stuck</Label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Chip small active={!settings.hints} onClick={() => set({ hints: false })}>Off</Chip>
              {HINT_SECONDS.map(n => <Chip key={n} small active={settings.hints && settings.hintSeconds === n} onClick={() => set({ hints: true, hintSeconds: n })}>{n} s</Chip>)}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: T.mist }}>A short word appears after this long without finding one.</div>
          </div>
        )}
        <div>
          <Label>Shortest word allowed</Label>
          <div style={{ display: "flex", gap: 8 }}>
            {[2, 3, 4].map(n => <Chip key={n} small active={settings.minLen === n} onClick={() => set({ minLen: n })}>{n} letters</Chip>)}
          </div>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <Toggle on={!!settings.wordOfGame} onClick={() => set({ wordOfGame: !settings.wordOfGame })} label="Word of the game: one easy word to find, shown at the top" />
          <Toggle on={settings.showCount} onClick={() => set({ showCount: !settings.showCount })} label="Show how many words are hiding" />
          {online && <Toggle on={settings.ownLooks !== false} onClick={() => set({ ownLooks: settings.ownLooks === false })} label="Let students use their own looks" />}
          <Toggle on={settings.sound} onClick={() => set({ sound: !settings.sound })} label="Sound effects" />
        </div>
      </Section>
    </aside>
  );
}
