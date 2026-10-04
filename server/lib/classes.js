import { randomBytes } from "crypto";

export const LIMITS = { classes: 30, students: 60, className: 40, studentName: 30 };

const newId = () => randomBytes(6).toString("base64url");
const tidy = s => (typeof s === "string" ? s.normalize("NFC").replace(/\s+/g, " ").trim() : "");

// Validates a class sent by the teacher. Students keep their id when it already belongs to this class,
// so renaming a student later won't cut them off from their saved progress.
// Returns { name, students: [{ id, name }] } or { error }.
export function pickClass(body, existingStudents = []) {
  if (!body || typeof body !== "object") return { error: "invalid class" };
  const name = tidy(body.name);
  if (!name || name.length > LIMITS.className) return { error: "class-name" };
  if (!Array.isArray(body.students) || body.students.length > LIMITS.students) return { error: "too-many-students" };

  const known = new Set(existingStudents.map(s => s.id));
  const seen = new Set();
  const students = [];
  for (const s of body.students) {
    const sName = tidy(s && s.name);
    if (!sName) continue;
    if (sName.length > LIMITS.studentName) return { error: "student-name", name: sName };
    if (seen.has(sName.toLowerCase())) return { error: "duplicate-student", name: sName };
    seen.add(sName.toLowerCase());
    students.push({ id: typeof s.id === "string" && known.has(s.id) ? s.id : newId(), name: sName });
  }
  return { name, students };
}
