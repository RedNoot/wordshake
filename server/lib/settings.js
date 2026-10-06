import { resolveSound } from "./phonics.js";

const isBool = v => typeof v === "boolean";
// How the app looks for the teacher's screen and every joined device (see src/theme.js).
export const THEMES = ["classic", "rednut"];
export const pickTheme = t => (THEMES.includes(t) ? t : "classic");

// The settings worth saving, or null if anything is missing or out of range.
export function pickSettings(s) {
  if (!s || typeof s !== "object") return null;
  const { seconds, size, minLen, sound, showCount, phSound, phTicked, phBonus, mode = "online", classId = null, theme = "classic" } = s;
  const ok = [60, 120, 180, 240, 300].includes(seconds) && [4, 5, 6].includes(size) && [2, 3, 4].includes(minLen)
    && isBool(sound) && isBool(showCount) && isBool(phBonus) && resolveSound(phSound, phTicked) !== undefined
    && ["online", "workbook"].includes(mode) && THEMES.includes(theme) && (classId === null || (typeof classId === "string" && /^[A-Za-z0-9]{1,40}$/.test(classId)));
  return ok ? { seconds, size, minLen, sound, showCount, phSound, phTicked, phBonus, mode, classId, theme } : null;
}

// The settings a live round needs, or null if anything is out of range.
export function pickRoundSettings(s) {
  if (!s || typeof s !== "object") return null;
  const { seconds, size, minLen, phSound = null, phTicked = [], phBonus = false } = s;
  const ok = [60, 120, 180, 240, 300].includes(seconds) && [4, 5, 6].includes(size) && [2, 3, 4].includes(minLen)
    && isBool(phBonus) && resolveSound(phSound, phTicked) !== undefined;
  return ok ? { seconds, size, minLen, phSound, phTicked: [...phTicked], phBonus } : null;
}
