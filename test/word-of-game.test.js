import test from "node:test";
import assert from "node:assert/strict";
import { pickWordOfGame } from "../server/lib/wordOfGame.js";
import { pickSettings, pickRoundSettings } from "../server/lib/settings.js";
import { newRound, playerView, roundRecord } from "../server/lib/round.js";
import { SW_WORDS } from "../server/lib/phonics.js";

const once = () => 0;

test("the word of the game is a short, common word from the board", () => {
  const list = ["xylophone", "sri", "thru", "cat", "dog", "strange"];
  for (const r of [0, 0.99]) assert.ok(["cat", "dog"].includes(pickWordOfGame({ list }, 3, () => r)));
  // With no common word on the board it still picks a Sounds-Write word, then anything.
  const sw = SW_WORDS.find(w => w.length === 3 && !["cat", "dog"].includes(w));
  assert.equal(pickWordOfGame({ list: ["zzzq", sw] }, 3, once), sw);
  // Never shorter than the round allows, and never a word that isn't on the board.
  assert.ok(pickWordOfGame({ list }, 4, once).length >= 4);
  assert.equal(pickWordOfGame({ list: [] }, 3, once), null);
});

test("today's sound wins when the board has a word with it", () => {
  const [a, b] = ["cat", "dog"];
  const w = pickWordOfGame({ list: [a, b], phonics: { tagMap: { [b]: [] } } }, 3, once);
  assert.equal(w, b);
});

test("the setting is saved and reaches the round, and devices are told the word", () => {
  const base = { seconds: 120, size: 4, minLen: 3, sound: true, showCount: true, phSound: null, phTicked: [], phBonus: false };
  assert.equal(pickSettings(base).wordOfGame, false);
  assert.equal(pickSettings({ ...base, wordOfGame: true }).wordOfGame, true);
  assert.equal(pickSettings({ ...base, wordOfGame: "yes" }), null);
  const settings = pickRoundSettings({ ...base, wordOfGame: true });
  assert.equal(settings.wordOfGame, true);
  const game = { tiles: [], rots: [], solution: { list: ["cat"], wordOfGame: "cat", phonics: null } };
  const round = newRound(1, settings, game, ["p1"]);
  assert.equal(playerView(round, "p1", 0).wordOfGame, "cat");
  assert.equal(roundRecord(round).settings.wordOfGame, "cat");
  const plain = newRound(2, pickRoundSettings(base), { ...game, solution: { list: ["cat"], phonics: null } }, ["p1"]);
  assert.equal(playerView(plain, "p1", 0).wordOfGame, null);
});
