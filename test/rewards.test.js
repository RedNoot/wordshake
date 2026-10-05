import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRound, weekKey, tierOf, emptySummary } from "../shared/rewards.js";

const MON = Date.UTC(2026, 9, 4, 22, 0);   // Monday 5 Oct, 9am in Melbourne
const day = 86400000;
const sw = { settings: { phSound: "ae" }, available: { ay: 3, ai: 2, "a-e": 0 } };
const plain = { settings: { phSound: null }, available: {} };

test("weeks are counted in Australian time", () => {
  assert.equal(weekKey(MON), "2026-W41");
  assert.equal(weekKey(MON - 3 * day), "2026-W40", "the Friday before");
  assert.equal(weekKey(MON + 4 * day + 6 * 3600e3), "2026-W41", "Friday afternoon");
});

test("sticker tiers", () => {
  assert.deepEqual([0, 1, 4, 5, 14, 15, 99].map(tierOf), [0, 1, 1, 2, 2, 3, 3]);
});

test("a first round: trophies for turning up, no personal bests yet", () => {
  const { summary, earned } = applyRound(null, { words: [], score: 0, bySpelling: {} }, plain, MON);
  assert.deepEqual(earned, { trophies: ["first-round"], stickers: [], best: [] });
  assert.equal(summary.rounds, 1);
  assert.deepEqual(summary.weeks, ["2026-W41"]);
});

test("words, stickers, full set and personal bests", () => {
  let s = applyRound(null, { words: ["cat"], score: 1, bySpelling: {} }, plain, MON).summary;
  const p = { words: ["play", "stay", "rain", "playing", "trains"], score: 12, bySpelling: { ay: ["play", "stay", "playing"], ai: ["rain", "trains"] } };
  const { summary, earned } = applyRound(s, p, sw, MON + day);
  assert.deepEqual(earned.best, ["score", "words"]);
  assert.deepEqual(earned.trophies.sort(), ["full-set", "high-five", "long-word", "sound-spotter"].sort());
  assert.deepEqual(earned.stickers, [{ sound: "ae", g: "ay", tier: 1 }, { sound: "ae", g: "ai", tier: 1 }]);
  assert.deepEqual(summary.stickers, { ae: { ay: 3, ai: 2 } });
  assert.equal(summary.words, 6);
  assert.equal(s.rounds, 1, "the old summary isn't changed");

  // Two more ay words: silver. Nothing earned twice; a lower score isn't a best.
  const again = applyRound(summary, { words: ["day", "way"], score: 2, bySpelling: { ay: ["day", "way"] } }, sw, MON + 2 * day);
  assert.deepEqual(again.earned, { trophies: [], stickers: [{ sound: "ae", g: "ay", tier: 2 }], best: [] });
});

test("full set needs every spelling that was on the board, and at least two", () => {
  const one = { settings: { phSound: "ae" }, available: { ay: 3 } };
  assert.ok(!applyRound(null, { words: ["day"], score: 1, bySpelling: { ay: ["day"] } }, one, MON).earned.trophies.includes("full-set"));
  assert.ok(!applyRound(null, { words: ["day"], score: 1, bySpelling: { ay: ["day"] } }, sw, MON).earned.trophies.includes("full-set"));
});

test("lifetime and weekly trophies; collector and gold", () => {
  let s = emptySummary();
  const got = [];
  for (let w = 0; w < 10; w++) {
    const r = applyRound(s, { words: Array.from({ length: 25 }, (_, i) => "w" + w + i), score: 25, bySpelling: { [`g${w % 6}`]: ["a", "b", "c"] } }, { settings: { phSound: `s${w}` }, available: {} }, MON + w * 7 * day);
    s = r.summary; got.push(...r.earned.trophies);
  }
  for (const id of ["words-50", "words-100", "words-250", "weeks-5", "weeks-10", "word-storm", "ten-words", "sound-collector"]) assert.ok(got.includes(id), id);
  assert.ok(!got.includes("gold-sticker"));
  const gold = applyRound(s, { words: ["x"], score: 1, bySpelling: { g0: Array(15).fill("x") } }, { settings: { phSound: "s0" }, available: {} }, MON);
  assert.ok(gold.earned.trophies.includes("gold-sticker"));
  assert.equal(got.length, new Set(got).size, "each trophy once");
});
