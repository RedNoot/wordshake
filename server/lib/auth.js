import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAuth } from "firebase-admin/auth";
import { firebaseApp } from "./firebase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "auth.config.json"), "utf8"));

export class AuthError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    Object.assign(this, { status, code }, extra);
  }
}

const verifyWithFirebase = token => getAuth(firebaseApp).verifyIdToken(token);

export async function verifyTeacher(idToken, verify = verifyWithFirebase) {
  if (!AUTH.firebase.apiKey) throw new AuthError(503, "sign-in-not-configured");
  let claims;
  try {
    claims = await verify(idToken);
  } catch (e) {
    throw new AuthError(401, e.code === "auth/id-token-expired" ? "token-expired" : "token-invalid");
  }
  if (claims.firebase?.sign_in_provider !== "google.com" || !claims.email_verified || typeof claims.email !== "string") {
    throw new AuthError(401, "token-invalid");
  }
  return { id: claims.uid, name: claims.name || "", email: claims.email };
}
