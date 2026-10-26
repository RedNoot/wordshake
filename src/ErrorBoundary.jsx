import { Component } from "react";
import { T, CSS } from "./theme.js";

/*
 * If the screen ever crashes, show a friendly "carry on" button instead of a blank page.
 * Reloading is safe mid-lesson: the big screen gets its room back from the server, and a student's
 * device rejoins from the /join/CODE address and the pass it saved when it joined.
 * Each crash is also sent to AppReporter (without names, codes or secret pictures) so it can be fixed.
 */

// What a report must never carry: a room or class code in a path, ids in API paths, a name or picture in a
// button's label (the name grid and the picture pad label their buttons with them), or quoted text in an error.
const SCRUB_PATHS = [[/\/join\/[^/]+/i, "/join/:code"], [/\/(classes|students|devices|games|awards)\/[^/]+/g, "/$1/:id"]];
const unquote = s => String(s || "").replace(/"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’/g, '"…"');
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;   // a data-report="start-round" name is fine; anything else in [ ] goes
function scrubReport(r) {
  try {
    r.message = unquote(r.message);
    r.stack = unquote(r.stack);
    r.breadcrumbs = (r.breadcrumbs || []).map(b => ({
      ...b,
      msg: b.type === "click" ? b.msg.replace(/\[([^\]]*)\]$/, (m, label) => (SLUG.test(label) ? m : "")) : unquote(b.msg),
    }));
    return r;
  } catch { return null; }   // the kit would send it unscrubbed if this threw, so drop it instead
}

// Errors outside drawing the screen (a button handler, a lost promise) are caught by the kit itself.
// Reports go to WordShake's own server, which passes them on (server/index.js /api/report).
export function startReporting(view) {
  if (!window.AppReporter) return;
  window.AppReporter.init({
    app: "wordshake", endpoint: "/api", version: __APP_VERSION__,
    env: import.meta.env.PROD ? "prod" : "dev",
    button: false,             // no feedback button: children use this
    scrubPaths: SCRUB_PATHS,
    context: () => ({ view }),
    beforeSend: scrubReport,
  });
}

export class ErrorBoundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  // React doesn't pass errors it caught here on to the page, so send them ourselves.
  componentDidCatch(err, info) {
    try {
      const component = ((info && info.componentStack) || "").split("\n").map(l => l.trim()).find(Boolean) || "";
      window.AppReporter && window.AppReporter.captureError(err, { kind: "crash", context: { component: component.slice(0, 80) } });
    } catch { /* reporting must never cause a second error */ }
  }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="ws-root" role="alert" style={{ minHeight: "100vh", background: T.ink, color: T.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 24, boxSizing: "border-box", textAlign: "center" }}>
        <style>{CSS}</style>
        <div className="ws-display" style={{ fontSize: 34, fontWeight: 700 }}>Oops! Something went wrong.</div>
        <div style={{ fontSize: 20, color: T.mist, maxWidth: 520 }}>Tap the button to carry on. You'll go straight back to your game.</div>
        <button onClick={() => window.location.reload()} className="ws-display"
          style={{ fontSize: 26, fontWeight: 700, border: "none", borderRadius: 16, padding: "16px 34px", cursor: "pointer", background: T.amber, color: T.ink }}>
          Carry on
        </button>
      </div>
    );
  }
}
