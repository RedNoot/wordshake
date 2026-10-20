import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSettings } from "../server/lib/settings.js";

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

test("settings: the hint timer is 15 seconds unless the teacher picks 10, 20 or 30", () => {
  assert.equal(pickSettings(SAVED).hintSeconds, 15);
  assert.equal(pickSettings({ ...SAVED, hintSeconds: 30 }).hintSeconds, 30);
  assert.equal(pickSettings({ ...SAVED, hintSeconds: 1 }), null);
  assert.equal(pickSettings({ ...SAVED, hintSeconds: "15" }), null);
});
