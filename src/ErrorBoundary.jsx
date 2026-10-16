import { Component } from "react";
import { T, CSS } from "./theme.js";

/*
 * If the screen ever crashes, show a friendly "carry on" button instead of a blank page.
 * Reloading is safe mid-lesson: the big screen gets its room back from the server, and a student's
 * device rejoins from the /join/CODE address and the pass it saved when it joined.
 * Each crash is also sent to the server log (without names or tokens) so it can be fixed.
 */
let reported = 0;
export function reportError(kind, err) {
  if (reported >= 5) return;   // one broken page shouldn't flood the log
  reported++;
  try {
    const body = JSON.stringify({
      kind,
      message: String((err && err.message) || err || "").slice(0, 300),
      stack: String((err && err.stack) || "").slice(0, 1500),
      page: window.location.pathname.slice(0, 40),
    });
    fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* reporting must never cause a second error */ }
}

// Errors outside drawing the screen (a button handler, a lost promise) don't blank the page, but are still worth knowing about.
export function watchErrors() {
  window.addEventListener("error", e => reportError("error", e.error || e.message));
  window.addEventListener("unhandledrejection", e => reportError("promise", e.reason));
}

export class ErrorBoundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err, info) { reportError("crash", { message: err && err.message, stack: `${(err && err.stack) || ""}\n${(info && info.componentStack) || ""}` }); }
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
