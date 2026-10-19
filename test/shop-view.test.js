import { test } from "node:test";
import assert from "node:assert/strict";
import { itemState, shelves, avatarOf, wornIn, shopError } from "../src/shopView.js";

// Made-up items, so these tests don't depend on what's in the catalogue today.
const ocean = { id: "t-ocean", slot: "theme", name: "Ocean", emoji: "🌊", price: 60 };
const fox = { id: "a-fox", slot: "avatar", name: "Fox", emoji: "🦊", price: 20 };
const crown = { id: "a-crown", slot: "avatar", name: "Crown", emoji: "👑", price: 0, unlock: "first-round" };
const classic = { id: "classic", slot: "theme", name: "Classic", emoji: "🌙", price: 0 };
const wallet = (stars, spent = 0, owned = {}) => ({ stars, spent, owned, equipped: {} });

test("an item's shop state", () => {
  assert.equal(itemState(ocean, wallet(100), {}, {}).state, "buy");
  assert.deepEqual(itemState(ocean, wallet(50), {}, {}), { state: "short", need: 10 });
  assert.deepEqual(itemState(ocean, wallet(100, 50), {}, {}), { state: "short", need: 10 });
  assert.equal(itemState({ ...ocean, id: "classic", price: 0 }, wallet(0), {}, {}).state, "wearing");
  assert.equal(itemState(classic, wallet(0), {}, { theme: "rednut" }).state, "owned");
  assert.equal(itemState({ id: null, slot: "avatar" }, wallet(0), {}, { avatar: null }).state, "wearing");
  assert.equal(itemState({ id: null, slot: "avatar" }, wallet(0), {}, { avatar: "a-fox" }).state, "owned");
});

test("wearing comes from worn, never from the wallet's equipped", () => {
  const w = { ...wallet(0, 0, { "a-fox": 1 }), equipped: { avatar: "a-fox" } };
  assert.notEqual(itemState(fox, w, {}, { avatar: null }).state, "wearing");
  assert.equal(wornIn({ avatar: "a-fox" }, "avatar"), "a-fox");
  assert.equal(wornIn(null, "theme"), "classic");
});

test("unlock-only items are locked until their trophy is won", () => {
  // These go through shared/shop.js, which only knows real catalogue items, so check the trophy branch shape here.
  const s = itemState(crown, wallet(999), {}, {});
  assert.equal(s.state, "locked");
  assert.equal(typeof s.trophy, "string");
});

test("shelves put the default first, then cheapest, trophy prizes last", () => {
  const sh = shelves([crown, fox, { ...fox, id: "a-owl", name: "Owl", price: 10 }, ocean, classic]);
  assert.deepEqual(sh.avatar.map(i => i.id), [null, "a-owl", "a-fox", "a-crown"]);
  assert.deepEqual(sh.theme.map(i => i.id), ["classic", "t-ocean"]);
  assert.equal(sh.dice[0].id, null);
});

test("avatar emoji, and kind error words", () => {
  assert.equal(avatarOf({ avatar: "a-fox" }, [fox]), "🦊");
  assert.equal(avatarOf({ avatar: "gone" }, [fox]), "");
  assert.equal(avatarOf(null, [fox]), "");
  assert.match(shopError("not-now"), /round/);
  assert.ok(shopError("weird-new-code"));
});
