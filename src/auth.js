import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, GoogleAuthProvider } from "firebase/auth";
import authConfig from "../auth.config.json";

export const signInConfigured = !!authConfig.firebase.apiKey;

const auth = signInConfigured ? getAuth(initializeApp(authConfig.firebase)) : null;

let ready;
// Resolves to the signed-in user (or null) once Firebase has restored any previous sign-in.
export function initAuth() {
  ready ??= new Promise(resolve => {
    if (!auth) return resolve(null);
    const stop = onAuthStateChanged(auth, user => { stop(); resolve(user); });
  });
  return ready;
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return (await signInWithPopup(auth, provider)).user;
}

// Signs out of WordShake only; the teacher stays signed in to Google.
export const signOut = () => firebaseSignOut(auth);

// Fetch with the teacher's ID token; retries once with a fresh token if the server says it has expired.
export async function authFetch(url, options = {}) {
  for (const forceRefresh of [false, true]) {
    const idToken = await auth.currentUser.getIdToken(forceRefresh);
    const res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${idToken}` } });
    if (res.status !== 401 || forceRefresh) return res;
  }
}

// A fresh ID token for the signed-in teacher, for opening or resuming a live room.
export const getIdToken = () => auth.currentUser.getIdToken();
