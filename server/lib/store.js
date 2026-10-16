import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { applyRound } from "../../shared/rewards.js";
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
const SUMMARY_FIELDS = ["name", "rounds", "words", "bestScore", "bestWords", "weeks", "stickers", "spotted", "trophies"];
const pickSummary = data => Object.fromEntries(SUMMARY_FIELDS.filter(k => data[k] !== undefined).map(k => [k, data[k]]));

/*
 * Saves one finished round and folds it into every player's reward summary, in a single transaction:
 * the class's progress and the students' rewards can never disagree, because both are written or neither is.
 * Rewards are worked out from the summaries in the database at that moment (never from a copy held in memory),
 * and the round's id makes a retry harmless: a round that is already saved is never counted twice.
 * Awards are never touched here, so an award given from the Progress page during a lesson can't be overwritten.
 * Returns { status: "saved", earned, summaries } | { status: "already-saved" } | { status: "no-class" }.
 */
export async function saveRound(teacherId, classId, gameId, record, endedAt) {
  const sids = Object.keys(record.players);
  const clsRef = classesOf(teacherId).doc(classId);
  const gameRef = gamesOf(teacherId, classId).doc(gameId);
  const studentRefs = sids.map(sid => studentsOf(teacherId, classId).doc(sid));
  return db.runTransaction(async tx => {
    const [cls, game, ...students] = await tx.getAll(clsRef, gameRef, ...studentRefs);
    if (!cls.exists) return { status: "no-class" };  // the class was deleted mid-lesson: don't leave orphaned history behind
    if (game.exists) return { status: "already-saved" };
    const earned = {}, summaries = {};
    students.forEach((doc, i) => {
      const sid = sids[i];
      const { summary, earned: e } = applyRound(doc.exists ? pickSummary(doc.data()) : null, record.players[sid], record, endedAt);
      tx.set(doc.ref, { ...pickSummary(summary), name: record.players[sid].name, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      earned[sid] = e;
      summaries[sid] = { ...pickSummary(summary), awards: (doc.exists && doc.get("awards")) || [] };
    });
    tx.set(gameRef, { ...record, endedAt: Timestamp.fromMillis(endedAt) });
    return { status: "saved", earned, summaries };
  });
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

/*
 * ---- live rooms: liveRooms/{teacherId} = { code, createdAt, updatedAt, data: the room as JSON (see snapshot.js) } ----
 * One per teacher (a teacher has one open room), so the big screen can find its room again after a server restart,
 * and students' devices find it by code. Stored as a JSON string because Firestore can't hold arrays inside arrays.
 * Development uses its own collection, so a room opened on a laptop can never turn up on the live site.
 * Only the server reads these (they hold each device's join pass); the app itself never touches Firestore.
 */
const liveRooms = () => db.collection(process.env.NODE_ENV === "production" ? "liveRooms" : "liveRooms-dev");
const roomOut = doc => (doc && doc.exists ? JSON.parse(doc.get("data")) : null);

export const liveRoomStore = {
  async save(teacherId, { code, createdAt, data }) {
    await liveRooms().doc(teacherId).set({ code, createdAt, updatedAt: FieldValue.serverTimestamp(), data });
  },
  async byTeacher(teacherId) {
    return roomOut(await liveRooms().doc(teacherId).get());
  },
  async byCode(code) {
    const snap = await liveRooms().where("code", "==", code).limit(1).get();
    return roomOut(snap.docs[0]);
  },
  // Only that room: if the teacher has since opened a new one, it stays.
  async remove(teacherId, code) {
    const ref = liveRooms().doc(teacherId);
    await db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (doc.exists && doc.get("code") === code) tx.delete(ref);
    });
  },
};
