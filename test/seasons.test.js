import test from "node:test";
import assert from "node:assert/strict";
import { SEASONS, SEASON_BY_ID, easterSunday, seasonOpen, openSeasons } from "../shared/seasons.js";
import { SEASONAL } from "../shared/looks/seasonal.js";
import { ITEMS, cantBuy, cantEquip, wornLooks } from "../shared/shop.js";
import { shelves } from "../src/shopView.js";

// Noon in Australia on a date (the season clock works in Australian days).
const on = (y, m, d) => Date.UTC(y, m - 1, d, 2);

test("Easter Sunday matches the published dates", () => {
  const known = { 2019: "04-21", 2024: "03-31", 2025: "04-20", 2026: "04-05", 2027: "03-28", 2028: "04-16" };
  for (const [y, md] of Object.entries(known)) assert.equal(new Date(easterSunday(+y)).toISOString().slice(0, 10), `${y}-${md}`);
});

test("each shelf opens on its dates and no others", () => {
  assert.ok(seasonOpen("halloween", on(2026, 10, 1)) && seasonOpen("halloween", on(2026, 10, 31)));
  assert.ok(!seasonOpen("halloween", on(2026, 9, 30)) && !seasonOpen("halloween", on(2026, 11, 1)));
  assert.ok(seasonOpen("christmas", on(2026, 12, 1)) && seasonOpen("christmas", on(2026, 12, 31)));
  assert.ok(!seasonOpen("christmas", on(2026, 11, 30)) && !seasonOpen("christmas", on(2027, 1, 1)));
  // Easter 2027 is 28 March: open 14 March to 4 April.
  assert.ok(seasonOpen("easter", on(2027, 3, 14)) && seasonOpen("easter", on(2027, 4, 4)));
  assert.ok(!seasonOpen("easter", on(2027, 3, 13)) && !seasonOpen("easter", on(2027, 4, 5)));
  assert.deepEqual(openSeasons(on(2026, 7, 1)), []);
  assert.deepEqual(openSeasons(on(2026, 10, 19)), ["halloween"]);
  // Late on 30 September in UTC is already 1 October in Australia.
  assert.ok(seasonOpen("halloween", Date.UTC(2026, 8, 30, 14)));
});

test("every seasonal item names a real season and is in the shop", () => {
  const ids = new Set(ITEMS.map(i => i.id));
  for (const i of SEASONAL) {
    assert.ok(SEASON_BY_ID[i.season], `${i.id}: unknown season ${i.season}`);
    assert.ok(ids.has(i.id), `${i.id}: not gathered into its slot`);
    assert.ok(!i.unlock, `${i.id}: seasonal items are bought, not unlocked`);
  }
  assert.equal(new Set(ITEMS.map(i => i.id)).size, ITEMS.length, "item ids are unique");
});

for (const season of SEASONS) {
  const item = SEASONAL.find(i => i.season === season.id);
  test(`${season.name}: buy only in season, keep and wear all year`, { skip: !item && "no items yet" }, () => {
    const t = { halloween: on(2026, 10, 19), christmas: on(2026, 12, 10), easter: on(2027, 3, 28) }[season.id];
    const away = on(2026, 7, 1);
    const rich = { stars: 9999, spent: 0, owned: {}, equipped: {} };
    assert.equal(cantBuy(rich, {}, item.id, t), null);
    assert.equal(cantBuy(rich, {}, item.id, away), "not-in-season");
    const mine = { ...rich, owned: { [item.id]: t }, equipped: { [item.slot]: item.id } };
    assert.equal(cantEquip(mine, {}, item.slot, item.id), null);
    assert.equal(wornLooks(mine, {})[item.slot], item.id, "still worn out of season");
    // The shop: a shelf of its own in season; away (unless owned) out of season.
    assert.ok(shelves(ITEMS, { seasons: [season.id], wallet: rich })[season.id].some(i => i.id === item.id));
    const off = shelves(ITEMS, { seasons: [], wallet: rich });
    assert.equal(off[season.id], undefined);
    assert.ok(!off[item.slot].some(i => i.id === item.id), "not on its slot shelf unless owned");
    assert.ok(shelves(ITEMS, { seasons: [], wallet: mine })[item.slot].some(i => i.id === item.id), "owned: on its slot shelf all year");
  });
}
