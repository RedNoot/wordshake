import { randomBytes, randomInt } from "crypto";
import { PICTURES, PIN_LEN, validPin, cleanClassCode, validClassCode } from "../../shared/pictures.js";

export const LIMITS = { classes: 30, students: 60, className: 40, studentName: 30 };

const newId = () => randomBytes(6).toString("base64url");
const tidy = s => (typeof s === "string" ? s.normalize("NFC").replace(/\s+/g, " ").trim() : "");

// Three different pictures, in order (see shared/pictures.js).
export function newPin() {
  const pin = [];
  while (pin.length < PIN_LEN) { const i = randomInt(PICTURES.length); if (!pin.includes(i)) pin.push(i); }
  return pin;
}

// Validates a class sent by the teacher. Students keep their id when it already belongs to this class,
// so renaming a student later won't cut them off from their saved progress.
// Secret pictures are never taken from the teacher's request: a student keeps theirs, and a new student is given one.
// The class code is optional here: the store makes one up when it's left out, and checks no other class has it.
// Returns { name, code: string | null, students: [{ id, name, pin }] } or { error }.
export function pickClass(body, existingStudents = []) {
  if (!body || typeof body !== "object") return { error: "invalid class" };
  const name = tidy(body.name);
  if (!name || name.length > LIMITS.className) return { error: "class-name" };
  if (!Array.isArray(body.students) || body.students.length > LIMITS.students) return { error: "too-many-students" };
  const code = body.code == null || body.code === "" ? null : cleanClassCode(body.code);
  if (code !== null && !validClassCode(code)) return { error: "class-code" };

  const known = new Map(existingStudents.map(s => [s.id, s]));
  const seen = new Set();
  const students = [];
  for (const s of body.students) {
    const sName = tidy(s && s.name);
    if (!sName) continue;
    if (sName.length > LIMITS.studentName) return { error: "student-name", name: sName };
    if (seen.has(sName.toLowerCase())) return { error: "duplicate-student", name: sName };
    seen.add(sName.toLowerCase());
    const old = typeof s.id === "string" && known.get(s.id);
    students.push({ id: old ? old.id : newId(), name: sName, pin: old && validPin(old.pin) ? old.pin : newPin() });
  }
  return { name, code, students };
}
