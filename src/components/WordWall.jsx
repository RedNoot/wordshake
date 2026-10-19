import { useLayoutEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { T } from "../theme.js";

const { Engine, Bodies, Body, Composite, Sleeping } = Matter;

/*
 * Class together: the big screen's word pile. Every word the class finds drops in from the top and tumbles onto the
 * pile (no names); each time another student finds the same word, it grows. When the pile gets near the top,
 * everything shrinks a little so there's always room. Reduced motion: the words sit as a still list, sized the same way.
 * words: oldest first, as the server sends them; counts[i]: how many students found words[i].
 */
const BASE = 20;           // font size (px) of a word found by one student
const GROW = 0.3;          // each extra student who finds it adds this much of BASE
const MAX_GROW = 2.6;      // the biggest a word gets, as a multiple of BASE
export const sizeFor = n => Math.min(MAX_GROW, 1 + GROW * Math.max(0, (n || 1) - 1));
const STEP = 1000 / 60;    // physics step (ms), fixed so a 120Hz screen doesn't run it double speed

const chip = {
  position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", fontWeight: 700, letterSpacing: ".05em", lineHeight: 1.1,
  background: "rgb(var(--ws-green-rgb) / .16)", border: "2px solid rgb(var(--ws-green-rgb) / .55)", borderRadius: ".45em",
  padding: ".25em .55em", willChange: "transform",
};

function reducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

export function WordWall({ words, counts = [], of, height }) {
  const [still] = useState(reducedMotion);
  return (
    <section aria-label="Words the class has found" style={{ width: "min(480px, 92vw)", height, display: "flex", flexDirection: "column", gap: 10, background: "rgb(var(--ws-fg) / .05)", border: `1px solid ${T.faint}`, borderRadius: 18, padding: "14px 16px", minHeight: 0 }}>
      <div role="status" className="ws-display" style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ fontSize: 26 }}>🤝</span>
        <b key={words.length} style={{ fontSize: 40, color: T.amber, lineHeight: 1, animation: words.length ? "ws-pop .4s ease both" : "none" }}>{words.length}</b>
        <span style={{ fontSize: 20, color: T.mist }}>of {of} words found together</span>
      </div>
      <div style={{ height: 8, background: "rgb(var(--ws-fg) / .1)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${of ? Math.min(100, (words.length / of) * 100) : 0}%`, background: T.green, borderRadius: 999, transition: "width .4s ease" }} />
      </div>
      {words.length === 0 && <div style={{ color: T.mist, fontSize: 17 }}>Every word anyone finds drops in here. Find it too and it grows!</div>}
      {still ? <StillWords words={words} counts={counts} /> : <WordPile words={words} counts={counts} />}
    </section>
  );
}

function StillWords({ words, counts }) {
  const newestFirst = words.map((w, i) => [w, counts[i]]).reverse();
  return (
    <div style={{ overflowY: "auto", minHeight: 0, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start", alignItems: "center" }}>
      {newestFirst.map(([w, n]) => <span key={w} className="ws-display" style={{ ...chip, position: "static", fontSize: BASE * sizeFor(n) }}>{w.toUpperCase()}</span>)}
    </div>
  );
}

/*
 * The physics (matter-js) moves invisible boxes; each frame the word chips are moved to match. React draws the chips;
 * their size and position are set here directly, so a chip and its box always agree.
 */
function WordPile({ words, counts }) {
  const box = useRef(null);
  const els = useRef(new Map());     // word -> its chip
  const sim = useRef(null);          // { engine, items: Map(word -> { body, scale }), walls, fit }

  useLayoutEffect(() => {
    const engine = Engine.create({ enableSleeping: true });
    const s = { engine, items: new Map(), walls: [], fit: 1 };
    sim.current = s;
    const build = () => {
      const w = box.current.clientWidth, h = box.current.clientHeight;
      Composite.remove(engine.world, s.walls);
      const tall = h + 4000;   // the sides reach far above the top, so words still dropping in can't slip out
      s.walls = [
        Bodies.rectangle(w / 2, h + 50, w * 3, 100, { isStatic: true }),
        Bodies.rectangle(-50, h - tall / 2, 100, tall, { isStatic: true }),
        Bodies.rectangle(w + 50, h - tall / 2, 100, tall, { isStatic: true }),
      ];
      Composite.add(engine.world, s.walls);
      for (const it of s.items.values()) Sleeping.set(it.body, false);
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(box.current);

    let raf, last = performance.now(), acc = 0, sinceFit = 0;
    const tick = t => {
      acc += Math.min(100, t - last); last = t;
      while (acc >= STEP) { Engine.update(engine, STEP); acc -= STEP; }
      for (const [word, it] of s.items) {
        const el = els.current.get(word);
        // A chip looks the same turned half a turn, so draw it whichever way keeps the word the right way up.
        let a = it.body.angle % (2 * Math.PI);
        if (Math.cos(a) < 0) a += Math.PI;
        if (el) el.style.transform = `translate(${it.body.position.x}px, ${it.body.position.y}px) translate(-50%, -50%) rotate(${a}rad)`;
      }
      // About once a second: if the settled pile reaches near the top, shrink everything a little.
      if (++sinceFit > 60) {
        sinceFit = 0;
        const h = box.current.clientHeight;
        let top = Infinity;
        for (const it of s.items.values()) if (it.body.speed < 0.3 && it.body.position.y > 0) top = Math.min(top, it.body.bounds.min.y);
        if (top < h * 0.2 && s.fit > 0.4) {
          s.fit *= 0.88;
          for (const [word, it] of s.items) {
            Body.scale(it.body, 0.88, 0.88);
            Sleeping.set(it.body, false);
            const el = els.current.get(word);
            if (el) el.style.fontSize = `${BASE * s.fit * it.scale}px`;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); Engine.clear(engine); };
  }, []);

  // New words drop in from above the top (several at once queue up one above the other); repeats grow.
  useLayoutEffect(() => {
    const s = sim.current, w = box.current.clientWidth;
    let queued = 0;
    words.forEach((word, i) => {
      const el = els.current.get(word);
      if (!el) return;
      const scale = sizeFor(counts[i]);
      const it = s.items.get(word);
      if (!it) {
        el.style.fontSize = `${BASE * s.fit * scale}px`;
        const bw = el.offsetWidth, bh = el.offsetHeight;
        const x = bw / 2 + Math.random() * Math.max(1, w - bw);
        const body = Bodies.rectangle(x, -bh - queued * (bh + 30), bw, bh, {
          chamfer: { radius: bh * 0.3 }, restitution: 0.2, friction: 0.5, frictionStatic: 0.8, angle: (Math.random() - 0.5) * 0.6,
        });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
        Composite.add(s.engine.world, body);
        s.items.set(word, { body, scale });
        queued++;
      } else if (scale !== it.scale) {
        const r = scale / it.scale;
        Body.scale(it.body, r, r);
        Sleeping.set(it.body, false);
        Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 2, y: -4 });   // a little hop as it grows
        el.style.fontSize = `${BASE * s.fit * scale}px`;
        it.scale = scale;
        el.animate([{ filter: "brightness(1.7)" }, { filter: "brightness(1)" }], { duration: 700 });
      }
    });
  }, [words, counts]);

  return (
    <div ref={box} aria-hidden="true" style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", borderRadius: 12 }}>
      {words.map(word => (
        <span key={word} ref={el => { if (el) els.current.set(word, el); else els.current.delete(word); }} className="ws-display"
          style={{ ...chip, transform: "translate(-9999px, 0)" }}>{word.toUpperCase()}</span>
      ))}
    </div>
  );
}

// The end of a Class together round: the class's total, compared only with its own best on this kind of board.
export function bestLine(r) {
  if (!r.words) return "No words this time — let's go again!";
  if (r.newBest) return r.best == null ? "Our first Class together score on this board!" : `A new class best! (last best: ${r.best} words)`;
  if (r.words === r.best) return `We matched our class best of ${r.best} words!`;
  return `Our class best on this board is ${r.best} words — ${r.best - r.words + 1} more to beat it.`;
}
