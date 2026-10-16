import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDictionary } from "../server/lib/dictionary.js";

// A deploy without the word list would quietly mark real words "not a word": fail the build instead.
test("dictionary: the full word list ships with the server", async () => {
  const dict = await loadDictionary();
  assert.equal(dict.status, "full");
  assert.ok(dict.words.length > 150000);
  for (const w of ["shake", "ship", "chips"]) assert.ok(dict.words.includes(w), w);
});
