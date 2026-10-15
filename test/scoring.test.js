import { test } from "node:test";
import assert from "node:assert/strict";
import { wordPoints } from "../shared/scoring.js";

test("scoring: 1 point at the shortest length, +1 for every extra letter", () => {
  assert.equal(wordPoints(3, 3), 1);
  assert.equal(wordPoints(5, 3), 3, "shake with a 3-letter minimum (plus 2 if the sound bonus is on)");
  assert.equal(wordPoints(2, 2), 1);
  assert.equal(wordPoints(5, 2), 4);
  assert.equal(wordPoints(4, 4), 1);
  assert.equal(wordPoints(9, 4), 6);
});
