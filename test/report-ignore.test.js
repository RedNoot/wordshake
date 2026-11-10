import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_IGNORE } from "../src/report-ignore.js";

// The kit matches ignore entries against "<name>: <message>" (AppReporter g-d45311793ad114974cb7e3dc).
const ignored = msg => REPORT_IGNORE.some(r => (typeof r === "string" ? msg.includes(r) : r.test(msg)));

test("a Google script the device added doesn't get reported", () => {
  assert.ok(ignored("LoadError: script failed to load: apis.google.com/js/api.js"));
});

test("WordShake's own scripts failing still get reported", () => {
  assert.ok(!ignored("LoadError: script failed to load: /assets/index-3f9a1c.js"));
  assert.ok(!ignored("LoadError: script failed to load: wordshake.onrender.com/app-reporter.js"));
  assert.ok(!ignored("TypeError: apis.google.com is not a function"));
});
