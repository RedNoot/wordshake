import { ITEM_BY_ID, balanceOf, cantBuy, cantEquip, wornLooks } from "../../shared/shop.js";

/*
 * The shop's side of a student document (see docs/SHOP.md): the wallet is spent, owned and equipped, while stars
 * live in the reward summary. These run inside a Firestore transaction (store.js), so two buys at once are decided
 * one after the other from what's stored, and a student can never spend the same stars twice.
 * Only the wallet fields are written: a round being saved at the same moment keeps its summary.
 */
export const pickWallet = data => ({ spent: data.spent || 0, owned: data.owned || {}, equipped: data.equipped || {} });
const walletOf = data => ({ stars: data.stars || 0, ...pickWallet(data) });
// What a device is shown of its own wallet.
export const walletOut = w => ({ stars: w.stars || 0, spent: w.spent || 0, balance: balanceOf(w), owned: w.owned || {}, equipped: w.equipped || {} });
const read = async (tx, ref) => { const doc = await tx.get(ref); return doc.exists ? doc.data() : {}; };

export async function buyIn(tx, ref, itemId, t) {
  const data = await read(tx, ref), w = walletOf(data), trophies = data.trophies || {};
  const why = cantBuy(w, trophies, itemId);
  if (why) return { error: why };
  const next = { ...w, spent: w.spent + ITEM_BY_ID[itemId].price, owned: { ...w.owned, [itemId]: t } };
  tx.set(ref, { spent: next.spent, owned: next.owned }, { merge: true });
  return { ok: true, wallet: walletOut(next), worn: wornLooks(next, trophies) };
}

export async function equipIn(tx, ref, slot, itemId) {
  const data = await read(tx, ref), w = walletOf(data), trophies = data.trophies || {};
  const why = cantEquip(w, trophies, slot, itemId);
  if (why) return { error: why };
  const next = { ...w, equipped: { ...w.equipped, [slot]: itemId } };
  tx.set(ref, { equipped: next.equipped }, { merge: true });
  return { ok: true, worn: wornLooks(next, trophies) };
}
