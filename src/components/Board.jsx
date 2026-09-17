import { useMemo } from "react";
import { T } from "../theme.js";

export function Board({ tiles, rots, size, dim, hidden, tumble, path, pathKey, targetSet }) {
  const gap = `calc(${dim} * 0.018)`;
  const centers = useMemo(() => (path || []).map(i => ({ x: ((i % size) + 0.5) / size * 100, y: (Math.floor(i / size) + 0.5) / size * 100 })), [path, size]);
  return (
    <div style={{ width: dim, height: dim, position: "relative", background: T.well, borderRadius: `calc(${dim} * 0.04)`, padding: `calc(${dim} * 0.028)`, boxShadow: `inset 0 4px 18px rgba(0,0,0,.45), 0 0 0 4px ${T.wellEdge}` }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${size},1fr)`, gap, width: "100%", height: "100%" }}>
        {tiles.map((t, i) => {
          const isTarget = !hidden && targetSet && targetSet.has(t.toLowerCase());
          return (
            <div key={i} className="ws-display" style={{
              "--rt": `${rots[i]}deg`,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hidden ? "rgba(255,255,255,0.05)"
                : isTarget ? `linear-gradient(to top, ${T.amber} 0%, ${T.amber} 9%, ${T.dice} 9%)` : T.dice,
              color: T.letter, borderRadius: `calc(${dim} * 0.018)`,
              transform: `rotate(${rots[i]}deg)`,
              boxShadow: hidden ? "none" : `inset 0 -5px 0 ${T.diceEdge}, inset 0 2px 6px rgba(255,255,255,.8), 0 3px 6px rgba(0,0,0,.35)`,
              fontWeight: 700,
              fontSize: `calc(${dim} / ${size} * ${t.length > 2 ? 0.24 : t.length > 1 ? 0.32 : 0.48})`,
              animation: tumble && !hidden ? `ws-tumble .5s ${i * 0.03}s cubic-bezier(.2,.9,.3,1.2) both` : "none",
              userSelect: "none",
            }}>{hidden ? "" : t[0].toUpperCase() + t.slice(1).toLowerCase()}</div>
          );
        })}
      </div>
      {centers.length > 1 && (
        <svg key={pathKey} viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position: "absolute", inset: `calc(${dim} * 0.028)`, width: `calc(100% - ${dim} * 0.056)`, height: `calc(100% - ${dim} * 0.056)`, pointerEvents: "none", overflow: "visible" }}>
          <polyline points={centers.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={T.amber} strokeWidth="3.2"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9" pathLength="100"
            style={{ strokeDasharray: 100, animation: "ws-draw 1.4s .2s ease both" }} />
          {centers.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 3.4 : 2.2} fill={i === 0 ? T.amber : "rgba(255,176,32,.85)"} stroke={i === 0 ? T.ink : "none"} strokeWidth={i === 0 ? 1 : 0} />
          ))}
        </svg>
      )}
    </div>
  );
}
