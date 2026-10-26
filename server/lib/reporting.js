import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import reporter from "./app-reporter.cjs";

/*
 * Crash reports go to AppReporter (D:\AppReporter), which files them in Discord. The server reports its own errors,
 * and forwards the browser's reports (see /api/report in index.js) so students' devices only ever talk to WordShake.
 */
export const RELAY = "https://app-reporter.app-reporter-relay.workers.dev";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The build writes dist/version.json (vite.config.js): "<commit count>-<short sha>". Without a build it's 0-dev.
function readVersion() {
  try { return JSON.parse(readFileSync(path.join(__dirname, "..", "..", "dist", "version.json"), "utf8")).version || "0-dev"; }
  catch { return "0-dev"; }
}
export const VERSION = readVersion();

// Only the live server reports its own errors (tests and `npm run dev` would otherwise file real ones).
// APP_REPORTER=on turns it on elsewhere, for checking the wiring.
const enabled = process.env.NODE_ENV === "production" || process.env.APP_REPORTER === "on";
reporter.init({ app: "wordshake", endpoint: enabled ? RELAY : "", version: VERSION, catchUncaught: false });

// Error text can carry a quoted word, name or code, and ids (class, student, teacher) are long runs of letters
// and digits. Neither leaves the server.
const clean = s => String(s || "")
  .replace(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g, '"…"')
  .replace(/\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}\b/g, "[id]");

// page should be a route pattern ("/api/classes/:id"), never a real path.
export function reportServerError(err, { kind = "error", page = "", context, wait = false } = {}) {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    return reporter.captureError({ name: e.name, message: clean(e.message), stack: clean(e.stack) }, { kind, page, context, wait });
  } catch { return Promise.resolve(null); }   // reporting must never cause a second error
}

if (enabled) {
  // An unhandled rejection is reported and the server keeps running, so live rooms survive it.
  process.on("unhandledRejection", reason => { console.error("Unhandled rejection:", reason); reportServerError(reason); });
  // An uncaught exception is reported, then the server exits and Render restarts it, as before.
  process.on("uncaughtException", async err => {
    console.error(err);
    await reportServerError(err, { kind: "crash", wait: true });
    process.exit(1);
  });
}
