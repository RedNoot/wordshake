# WordShake: status

_Updated 2026-11-24. Read this first in a new session, and update it as each step finishes. This repo is public: keep this file free of names, keys and anything private._

## Live
- Hosted on Render (free tier, sleeps when idle; a waking page covers the cold start). It auto-deploys on every push to main.
- Class games on the big screen, plus:
  - student sign-in by class code and a 3-picture PIN, with picture practice;
  - home games with guests;
  - stars, a shop and seasonal shelves;
  - word of the game, Class together and teams mode;
  - the word jar, the Progress page and the end-of-round stars beat;
  - "Send feedback" in the teacher's settings drawer (AppReporter).
  - The end-of-round reveal uses small ← / Next → corner buttons, and there's a ⛶ Full screen button during games (F toggles it on the reveal). Live from 24 Nov.

## In progress
- Nothing. Full screen hasn't been tried on the classroom projector yet.

## Next (ideas waiting for a yes)
- A **wordshake.robmakes.app** address via a Render custom domain. Steps:
  1. Add the domain in Render (Rob).
  2. Add a DNS-only CNAME in Cloudflare.
  3. Add the domain to Firebase's authorised domains (Rob).
  4. Update the portfolio links and `server/check.html`.
- Home rounds on the Progress page, the teacher's board for home games, and a printable home note with the class code.

## Run, test, deploy
- `npm test` (prebuild runs it too).
- Deploy = push to main, which Render picks up. Add `[skip render]` to a commit message that shouldn't deploy, such as a docs-only change.

## Rules for this repo
- **Never push during a lesson:** a Render deploy restarts the server and wipes live rooms.
- Rewards compare a student only with their own past. No leaderboards or levels.
- Emoji must be below U+1FA70 (Windows 10 shows boxes); a test enforces this.
