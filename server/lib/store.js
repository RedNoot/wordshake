import { getFirestore, FieldValue, FieldPath, Timestamp } from "firebase-admin/firestore";
import { createHash, randomBytes } from "crypto";
import { applyRound } from "../../shared/rewards.js";
import { newWords, bankFromGames } from "../../shared/wordbank.js";
import { firebaseApp } from "./firebase.js";
import { pickWallet, buyIn, equipIn } from "./wallet.js";
import { suggestClassCode, validPin } from "../../shared/pictures.js";
import { newPin } from "./classes.js";

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
  // A theme saved before the shop is still in the database (settings are merged, never replaced): it no longer counts.
  const { theme, ...settings } = (snap.exists && snap.get("settings")) || {};
  return { name: teacher.name, isNew: !snap.exists, settings: Object.keys(settings).length ? settings : null };
}

export async function saveSettings(teacherId, settings) {
  await teacherDoc(teacherId).set({ settings }, { merge: true });
}

/*
 * ---- class lists: teachers/{uid}/classes/{classId} = { name, code, students: [{ id, name, pin }] } ----
 * The class code students sign in with is also kept in classCodes/{CODE} = { teacherId, classId }, so a student
 * can find their class from the code alone. The two are written together, so no two classes can share a code.
 */
const classOut = doc => ({ id: doc.id, name: doc.get("name"), code: doc.get("code") || null, students: doc.get("students") || [], coopBest: doc.get("coopBest") || {} });
const classCodes = () => db.collection("classCodes");

export async function listClasses(teacherId) {
  const snap = await classesOf(teacherId).get();
  const out = [];
  for (const doc of snap.docs) {
    const cls = classOut(doc);
    // Classes made before sign-in have no code: they're given one (and any missing pictures) the first time they're listed.
    if (cls.code) { out.push(cls); continue; }
    const students = cls.students.map(s => (validPin(s.pin) ? s : { ...s, pin: newPin() }));
    const done = await writeWithCode(teacherId, doc.ref, { name: cls.name, code: null, students }, false);
    out.push(done.error ? cls : { ...cls, ...done });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export async function getClass(teacherId, classId) {
  const doc = await classesOf(teacherId).doc(classId).get();
  return doc.exists ? classOut(doc) : null;
}

export async function countClasses(teacherId) {
  return (await classesOf(teacherId).count().get()).data().count;
}

// Writes a class and claims its code (releasing its old one). Returns the class, or { error: "code-taken" }.
async function writeClass(teacherId, ref, cls, isNew) {
  return db.runTransaction(async tx => {
    const [doc, claim] = await tx.getAll(ref, ...(cls.code ? [classCodes().doc(cls.code)] : []));
    if (!isNew && !doc.exists) return { error: "class-not-found" };
    if (claim && claim.exists && !(claim.get("teacherId") === teacherId && claim.get("classId") === ref.id)) return { error: "code-taken" };
    const oldCode = doc.exists ? doc.get("code") : null;
    if (oldCode && oldCode !== cls.code) {
      const old = await tx.get(classCodes().doc(oldCode));
      if (old.exists && old.get("teacherId") === teacherId && old.get("classId") === ref.id) tx.delete(old.ref);
    }
    if (cls.code) tx.set(classCodes().doc(cls.code), { teacherId, classId: ref.id });
    const stamp = { updatedAt: FieldValue.serverTimestamp(), ...(isNew ? { createdAt: FieldValue.serverTimestamp() } : {}) };
    tx.set(ref, { ...cls, ...stamp }, { merge: !isNew });
    return { id: ref.id, ...cls };
  });
}

// A class always has a code: when the teacher leaves it out, one is made up (another is tried if a class already has it).
async function writeWithCode(teacherId, ref, cls, isNew) {
  if (cls.code) return writeClass(teacherId, ref, cls, isNew);
  for (let i = 0; i < 5; i++) {
    const out = await writeClass(teacherId, ref, { ...cls, code: suggestClassCode() }, isNew);
    if (out.error !== "code-taken") return out;
  }
  return { error: "code-taken" };
}

export async function createClass(teacherId, cls) {
  return writeWithCode(teacherId, classesOf(teacherId).doc(), cls, true);
}

export async function updateClass(teacherId, classId, cls) {
  return writeWithCode(teacherId, classesOf(teacherId).doc(classId), cls, false);
}

// Deleting a class also deletes its saved rounds (Firestore doesn't remove subcollections on its own),
// frees its class code and signs out every device signed in to it.
export async function deleteClass(teacherId, classId) {
  const cls = await getClass(teacherId, classId);
  if (cls && cls.code) {
    const ref = classCodes().doc(cls.code);
    await db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (doc.exists && doc.get("teacherId") === teacherId && doc.get("classId") === classId) tx.delete(ref);
    });
  }
  await forgetDevices(teacherId, classId);
  await db.recursiveDelete(classesOf(teacherId).doc(classId));
}

// The class a student's typed code belongs to: { teacherId, classId } or null.
export async function classByCode(code) {
  const doc = await classCodes().doc(code).get();
  return doc.exists ? { teacherId: doc.get("teacherId"), classId: doc.get("classId") } : null;
}

/*
 * ---- signed-in devices: studentPasses/{sha256 of the pass} = { teacherId, classId, studentId, device, createdAt, lastUsedAt } ----
 * A device that signed in keeps a random pass; only its hash is stored, so the database can't be used to sign in.
 * A student can be signed in on a few devices; the one used longest ago makes way for a new one.
 */
const passes = () => db.collection("studentPasses");
const hashPass = pass => createHash("sha256").update(pass).digest("hex");
const DEVICES_MAX = 5;
const TOUCH_MS = 12 * 60 * 60 * 1000;   // "last used" is only written about twice a day

export async function createPass({ teacherId, classId, studentId }, device, t) {
  const pass = randomBytes(24).toString("base64url");
  const mine = await passes().where("teacherId", "==", teacherId).where("classId", "==", classId).where("studentId", "==", studentId).get();
  const old = mine.docs.sort((a, b) => (a.get("lastUsedAt") || 0) - (b.get("lastUsedAt") || 0)).slice(0, Math.max(0, mine.size - DEVICES_MAX + 1));
  await Promise.all(old.map(d => d.ref.delete()));
  await passes().doc(hashPass(pass)).set({ teacherId, classId, studentId, device, createdAt: t, lastUsedAt: t });
  return pass;
}

// Who a pass belongs to: { teacherId, classId, studentId } or null.
export async function passOwner(pass, t) {
  if (typeof pass !== "string" || pass.length < 20 || pass.length > 64) return null;
  const ref = passes().doc(hashPass(pass));
  const doc = await ref.get();
  if (!doc.exists) return null;
  if (t - (doc.get("lastUsedAt") || 0) > TOUCH_MS) ref.update({ lastUsedAt: t }).catch(() => {});
  return { teacherId: doc.get("teacherId"), classId: doc.get("classId"), studentId: doc.get("studentId") };
}

export async function forgetPass(pass) {
  if (typeof pass === "string" && pass.length >= 20 && pass.length <= 64) await passes().doc(hashPass(pass)).delete();
}

// The teacher's view: every signed-in device in a class, as [{ id, studentId, device, createdAt, lastUsedAt }].
export async function listDevices(teacherId, classId) {
  const snap = await passes().where("teacherId", "==", teacherId).where("classId", "==", classId).get();
  return snap.docs.map(d => ({ id: d.id, studentId: d.get("studentId"), device: d.get("device"), createdAt: d.get("createdAt"), lastUsedAt: d.get("lastUsedAt") }));
}

// Signs out one device (id from listDevices), every device of one student, or (no studentId) the whole class.
export async function forgetDevices(teacherId, classId, studentId = null, id = null) {
  if (id) {
    const ref = passes().doc(id);
    const doc = await ref.get();
    if (doc.exists && doc.get("teacherId") === teacherId && doc.get("classId") === classId && (!studentId || doc.get("studentId") === studentId)) await ref.delete();
    return;
  }
  let q = passes().where("teacherId", "==", teacherId).where("classId", "==", classId);
  if (studentId) q = q.where("studentId", "==", studentId);
  const snap = await q.get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

/*
 * ---- secret pictures: the picture code is in the class document (students[].pin, for the teacher to look up);
 *      on the student's document: pinShown (the student has been shown it), pinFails, pinLockedUntil, and how well
 *      they know it: pinPractised, pinStreak, pinCheckedAt (server/lib/signin.js) ----
 */
const SIGNIN_FIELDS = ["pinShown", "pinFails", "pinLockedUntil", "pinPractised", "pinStreak", "pinCheckedAt"];
const signinOut = doc => Object.fromEntries(SIGNIN_FIELDS.map(k => [k, doc.exists ? doc.get(k) ?? null : null]));

export async function getSignin(teacherId, classId, studentId) {
  return signinOut(await studentsOf(teacherId, classId).doc(studentId).get());
}

export async function setSignin(teacherId, classId, studentId, patch) {
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => SIGNIN_FIELDS.includes(k)));
  await studentsOf(teacherId, classId).doc(studentId).set(clean, { merge: true });
}

export async function listSignin(teacherId, classId) {
  const snap = await studentsOf(teacherId, classId).select(...SIGNIN_FIELDS).get();
  return Object.fromEntries(snap.docs.map(d => [d.id, signinOut(d)]));
}

// New secret pictures for one student: they're shown them the next time they join in class.
export async function resetPin(teacherId, classId, studentId, pin) {
  const clsRef = classesOf(teacherId).doc(classId);
  return db.runTransaction(async tx => {
    const doc = await tx.get(clsRef);
    const students = doc.exists ? doc.get("students") || [] : [];
    if (!students.some(s => s.id === studentId)) return { error: "student-not-found" };
    tx.update(clsRef, { students: students.map(s => (s.id === studentId ? { ...s, pin } : s)) });
    tx.set(studentsOf(teacherId, classId).doc(studentId), { pinShown: false, pinFails: 0, pinLockedUntil: 0, pinPractised: 0, pinStreak: 0, pinCheckedAt: 0 }, { merge: true });
    return { ok: true, pin };
  });
}

/* ---- progress: teachers/{uid}/classes/{classId}/games/{gameId} = one finished round (see roundRecord in round.js) ---- */
const gamesOf = (teacherId, classId) => classesOf(teacherId).doc(classId).collection("games");
export const GAMES_SHOWN = 150;

/*
 * ---- rewards: teachers/{uid}/classes/{classId}/students/{studentId} = summary (see shared/rewards.js) + awards
 *      + the shop wallet (spent, owned, equipped: see wallet.js), which only buyItem and equipItem write ----
 */
const studentsOf = (teacherId, classId) => classesOf(teacherId).doc(classId).collection("students");
const SUMMARY_FIELDS = ["name", "rounds", "words", "stars", "bestScore", "bestWords", "weeks", "stickers", "spotted", "trophies"];
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
      // The word jar: this round's new words, merged into the bank's map (set with merge only touches these keys).
      const fresh = newWords(doc.exists ? doc.get("bank") : null, record.players[sid].words, endedAt);
      tx.set(doc.ref, { ...pickSummary(summary), name: record.players[sid].name, updatedAt: FieldValue.serverTimestamp(), ...(Object.keys(fresh).length ? { bank: fresh } : {}) }, { merge: true });
      earned[sid] = e;
      // spent is read, never written, so the device can be told its new balance.
      summaries[sid] = { ...pickSummary(summary), awards: (doc.exists && doc.get("awards")) || [], spent: (doc.exists && doc.get("spent")) || 0 };
    });
    tx.set(gameRef, { ...record, endedAt: Timestamp.fromMillis(endedAt) });
    // Class together: the class's own best for this kind of board (most words found between them).
    const c = record.coop, best = c && (cls.get("coopBest") || {})[c.key];
    if (c && c.words.length && (!best || c.words.length > best.words)) {
      tx.set(clsRef, { coopBest: { [c.key]: { words: c.words.length, points: c.points, at: endedAt } } }, { merge: true });
    }
    return { status: "saved", earned, summaries };
  });
}

const studentOut = doc => ({ ...pickSummary(doc.data()), ...pickWallet(doc.data()), awards: doc.get("awards") || [] });

export async function getStudent(teacherId, classId, studentId) {
  const doc = await studentsOf(teacherId, classId).doc(studentId).get();
  return doc.exists ? studentOut(doc) : null;
}

/*
 * The word jar: the student's bank (word -> first-found time). The first time it's opened, it's filled from every
 * round saved before the jar existed, and marked built so that only happens once.
 */
export async function getWords(teacherId, classId, studentId) {
  const ref = studentsOf(teacherId, classId).doc(studentId);
  const doc = await ref.get();
  if (doc.exists && doc.get("bankBuilt")) return doc.get("bank") || {};
  const games = gamesOf(teacherId, classId), words = new FieldPath("players", studentId, "words");
  const snap = await games.where(new FieldPath("players", studentId, "score"), ">=", 0).select(words, "endedAt").get()
    .catch(() => games.select(words, "endedAt").get());   // no index for that query: read the class's rounds instead
  const history = snap.docs.map(d => ({ endedAt: d.get("endedAt") ? d.get("endedAt").toMillis() : null, players: { [studentId]: { words: d.get(words) || [] } } }));
  return db.runTransaction(async tx => {
    const now = await tx.get(ref);
    if (now.exists && now.get("bankBuilt")) return now.get("bank") || {};
    const bank = bankFromGames(history, studentId, (now.exists && now.get("bank")) || {});
    tx.set(ref, { bank, bankBuilt: true }, { merge: true });
    return bank;
  });
}

// Progress: every student's summary and wallet. The class table must not show stars (it may be on a projector).
export async function listSummaries(teacherId, classId) {
  const snap = await studentsOf(teacherId, classId).get();
  return Object.fromEntries(snap.docs.map(d => [d.id, studentOut(d)]));
}

// The shop. Each is one transaction on the student's document, like addAward (see wallet.js).
export async function buyItem(teacherId, classId, studentId, itemId, t) {
  const ref = studentsOf(teacherId, classId).doc(studentId);
  return db.runTransaction(tx => buyIn(tx, ref, itemId, t));
}

export async function equipItem(teacherId, classId, studentId, slot, id) {
  const ref = studentsOf(teacherId, classId).doc(studentId);
  return db.runTransaction(tx => equipIn(tx, ref, slot, id));
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
