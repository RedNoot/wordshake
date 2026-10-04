import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = "firebase-service-account.json";
// Render mounts secret files under /etc/secrets; locally the key sits in the project folder (git-ignored).
const keyPath = [path.join("/etc/secrets", KEY_FILE), path.join(__dirname, "..", "..", KEY_FILE)].find(p => fs.existsSync(p));

export const firebaseApp = keyPath ? initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) }) : null;
