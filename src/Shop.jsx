import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";
import { call as netCall } from "./net.js";
import { SLOTS, SLOT_NAMES, ITEMS, balanceOf } from "../shared/shop.js";
import { Look, DieRow, TryBoard, CoverMini } from "./components/LookSamples.jsx";
import { itemState, shelves, wornIn, shopError } from "./shopView.js";
import { SEASONS, SEASON_BY_ID } from "../shared/seasons.js";

/*
 * The student's shop, opened from the lobby like "My trophies" (class-list students only).
 * Stars are spent on looks for this device only; nothing bought is ever taken away.
 * The server decides everything (prices, what's owned, what's worn); this screen just shows it and asks.
 *   cached:   the last player:shop reply, shown straight away while a fresh one loads
 *   onLoaded: every fresh reply (wallet / trophies / worn), so the lobby's balance stays right
 *   onWorn:   the server's `worn` after a buy or a wear, so the device dresses itself at once
 *   call, items: the socket call and the catalogue (swappable, for a harness)
 */
const SLOT_EMOJI = { theme: "🎨", dice: "🎲", effect: "✨", avatar: "🙂", cover: "📒" };
const pill = { fontSize: 18, fontWeight: 700, border: "none", borderRadius: 14, padding: "12px 18px", minHeight: 48, cursor: "pointer", width: "100%" };

// The little picture on each card, drawn in the student's current theme so it looks like it will on their device.
function ItemPreview({ item, theme, name, trying, onTry }) {
  const box = { padding: 10, borderRadius: 12, minHeight: 96, display: "grid", placeItems: "center", gap: 8 };
  if (item.slot === "theme") {
    return (
      <Look theme={item.id || "classic"} style={box}>
        <div className="ws-display" aria-hidden="true" style={{ fontSize: 19, fontWeight: 700 }}>Hi, <span style={{ color: T.amber }}>{name}</span>!</div>
        <div aria-hidden="true" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="ws-display" style={{ background: T.amber, color: T.ink, borderRadius: 10, padding: "4px 10px", fontWeight: 700, fontSize: 14 }}>Go →</span>
          <span className="ws-display" style={{ color: T.green, fontWeight: 700, fontSize: 14 }}>✓ +3</span>
        </div>
        <div aria-hidden="true"><DieRow /></div>
      </Look>
    );
  }
  if (item.slot === "dice") return <Look theme={theme} dice={item.id} style={box}><div aria-hidden="true"><DieRow /></div></Look>;
  if (item.slot === "cover") return <Look theme={theme} cover={item.id} style={{ ...box, placeItems: "stretch" }}><CoverMini /></Look>;
  if (item.slot === "avatar") {
    return (
      <Look theme={theme} style={box}>
        <span aria-hidden="true" className="ws-display" style={{ fontSize: 22, fontWeight: 600, background: "rgb(var(--ws-fg) / .08)", borderRadius: 999, padding: "6px 16px" }}>
          {item.id ? <span style={{ fontSize: 34, verticalAlign: "middle" }}>{item.emoji} </span> : null}{name}
        </span>
      </Look>
    );
  }
  // Word sparkles: a board to swipe, only once asked for, so the page still scrolls with a finger.
  return (
    <Look theme={theme} style={box}>
      {trying ? <><TryBoard effect={item.id} dim="150px" /><span style={{ color: T.mist, fontSize: 13 }}>Swipe some letters</span></>
        : item.id ? <button type="button" className="ws-btn ws-display" onClick={onTry} aria-label={`Try ${item.name}`}
          style={{ fontSize: 17, fontWeight: 700, minHeight: 48, padding: "8px 16px", borderRadius: 12, cursor: "pointer", background: "rgb(var(--ws-fg) / .1)", color: "var(--ws-text)", border: "2px dashed rgb(var(--ws-fg) / .3)" }}><span aria-hidden="true" style={{ fontSize: 26 }}>{item.emoji}</span> Try it</button>
          : <span style={{ color: T.mist, fontSize: 15 }}>Words just turn green</span>}
    </Look>
  );
}

function ItemCard({ item, look, theme, name, busy, onWear, onBuy, trying, onTry }) {
  const { state, need, trophy } = look;
  const price = item.unlock ? "Trophy prize" : item.price ? `⭐ ${item.price}` : "Free";
  let action;
  if (state === "wearing") {
    action = <button type="button" disabled className="ws-display" style={{ ...pill, cursor: "default", background: "rgb(var(--ws-green-rgb) / .16)", color: "var(--ws-text)", outline: `2px solid ${T.green}`, outlineOffset: -2 }}>Wearing ✓</button>;
  } else if (state === "owned") {
    action = <button type="button" disabled={busy} onClick={onWear} className="ws-btn ws-display" aria-label={`Wear ${item.name}`} style={{ ...pill, background: T.green, color: T.ink }}>Wear it</button>;
  } else if (state === "buy") {
    action = <button type="button" disabled={busy} onClick={onBuy} className="ws-btn ws-display" aria-label={`Buy ${item.name} for ${item.price} stars`} style={{ ...pill, background: T.amber, color: T.ink }}>Buy</button>;
  } else if (state === "locked") {
    action = <div className="ws-display" style={{ ...pill, cursor: "default", boxSizing: "border-box", textAlign: "center", background: "rgb(var(--ws-fg) / .06)", color: T.mist, fontSize: 16 }}>🔒 Win the {trophy} trophy</div>;
  } else {
    // Not enough stars yet: say how close they are, kindly. A bar, never a warning colour.
    const have = Math.max(0, item.price - need);
    action = (
      <div style={{ display: "grid", gap: 6, padding: "4px 2px" }}>
        <div style={{ height: 10, borderRadius: 999, background: "rgb(var(--ws-fg) / .1)", overflow: "hidden" }} aria-hidden="true">
          <div style={{ width: `${(have / item.price) * 100}%`, height: "100%", background: T.bar }} />
        </div>
        <div style={{ color: T.mist, fontSize: 16, textAlign: "center" }}>{need} more {need === 1 ? "star" : "stars"} to go</div>
      </div>
    );
  }
  return (
    <section aria-label={item.name} style={{ display: "grid", gap: 10, alignContent: "start", background: "rgb(var(--ws-fg) / .05)", border: `2px solid ${state === "wearing" ? T.green : "var(--ws-faint)"}`, borderRadius: 18, padding: 10 }}>
      <ItemPreview item={item} theme={theme} name={name} trying={trying} onTry={onTry} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "0 4px" }}>
        <span className="ws-display" style={{ fontSize: 19, fontWeight: 700 }}><span aria-hidden="true">{item.emoji} </span>{item.name}</span>
        {item.id && state !== "wearing" && state !== "owned" && <span className="ws-display" style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", color: state === "buy" ? T.amber : T.mist }}>{price}</span>}
      </div>
      {action}
    </section>
  );
}

// "Buy Ocean for 60 ⭐?", then "You got it!" with a chance to wear it straight away (buying never wears it by itself).
function Confirm({ item, done, busy, onYes, onWear, onClose }) {
  const first = useRef(null);
  useEffect(() => { if (first.current) first.current.focus(); }, [done]);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const big = { fontSize: 21, fontWeight: 700, border: "none", borderRadius: 14, padding: "14px 24px", minHeight: 52, cursor: "pointer", minWidth: 140 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: 16, background: "rgb(var(--ws-ink-rgb) / .85)", backdropFilter: "blur(3px)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ws-shop-ask" onClick={e => e.stopPropagation()} className="ws-fade"
        style={{ display: "grid", gap: 18, justifyItems: "center", textAlign: "center", width: "min(100%, 420px)", background: T.ink, border: "2px solid rgb(var(--ws-fg) / .18)", borderRadius: 22, padding: "24px 20px", boxSizing: "border-box" }}>
        <span aria-hidden="true" style={{ fontSize: 64, lineHeight: 1, animation: done ? "ws-slap .6s ease both" : "none" }}>{item.emoji}</span>
        <div id="ws-shop-ask" className="ws-display" style={{ fontSize: 26, fontWeight: 700 }}>
          {done ? `You got ${item.name}! 🎉` : `Buy ${item.name} for ${item.price} ⭐?`}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {done ? <>
            <button ref={first} type="button" onClick={onWear} disabled={busy} className="ws-btn ws-display" style={{ ...big, background: T.green, color: T.ink }}>Wear it now</button>
            <button type="button" onClick={onClose} className="ws-btn ws-display" style={{ ...big, background: "rgb(var(--ws-fg) / .1)", color: "var(--ws-text)" }}>Later</button>
          </> : <>
            <button ref={first} type="button" onClick={onYes} disabled={busy} className="ws-btn ws-display" style={{ ...big, background: T.amber, color: T.ink }}>{busy ? "Buying…" : "Yes, buy it"}</button>
            <button type="button" onClick={onClose} className="ws-btn ws-display" style={{ ...big, background: "rgb(var(--ws-fg) / .1)", color: "var(--ws-text)" }}>Not now</button>
          </>}
        </div>
      </div>
    </div>
  );
}

export function Shop({ name, cached, ownLooks = true, onLoaded, onWorn, onClose, call = netCall, items = ITEMS }) {
  const [data, setData] = useState(cached || null);   // { wallet, trophies, worn }
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState("theme");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(null);       // { item, done } while the buy dialog is open
  const [trying, setTrying] = useState(null); // the sparkle being tried out
  const [reload, setReload] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const take = res => {
    const next = { wallet: res.wallet, trophies: res.trophies || (data && data.trophies) || {}, worn: res.worn, seasons: res.seasons || [] };
    setData(next);
    if (onLoaded) onLoaded(next);
    return next;
  };

  // The server allows one look every couple of seconds, so a quick reopen waits and tries once more.
  useEffect(() => {
    let timer = null;
    const load = retry => call("player:shop").then(res => {
      if (!alive.current) return;
      if (res.ok) { take(res); setFailed(false); if (onWorn) onWorn(res.worn); }
      else if (res.error === "slow-down" && retry) timer = setTimeout(() => load(false), 2100);
      else setFailed(true);
    });
    load(true);
    return () => clearTimeout(timer);
  }, [reload]); // eslint-disable-line

  const wear = async item => {
    setBusy(true); setNote("");
    const res = await call("player:equip", { slot: item.slot, id: item.id });
    if (!alive.current) return;
    setBusy(false);
    if (!res.ok) return setNote(shopError(res.error));
    setData(d => { const next = { ...d, worn: res.worn }; if (onLoaded) onLoaded(next); return next; });
    if (onWorn) onWorn(res.worn);
    setAsk(null);
  };

  const buy = async item => {
    setBusy(true); setNote("");
    const res = await call("player:buy", { id: item.id });
    if (!alive.current) return;
    setBusy(false);
    if (!res.ok) {
      setAsk(null);
      setNote(shopError(res.error));
      if (res.error === "owned" || res.error === "not-enough") setReload(k => k + 1);   // our copy was out of date
      return;
    }
    take(res);
    setAsk({ item, done: true });
  };

  const shelf = shelves(items, { seasons: (data && data.seasons) || [], wallet: data && data.wallet, trophies: data && data.trophies });
  const seasonTabs = SEASONS.filter(s => shelf[s.id]);
  const worn = data ? data.worn : null;
  const theme = wornIn(worn, "theme");
  const list = shelf[tab] || [];
  const real = SEASON_BY_ID[tab] ? list : list.filter(i => i.id && !(i.slot === "theme" && i.price === 0));   // what's actually for sale here

  return (
    <div className="ws-fade" style={{ width: "100%", display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 32 }}>Shop <span aria-hidden="true">🛍️</span></h1>
        <button type="button" className="ws-btn ws-display" onClick={onClose} style={{ fontSize: 18, fontWeight: 600, background: "rgb(var(--ws-fg) / .1)", color: "var(--ws-text)", border: "none", borderRadius: 12, padding: "10px 18px", minHeight: 48, cursor: "pointer" }}>← Back</button>
      </div>

      {data && (
        <div className="ws-display" aria-label={`You have ${balanceOf(data.wallet)} stars to spend`} style={{ justifySelf: "start", display: "flex", alignItems: "baseline", gap: 8, background: "rgb(var(--ws-amber-rgb) / .14)", border: `2px solid ${T.amber}`, borderRadius: 999, padding: "8px 20px" }}>
          <span style={{ fontSize: 30, fontWeight: 800 }}>⭐ {balanceOf(data.wallet)}</span>
          <span style={{ fontSize: 17, color: T.mist, fontWeight: 600 }}>to spend</span>
        </div>
      )}
      {!ownLooks && data && (
        <div role="status" style={{ fontSize: 17, color: T.mist, background: "rgb(var(--ws-fg) / .06)", borderRadius: 14, padding: "10px 16px" }}>
          Your teacher has turned looks off for now. You can still shop, and your looks will come back later.
        </div>
      )}
      {note && <div role="status" style={{ fontSize: 18, background: "rgb(var(--ws-fg) / .08)", border: "1px solid rgb(var(--ws-fg) / .2)", borderRadius: 14, padding: "10px 16px" }}>{note}</div>}

      {!data && !failed && <div style={{ color: T.mist, fontSize: 20 }}>Opening the shop…</div>}
      {!data && failed && (
        <div role="status" style={{ display: "grid", gap: 12, justifyItems: "start", fontSize: 19 }}>
          The shop didn't open. Check the wifi, then try again.
          <button type="button" className="ws-btn ws-display" onClick={() => { setFailed(false); setReload(k => k + 1); }} style={{ ...pill, width: "auto", background: T.amber, color: T.ink }}>Try again</button>
        </div>
      )}

      {data && (
        <>
          <div role="tablist" aria-label="Shop shelves" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...seasonTabs.map(s => ({ id: s.id, emoji: s.emoji, name: s.name })), ...SLOTS.map(slot => ({ id: slot, emoji: SLOT_EMOJI[slot], name: SLOT_NAMES[slot] }))].map(t => (
              <button key={t.id} type="button" role="tab" id={`ws-shop-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="ws-shop-shelf" onClick={() => { setTab(t.id); setTrying(null); }}
                className="ws-btn ws-display" style={{ fontSize: 17, fontWeight: 600, minHeight: 48, padding: "8px 16px", borderRadius: 999, cursor: "pointer", border: `2px solid ${tab === t.id ? T.amber : "rgb(var(--ws-fg) / .2)"}`, background: tab === t.id ? "rgb(var(--ws-amber-rgb) / .15)" : "transparent", color: "var(--ws-text)" }}>
                <span aria-hidden="true">{t.emoji} </span>{t.name}
              </button>
            ))}
          </div>
          <div id="ws-shop-shelf" role="tabpanel" aria-labelledby={`ws-shop-tab-${tab}`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
            {SEASON_BY_ID[tab] && (
              <div style={{ gridColumn: "1 / -1", fontSize: 18, color: T.mist }}>
                Only in the shop {SEASON_BY_ID[tab].when}. Anything you get is yours to keep all year.
              </div>
            )}
            {list.map(item => (
              <ItemCard key={item.id || "none"} item={item} name={name} theme={theme} busy={busy}
                look={itemState(item, data.wallet, data.trophies, worn)}
                onWear={() => wear(item)} onBuy={() => { setNote(""); setAsk({ item, done: false }); }}
                trying={trying === item.id} onTry={() => setTrying(item.id)} />
            ))}
            {real.length < 2 && (
              <div style={{ display: "grid", placeItems: "center", textAlign: "center", gap: 6, minHeight: 160, border: "2px dashed rgb(var(--ws-fg) / .18)", borderRadius: 18, padding: 16, color: T.mist, fontSize: 18 }}>
                <span aria-hidden="true" style={{ fontSize: 40 }}>📦</span>
                More coming soon!
              </div>
            )}
          </div>
        </>
      )}

      {ask && <Confirm item={ask.item} done={ask.done} busy={busy} onYes={() => buy(ask.item)} onWear={() => wear(ask.item)} onClose={() => setAsk(null)} />}
    </div>
  );
}
