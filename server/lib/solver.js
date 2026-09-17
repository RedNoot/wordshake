import { BLOCKLIST, SEVERE_LONG } from "./blocklist.js";

/* ---------- engine (tested; relocated verbatim from the prototype) ---------- */
const nbrCache = {};
export function neighborsFor(size) {
  if (nbrCache[size]) return nbrCache[size];
  const n = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const list = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) list.push(rr * size + cc);
    }
    n.push(list);
  }
  return (nbrCache[size] = n);
}
export const diceFaces = d => (d.includes(",") ? d.split(",") : d.split("").map(c => (c === "Q" ? "Qu" : c)));
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const rollTiles = (DICE, size) => shuffle(DICE[size].slice()).map(d => { const f = diceFaces(d); return f[Math.floor(Math.random() * f.length)]; });

export function buildTrie(words) { const root = {}; for (const w of words) { let n = root; for (const ch of w) n = n[ch] || (n[ch] = {}); n.$ = 1; } return root; }
export function filterForBoard(words, tiles, minLen, maxLen) {
  const allowed = new Set(tiles.join("").toLowerCase());
  const out = [];
  outer: for (const w of words) {
    if (w.length < minLen || w.length > maxLen) continue;
    for (const ch of w) if (!allowed.has(ch)) continue outer;
    out.push(w);
  }
  return out;
}
export function solve(tiles, size, minLen, trie) {
  const nbrs = neighborsFor(size), found = new Set(), visited = new Array(tiles.length).fill(false);
  const dfs = (i, node, word) => {
    const s = tiles[i].toLowerCase(); let n = node;
    for (const ch of s) { n = n[ch]; if (!n) return; }
    const w = word + s; visited[i] = true;
    if (n.$ && w.length >= minLen) found.add(w);
    for (const j of nbrs[i]) if (!visited[j]) dfs(j, n, w);
    visited[i] = false;
  };
  for (let i = 0; i < tiles.length; i++) dfs(i, trie, "");
  return found;
}
export function findPath(tiles, size, word) {
  const nbrs = neighborsFor(size), visited = new Array(tiles.length).fill(false);
  let result = null;
  const dfs = (i, pos, path) => {
    if (result) return;
    const s = tiles[i].toLowerCase();
    if (word.slice(pos, pos + s.length) !== s) return;
    const np = pos + s.length;
    visited[i] = true; path.push(i);
    if (np === word.length) result = path.slice();
    else for (const j of nbrs[i]) if (!visited[j]) dfs(j, np, path);
    visited[i] = false; path.pop();
  };
  for (let i = 0; i < tiles.length && !result; i++) dfs(i, 0, []);
  return result;
}

/* ---- board-level screen: reject any board where a blocked word is traceable ---- */
let _rejectTrie = null;
function getRejectTrie() {
  if (!_rejectTrie) _rejectTrie = buildTrie([...BLOCKLIST].filter(w => w.length <= 6 || SEVERE_LONG.has(w)));
  return _rejectTrie;
}
export function boardIsClean(tiles, size) {
  return solve(tiles, size, 3, getRejectTrie()).size === 0;
}
