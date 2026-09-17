import { T } from "../theme.js";

/* ---------- highlighted word ---------- */
export function Hi({ word, ranges, fontSize = 20 }) {
  const marks = new Array(word.length).fill(false);
  for (const [s, e] of ranges || []) for (let i = s; i < e && i < word.length; i++) marks[i] = true;
  const parts = [];
  let i = 0;
  while (i < word.length) {
    let j = i;
    while (j < word.length && marks[j] === marks[i]) j++;
    parts.push({ text: word.slice(i, j), on: marks[i] });
    i = j;
  }
  return (
    <span className="ws-display" style={{ fontSize, fontWeight: 600, letterSpacing: 1 }}>
      {parts.map((p, k) => (
        <span key={k} style={p.on ? { color: T.amber, borderBottom: `2px solid ${T.amber}` } : {}}>{p.text.toUpperCase()}</span>
      ))}
    </span>
  );
}
