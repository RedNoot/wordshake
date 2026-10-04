import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { firebaseApp } from "./firebase.js";

const db = firebaseApp ? getFirestore(firebaseApp) : null;

export const storeReady = db !== null;

export async function loadTeacher(teacher) {
  const ref = db.collection("teachers").doc(teacher.id);
  const snap = await ref.get();
  await ref.set({
    name: teacher.name, email: teacher.email, lastSeenAt: FieldValue.serverTimestamp(),
    ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true });
  return { name: teacher.name, settings: (snap.exists && snap.get("settings")) || null };
}

export async function saveSettings(teacherId, settings) {
  await db.collection("teachers").doc(teacherId).set({ settings }, { merge: true });
}
