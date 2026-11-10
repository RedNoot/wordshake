import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_IGNORE } from "../src/report-ignore.js";

// The kit matches ignore entries against "<name>: <message>" (AppReporter g-d45311793ad114974cb7e3dc).
const ignored = msg => REPORT_IGNORE.some(r => (typeof r === "string" ? msg.includes(r) : r.test(msg)));

test("Google's sign-in helper being blocked doesn't get reported", () => {
  assert.ok(ignored("LoadError: script failed to load: apis.google.com/js/api.js"));
});

// The second script the helper asks for (AppReporter g-2e26b5664db414e73920698f).
test("nor does the gapi_iframes script it loads next", () => {
  assert.ok(ignored("LoadError: script failed to load: apis.google.com/_/scs/abc-static/_/js/k=gapi.lb.en.etOqPKhAhvg.O/m=gapi_iframes/rt=j/sv=1/d=1/ed=1/rs=[token]/cb=gapi.loaded_0"));
});

test("WordShake's own scripts failing still get reported", () => {
  assert.ok(!ignored("LoadError: script failed to load: /assets/index-3f9a1c.js"));
  assert.ok(!ignored("LoadError: script failed to load: wordshake.onrender.com/app-reporter.js"));
  assert.ok(!ignored("TypeError: apis.google.com is not a function"));
});
