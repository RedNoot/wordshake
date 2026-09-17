# WordShake — Getting it hosted, step by step

You're going from "a file that works" to "a URL my class can join." This document covers Phase 1 of that: getting the project into a repo and running as a local web server. QR joining and multiplayer come in the next phase, once this foundation exists.

Total time: about an hour, most of it waiting for downloads.

---

## Before you start — one decision

**Will students join over the internet, or only the school's local network?**

Recommended: **the internet** (a public URL like `wordshake.onrender.com`). It works on any device, needs no IT involvement, and QR codes just work. School networks frequently block device-to-device traffic, which breaks local-only hosting.

Everything below assumes the internet option. If your IT team requires local-only, tell Claude Code that in Step 6 and it will adjust.

---

## Step 1 — Download your files

From this conversation, download these five files into a folder on your computer. Make a folder called `wordshake` in your Documents.

| File | What it is |
|---|---|
| `classroom-boggle-implementation-guide.md` | The project brief — the plan for the whole build |
| `wordshake-workbook.jsx` | The working game (your reference implementation) |
| `phonics-table.txt` | The certified Sounds-Write word table |
| `phonics-aligner.js` | Build-time tool that generates the table |
| `build-phonics-table.js` | Build-time script that runs the aligner |

The last two aren't needed to run the game — they're how you'd regenerate the word table if you ever edit the phonics data. Keep them; future-you will want them.

---

## Step 2 — Create a GitHub account and repository

GitHub is where your code lives. It's free, and both Render (hosting) and Claude Code work directly with it.

1. Go to **github.com** and sign up if you don't have an account.
2. Click the **+** in the top right → **New repository**.
3. Name it `wordshake`.
4. Choose **Private**.
5. Tick **Add a README file**.
6. Click **Create repository**.

Leave the browser tab open — you'll come back to it.

---

## Step 3 — Install Node.js

This is the engine that runs the server. It's also what Claude Code needs.

1. Go to **nodejs.org**.
2. Download the **LTS** version (the left-hand button, not "Current").
3. Run the installer, accepting all defaults.

To confirm it worked, open a terminal — on Mac, press Cmd+Space and type "Terminal"; on Windows, press Start and type "PowerShell" — and run:

```
node --version
```

You should see something like `v22.x.x`. If you see "command not found", restart the terminal and try again.

---

## Step 4 — Install Claude Code

In that same terminal, run:

```
npm install -g @anthropic-ai/claude-code
```

Then:

```
claude
```

It will walk you through signing in with your Claude account. Once you see the Claude Code prompt, you're ready.

---

## Step 5 — Point Claude Code at your project

Close Claude Code for a moment (type `/exit`). Navigate the terminal to your folder:

**Mac:**
```
cd ~/Documents/wordshake
```

**Windows:**
```
cd ~\Documents\wordshake
```

Now start Claude Code again from inside that folder:

```
claude
```

It can now see your five files.

---

## Step 6 — The first instruction

Paste this into Claude Code exactly as written. It's deliberately narrow — one boring milestone, not the whole app.

> Read `classroom-boggle-implementation-guide.md` — it's the brief for this project. Also read `wordshake-workbook.jsx`, which is a complete, working, tested single-file React prototype of Phase 1 (workbook mode).
>
> Your task right now is **only** to restructure this into a proper Node.js project served over HTTP. Do not add multiplayer, rooms, QR codes, or player devices yet.
>
> Specifically:
> 1. Set up a Node.js + Express project with Vite for the React front end.
> 2. Move the game logic out of the single file into modules on the **server** side: board generation from the dice sets, the trie solver, the content-safety board screening, and the phonics tagging/seeding. Load `phonics-table.txt` from disk at server start rather than embedding it in the bundle.
> 3. Keep the React host view as the front end, fetching a generated board from a server endpoint instead of generating it in the browser.
> 4. **Preserve exactly**: the official Boggle dice distributions, the coverage-guarantee seeding behaviour, the two-tier content blocklist and board rejection screen, and all phonics tagging behaviour. These are tested and correct — do not rewrite their logic, just relocate it.
> 5. Initialise a git repository and add a sensible `.gitignore` for Node.
>
> When done, I should be able to run one command, open `localhost` in my browser, and play a complete workbook round exactly as the prototype does today.
>
> Before you start, tell me your plan and ask me anything ambiguous.

Read its plan before saying yes. If something sounds wrong, say so — it will adjust.

---

## Step 7 — Test it locally

When Claude Code says it's done, ask:

> How do I run it?

Follow its instructions (it'll be something like `npm run dev`), open the URL it gives you, and **play a full round** — including one with a target sound selected. Check the board appears, the timer runs, the reveal works, and the phonics showcase looks right.

If anything's broken, tell Claude Code exactly what you saw. It can read its own code and fix it.

---

## Step 8 — Push it to GitHub

Ask Claude Code:

> Push this to my GitHub repository at github.com/YOUR-USERNAME/wordshake

Replace with your actual username. It'll walk you through authenticating the first time.

Refresh your GitHub tab — your code should be there. **This is the milestone that matters.** Your work is now backed up, versioned, and ready to deploy.

---

## Step 9 — Deploy to Render

1. Go to **render.com** and sign up **using your GitHub account** (this connects them automatically).
2. Click **New** → **Web Service**.
3. Choose your `wordshake` repository.
4. Render usually detects the settings. If it asks:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** **Free**
5. Click **Create Web Service** and wait a few minutes.

You'll get a public URL like `wordshake-abc1.onrender.com`. Open it on your phone to confirm it works away from your computer.

If the deploy fails, copy the error log from Render, paste it into Claude Code, and ask it to fix the build. This is normal and usually a small config issue.

**Remember the free tier's quirk:** after 15 minutes of no traffic, the service sleeps and takes about a minute to wake. Open the URL two minutes before your lesson starts.

---

## Step 10 — Now build the multiplayer

Only once Steps 1–9 all work. Then give Claude Code this:

> Now implement Phase 2 from the guide: online multiplayer.
>
> - A host view at `/host` that creates a room and displays a short room code plus a QR code linking to the join URL.
> - A player view where students enter the room code and a custom name.
> - Socket.IO for real-time communication, with the **server authoritative** over the timer, word validation, and board — clients must never receive the answer list before the results state.
> - Words submitted after the round ends are rejected server-side. Late joiners wait for the next round.
> - Reconnection: a student who drops and rejoins mid-round gets their name, words, and score back.
> - Design for 35 concurrent players.
> - Apply the same name moderation described in the guide, including leet-speak normalisation.
>
> Keep workbook mode working exactly as it does now — it's the fallback when the wifi fails.
>
> Tell me your plan first.

---

## If you get stuck

- **Something's broken:** describe what you saw to Claude Code — it can read the code and fix it.
- **A deploy fails:** paste the error log from Render into Claude Code.
- **You want to change the game itself** (word lists, phonics data, styling): that's a normal Claude Code request too. The `build-phonics-table.js` script is how you regenerate the word table after editing phonics data.
- **You want to start over on a step:** git means nothing is permanent. Ask Claude Code to undo it.

---

## What you already have, in the meantime

`wordshake.html` still works today — email it, double-click it, run classes with it. Nothing above puts that at risk. The hosted version is an addition, not a replacement, and workbook mode remains your wifi-failure fallback.
