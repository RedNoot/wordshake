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

export async function saveRound(teacherId, classId, record) {
  const cls = await classesOf(teacherId).doc(classId).get();
  if (!cls.exists) return;  // the class was deleted mid-lesson: don't leave orphaned history behind
  await gamesOf(teacherId, classId).add({ ...record, endedAt: FieldValue.serverTimestamp() });
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
