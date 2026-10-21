import { validPin } from "../../shared/pictures.js";

/*
 * Student sign-in rules. A device that signs in is remembered (a pass), so this only matters on a new device
 * or after signing out: class code, tap your name, then your three secret pictures.
 * The very first time, the student hasn't seen their pictures yet: they're shown them on their own device,
 * and that only happens while their teacher has the class's game open (the teacher is in the room).
 */
export const PIN_TRIES = 5;                  // wrong tries in a row before a short wait
export const PIN_LOCK_MS = 15 * 60 * 1000;   // the wait; the teacher can end it early from the class page

// state = { pinShown, pinFails, pinLockedUntil } from the student's document.
// Returns { ok: true, patch } | { error: "locked", until } | { error: "wrong-pin", left, patch }.
// patch is what to save on the student's document.
export function checkPin(state, given, pin, t) {
  const until = (state && state.pinLockedUntil) || 0;
  if (until > t) return { error: "locked", until };
  const fails = until ? 0 : (state && state.pinFails) || 0;   // a wait that has ended starts the count again
  const right = validPin(given) && validPin(pin) && given.every((p, i) => p === pin[i]);
  if (right) return { ok: true, patch: { pinFails: 0, pinLockedUntil: 0 } };
  const n = fails + 1;
  if (n >= PIN_TRIES) return { error: "locked", until: t + PIN_LOCK_MS, patch: { pinFails: 0, pinLockedUntil: t + PIN_LOCK_MS } };
  return { error: "wrong-pin", left: PIN_TRIES - n, patch: { pinFails: n, pinLockedUntil: 0 } };
}

// A short name for a device, for the teacher's list ("iPad · last used yesterday").
export function deviceLabel(ua) {
  const s = typeof ua === "string" ? ua : "";
  if (/iPad/.test(s) || (/Macintosh/.test(s) && /Mobile/.test(s))) return "iPad";
  if (/iPhone|iPod/.test(s)) return "iPhone";
  if (/CrOS/.test(s)) return "Chromebook";
  if (/Android/.test(s)) return /Mobile/.test(s) ? "Android phone" : "Android tablet";
  if (/Windows/.test(s)) return "Windows computer";
  if (/Macintosh|Mac OS X/.test(s)) return "Mac";
  if (/Linux/.test(s)) return "Linux computer";
  return "Device";
}

// The pass a device sent: in the message, or (if this browser's storage was cleared) in its cookie.
export const PASS_COOKIE = "ws_student";
export function passFromCookie(header) {
  const m = typeof header === "string" && header.match(new RegExp(`(?:^|;\\s*)${PASS_COOKIE}=([A-Za-z0-9_-]{20,64})`));
  return m ? m[1] : null;
}
