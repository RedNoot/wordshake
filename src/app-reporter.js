/*!
 * AppReporter browser kit v1 — crash reports, bug reports and suggestions, filed into Discord via the relay.
 * Copy this one file into an app. No build step, no dependencies.
 *
 * Quickest setup (plain HTML):
 *   <script src="app-reporter.js" data-app="classroomos" data-endpoint="https://app-reporter.<you>.workers.dev"
 *           data-version="1.2.0" data-button="true"></script>
 *
 * Or from code (React/Vite: `import "./app-reporter.js"` once, then):
 *   AppReporter.init({ app: "wordshake", endpoint: "...", version: "1.2.0", button: false });
 *
 * Reporting must never break the app: every public function swallows its own errors.
 */
(function () {
  "use strict";
  if (window.AppReporter && window.AppReporter.version) return;   // loaded twice

  var cfg = {
    app: "", endpoint: "", version: "", env: "",
    crashes: "auto",        // "auto" = send cleaned crash reports silently; "ask" = show a small prompt; "off"
    button: false,          // true / "bottom-right" / "bottom-left" shows a floating "Feedback" button
    buttonLabel: "Feedback",
    askContact: false,      // offer an optional "how can we reach you" box (keep off for apps children use)
    maxPerPage: 5,          // automatic reports per page load
    scrubPaths: [],         // e.g. [[/\/join\/[^/]+/, "/join/:code"]] — anything in a path that identifies someone
    ignore: [],             // messages (strings or regexes) never worth reporting
    context: null,          // function returning extra facts, e.g. () => ({ screen: "lobby", players: 12 })
    beforeSend: null,       // function(report) -> report, or null to drop it
    theme: { accent: "#3e63dd", bg: "#ffffff", text: "#1c2024" },
  };
  var started = Date.now(), sent = 0, crumbs = [], extra = {}, seen = {}, ready = false;
  var QUEUE_KEY = "appReporter.queue", DEVICE_KEY = "appReporter.device";

  // ----- Cleaning ------------------------------------------------------------------------------
  var SCRUB = [
    [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, "[jwt]"],
    [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]"],
    [/\b(bearer|token|key|secret|password|pass|pwd|auth|session|sig)(\s*[=:]\s*)["']?[^\s"'&,;]+/gi, "$1$2[redacted]"],
    [/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g, "[token]"],
  ];
  function scrub(s) {
    s = s == null ? "" : String(s);
    for (var i = 0; i < SCRUB.length; i++) s = s.replace(SCRUB[i][0], SCRUB[i][1]);
    return s;
  }
  function cleanPath(p) {
    p = String(p || "").split(/[?#]/)[0];
    for (var i = 0; i < cfg.scrubPaths.length; i++) {
      var rule = cfg.scrubPaths[i];
      p = Array.isArray(rule) ? p.replace(rule[0], rule[1]) : p.replace(rule, ":hidden");
    }
    return scrub(p);
  }
  // URLs inside stacks and messages keep their path but lose query strings and fragments.
  function cleanText(s) {
    return scrub(String(s || "").replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, "$1"));
  }

  // ----- Breadcrumbs: what happened just before (never the text on screen) ----------------------
  function crumb(type, msg) {
    var secs = ((Date.now() - started) / 1000).toFixed(1);
    crumbs.push({ t: "+" + secs + "s", type: type, msg: cleanText(msg).slice(0, 160) });
    if (crumbs.length > 30) crumbs.shift();
  }
  function describe(el) {
    if (!el || !el.tagName) return "?";
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    var cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    if (cls) s += "." + cls;
    var label = el.getAttribute && (el.getAttribute("data-report") || el.getAttribute("aria-label") || el.getAttribute("name"));
    if (label) s += '[' + label.slice(0, 40) + ']';
    return s;
  }
  function watchCrumbs() {
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("button,a,input,select,[role=button],[data-report]") || e.target : e.target;
      crumb("click", describe(el));
    }, true);
    var lastPath = location.pathname;
    function nav() { if (location.pathname !== lastPath) { lastPath = location.pathname; crumb("nav", cleanPath(lastPath)); } }
    ["pushState", "replaceState"].forEach(function (m) {
      var orig = history[m];
      if (typeof orig === "function") history[m] = function () { var r = orig.apply(this, arguments); try { nav(); } catch (_) {} return r; };
    });
    window.addEventListener("popstate", nav);
    ["error", "warn"].forEach(function (level) {
      var orig = console[level];
      if (typeof orig !== "function") return;
      console[level] = function () {
        try { crumb("console." + level, Array.prototype.map.call(arguments, function (a) { return a && a.message ? a.message : typeof a === "object" ? safeJson(a) : String(a); }).join(" ")); } catch (_) {}
        return orig.apply(console, arguments);
      };
    });
    if (window.fetch) {
      var origFetch = window.fetch;
      window.fetch = function (input, init) {
        var url = typeof input === "string" ? input : input && input.url || "";
        var method = (init && init.method || input && input.method || "GET").toUpperCase();
        if (cfg.endpoint && url.indexOf(cfg.endpoint) === 0) return origFetch.apply(this, arguments);
        return origFetch.apply(this, arguments).then(function (res) {
          if (!res.ok) crumb("fetch", method + " " + cleanPath(url.replace(/^https?:\/\/[^/]+/, "")) + " → " + res.status);
          return res;
        }, function (err) {
          crumb("fetch", method + " " + cleanPath(url.replace(/^https?:\/\/[^/]+/, "")) + " failed: " + (err && err.message));
          throw err;
        });
      };
    }
    window.addEventListener("offline", function () { crumb("network", "went offline"); });
    window.addEventListener("online", function () { crumb("network", "back online"); flushQueue(); });
  }
  function safeJson(o) { try { return JSON.stringify(o).slice(0, 160); } catch (_) { return "[object]"; } }

  // ----- Building and sending ------------------------------------------------------------------
  function device() {
    try {
      var id = localStorage.getItem(DEVICE_KEY);
      if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, id); }
      return id;
    } catch (_) { return ""; }
  }
  function build(kind, data) {
    var ctx = {};
    try { if (typeof cfg.context === "function") ctx = cfg.context() || {}; } catch (_) {}
    var all = {}, k;
    for (k in extra) all[k] = extra[k];
    for (k in ctx) all[k] = ctx[k];
    for (k in data.context || {}) all[k] = data.context[k];
    for (k in all) all[k] = cleanText(typeof all[k] === "object" ? safeJson(all[k]) : all[k]).slice(0, 200);
    all.screen = all.screen || (window.innerWidth + "×" + window.innerHeight);
    return {
      app: cfg.app, kind: kind, version: cfg.version, env: cfg.env, platform: "browser",
      message: cleanText(data.message).slice(0, 500),
      stack: cleanText(data.stack).slice(0, 4000),
      page: cleanPath(location.pathname),
      ua: navigator.userAgent,
      context: all,
      breadcrumbs: crumbs.slice(),
      userText: scrub(data.userText || "").slice(0, 2000),
      contact: String(data.contact || "").slice(0, 120),
      session: device(),
    };
  }
  function send(report) {
    if (!cfg.endpoint || !cfg.app) return Promise.resolve(null);
    if (typeof cfg.beforeSend === "function") {
      try { report = cfg.beforeSend(report); } catch (_) {}
      if (!report) return Promise.resolve(null);
    }
    var body = JSON.stringify(report), url = cfg.endpoint.replace(/\/+$/, "") + "/report";
    // text/plain keeps this a "simple" request: no CORS preflight, and it still works during page unload.
    // Resolves to the relay's reply when sent, {queued: true} when kept for later, or null when refused.
    var typed = report.kind === "bug" || report.kind === "suggestion";
    return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: body, keepalive: body.length < 60000 })
      .then(function (res) {
        if (res.ok) return res.json().catch(function () { return {}; });
        // Server trouble is worth retrying; when rate-limited, only what someone typed is kept.
        if (res.status >= 500 || (res.status === 429 && typed)) throw new Error("relay " + res.status);
        return null;   // refused (bad report, origin, or limit): retrying won't help
      })
      .catch(function () {
        if (navigator.sendBeacon && document.visibilityState === "hidden" && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return {};
        queue(body);
        return { queued: true };
      });
  }
  // Reports made while offline (school wifi drops) are kept and sent later.
  function queue(body) {
    try {
      var q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      q.push(body);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-10)));
    } catch (_) {}
  }
  function flushQueue() {
    var q;
    try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); localStorage.removeItem(QUEUE_KEY); } catch (_) { return; }
    q.forEach(function (body) { try { send(JSON.parse(body)); } catch (_) {} });
  }

  // ----- Automatic error capture ---------------------------------------------------------------
  function ignored(msg, stack) {
    if (!msg && !stack) return true;
    if (/^Script error\.?$/.test(msg)) return true;                         // cross-origin script, no details
    if (/ResizeObserver loop/.test(msg)) return true;                       // harmless browser noise
    if (/(chrome|moz|safari(-web)?)-extension:\/\//.test(stack)) return true; // someone's browser extension
    for (var i = 0; i < cfg.ignore.length; i++) {
      var r = cfg.ignore[i];
      if (typeof r === "string" ? msg.indexOf(r) >= 0 : r.test(msg)) return true;
    }
    return false;
  }
  function captureError(err, opts) {
    try {
      opts = opts || {};
      var msg = err && err.message ? String(err.message) : String(err == null ? "" : err);
      var stack = err && err.stack ? String(err.stack) : "";
      if (err && err.name && msg.indexOf(err.name) !== 0) msg = err.name + ": " + msg;
      if (!ready || cfg.crashes === "off" || ignored(msg, stack)) return;
      var key = msg + "|" + stack.split("\n").slice(0, 2).join("|");
      if (seen[key] || sent >= cfg.maxPerPage) return;   // the same error twice in one visit is noise
      seen[key] = true; sent++;
      var report = build(opts.kind || "error", { message: msg, stack: stack, context: opts.context });
      if (cfg.crashes === "ask" && !opts.silent) askToSend(report);
      else send(report);
    } catch (_) {}
  }
  function watchErrors() {
    window.addEventListener("error", function (e) {
      if (e.target && e.target !== window && e.target.tagName) {   // a script/image/stylesheet failed to load
        var src = e.target.src || e.target.href || "";
        if (e.target.tagName === "SCRIPT" || e.target.tagName === "LINK") captureError({ name: "LoadError", message: e.target.tagName.toLowerCase() + " failed to load: " + cleanPath(src.replace(/^https?:\/\/[^/]+/, "")) });
        return;
      }
      captureError(e.error || { message: e.message, stack: e.filename ? "at " + e.filename + ":" + e.lineno + ":" + e.colno : "" });
    }, true);
    window.addEventListener("unhandledrejection", function (e) {
      var r = e.reason;
      captureError(r instanceof Error ? r : { name: "UnhandledRejection", message: typeof r === "object" ? safeJson(r) : String(r) });
    });
  }

  // ----- UI: feedback dialog, crash prompt, floating button (in a shadow root so app CSS can't leak in)
  var host, root;
  function ui() {
    if (root) return root;
    host = document.createElement("div");
    host.setAttribute("data-app-reporter", "");
    document.body.appendChild(host);
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var t = cfg.theme;
    var style = document.createElement("style");
    style.textContent =
      ":host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
      ".fab{position:fixed;bottom:16px;z-index:2147483646;border:0;border-radius:999px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;background:" + t.accent + ";color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:.9}" +
      ".fab:hover,.fab:focus-visible{opacity:1}.fab.right{right:16px}.fab.left{left:16px}" +
      ".back{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".card{background:" + t.bg + ";color:" + t.text + ";border-radius:16px;width:100%;max-width:440px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)}" +
      "h2{margin:0 0 14px;font-size:20px}label{display:block;font-size:13px;font-weight:600;margin:12px 0 6px}" +
      ".kinds{display:flex;gap:8px}.kinds button{flex:1;padding:10px;border-radius:10px;border:2px solid #d0d5dd;background:transparent;color:inherit;font-size:14px;cursor:pointer}" +
      ".kinds button[aria-pressed=true]{border-color:" + t.accent + ";background:" + t.accent + "1a;font-weight:600}" +
      "textarea,input{width:100%;padding:10px;border-radius:10px;border:1px solid #d0d5dd;font-size:15px;color:inherit;background:transparent}textarea{min-height:110px;resize:vertical}" +
      ".row{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.row button{padding:10px 18px;border-radius:10px;border:0;font-size:15px;cursor:pointer;font-weight:600}" +
      ".go{background:" + t.accent + ";color:#fff}.go:disabled{opacity:.5;cursor:default}.no{background:transparent;color:inherit}" +
      ".note{font-size:12px;opacity:.7;margin-top:10px}" +
      ".toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;background:#1c2024;color:#fff;border-radius:12px;padding:12px 16px;font-size:14px;display:flex;gap:12px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.3);max-width:calc(100% - 32px)}" +
      ".toast button{border:0;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer}.toast .go{background:" + t.accent + "}.toast .no{color:#fff}";
    root.appendChild(style);
    return root;
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "text") n.textContent = attrs[k]; else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function toast(text, actions, ms) {
    var r = ui(), t = el("div", { "class": "toast", role: "status" }, [el("span", { text: text })]);
    (actions || []).forEach(function (a) { t.appendChild(el("button", { "class": a.cls, text: a.label, onclick: function () { t.remove(); a.fn && a.fn(); } })); });
    r.appendChild(t);
    if (ms) setTimeout(function () { t.remove(); }, ms);
    return t;
  }
  function askToSend(report) {
    toast("Something went wrong. Send a report so it can be fixed?", [
      { label: "Send", cls: "go", fn: function () { send(report).then(function (res) { if (res && !res.queued) toast("Thanks — report sent.", [], 3000); }); } },
      { label: "Not now", cls: "no" },
    ], 15000);
  }
  function showFeedback(opts) {
    try {
      opts = opts || {};
      var r = ui(), kind = opts.kind === "suggestion" ? "suggestion" : "bug", prev = document.activeElement;
      var text = el("textarea", { id: "ar-text", maxlength: "2000", placeholder: "" });
      var contact = cfg.askContact ? el("input", { id: "ar-contact", maxlength: "120", placeholder: "Email or name (optional)" }) : null;
      var go = el("button", { "class": "go", type: "submit", text: "Send", disabled: "" });
      var bugBtn = el("button", { type: "button", text: "🐞 Something's wrong" });
      var ideaBtn = el("button", { type: "button", text: "💡 I have an idea" });
      function setKind(k) {
        kind = k;
        bugBtn.setAttribute("aria-pressed", String(k === "bug"));
        ideaBtn.setAttribute("aria-pressed", String(k === "suggestion"));
        text.placeholder = k === "bug" ? "What happened? What did you expect?" : "What would make this better?";
      }
      bugBtn.addEventListener("click", function () { setKind("bug"); });
      ideaBtn.addEventListener("click", function () { setKind("suggestion"); });
      setKind(kind);
      text.addEventListener("input", function () { if (text.value.trim()) go.removeAttribute("disabled"); else go.setAttribute("disabled", ""); });
      function close() { back.remove(); document.removeEventListener("keydown", onKey, true); if (prev && prev.focus) prev.focus(); }
      function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
      var form = el("form", { "class": "card", role: "dialog", "aria-modal": "true", "aria-labelledby": "ar-title" }, [
        el("h2", { id: "ar-title", text: opts.title || "Send feedback" }),
        el("div", { "class": "kinds" }, [bugBtn, ideaBtn]),
        el("label", { "for": "ar-text", text: "Tell us about it" }), text,
        contact && el("label", { "for": "ar-contact", text: "How can we reach you?" }), contact,
        el("div", { "class": "note", text: "Technical details about this page are sent with your message. Please don't include names or passwords." }),
        el("div", { "class": "row" }, [el("button", { "class": "no", type: "button", text: "Cancel", onclick: close }), go]),
      ]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!text.value.trim()) return;
        go.setAttribute("disabled", ""); go.textContent = "Sending…";
        var rep = build(kind, { userText: text.value.trim(), contact: contact && contact.value, context: opts.context });
        send(rep).then(function (res) {
          close();
          toast(!res ? "Sorry, that couldn't be sent. Please try again later."
            : res.queued ? "Saved — it will send when the connection is back."
            : "Thanks! Your " + (kind === "bug" ? "report" : "idea") + " was sent.", [], 3500);
        });
      });
      var back = el("div", { "class": "back", onclick: function (e) { if (e.target === back) close(); } }, [form]);
      r.appendChild(back);
      document.addEventListener("keydown", onKey, true);
      setTimeout(function () { text.focus(); }, 0);
    } catch (_) {}
  }
  function showButton() {
    var side = String(cfg.button).indexOf("left") >= 0 ? "left" : "right";
    ui().appendChild(el("button", { "class": "fab " + side, type: "button", text: cfg.buttonLabel, "aria-label": "Send feedback", onclick: function () { showFeedback(); } }));
  }

  // ----- Public API ----------------------------------------------------------------------------
  function init(options) {
    try {
      for (var k in options || {}) if (options[k] !== undefined) cfg[k] = options[k];
      if (!cfg.app || !cfg.endpoint) { (console.warn || function () {})("AppReporter: app and endpoint are required"); return; }
      if (ready) return;
      ready = true;
      watchCrumbs();
      if (cfg.crashes !== "off") watchErrors();
      var start = function () { if (cfg.button) showButton(); flushQueue(); };
      if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
    } catch (_) {}
  }

  window.AppReporter = {
    version: "1.0.0",
    init: init,
    captureError: captureError,
    // Sends a report straight away: kind is "crash", "error", "bug" or "suggestion".
    report: function (kind, data) { try { return send(build(kind, data || {})); } catch (_) { return Promise.resolve(null); } },
    showFeedback: showFeedback,
    addBreadcrumb: function (type, msg) { try { crumb(type, msg); } catch (_) {} },
    setContext: function (obj) { for (var k in obj || {}) extra[k] = obj[k]; },
  };

  // Zero-code setup from the <script> tag's data- attributes.
  var me = document.currentScript;
  if (me && me.getAttribute("data-app")) {
    var b = me.getAttribute("data-button");
    init({
      app: me.getAttribute("data-app"),
      endpoint: me.getAttribute("data-endpoint"),
      version: me.getAttribute("data-version") || "",
      env: me.getAttribute("data-env") || (/^(localhost|127\.|192\.168\.)/.test(location.hostname) ? "dev" : "prod"),
      crashes: me.getAttribute("data-crashes") || "auto",
      button: b === "true" ? true : b && b !== "false" ? b : false,
      askContact: me.getAttribute("data-ask-contact") === "true",
    });
  }
})();
