import { resolveSound } from "./phonics.js";
import { HINT_SECS } from "../../shared/hints.js";

const isBool = v => typeof v === "boolean";

// The settings worth saving, or null if anything is missing or out of range.
// ownLooks: students' devices wear their own shop looks (docs/SHOP.md). The old theme setting went with the shop,
// so a theme saved before then is simply left out.
export function pickSettings(s) {
  if (!s || typeof s !== "object") return null;
  const { seconds, size, minLen, sound, showCount, phSound, phTicked, phBonus, hints = true, hintSecs = 15, mode = "online", classId = null, ownLooks = true, wordOfGame = false } = s;
  const ok = [60, 120, 180, 240, 300].includes(seconds) && [4, 5, 6].includes(size) && [2, 3, 4].includes(minLen)
    && isBool(sound) && isBool(showCount) && isBool(phBonus) && isBool(hints) && HINT_SECS.includes(hintSecs) && resolveSound(phSound, phTicked) !== undefined
    && ["online", "workbook"].includes(mode) && isBool(ownLooks) && isBool(wordOfGame) && (classId === null || (typeof classId === "string" && /^[A-Za-z0-9]{1,40}$/.test(classId)));
  return ok ? { seconds, size, minLen, sound, showCount, phSound, phTicked, phBonus, hints, hintSecs, mode, classId, ownLooks, wordOfGame } : null;
}

// The settings a live round needs, or null if anything is out of range.
export function pickRoundSettings(s) {
  if (!s || typeof s !== "object") return null;
  const { seconds, size, minLen, phSound = null, phTicked = [], phBonus = false, hints = true, hintSecs = 15, wordOfGame = false } = s;
  const ok = [60, 120, 180, 240, 300].includes(seconds) && [4, 5, 6].includes(size) && [2, 3, 4].includes(minLen)
    && isBool(phBonus) && isBool(hints) && HINT_SECS.includes(hintSecs) && isBool(wordOfGame) && resolveSound(phSound, phTicked) !== undefined;
  return ok ? { seconds, size, minLen, phSound, phTicked: [...phTicked], phBonus, hints, hintSecs, wordOfGame } : null;
}
