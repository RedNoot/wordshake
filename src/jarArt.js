/*
 * How the word jar's shop looks are drawn (the catalogue is in shared/looks/marbles.js and jars.js).
 *   marbleSprite: one marble, drawn once per colour and size and then stamped every frame.
 *   JAR_ART:      per jar id, what's painted behind the marbles (back) and over them (front): lids, water, snow.
 *                 `moving` jars are redrawn every frame; under reduced motion everything is drawn once and holds still.
 */
import { DEFAULT_MARBLES } from "../shared/looks/marbles.js";
import { DEFAULT_JAR } from "../shared/looks/jars.js";

export const mix = (hex, to, f) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f));
  return `rgb(${c.join(",")})`;
};
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const light = hex => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150; };

// The same "random" speckles every time a sprite is drawn.
const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const seedOf = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;

// The shine every marble gets: a small soft oval up and to the left.
const shine = (g, m, r, a = 0.75) => {
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.beginPath(); g.ellipse(m - r * 0.36, m - r * 0.42, r * 0.24, r * 0.16, -0.6, 0, Math.PI * 2); g.fill();
};
const ball = (g, m, r, stops) => {
  const grad = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
  for (const [at, c] of stops) grad.addColorStop(at, c);
  g.fillStyle = grad;
  g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill();
};

const FINISH = {
  glass(g, m, r, c) {
    ball(g, m, r, [[0, mix(c, "#FFFFFF", 0.55)], [0.55, c], [1, mix(c, "#000000", 0.45)]]);
    shine(g, m, r);
  },
  // Soft and milky, with a faint rainbow ring.
  pearl(g, m, r, c) {
    ball(g, m, r, [[0, mix(c, "#FFFFFF", 0.8)], [0.6, c], [1, mix(c, "#6A5A8A", 0.35)]]);
    g.lineWidth = Math.max(1, r * 0.12);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.beginPath(); g.arc(m, m, r * 0.78, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
    shine(g, m, r, 0.55);
  },
  // A cat's-eye: clear glass with a twist of colour through the middle.
  swirl(g, m, r, c) {
    ball(g, m, r, [[0, "rgba(255,255,255,0.55)"], [0.7, mix(c, "#FFFFFF", 0.7)], [1, mix(c, "#000000", 0.35)]]);
    g.save();
    g.beginPath(); g.arc(m, m, r * 0.96, 0, Math.PI * 2); g.clip();
    g.fillStyle = c;
    for (const turn of [0, Math.PI]) {
      g.beginPath();
      g.moveTo(m, m);
      g.bezierCurveTo(m + Math.cos(turn) * r * 0.9, m + Math.sin(turn) * r * 0.2, m + Math.cos(turn + 0.9) * r * 1.1, m + Math.sin(turn + 0.9) * r * 1.1, m + Math.cos(turn + 1.6) * r, m + Math.sin(turn + 1.6) * r);
      g.bezierCurveTo(m + Math.cos(turn + 1.3) * r * 0.5, m + Math.sin(turn + 1.3) * r * 0.5, m + Math.cos(turn + 0.3) * r * 0.3, m + Math.sin(turn + 0.3) * r * 0.3, m, m);
      g.fill();
    }
    g.restore();
    shine(g, m, r, 0.85);
  },
  // Little dots: stars on dark colours, freckles on light ones (Easter eggs).
  speckle(g, m, r, c, rand) {
    const pale = light(c);
    ball(g, m, r, pale ? [[0, mix(c, "#FFFFFF", 0.5)], [0.6, c], [1, mix(c, "#5A4030", 0.3)]] : [[0, mix(c, "#FFFFFF", 0.3)], [0.5, c], [1, mix(c, "#0A0A30", 0.6)]]);
    g.fillStyle = pale ? "rgba(90,60,40,0.45)" : "rgba(255,255,255,0.85)";
    for (let i = 0; i < Math.max(4, r * 0.7); i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * 0.8;
      g.beginPath(); g.arc(m + Math.cos(a) * d, m + Math.sin(a) * d, Math.max(0.6, r * (pale ? 0.07 : 0.05) * (0.5 + rand())), 0, Math.PI * 2); g.fill();
    }
    shine(g, m, r, 0.6);
  },
  // Lit from inside, with a soft halo round the edge.
  glow(g, m, r, c) {
    const halo = g.createRadialGradient(m, m, r * 0.8, m, m, r * 1.45);
    halo.addColorStop(0, rgba(c, 0.45)); halo.addColorStop(1, rgba(c, 0));
    g.fillStyle = halo;
    g.beginPath(); g.arc(m, m, r * 1.45, 0, Math.PI * 2); g.fill();
    ball(g, m, r, [[0, "#FFFFFF"], [0.35, mix(c, "#FFFFFF", 0.55)], [1, c]]);
    shine(g, m, r, 0.5);
  },
  // Cut like a jewel: flat facets in light and dark, round the middle.
  gem(g, m, r, c) {
    g.fillStyle = c;
    g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill();
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = mix(c, i % 2 ? "#000000" : "#FFFFFF", i % 2 ? 0.22 + (i % 3) * 0.06 : 0.25 + (i % 3) * 0.08);
      g.beginPath(); g.moveTo(m + Math.cos(a0) * r * 0.45, m + Math.sin(a0) * r * 0.45);
      g.lineTo(m + Math.cos(a0) * r, m + Math.sin(a0) * r); g.lineTo(m + Math.cos(a1) * r, m + Math.sin(a1) * r);
      g.lineTo(m + Math.cos(a1) * r * 0.45, m + Math.sin(a1) * r * 0.45); g.closePath(); g.fill();
    }
    g.fillStyle = mix(c, "#FFFFFF", 0.35);
    g.beginPath();
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; g.lineTo(m + Math.cos(a) * r * 0.45, m + Math.sin(a) * r * 0.45); }
    g.closePath(); g.fill();
    shine(g, m, r, 0.9);
  },
  // Polished metal: bright bands top and bottom, a dark one through the middle.
  metal(g, m, r, c) {
    const grad = g.createLinearGradient(m, m - r, m, m + r);
    grad.addColorStop(0, mix(c, "#FFFFFF", 0.7)); grad.addColorStop(0.35, c); grad.addColorStop(0.5, mix(c, "#000000", 0.45));
    grad.addColorStop(0.62, c); grad.addColorStop(1, mix(c, "#FFFFFF", 0.4));
    g.fillStyle = grad;
    g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = mix(c, "#000000", 0.3); g.lineWidth = Math.max(1, r * 0.08);
    g.beginPath(); g.arc(m, m, r * 0.96, 0, Math.PI * 2); g.stroke();
    shine(g, m, r, 0.95);
  },
  // A Christmas bauble: shiny glass with a little silver cap on top.
  bauble(g, m, r, c) {
    ball(g, m, r, [[0, mix(c, "#FFFFFF", 0.65)], [0.45, c], [1, mix(c, "#000000", 0.5)]]);
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = Math.max(1, r * 0.1);
    g.beginPath(); g.ellipse(m, m, r * 0.95, r * 0.28, 0, 0, Math.PI); g.stroke();
    g.fillStyle = "#C9CED6";
    g.fillRect(m - r * 0.28, m - r * 1.12, r * 0.56, r * 0.26);
    g.strokeStyle = "#C9CED6"; g.lineWidth = Math.max(1, r * 0.08);
    g.beginPath(); g.arc(m, m - r * 1.2, r * 0.13, 0, Math.PI * 2); g.stroke();
    shine(g, m, r, 0.9);
  },
};
// How far a finish draws outside the marble, as a share of its radius.
const PAD = { glow: 0.5, bauble: 0.4 };

// One marble: { canvas, pad } where pad is how far the picture reaches past the marble's edge.
export function marbleSprite(set, colour, r, dpr) {
  const finish = FINISH[set.finish] ? set.finish : "glass";
  const pad = 1 + r * (PAD[finish] || 0);
  const c = document.createElement("canvas"), s = Math.ceil((r + pad) * 2 * dpr);
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  FINISH[finish](g, r + pad, r, colour, seeded(seedOf(colour + r)));
  return { canvas: c, pad };
}

// The marble set and jar a device is wearing, as drawable looks. Anything unknown is the default.
export const marbleSetOf = (items, id) => (id && items.find(i => i.id === id && i.slot === "marble")) || DEFAULT_MARBLES;
export const jarOf = (items, id) => (id && items.find(i => i.id === id && i.slot === "jar")) || DEFAULT_JAR;

// roundRect isn't on older iPads' canvas: a plain rectangle there.
export const rounded = (g, x, y, w, h, r) => (g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h));

/*
 * The drawing for each jar. Each part gets { g, W, H, path (the jar's inside), shape (the left side, in pixels),
 * glass(a) (the page's foreground at alpha a), fg ([r, g, b] of it), tint, t (ms, for the moving ones) }.
 */
const inside = (k, fn) => { k.g.save(); k.g.clip(k.path); fn(); k.g.restore(); };
const top = k => ({ l: k.shape[0][0], r: k.W - k.shape[0][0], y: k.shape[0][1] });
// The jar's edge in its own colour, pulled a little towards the page's text colour so it shows on light themes too.
const edge = (k, a) => {
  const n = parseInt(k.tint.slice(1), 16), fg = k.fg.map(Number);
  return `rgba(${[n >> 16, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * 0.65 + fg[i] * 0.35)).join(",")},${a})`;
};
const outline = (k, a = 0.45) => {
  const { g } = k;
  g.lineWidth = 4; g.lineJoin = "round";
  g.strokeStyle = k.jar.id === "glass" ? k.glass(0.4) : edge(k, Math.min(1, a + 0.25));
  g.stroke(k.path);
};
// The shine down the glass: follows the left side, a little inside it.
const streak = k => {
  const { g, shape, W } = k, n = shape.length;
  const pts = shape.slice(Math.floor(n * 0.3), Math.ceil(n * 0.8) + 1);
  if (pts.length < 2) return;
  g.strokeStyle = k.glass(0.1); g.lineWidth = W * 0.035; g.lineCap = "round";
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + W * 0.06, y) : g.moveTo(x + W * 0.06, y))); g.stroke();
  g.lineCap = "butt";
};
const band = (k, colour, h = 0.028) => {
  const { l, r, y } = top(k);
  k.g.fillStyle = colour;
  k.g.beginPath(); rounded(k.g, l - 4, y, r - l + 8, k.H * h, 4); k.g.fill();
};

const plain = { back: k => { k.g.fillStyle = rgba(k.tint, 0.08); k.g.fill(k.path); } };

export const JAR_ART = {
  glass: {
    back: k => { k.g.fillStyle = k.glass(0.05); k.g.fill(k.path); },
    front: k => { outline(k); streak(k); band(k, k.glass(0.35)); },
  },
  "jar-fishbowl": {
    moving: true,
    back: k => inside(k, () => {
      const { g, W, H, t } = k, level = H * 0.34;
      g.fillStyle = rgba(k.tint, 0.18);
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, level + Math.sin(x / 26 + t / 700) * 3);
      g.lineTo(W, H); g.closePath(); g.fill();
    }),
    front: k => {
      const { g, W, H, t } = k;
      inside(k, () => {
        g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 1.5;
        for (let i = 0; i < 7; i++) {
          const cycle = 5200 + i * 700, p = ((t + i * 1900) % cycle) / cycle;
          const x = W * (0.25 + ((i * 0.37) % 0.5)) + Math.sin(p * 9 + i) * 5, y = H * 0.94 - p * H * 0.58;
          g.beginPath(); g.arc(x, y, 2.5 + (i % 3), 0, Math.PI * 2); g.stroke();
        }
      });
      outline(k, 0.6); streak(k);
      const { l, r, y } = top(k);
      g.strokeStyle = rgba(k.tint, 0.75); g.lineWidth = 6;
      g.beginPath(); g.ellipse(W / 2, y + 2, (r - l) / 2 + 6, H * 0.018, 0, 0, Math.PI * 2); g.stroke();
    },
  },
  "jar-honey": {
    back: k => inside(k, () => {
      const { g, W, H } = k, s = W * 0.06;
      g.fillStyle = rgba(k.tint, 0.1); g.fill(k.path);
      g.strokeStyle = rgba(k.tint, 0.18); g.lineWidth = 1.5;
      for (let row = 0; row * s * 1.5 < H; row++) {
        for (let col = 0; col * s * 1.73 < W + s; col++) {
          const cx = col * s * 1.73 + (row % 2) * s * 0.87, cy = row * s * 1.5;
          g.beginPath();
          for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); }
          g.closePath(); g.stroke();
        }
      }
    }),
    front: k => {
      const { g, W, H } = k, { l, r, y } = top(k);
      outline(k, 0.6); streak(k);
      // a cloth cover tied on with string, and a drip of honey down the side
      g.fillStyle = "#E8574F";
      g.beginPath(); g.moveTo(l - W * 0.07, y + H * 0.07); g.quadraticCurveTo(W / 2, y - H * 0.09, r + W * 0.07, y + H * 0.07);
      g.lineTo(r + W * 0.04, y + H * 0.1); g.lineTo(l - W * 0.04, y + H * 0.1); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(l + ((r - l) * (i + 0.5)) / 6, y + H * 0.045 - Math.sin(((i + 0.5) / 6) * Math.PI) * H * 0.04, W * 0.012, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = "#C9A26A"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(l - 2, y + H * 0.085); g.lineTo(r + 2, y + H * 0.085); g.stroke();
      g.fillStyle = rgba(k.tint, 0.9);
      g.beginPath(); g.moveTo(r - W * 0.02, y + H * 0.1); g.lineTo(r - W * 0.06, y + H * 0.1);
      g.quadraticCurveTo(r - W * 0.06, y + H * 0.15, r - W * 0.04, y + H * 0.17); g.quadraticCurveTo(r - W * 0.02, y + H * 0.15, r - W * 0.02, y + H * 0.1); g.fill();
    },
  },
  "jar-cookie": {
    back: plain.back,
    front: k => {
      const { g, W, H } = k, { l, r, y } = top(k);
      outline(k, 0.6); streak(k);
      // a china lid with a round knob, and a stripe round the neck
      g.fillStyle = "#F6E7CF"; g.strokeStyle = "#C9A26A"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(l - W * 0.05, y + H * 0.02); g.quadraticCurveTo(W / 2, y - H * 0.14, r + W * 0.05, y + H * 0.02); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#E2B979";
      g.beginPath(); rounded(g, l - W * 0.05, y + H * 0.01, r - l + W * 0.1, H * 0.025, 5); g.fill();
      g.fillStyle = "#F6E7CF";
      g.beginPath(); g.arc(W / 2, y - H * 0.085, W * 0.035, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = "#9A5B2E";
      for (const [dx, dy] of [[-0.12, -0.03], [0.06, -0.05], [0.15, -0.015], [-0.03, -0.015]]) { g.beginPath(); g.arc(W / 2 + dx * W, y + dy * H, W * 0.009, 0, Math.PI * 2); g.fill(); }
    },
  },
  "jar-rocket": {
    moving: true,
    back: plain.back,
    front: k => {
      const { g, W, H, t, shape } = k, { l, r, y } = top(k);
      const last = shape[shape.length - 1], bottom = last[1];
      // fins either side of the tail, then the flame under it
      g.fillStyle = "#E8574F";
      for (const s of [-1, 1]) {
        const x0 = W / 2 + s * (W / 2 - shape[3][0]);
        g.beginPath(); g.moveTo(x0, H * 0.54); g.lineTo(x0 + s * W * 0.15, H * 0.8); g.lineTo(x0 + s * W * 0.15, H * 0.88); g.lineTo(x0, H * 0.79); g.closePath(); g.fill();
      }
      const flick = 1 + Math.sin(t / 60) * 0.15 + Math.sin(t / 37) * 0.1;
      g.fillStyle = "#FFB020";
      g.beginPath(); g.moveTo(last[0] + 6, bottom); g.quadraticCurveTo(W / 2, bottom + (H - bottom) * 1.1 * flick, W - last[0] - 6, bottom); g.fill();
      g.fillStyle = "#FFF07A";
      g.beginPath(); g.moveTo(last[0] + 20, bottom); g.quadraticCurveTo(W / 2, bottom + (H - bottom) * 0.6 * flick, W - last[0] - 20, bottom); g.fill();
      outline(k, 0.7); streak(k);
      // the nose cone over the top
      g.fillStyle = "#E8574F";
      g.beginPath(); g.moveTo(l - 6, y + 3); g.quadraticCurveTo(W / 2 - W * 0.06, y - H * 0.1, W / 2, y - H * 0.15); g.quadraticCurveTo(W / 2 + W * 0.06, y - H * 0.1, r + 6, y + 3); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.beginPath(); g.ellipse(W / 2 - W * 0.04, y - H * 0.06, W * 0.012, H * 0.035, 0.3, 0, Math.PI * 2); g.fill();
    },
  },
  "jar-crystal": {
    moving: true,
    back: plain.back,
    front: k => {
      const { g, W, H, t, shape } = k;
      outline(k, 0.75);
      // facet lines from each corner towards the middle
      g.strokeStyle = rgba(k.tint, 0.22); g.lineWidth = 1.5;
      for (const [x, y] of shape.slice(1)) for (const s of [0, 1]) { const px = s ? W - x : x; g.beginPath(); g.moveTo(px, y); g.lineTo(W / 2 + (px - W / 2) * 0.55, H * 0.55 + (y - H * 0.55) * 0.55); g.stroke(); }
      streak(k);
      // a few twinkles on the glass
      g.fillStyle = "#FFFFFF";
      [[0.2, 0.32], [0.78, 0.45], [0.3, 0.78], [0.7, 0.85]].forEach(([fx, fy], i) => {
        const s = W * 0.025 * Math.max(0, Math.sin(t / 500 + i * 1.7));
        if (s < 0.5) return;
        const x = fx * W, y = fy * H;
        g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s * 0.4, y - s * 0.4); g.lineTo(x + s * 2, y); g.lineTo(x + s * 0.4, y + s * 0.4);
        g.lineTo(x, y + s * 2); g.lineTo(x - s * 0.4, y + s * 0.4); g.lineTo(x - s * 2, y); g.lineTo(x - s * 0.4, y - s * 0.4); g.closePath(); g.fill();
      });
      // a cut-glass stopper
      const { y } = top(k);
      g.fillStyle = rgba(k.tint, 0.85);
      g.beginPath(); g.moveTo(W / 2, y - H * 0.06); g.lineTo(W / 2 + W * 0.1, y + H * 0.01); g.lineTo(W / 2, y + H * 0.05); g.lineTo(W / 2 - W * 0.1, y + H * 0.01); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.beginPath(); g.moveTo(W / 2, y - H * 0.06); g.lineTo(W / 2 - W * 0.1, y + H * 0.01); g.lineTo(W / 2, y + H * 0.01); g.closePath(); g.fill();
    },
  },
  "halloween-pumpkin-jar": {
    back: k => { k.g.fillStyle = rgba(k.tint, 0.12); k.g.fill(k.path); },
    front: k => {
      const { g, W, H } = k, { y } = top(k);
      inside(k, () => {
        // the pumpkin's ribs, and a friendly face
        g.strokeStyle = rgba(k.tint, 0.3); g.lineWidth = 3;
        for (const f of [0.18, 0.36]) for (const s of [-1, 1]) { g.beginPath(); g.ellipse(W / 2, H * 0.62, W * f, H * 0.33, 0, s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s < 0 ? Math.PI * 1.5 : Math.PI * 0.5); g.stroke(); }
        g.fillStyle = "rgba(255,214,90,0.22)";
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + s * W * 0.2, H * 0.44); g.lineTo(W / 2 + s * W * 0.12, H * 0.54); g.lineTo(W / 2 + s * W * 0.28, H * 0.54); g.closePath(); g.fill(); }
        g.beginPath(); g.moveTo(W * 0.27, H * 0.66); g.quadraticCurveTo(W / 2, H * 0.86, W * 0.73, H * 0.66); g.quadraticCurveTo(W / 2, H * 0.76, W * 0.27, H * 0.66); g.fill();
      });
      outline(k, 0.7); streak(k);
      band(k, "#4E7A2A", 0.03);
      // the stalk, curling over, with a leaf
      g.fillStyle = "#4E7A2A";
      g.beginPath(); g.moveTo(W / 2 - W * 0.03, y); g.quadraticCurveTo(W / 2 - W * 0.02, y - H * 0.1, W / 2 + W * 0.07, y - H * 0.11);
      g.lineTo(W / 2 + W * 0.07, y - H * 0.08); g.quadraticCurveTo(W / 2 + W * 0.01, y - H * 0.07, W / 2 + W * 0.03, y); g.closePath(); g.fill();
      g.fillStyle = "#6FA83A";
      g.beginPath(); g.ellipse(W / 2 - W * 0.09, y - H * 0.035, W * 0.06, H * 0.02, -0.4, 0, Math.PI * 2); g.fill();
    },
  },
  "christmas-snow-globe": {
    moving: true,
    back: k => { k.g.fillStyle = rgba(k.tint, 0.1); k.g.fill(k.path); },
    front: k => {
      const { g, W, H, t, shape } = k;
      inside(k, () => {
        g.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 26; i++) {
          const cycle = 9000 + (i % 5) * 1300, p = ((t + i * 977) % cycle) / cycle;
          const x = W * (0.1 + ((i * 0.618) % 0.8)) + Math.sin(p * 6 + i) * W * 0.03, y = H * 0.1 + p * H * 0.72;
          g.beginPath(); g.arc(x, y, 1.5 + (i % 3) * 0.8, 0, Math.PI * 2); g.fill();
        }
      });
      // the whole globe (closed at the top), then the wooden stand over its foot
      g.lineWidth = 4; g.strokeStyle = edge(k, 0.75);
      g.beginPath(); g.arc(W / 2, H * 0.5, W * 0.44, 0, Math.PI * 2); g.stroke();
      streak(k);
      const foot = shape[shape.length - 1];
      g.fillStyle = "#8A4B2A";
      g.beginPath(); g.moveTo(foot[0] - 4, foot[1] - 2); g.lineTo(W - foot[0] + 4, foot[1] - 2); g.lineTo(W * 0.84, H * 0.97); g.lineTo(W * 0.16, H * 0.97); g.closePath(); g.fill();
      g.fillStyle = "#C0392B";
      g.beginPath(); rounded(g, W * 0.2, foot[1] + H * 0.07, W * 0.6, H * 0.035, 4); g.fill();
    },
  },
  "easter-egg-jar": {
    back: k => { k.g.fillStyle = rgba(k.tint, 0.12); k.g.fill(k.path); },
    front: k => {
      const { g, W, H } = k;
      inside(k, () => {
        // a zigzag ribbon round the middle, like a painted egg
        g.strokeStyle = "rgba(255,170,200,0.55)"; g.lineWidth = W * 0.025; g.lineJoin = "round";
        g.beginPath(); for (let i = 0; i <= 12; i++) g.lineTo((W * i) / 12, H * 0.5 + (i % 2 ? -1 : 1) * H * 0.025); g.stroke();
        g.strokeStyle = "rgba(150,210,255,0.45)"; g.lineWidth = W * 0.012;
        for (const yy of [0.43, 0.57]) { g.beginPath(); g.moveTo(0, H * yy); g.lineTo(W, H * yy); g.stroke(); }
      });
      outline(k, 0.7); streak(k);
      band(k, "#FFB3C7", 0.03);
    },
  },
};
export const artFor = jar => JAR_ART[jar.id] || { back: plain.back, front: k => { outline(k); streak(k); band(k, rgba(k.tint, 0.5)); } };
