import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanGuestName, uniqueName } from "../server/lib/names.js";
import { pickClass, LIMITS } from "../server/lib/classes.js";

test("real children's names pass the guest filter", () => {
  for (const n of ["Ava", "Mia-Rose", "O'Neill", "Zoë", "Siobhán", "Cassie", "Dave", "Vanessa", "Bo", "Al", "Mohammed", "Nguyen", "Jo Jo", "Alexander", "Hitchcock"]) {
    assert.ok(cleanGuestName(n), n);
  }
  assert.equal(cleanGuestName("  Ava   Lee "), "Ava Lee");
});

test("rude, silly and malformed names are refused", () => {
  for (const n of ["fuck", "Dick", "FuCk", "fvck", "Sh1t", "b1tch", "a$$", "xXfuckXx", "bigshit", "poo", "Poo Head", "bum", "sexy", "nigga", "c u n t",
    "a", "1234", "Ava!", "<script>","ThirteenChars", "-Ava"]) {
    assert.equal(cleanGuestName(n), null, n);
  }
});

test("duplicate names get a number", () => {
  assert.equal(uniqueName("Ava", ["Ben"]), "Ava");
  assert.equal(uniqueName("ava", ["Ava"]), "ava 2");
  assert.equal(uniqueName("Ava", ["Ava", "ava 2"]), "Ava 3");
});

test("class lists are tidied and validated", () => {
  const c = pickClass({ name: "  3/4B ", students: [{ name: " Ava  Lee " }, { name: "" }, { name: "Ben" }] });
  assert.equal(c.name, "3/4B");
  assert.deepEqual(c.students.map(s => s.name), ["Ava Lee", "Ben"]);
  assert.ok(c.students.every(s => /^[\w-]{8}$/.test(s.id)));
  assert.deepEqual(pickClass({ name: "", students: [] }), { error: "class-name" });
  assert.equal(pickClass({ name: "x", students: [{ name: "Ava" }, { name: "ava" }] }).error, "duplicate-student");
  assert.equal(pickClass({ name: "x", students: Array.from({ length: LIMITS.students + 1 }, (_, i) => ({ name: `S${i}` })) }).error, "too-many-students");
  assert.equal(pickClass({ name: "x", students: "Ava" }).error, "too-many-students");
  assert.equal(pickClass(null).error, "invalid class");
});

test("students keep their id when edited, and can't borrow ids from elsewhere", () => {
  const existing = [{ id: "keepme01", name: "Ava" }];
  const c = pickClass({ name: "x", students: [{ id: "keepme01", name: "Ava L" }, { id: "stolen01", name: "Ben" }] }, existing);
  assert.equal(c.students[0].id, "keepme01");
  assert.notEqual(c.students[1].id, "stolen01");
});
