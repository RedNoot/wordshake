import { test } from "node:test";
import assert from "node:assert/strict";
import { standouts } from "../server/lib/round.js";

// A finished round with just what standouts reads: who played, and each player's words with their points.
const roundOf = players => ({
  eligible: new Set(players.filter(p => !p.late).map(p => p.id)),
  who: new Map(players.map(p => [p.id, { studentId: p.sid || null, name: p.name }])),
  found: new Map(players.map(p => [p.id, new Map(p.words.map(w => [w, { pts: w.length - 2, bonus: 0 }]))])),
});

test("standouts: top three scores, equal scores share a place, nobody on 0", () => {
  const r = roundOf([
    { id: "a", sid: "s1", name: "Ava", words: ["cats", "cat"] },      // 3
    { id: "b", sid: "s2", name: "Ben", words: ["cat"] },              // 1
    { id: "c", sid: "s3", name: "Cal", words: ["dogs", "dog"] },      // 3
    { id: "d", sid: "s4", name: "Dee", words: ["tac"] },              // 1
    { id: "e", sid: "s5", name: "Eli", words: ["catty", "tac"] },     // 4
    { id: "f", sid: "s6", name: "Fay", words: [] },                   // 0
  ]);
  assert.deepEqual(standouts(r).top, [
    { name: "Eli", score: 4, place: 1 },
    { name: "Ava", score: 3, place: 2 },
    { name: "Cal", score: 3, place: 2 },
  ], "a fourth-best score isn't on the podium");
});

test("standouts: everyone who found the longest word anyone found", () => {
  const r = roundOf([
    { id: "a", sid: "s1", name: "Ava", words: ["cats", "cat"] },
    { id: "b", name: "Max", words: ["dogs"] },                      // a guest counts too
    { id: "c", sid: "s3", name: "Cal", words: ["cat"] },
  ]);
  assert.deepEqual(standouts(r).longest, [{ name: "Ava", word: "cats" }, { name: "Max", word: "dogs" }]);
});

test("standouts: one row per student, late joiners left out, an empty round names nobody", () => {
  const r = roundOf([
    { id: "a1", sid: "s1", name: "Ava", words: ["cat"] },
    { id: "a2", sid: "s1", name: "Ava", words: ["cats", "cat"] },   // Ava on a second device: her better one counts
    { id: "z", sid: "s9", name: "Zed", words: ["catty"], late: true },
  ]);
  assert.deepEqual(standouts(r), { top: [{ name: "Ava", score: 3, place: 1 }], longest: [{ name: "Ava", word: "cats" }] });
  assert.deepEqual(standouts(roundOf([{ id: "a", name: "Ava", words: [] }])), { top: [], longest: [] });
});
