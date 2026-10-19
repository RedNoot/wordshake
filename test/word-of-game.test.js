import test from "node:test";
import assert from "node:assert/strict";
import { pickWordOfGame } from "../server/lib/wordOfGame.js";
import { pickSettings, pickRoundSettings } from "../server/lib/settings.js";
import { newRound, playerView, roundRecord, checkWord, coopResult } from "../server/lib/round.js";
import { snapshotRoom, restoreRoom } from "../server/lib/snapshot.js";
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

test("class together: the class's words are saved with the round, and survive a restart", async () => {
  const base = { seconds: 60, size: 4, minLen: 3, sound: true, showCount: true, phSound: null, phTicked: [], phBonus: false };
  const game = { tiles: ["C", "A", "T", "S", ...Array(12).fill("X")], rots: [], solution: { list: ["cat", "cats"], total: 2, phonics: null } };
  const round = newRound(1, pickRoundSettings(base), game, ["a", "b"]);
  round.coop = { wall: new Map() };
  round.who = new Map([["a", { studentId: "s1", name: "Ava" }], ["b", { studentId: "s2", name: "Ben" }]]);
  round.state = "playing"; round.endsAt = 10_000;
  for (const [p, w] of [["a", "cats"], ["b", "cats"], ["b", "cat"]]) await checkWord(round, p, w, 0, async () => true);
  const rec = roundRecord(round);
  assert.deepEqual(rec.coop, { words: ["cats", "cat"], points: 3, key: "4-3-all" });
  assert.deepEqual([rec.players.s1.score, rec.players.s2.score], [2, 3], "everyone's own score is unchanged");
  assert.equal(coopResult(round, { words: 3 }).newBest, false);

  const room = { code: "BCDF", teacherId: "t", classId: "c", className: "C", roster: [], players: new Map(), phase: "playing", ownLooks: true,
    createdAt: 0, roundNo: 1, teams: null, coop: true, coopBest: { "4-3-all": { words: 1, points: 1, at: 0 } }, round };
  const back = restoreRoom(JSON.parse(JSON.stringify(snapshotRoom(room, 1))));
  assert.equal(back.coop, true);
  assert.deepEqual(back.coopBest, room.coopBest);
  assert.deepEqual([...back.round.coop.wall], [["cats", 2], ["cat", 1]]);
});
