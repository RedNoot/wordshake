import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { firebaseApp } from "./firebase.js";

const db = firebaseApp ? getFirestore(firebaseApp) : null;

export const storeReady = db !== null;

const teacherDoc = id => db.collection("teachers").doc(id);
const classesOf = id => teacherDoc(id).collection("classes");

export async function loadTeacher(teacher) {
  const ref = teacherDoc(teacher.id);
  const snap = await ref.get();
  await ref.set({
    name: teacher.name, email: teacher.email, lastSeenAt: FieldValue.serverTimestamp(),
    ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true });
  return { name: teacher.name, isNew: !snap.exists, settings: (snap.exists && snap.get("settings")) || null };
}

export async function saveSettings(teacherId, settings) {
  await teacherDoc(teacherId).set({ settings }, { merge: true });
}

/* ---- class lists: teachers/{uid}/classes/{classId} = { name, students: [{ id, name }] } ---- */
const classOut = doc => ({ id: doc.id, name: doc.get("name"), students: doc.get("students") || [] });

export async function listClasses(teacherId) {
  const snap = await classesOf(teacherId).get();
  return snap.docs.map(classOut).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export async function getClass(teacherId, classId) {
  const doc = await classesOf(teacherId).doc(classId).get();
  return doc.exists ? classOut(doc) : null;
}

export async function countClasses(teacherId) {
  return (await classesOf(teacherId).count().get()).data().count;
}

export async function createClass(teacherId, cls) {
  const ref = classesOf(teacherId).doc();
  await ref.set({ ...cls, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return { id: ref.id, ...cls };
}

export async function updateClass(teacherId, classId, cls) {
  await classesOf(teacherId).doc(classId).update({ ...cls, updatedAt: FieldValue.serverTimestamp() });
  return { id: classId, ...cls };
}

// Deleting a class also deletes its saved rounds (Firestore doesn't remove subcollections on its own).
export async function deleteClass(teacherId, classId) {
  await db.recursiveDelete(classesOf(teacherId).doc(classId));
}

/* ---- progress: teachers/{uid}/classes/{classId}/games/{gameId} = one finished round (see roundRecord in round.js) ---- */
const gamesOf = (teacherId, classId) => classesOf(teacherId).doc(classId).collection("games");
export const GAMES_SHOWN = 150;

/* ---- rewards: teachers/{uid}/classes/{classId}/students/{studentId} = summary (see shared/rewards.js) + awards ---- */
const studentsOf = (teacherId, classId) => classesOf(teacherId).doc(classId).collection("students");
const SUMMARY_FIELDS = ["name", "rounds", "words", "bestScore", "bestWords", "weeks", "stickers", "trophies"];
const pickSummary = data => Object.fromEntries(SUMMARY_FIELDS.filter(k => data[k] !== undefined).map(k => [k, data[k]]));

// The round and every student's updated summary are written together. Awards are never touched here,
// so an award given from the Progress page during a lesson can't be overwritten by a round.
export async function saveRound(teacherId, classId, record, summaries = null) {
  const cls = await classesOf(teacherId).doc(classId).get();
  if (!cls.exists) return;  // the class was deleted mid-lesson: don't leave orphaned history behind
  const batch = db.batch();
  batch.set(gamesOf(teacherId, classId).doc(), { ...record, endedAt: FieldValue.serverTimestamp() });
  for (const [sid, sum] of Object.entries(summaries || {})) {
    batch.set(studentsOf(teacherId, classId).doc(sid), { ...pickSummary(sum), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await batch.commit();
}

export async function loadSummaries(teacherId, classId) {
  const snap = await studentsOf(teacherId, classId).get();
  return new Map(snap.docs.map(d => [d.id, pickSummary(d.data())]));
}

export async function getStudent(teacherId, classId, studentId) {
  const doc = await studentsOf(teacherId, classId).doc(studentId).get();
  return doc.exists ? { ...pickSummary(doc.data()), awards: doc.get("awards") || [] } : null;
}

export async function listSummaries(teacherId, classId) {
  const snap = await studentsOf(teacherId, classId).get();
  return Object.fromEntries(snap.docs.map(d => [d.id, { ...pickSummary(d.data()), awards: d.get("awards") || [] }]));
}

export async function addAward(teacherId, classId, studentId, award, max) {
  const ref = studentsOf(teacherId, classId).doc(studentId);
  return db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    const awards = (doc.exists && doc.get("awards")) || [];
    if (awards.length >= max) return { error: "too-many-awards" };
    tx.set(ref, { awards: [...awards, award] }, { merge: true });
    return { ok: true, award };
  });
}

export async function removeAward(teacherId, classId, studentId, awardId) {
  const ref = studentsOf(teacherId, classId).doc(studentId);
  await db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists) return;
    tx.update(ref, { awards: (doc.get("awards") || []).filter(a => a.id !== awardId) });
  });
}

export async function listGames(teacherId, classId) {
  const snap = await gamesOf(teacherId, classId).orderBy("endedAt", "desc").limit(GAMES_SHOWN).get();
  return snap.docs.map(d => {
    const g = d.data();
    return { ...g, id: d.id, endedAt: g.endedAt ? g.endedAt.toMillis() : null };
  });
}

export async function deleteGame(teacherId, classId, gameId) {
  await gamesOf(teacherId, classId).doc(gameId).delete();
}
