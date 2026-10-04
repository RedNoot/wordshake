# WordShake Phase 1 setup: Google sign-in and saved settings

These steps use your own Google account, so you need to do them yourself. They take about 20 minutes and nothing here costs money. Everything happens in one place: the Firebase console.

When you're done, send Claude Code the four values from step 4. Claude Code will then switch sign-in on.

---

## Part 1 — Create the project and switch on Google sign-in

1. Go to **console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project**. Name it `wordshake`. You can switch off Google Analytics. Click **Create project**.
3. In the left menu, open **Build → Authentication** and click **Get started**. Then:
   - On the **Sign-in method** tab, choose **Google**, switch it on, pick your email as the support email, and click **Save**.
   - On the **Settings** tab, open **Authorized domains**, click **Add domain**, and enter `wordshake.onrender.com`.
4. Click the gear icon at the top left, then **Project settings**. Under **Your apps**, click the web icon `</>`, name the app `WordShake`, and click **Register app**. Leave Firebase Hosting unticked.
   Firebase then shows a block of code. Copy these four values from it and send them to Claude Code; they aren't secrets:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`

## Part 2 — Create the database

1. In the left menu, open **Build → Firestore Database** and click **Create database**:
   - **Database ID:** leave it as `(default)`.
   - **Location:** `australia-southeast2 (Melbourne)`. This can't be changed later.
   - Choose **Start in production mode**, then click **Create**.
2. Go back to **Project settings** and open the **Service accounts** tab. Click **Generate new private key**, then **Generate key**. A `.json` file downloads.
   **Treat this file like a password:** anyone who has it can read the database.
3. Rename the file to exactly `firebase-service-account.json`, and move it into the **Wordshake** folder on your Desktop. The project is already set up so this file can never be uploaded to GitHub.
4. Open Render, then your **wordshake** service. Go to **Environment → Secret Files → Add Secret File**:
   - **Filename:** `firebase-service-account.json`
   - **Contents:** open the file in Notepad, copy everything, and paste it here.
   - Click **Save changes**.

---

## Part 3 — First sign-in (after Claude Code switches it on)

1. Open **wordshake.onrender.com** and click **Sign in with Google** at the top right. Any Google account works.
2. If Google says the app is blocked by your organisation, your school's Google admin restricts outside apps for school accounts. Either sign in with a personal Google account, or ask IT to allow "WordShake" (the Firebase project `wordshake`) for staff.
3. Once you're signed in, your name appears at the top right. Change a setting and shake the dice. Then close the page and open it again: your settings should come back.

---

## Part 4 — Connection check at school (any time after the next update goes live)

On the school wifi, open **wordshake.onrender.com/check** on a student iPad and on a Chromebook. Tell Claude Code what it says on each.

If the page takes about a minute to load, the free server was asleep. That's normal.
