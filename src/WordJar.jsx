import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import Matter from "matter-js";
import { T } from "./theme.js";
import { call } from "./net.js";
import { bankList, jarsFor } from "../shared/wordbank.js";

const { Engine, Bodies, Body, Composite, Sleeping, Query, Events } = Matter;

/*
 * The word jar (student device only): one glass marble for every different word the student has ever found
 * (shared/wordbank.js). Tilt the device, or move the mouse, and they roll; shake it and they rattle; tap one to read
 * its word. Words found since the jar was last opened drop in from the top. A full jar goes on the shelf above and a
 * new one starts, so there are never more than 300 marbles at once.
 */
const STEP = 1000 / 60;          // physics step (ms), fixed so a 120Hz screen doesn't run it double speed
const MAX_TILT = 0.7;            // radians
const SEEN_KEY = "ws-jar-seen";  // per name on this device: { t, n } the newest word and the count last shown
const SOUND_KEY = "ws-jar-sound";

// Marble colour and size by word length. Colours are told apart by lightness too, not only hue.
export const LENGTHS = [
  { min: 3, label: "3 letters", colour: "#4FA3F7", size: 1 },
  { min: 4, label: "4 letters", colour: "#57C785", size: 1.12 },
  { min: 5, label: "5 letters", colour: "#FFB020", size: 1.26 },
  { min: 6, label: "6 letters", colour: "#FF6F91", size: 1.4 },
  { min: 7, label: "7 or more", colour: "#B48CFF", size: 1.6 },
];
const lengthOf = w => LENGTHS.filter(l => w.length >= l.min).pop() || LENGTHS[0];

// The jar's inside edge, as fractions of the canvas: left side top to bottom, mirrored for the right.
const LEFT = [[0.32, 0], [0.32, 0.08], [0.1, 0.16], [0.05, 0.24], [0.05, 0.9], [0.13, 0.975]];
const RIGHT = LEFT.map(([x, y]) => [1 - x, y]);
const OUTLINE = [...LEFT, ...[...RIGHT].reverse()];

const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const mix = (hex, to, f) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f));
  return `rgb(${c.join(",")})`;
};

// One marble drawn once per colour and size, then stamped each frame.
function marbleSprite(colour, r, dpr) {
  const c = document.createElement("canvas"), s = Math.ceil((r + 1) * 2 * dpr);
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  const m = r + 1;
  const grad = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
  grad.addColorStop(0, mix(colour, "#FFFFFF", 0.55));
  grad.addColorStop(0.55, colour);
  grad.addColorStop(1, mix(colour, "#000000", 0.45));
  g.fillStyle = grad;
  g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.beginPath(); g.ellipse(m - r * 0.36, m - r * 0.42, r * 0.24, r * 0.16, -0.6, 0, Math.PI * 2); g.fill();
  return c;
}

// roundRect isn't on older iPads' canvas: a plain rectangle there.
const rounded = (g, x, y, w, h, r) => (g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h));

// A wall along one edge of the jar, set just outside it (away from the jar's middle).
function wall(a, b, mid, t = 40) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  let nx = -dy / len, ny = dx / len;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  if ((mx + nx - mid[0]) ** 2 + (my + ny - mid[1]) ** 2 < (mx - mid[0]) ** 2 + (my - mid[1]) ** 2) { nx = -nx; ny = -ny; }
  return Bodies.rectangle(mx + (nx * t) / 2, my + (ny * t) / 2, len + t * 0.6, t, { isStatic: true, angle: Math.atan2(dy, dx), friction: 0.05 });
}

// Soft glass clinks. Made only after the student has touched something, as browsers require.
function clinker() {
  let ctx = null, last = 0;
  return {
    wake() { try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); } catch { ctx = null; } },
    play(speed) {
      if (!ctx || ctx.state !== "running") return;
      const t = ctx.currentTime;
      if (t - last < 0.045) return;
      last = t;
      const vol = Math.min(1, speed / 9) * 0.05;
      for (const f of [2300 + Math.random() * 1700, 5200 + Math.random() * 900]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.13);
      }
    },
  };
}

/*
 * The jar itself. words: [{ w, t }] oldest first, all in this jar. Words newer than dropAfter drop in one by one;
 * the rest start settled, oldest at the bottom. capacity sizes the marbles so a full jar is about three-quarters full.
 * Exposes shake() and sort(on), and the tilt (-1..1 of MAX_TILT) for a mouse.
 */
export const JarScene = forwardRef(function JarScene({ words, dropAfter, capacity, sound, picked, onPick }, ref) {
  const canvas = useRef(null);
  const sim = useRef(null);
  const still = useMemo(reducedMotion, []);

  useLayoutEffect(() => {
    const el = canvas.current, W = el.clientWidth, H = el.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(W * dpr); el.height = Math.round(H * dpr);
    const g = el.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const fg = (css.getPropertyValue("--ws-fg").trim() || "255 255 255").split(/\s+/).join(",");
    const glass = a => `rgba(${fg},${a})`;
    const P = ([x, y]) => [x * W, y * H];

    const engine = Engine.create({ enableSleeping: true });
    const mid = [W / 2, H * 0.6];
    const edges = [];
    for (let i = 0; i + 1 < LEFT.length; i++) edges.push([P(LEFT[i]), P(LEFT[i + 1])]);
    edges.push([P(LEFT[LEFT.length - 1]), P(RIGHT[RIGHT.length - 1])]);
    for (let i = 0; i + 1 < RIGHT.length; i++) edges.push([P(RIGHT[i]), P(RIGHT[i + 1])]);
    const lid = Bodies.rectangle(W / 2, -20, W, 40, { isStatic: true });   // nothing rattles out of the top
    Composite.add(engine.world, [...edges.map(([a, b]) => wall(a, b, mid)), lid]);

    // Marble size: a full jar of `capacity` comes up to about the shoulders.
    const unit = Math.max(3, Math.min(W * 0.05, Math.sqrt((0.95 * 0.9 * W * 0.72 * H) / (Math.max(capacity, 20) * Math.PI * 1.4))));
    const sprites = new Map();
    const spriteFor = (colour, r) => { const k = colour + r; if (!sprites.has(k)) sprites.set(k, marbleSprite(colour, r, dpr)); return sprites.get(k); };
    const make = (item, x, y) => {
      const L = lengthOf(item.w), r = Math.round(unit * L.size * 10) / 10;
      const body = Bodies.circle(x, y, r, { restitution: 0.25, friction: 0.02, frictionStatic: 0.1, frictionAir: 0.012, density: 0.002 });
      body.item = item; body.r = r; body.sprite = spriteFor(L.colour, r);
      return body;
    };

    // The words already in the jar: stacked from the bottom, oldest first, then settled before the first frame.
    const old = words.filter(x => !(x.t > dropAfter)), fresh = words.filter(x => x.t > dropAfter);
    const marbles = [];
    {
      const left = 0.07 * W, right = 0.93 * W;
      let x = left, y = 0.95 * H, row = 0;
      for (const item of old) {
        const b = make(item, 0, 0);
        if (x + b.r * 2 > right) { row++; x = left + (row % 2) * b.r; y -= b.r * 1.8; }
        Body.setPosition(b, { x: x + b.r + Math.random(), y: Math.max(y - b.r, H * 0.1) });
        x += b.r * 2;
        marbles.push(b);
      }
      Composite.add(engine.world, marbles);
      for (let i = 0; i < (still ? 400 : 150); i++) Engine.update(engine, STEP);
    }

    const s = { engine, marbles, make, W, H, tilt: 0, queue: still ? [] : [...fresh], dropAt: 0, picked: null, sound: clinker(), soundOn: sound };
    if (still) {
      // No motion: new words are simply already in the jar.
      for (const item of fresh) { const b = make(item, W / 2 + (Math.random() - 0.5) * W * 0.3, H * 0.12); marbles.push(b); Composite.add(engine.world, b); }
      for (let i = 0; i < 300; i++) Engine.update(engine, STEP);
    }
    sim.current = s;

    Events.on(engine, "collisionStart", e => {
      if (!s.soundOn) return;
      for (const p of e.pairs) {
        const a = p.bodyA, b = p.bodyB;
        const v = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
        if (v > 2.2) { s.sound.play(v); return; }
      }
    });

    const draw = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const path = new Path2D();
      OUTLINE.forEach((pt, i) => { const [x, y] = P(pt); if (i) path.lineTo(x, y); else path.moveTo(x, y); });
      g.fillStyle = glass(0.05); g.fill(path);
      for (const b of s.marbles) {
        const { x, y } = b.position;
        g.drawImage(b.sprite, x - b.r - 1, y - b.r - 1, (b.r + 1) * 2, (b.r + 1) * 2);
      }
      if (s.picked) {
        const b = s.marbles.find(m => m.item.w === s.picked);
        if (b) { g.strokeStyle = glass(0.95); g.lineWidth = 3; g.beginPath(); g.arc(b.position.x, b.position.y, b.r + 3, 0, Math.PI * 2); g.stroke(); }
      }
      g.lineWidth = 4; g.lineJoin = "round"; g.strokeStyle = glass(0.4); g.stroke(path);
      // the shine down the glass, and the rim
      g.fillStyle = glass(0.1);
      g.beginPath(); rounded(g, W * 0.1, H * 0.3, W * 0.035, H * 0.48, W * 0.02); g.fill();
      g.fillStyle = glass(0.35);
      g.beginPath(); rounded(g, W * 0.28, 0, W * 0.44, H * 0.028, 4); g.fill();
    };
    s.draw = draw;

    let raf = 0, last = performance.now(), acc = 0;
    const tick = t => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) { last = t; return; }
      acc += Math.min(100, t - last); last = t;
      if (s.queue.length && t > s.dropAt) {
        const item = s.queue.shift();
        const b = make(item, W / 2 + (Math.random() - 0.5) * W * 0.25, H * 0.05);
        Body.setVelocity(b, { x: (Math.random() - 0.5) * 2, y: 2 });
        s.marbles.push(b); Composite.add(engine.world, b);
        s.dropAt = t + Math.max(120, 420 - s.queue.length * 20);
      }
      while (acc >= STEP) { Engine.update(engine, STEP); acc -= STEP; }
      draw();
    };
    if (still) draw();
    else raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); Events.off(engine); Engine.clear(engine); };
  }, [words, dropAfter, capacity, still]); // eslint-disable-line

  useEffect(() => { if (sim.current) sim.current.soundOn = sound; }, [sound]);
  useEffect(() => { const s = sim.current; if (s) { s.picked = picked; if (still) s.draw(); } }, [picked, still]);

  useImperativeHandle(ref, () => ({
    tilt(f) {   // -1..1
      const s = sim.current;
      if (!s || still) return;
      const a = Math.max(-1, Math.min(1, f)) * MAX_TILT;
      if (Math.abs(a - s.tilt) < 0.01) return;
      s.tilt = a;
      s.engine.gravity.x = Math.sin(a); s.engine.gravity.y = Math.cos(a);
      for (const b of s.marbles) Sleeping.set(b, false);
    },
    shake() {
      const s = sim.current;
      if (!s || still) return;
      s.sound.wake();
      for (const b of s.marbles) {
        Sleeping.set(b, false);
        Body.setVelocity(b, { x: b.velocity.x + (Math.random() - 0.5) * 12, y: b.velocity.y - 4 - Math.random() * 9 });
      }
    },
    // Sorted: tip them all out and drop them back in longest first, so they settle in layers by length.
    sort(on) {
      const s = sim.current;
      if (!s) return;
      s.sound.wake();
      const items = s.marbles.map(b => b.item);
      Composite.remove(s.engine.world, s.marbles);
      s.marbles = [];
      const order = on ? [...items].sort((a, b) => b.w.length - a.w.length || (a.w < b.w ? -1 : 1)) : [...items].sort(() => Math.random() - 0.5);
      let y = s.H * 0.9;
      const rows = [];
      for (const item of order) {
        const b = s.make(item, 0, 0);
        rows.push(b);
      }
      // Stack them in rows from the bottom in that order, then let them settle.
      let x = s.W * 0.07;
      for (const b of rows) {
        if (x + b.r * 2 > s.W * 0.93) { x = s.W * 0.07; y -= b.r * 1.9; }
        Body.setPosition(b, { x: x + b.r, y: Math.max(y, s.H * 0.05) });
        x += b.r * 2.02;
      }
      s.marbles = rows;
      Composite.add(s.engine.world, rows);
      if (still) { for (let i = 0; i < 300; i++) Engine.update(s.engine, STEP); s.draw(); }
    },
  }), [still]);

  const pickAt = (clientX, clientY) => {
    const s = sim.current, r = canvas.current.getBoundingClientRect();
    if (!s) return null;
    s.sound.wake();
    const pt = { x: clientX - r.left, y: clientY - r.top };
    const hit = Query.point(s.marbles, pt)[0]
      || s.marbles.find(b => Math.hypot(b.position.x - pt.x, b.position.y - pt.y) < b.r + 8);   // small marbles: a little leeway
    return hit ? hit.item : null;
  };

  return (
    <canvas ref={canvas} role="img" aria-label={`A jar of ${words.length} marbles, one for each word`}
      onPointerDown={e => onPick(pickAt(e.clientX, e.clientY))}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "pointer" }} />
  );
});

const day = t => new Date(t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

// A small full jar for the shelf.
const ShelfJar = ({ n }) => (
  <div style={{ display: "grid", justifyItems: "center", gap: 2 }}>
    <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true">
      <path d="M11 2v4L4 11v27q0 3 3 3h20q3 0 3-3V11l-7-5V2z" fill="rgb(var(--ws-amber-rgb) / .35)" stroke="var(--ws-mist)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="9" y="0" width="16" height="4" rx="1.5" fill="var(--ws-mist)" />
    </svg>
    <span style={{ fontSize: 13, color: T.mist }}>{n}</span>
  </div>
);

/*
 * The jar screen. bank: word -> first-found time, or null to load it. Kept by the caller between visits.
 */
export function JarView({ name, bank, sceneRef }) {
  const list = useMemo(() => bankList(bank), [bank]);
  const jars = jarsFor(list.length);
  const sig = list.length ? `${list.length}:${list[list.length - 1].t}` : "0";
  const inJar = useMemo(() => list.slice(jars.start), [sig]); // eslint-disable-line
  const seenKey = `${SEEN_KEY}:${name}`;
  // What was last shown on this device. The first visit drops in just the latest round's words.
  const [seen] = useState(() => readJSON(seenKey, null) || { t: list.length ? list[list.length - 1].t - 1 : 0, n: list.length, first: true });
  const fresh = list.filter(x => x.t > seen.t).length;
  const filledJar = !seen.first && jarsFor(seen.n).full.length < jars.full.length;
  const [sound, setSound] = useState(() => readJSON(SOUND_KEY, true));
  const [picked, setPicked] = useState(null);
  const [sorted, setSorted] = useState(false);
  const [tiltAsk, setTiltAsk] = useState(() => typeof window !== "undefined" && window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === "function");
  const still = useMemo(reducedMotion, []);
  const local = useRef(null);
  const scene = sceneRef || local;
  const speak = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => { if (list.length) writeJSON(seenKey, { t: list[list.length - 1].t, n: list.length }); }, [list, seenKey]);
  useEffect(() => writeJSON(SOUND_KEY, sound), [sound]);

  // Tilt: the device's left-right lean, or (with a mouse) where the pointer is across the screen. Shake: a sharp jolt.
  useEffect(() => {
    if (still) return undefined;
    const onTilt = e => { if (e.gamma != null && scene.current) scene.current.tilt(e.gamma / 45); };
    let lastShake = 0;
    const onMotion = e => {
      const a = e.acceleration;
      if (!a || a.x == null) return;
      const now = Date.now();
      if (Math.hypot(a.x, a.y, a.z) > 15 && now - lastShake > 500) { lastShake = now; if (scene.current) scene.current.shake(); }
    };
    const onMouse = e => { if (e.pointerType === "mouse" && scene.current) scene.current.tilt(((e.clientX / window.innerWidth) - 0.5) * 2.4); };
    window.addEventListener("deviceorientation", onTilt);
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("pointermove", onMouse);
    return () => { window.removeEventListener("deviceorientation", onTilt); window.removeEventListener("devicemotion", onMotion); window.removeEventListener("pointermove", onMouse); };
  }, [still, scene]);

  const askTilt = async () => {
    try { await window.DeviceOrientationEvent.requestPermission(); if (window.DeviceMotionEvent && window.DeviceMotionEvent.requestPermission) await window.DeviceMotionEvent.requestPermission(); } catch { /* said no */ }
    setTiltAsk(false);
  };
  const say = w => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(w); u.rate = 0.85; speechSynthesis.speak(u); } catch { /* no voice */ } };
  const btn = { fontSize: 17, fontWeight: 600, background: "rgb(var(--ws-fg) / .08)", color: "var(--ws-text)", border: "none", borderRadius: 12, padding: "10px 16px", cursor: "pointer", minHeight: 44 };

  if (!list.length) {
    return <div style={{ color: T.mist, fontSize: 20, textAlign: "center", padding: "30px 10px" }}>Your jar is empty for now. Every word you find in a game drops in here.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 14, justifyItems: "center", width: "100%" }}>
      {(jars.full.length > 0) && (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "center" }} aria-label={`Full jars: ${jars.full.length}`}>
          {jars.full.map(n => <ShelfJar key={n} n={n} />)}
        </div>
      )}
      {filledJar && <div role="status" className="ws-display" style={{ fontSize: 20, fontWeight: 700, color: T.amber, textAlign: "center" }}>You filled a jar! It's on the shelf, and a new one has started.</div>}
      {fresh > 0 && !seen.first && <div role="status" style={{ fontSize: 17, color: T.green, fontWeight: 700 }}>{fresh} new {fresh === 1 ? "word" : "words"} since last time</div>}

      <div style={{ width: "min(400px, 88vw)", aspectRatio: "4 / 5", maxHeight: "62vh" }}>
        <JarScene ref={scene} words={inJar} dropAfter={seen.t} capacity={jars.size} sound={sound} picked={picked && picked.w}
          onPick={item => setPicked(item)} />
      </div>

      <div style={{ fontSize: 16, color: T.mist }}>{jars.inJar} of {jars.size} in this jar</div>

      {picked ? (
        <div className="ws-fade" style={{ display: "grid", justifyItems: "center", gap: 6, background: "rgb(var(--ws-fg) / .06)", borderRadius: 16, padding: "14px 22px", minWidth: 240 }}>
          <div className="ws-display" style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2, color: lengthOf(picked.w).colour }}>{picked.w.toUpperCase()}</div>
          <div style={{ fontSize: 15, color: T.mist }}>First found on {day(picked.t)}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {speak && <button className="ws-btn" onClick={() => say(picked.w)} style={btn}>🔊 Say it</button>}
            <button className="ws-btn" onClick={() => setPicked(null)} style={btn}>Put it back</button>
          </div>
        </div>
      ) : <div style={{ fontSize: 15, color: T.mist, textAlign: "center" }}>{still ? "Tap a marble to see its word." : "Tilt to roll them, shake to rattle them, tap one to see its word."}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {!still && <button className="ws-btn" onClick={() => scene.current && scene.current.shake()} style={btn}>Shake</button>}
        <button className="ws-btn" aria-pressed={sorted} onClick={() => { const on = !sorted; setSorted(on); if (scene.current) scene.current.sort(on); }} style={btn}>{sorted ? "Mix them up" : "Sort by length"}</button>
        {!still && <button className="ws-btn" aria-pressed={sound} onClick={() => setSound(x => !x)} style={btn}>{sound ? "🔔 Sound on" : "🔕 Sound off"}</button>}
        {tiltAsk && !still && <button className="ws-btn" onClick={askTilt} style={{ ...btn, background: T.amber, color: T.ink }}>Turn on tilting</button>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", fontSize: 14, color: T.mist }}>
        {LENGTHS.map(l => (
          <span key={l.min} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: "50%", background: l.colour }} />{l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// The screen opened from the student's lobby: loads the bank, keeping the last copy so it opens at once next time.
export function WordJar({ name, cached, refresh, onLoaded, onClose }) {
  const [bank, setBank] = useState(cached || null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true, timer = null;
    const load = retry => call("player:words").then(res => {
      if (!alive) return;
      if (res.ok) { setBank(res.bank); setError(""); if (onLoaded) onLoaded(res.bank); }
      else if (res.error === "slow-down" && retry) timer = setTimeout(() => load(false), 2100);
      else if (!cached) setError("Your jar didn't load. Try again in a moment.");
    });
    load(true);
    return () => { alive = false; clearTimeout(timer); };
  }, [refresh]); // eslint-disable-line
  const n = bank ? Object.keys(bank).length : 0;
  return (
    <div className="ws-fade" style={{ width: "100%", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 32 }}>{name}'s word jar{bank && <span style={{ color: T.mist, fontWeight: 500, fontSize: 20 }}> · {n} {n === 1 ? "word" : "words"}</span>}</h1>
        <button className="ws-btn ws-display" onClick={onClose} style={{ fontSize: 18, fontWeight: 600, background: "rgb(var(--ws-fg) / .1)", color: "var(--ws-text)", border: "none", borderRadius: 12, padding: "10px 18px", cursor: "pointer" }}>← Back</button>
      </div>
      {error && <div role="alert" style={{ color: T.red }}>{error}</div>}
      {!bank && !error && <div style={{ color: T.mist, fontSize: 20 }}>Opening the jar…</div>}
      {bank && <JarView name={name} bank={bank} />}
    </div>
  );
}
