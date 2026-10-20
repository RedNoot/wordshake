import { test } from "node:test";
import assert from "node:assert/strict";
import { newWords, bankFromGames, jarsFor, bankList } from "../shared/wordbank.js";

test("a round adds only the words the bank doesn't have", () => {
  assert.deepEqual(newWords({ cat: 1 }, ["cat", "dog", "dog"], 5), { dog: 5 });
  assert.deepEqual(newWords(null, ["cat"], 5), { cat: 5 });
  assert.deepEqual(newWords({}, undefined, 5), {});
});

test("filling the jar from saved rounds keeps each word's first time", () => {
  const games = [
    { endedAt: 30, players: { s1: { words: ["cat", "dog"] } } },
    { endedAt: 10, players: { s1: { words: ["cat"] }, s2: { words: ["pig"] } } },
    { endedAt: null, players: { s1: { words: ["hat"] } } },
  ];
  assert.deepEqual(bankFromGames(games, "s1"), { cat: 10, dog: 30 });
  assert.deepEqual(bankFromGames(games, "s1", { dog: 40, sun: 50 }), { cat: 10, dog: 30, sun: 50 }, "a word saved since keeps the older time");
  assert.deepEqual(bankFromGames(games, "nobody"), {});
});

test("jars fill at 100, then 150, 250 and 300 each", () => {
  assert.deepEqual(jarsFor(0), { full: [], start: 0, inJar: 0, size: 100 });
  assert.deepEqual(jarsFor(99), { full: [], start: 0, inJar: 99, size: 100 });
  assert.deepEqual(jarsFor(100), { full: [100], start: 100, inJar: 0, size: 150 });
  assert.deepEqual(jarsFor(260), { full: [100, 250], start: 250, inJar: 10, size: 250 });
  assert.deepEqual(jarsFor(1100), { full: [100, 250, 500, 800, 1100], start: 1100, inJar: 0, size: 300 });
});

test("the bank as a list runs oldest first", () => {
  assert.deepEqual(bankList({ dog: 2, cat: 2, sun: 1 }).map(x => x.w), ["sun", "cat", "dog"]);
});
