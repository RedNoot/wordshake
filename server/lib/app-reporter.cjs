/*
 * AppReporter Node kit v1: crash reports, bug reports and suggestions, filed into Discord via the relay.
 * Copy this one file into a project. Node 18+ (uses the built-in fetch). Works from CommonJS and ESM:
 *
 *   import reporter from "./app-reporter.cjs";          // or: const reporter = require("./app-reporter.cjs")
 *   reporter.init({ app: "wordshake", endpoint: "https://app-reporter.<you>.workers.dev", version: "1.2.0" });
 *   app.use(reporter.expressErrorHandler());            // after your routes (optional)
 *
 * Uncaught exceptions and unhandled rejections are reported. Reporting never throws.
 */
"use strict";
const os = require("os");

const cfg = { app: "", endpoint: "", version: "", env: process.env.NODE_ENV || "", context: null, maxPerProcess: 50, exitOnCrash: true };
const extra = {}, crumbs = [], seen = new Set(), started = Date.now();
let sent = 0;

const SCRUB = [
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, "[jwt]"],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]"],
  [/\b(bearer|token|key|secret|password|pass|pwd|auth|session|sig)(\s*[=:]\s*)["']?[^\s"'&,;]+/gi, "$1$2[redacted]"],
  [/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g, "[token]"],
  [/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, "$1"],
];
const scrub = s => SCRUB.reduce((out, [re, rep]) => out.replace(re, rep), s == null ? "" : String(s));

function init(options = {}) {
  Object.assign(cfg, options);
  cfg.endpoint = String(cfg.endpoint || "").replace(/\/+$/, "");
  if (options.catchUncaught === false) return;
  // Report, give the report a moment to leave, then exit as Node normally would.
  process.on("uncaughtException", async err => {
    await captureError(err, { kind: "crash", wait: true });
    if (cfg.exitOnCrash) { console.error(err); process.exit(1); }
  });
  process.on("unhandledRejection", reason => {
    captureError(reason instanceof Error ? reason : Object.assign(new Error(String(reason)), { name: "UnhandledRejection" }), { kind: "error" });
  });
}

function build(kind, d = {}) {
  let ctx = {};
  try { if (typeof cfg.context === "function") ctx = cfg.context() || {}; } catch {}
  const all = { ...extra, ...ctx, ...(d.context || {}) }, context = {};
  for (const [k, v] of Object.entries(all).slice(0, 20)) context[String(k).slice(0, 40)] = scrub(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 200);
  return {
    app: cfg.app, kind, version: cfg.version, env: cfg.env, platform: "node",
    message: scrub(d.message).slice(0, 500), stack: scrub(d.stack).slice(0, 4000),
    page: scrub(String(d.page || "").split("?")[0]).slice(0, 200),
    ua: `Node ${process.version} on ${os.platform()} ${os.release()}`,
    context, breadcrumbs: crumbs.slice(), userText: scrub(d.userText).slice(0, 2000), contact: String(d.contact || "").slice(0, 120),
    session: d.session || "",
  };
}

async function send(report) {
  if (!cfg.endpoint || !cfg.app) return null;
  try {
    const res = await fetch(cfg.endpoint + "/report", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report), signal: AbortSignal.timeout(5000),
    });
    return await res.json().catch(() => ({}));
  } catch { return null; }
}

function captureError(err, opts = {}) {
  try {
    const message = err && err.message ? `${err.name || "Error"}: ${err.message}` : String(err);
    const stack = (err && err.stack) || "";
    const key = message + "|" + stack.split("\n").slice(0, 2).join("|");
    if (seen.has(key) || sent >= cfg.maxPerProcess) return Promise.resolve(null);
    seen.add(key); sent++;
    const p = send(build(opts.kind || "error", { message, stack, context: opts.context, page: opts.page, session: opts.session }));
    return opts.wait ? p : (p.catch(() => {}), Promise.resolve(null));
  } catch { return Promise.resolve(null); }
}

// Express error middleware: reports, then hands the error on to Express's normal handling.
function expressErrorHandler() {
  return (err, req, res, next) => {
    captureError(err, { kind: "error", page: req.path, context: { method: req.method, route: (req.route && req.route.path) || req.path } });
    next(err);
  };
}

module.exports = {
  init, captureError, expressErrorHandler,
  report: (kind, data) => send(build(kind, data)),
  addBreadcrumb(type, msg) {
    crumbs.push({ t: `+${((Date.now() - started) / 1000).toFixed(1)}s`, type: String(type).slice(0, 20), msg: scrub(msg).slice(0, 160) });
    if (crumbs.length > 30) crumbs.shift();
  },
  setContext(obj) { Object.assign(extra, obj); },
};
