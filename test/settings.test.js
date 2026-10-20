import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSettings, pickRoundSettings } from "../server/lib/settings.js";

const SAVED = { seconds: 180, size: 4, minLen: 3, sound: true, showCount: true, phSound: null, phTicked: [], phBonus: false, hints: true, mode: "online", classId: null };

test("settings: own looks are on unless the teacher turns them off", () => {
  assert.equal(pickSettings(SAVED).ownLooks, true);
  assert.equal(pickSettings({ ...SAVED, ownLooks: false }).ownLooks, false);
  assert.equal(pickSettings({ ...SAVED, ownLooks: "no" }), null);
});

test("settings: a theme saved before the shop is ignored, not an error", () => {
  const s = pickSettings({ ...SAVED, theme: "rednut" });
  assert.ok(s);
  assert.equal("theme" in s, false);
  assert.ok(pickSettings({ ...SAVED, theme: "<script>" }), "whatever it was");
});

test("settings: the hint time is 15 seconds unless the teacher picks one of the offered times", () => {
  assert.equal(pickSettings(SAVED).hintSecs, 15);
  assert.equal(pickSettings({ ...SAVED, hintSecs: 30 }).hintSecs, 30);
  assert.equal(pickSettings({ ...SAVED, hintSecs: 7 }), null);
  assert.equal(pickSettings({ ...SAVED, hintSecs: "30" }), null);
  assert.equal(pickRoundSettings({ seconds: 180, size: 4, minLen: 3 }).hintSecs, 15);
  assert.equal(pickRoundSettings({ seconds: 180, size: 4, minLen: 3, hintSecs: 45 }).hintSecs, 45);
  assert.equal(pickRoundSettings({ seconds: 180, size: 4, minLen: 3, hintSecs: 0 }), null);
});
