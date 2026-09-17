# Classroom Boggle — Planning & Implementation Guide

## 1. Vision

A web-based, classroom-friendly recreation of the Netflix *Boggle Party* experience: the letter grid and timer live on the big screen (projector/interactive whiteboard), students join a single shared game from their own devices using custom names, and everyone races the clock to find words. When time expires, all devices lock, a leaderboard appears on the big screen, and the longest possible word hidden in the board is revealed.

Two things distinguish this from Netflix's version and make it classroom-ready:

1. **Workbook mode** — a device-free mode where students write words from the projected board into their exercise books, and the app produces a full answer list at the end for teacher-led or peer checking.
2. **Phonics targeting** — the teacher can bias the board and the answer reveal toward a target sound and its spellings (e.g. /aɪ/ as *i, i_e, igh, y, ie*), aligning the game with structured literacy / phonics instruction.

## 2. What we're mimicking from Netflix Boggle Party

The reference experience works like this: the game runs on a shared big screen; each player's phone/tablet becomes their controller by scanning a QR code; players create a profile name; the host chooses settings and starts the round; players swipe/tap words on their own device while the big screen shows the board, the countdown, and the score reveal; anyone joining mid-round waits for the next round.

Design cues to carry over:

- **Big screen = shared spectacle, small screen = private input.** Students should never need to look at their own device to see the timer or board state ceremony — the projector is the focal point. The device is only for entering words (and seeing their own found-word list).
- **QR code + short join code** for frictionless joining (school devices often can't scan QR easily, so always show a short alphanumeric room code and URL as a fallback).
- **Late joiners are spectators** until the next round.
- **A celebratory results sequence** — animated reveal of scores, unique words, and the "best word" moment — rather than a plain table. This is a big part of why the Netflix version feels fun.

## 3. Game modes

### Online mode (default)
Students join on devices, submit words during the round, devices lock at zero, leaderboard and longest-word reveal on the big screen.

### Workbook mode
No student devices. The teacher's screen shows the board and the countdown full-size. Students write words in their books. At time-up the screen locks the board (letters grey out, "Pens down!") and the teacher advances to an **answer-reveal sequence**:

1. Total number of valid words in the board (e.g. "There were 87 words hiding in this board!").
2. Valid words grouped by length, revealed group by group so the teacher can pace the checking ("Tick every 3-letter word you found…").
3. If a phonics target is set: a filtered view showing only words containing the target sound/spellings, with the target grapheme highlighted in each word.
4. The longest possible word (with an animated path trace across the board showing how it connects).
5. Optional: a self-scoring slide showing the point values per word length so students can total their own books.

Workbook mode is essentially the host screen running solo, so it falls out of the online-mode build almost for free — it's the same state machine with zero connected players and a manual "reveal" pacing control.

## 4. Recommended architecture

**A single web app with two views**, served from one URL:

- **Host view** (`/host`) — run on the teacher's laptop, displayed via projector. Creates the room, owns the settings, drives the state machine, shows board/timer/results.
- **Player view** (`/join` or root) — mobile-first page where students enter the room code and their name, then get the interactive board.

**Real-time layer:** WebSockets. Two sensible stacks:

| Option | Stack | Best when |
|---|---|---|
| A (recommended) | React + Node.js + Socket.IO, hosted on Render/Railway/Fly.io | You want full server authority (anti-cheat, authoritative timer) and custom logic like phonics seeding |
| B | React + Firebase Realtime Database / Firestore + Cloud Functions | You want minimal ops and don't mind moving validation into client + security rules / functions |

Option A is recommended because the server should be **authoritative** for three things: the timer (the lockout requirement), word validation, and the board (students should never receive the solver's answer list before results). School wifi is flaky, so Socket.IO's automatic reconnection with a session token matters — a student who drops and rejoins within the round should get their word list back.

**Server authority rules:**

- Server generates the board and the countdown. Clients render a local countdown for smoothness but the server timestamp decides validity.
- Every submitted word carries a server receive-time; anything after `round_end` is rejected (this is the "locked out at end of time" requirement — enforce it server-side, and also disable the input UI client-side at zero).
- Server validates: word length ≥ minimum, word exists in dictionary, word is traceable on the board (adjacency check), word not already submitted by that player.
- The full solver answer list is computed at board generation but only broadcast in the RESULTS state.

## 5. Game state machine

```
LOBBY → SETTINGS_LOCKED → COUNTDOWN(3,2,1) → PLAYING → LOCKED → RESULTS → (back to LOBBY, same players retained)
```

- **LOBBY:** room code + QR on screen; players join with names; joined names pop onto the big screen (this moment matters — kids love seeing their name appear). Teacher adjusts settings.
- **SETTINGS_LOCKED:** teacher hits Start; board is generated (with phonics seeding if set) and solved server-side; settings become immutable for the round.
- **COUNTDOWN:** 3-2-1 on all screens; board hidden until zero so nobody gets a head start.
- **PLAYING:** board visible everywhere; timer runs on big screen (and a slim timer bar on devices); players submit words; big screen can show a live "words found" ticker count per player (counts only — never the words themselves).
- **LOCKED:** at 0:00 all inputs disabled and server rejects further submissions; brief "Time's up!" beat.
- **RESULTS:** scoring animation → leaderboard → best/longest words per player → longest possible word reveal with path animation → (if phonics target) target-sound words showcase. "Play again" keeps the same roster.

## 6. Pre-game settings (teacher-configurable)

| Setting | Options | Default |
|---|---|---|
| Timer | 1, 2, 3, 4, 5 min (or custom seconds) | 3 min |
| Board size | 4×4, 5×5, 6×6 | 4×4 |
| Minimum word length | 2, 3, 4 letters | 3 |
| Mode | Online / Workbook | Online |
| Phonics target | Off, or pick a phoneme + which of its spellings to include | Off |
| Scoring style | Classic / Unique-words bonus | Classic |
| Q handling | "Qu" tile (classic) vs plain Q | Qu |

Store the last-used settings locally (teacher's browser) so setup is one click on repeat plays.

## 7. Board generation

Use the official dice distributions so letter frequency feels right:

- **4×4:** the 16 classic Boggle dice (e.g. AAEEGN, ELRTTY, AOOTTW, ABBJOO, EHRTVW, CIMOTU, DISTTY, EIOSST, DELRVY, ACHOPS, HIMNQU, EEINSU, EEGHNW, AFFKPS, HLNNRZ, DEILRX). Shuffle dice to cells, roll each die.
- **5×5:** Big Boggle 25-die set.
- **6×6:** Super Big Boggle 36-die set (includes a blank/double-letter die; simplest to substitute a common-letter die for classroom purposes).

**Board quality gate:** after generating, run the solver; if the board yields fewer than a threshold of valid words at the chosen minimum length (e.g. < 30 for 4×4), reroll. This guarantees no dud rounds.

**Phonics seeding (when a target is set):**

1. Generate a board normally from dice.
2. Solve it and count words containing the target graphemes pronounced as the target phoneme (see §8).
3. If below a target count (e.g. < 8), force-place 1–3 of the target graphemes: overwrite adjacent cells with a digraph split across two tiles (e.g. `A` `I` adjacent for *ai*) or dedicate a single tile to the digraph rendered as one tile (`AI` as a "Qu-style" combo tile — this is the cleaner UX and mirrors how phonics tiles work in classrooms). Re-solve, repeat until the threshold is met or attempts cap out.
4. Combo tiles score as their letter count (an *AI* tile counts as 2 letters toward word length).

The combo-tile approach is strongly recommended over splitting digraphs across cells: it makes the target spelling *visible* on the board, which is itself instructional, and it avoids adjacency luck.

## 8. Phonics targeting

### Data: phoneme → grapheme map

Maintain a curated table, roughly aligned to synthetic-phonics programs (Letters and Sounds / Sounds-Write / UFLI style). Illustrative entries:

| Phoneme | Graphemes |
|---|---|
| /a/ (cat) | a |
| /eɪ/ (rain) | a_e, ai, ay, ea, eigh, a |
| /iː/ (see) | ee, ea, e, y, ie, e_e |
| /aɪ/ (light) | i_e, igh, y, ie, i |
| /oʊ/ (boat) | o_e, oa, ow, o, oe |
| /d/ | d, dd, ed |
| /f/ | f, ff, ph |
| /ʃ/ (ship) | sh, ti, ci, ch |

The teacher picks the phoneme, then can tick/untick individual graphemes (a Year 1 class might want only *ai/ay*; a Year 3 class might include *eigh*).

### The hard problem: grapheme ≠ phoneme

The string *ea* is /iː/ in *bead* but /ɛ/ in *bread*. Pure string matching will mislabel words, which is pedagogically damaging. Solution: build the word list with **pronunciations attached** (CMU Pronouncing Dictionary is free and covers ~134k words). Preprocessing pipeline (offline, once):

1. For each dictionary word, get its CMUdict phoneme sequence.
2. Run a grapheme-to-phoneme alignment (existing open-source aligners, or a rule-based aligner for the curated word list) to map each grapheme in the spelling to its phoneme.
3. Store, per word, a set of `(phoneme, grapheme, position)` tuples.

At runtime, "words containing target sound /iː/ spelled *ea*" is then an exact lookup, and the results screen can highlight the correct letters (*b**ea**ch*). Words that fail alignment or aren't in CMUdict simply don't get phonics tags — they still count as valid words, they just won't appear in the target-sound showcase.

### Where the target shows up in gameplay

- Board seeding (§7) makes the target spellings findable.
- Optional **bonus scoring**: +2 points for any valid word containing the target sound/spelling (toggle).
- Results/workbook reveal: dedicated "Target sound words" screen with graphemes highlighted.
- Host lobby shows the target as a reminder card ("Today's sound: /ai/ — rain, play, eight").

## 9. Word list & validation

- **Base list:** ENABLE (public domain, ~173k words) or SCOWL-derived list. Avoid Collins/SOWPODS licensing questions for a distributed product.
- **Classroom filter:** subtract a profanity/offensive blocklist (e.g. the LDNOOBW list plus a manually reviewed slur list). Filter at build time so blocked words are neither accepted nor ever displayed in reveals.
- **Age tiers (optional setting):** "Junior" list (~10–20k high-frequency words, better for phonics classes so reveals aren't full of obscure Scrabble words) vs "Full" list. The longest-word reveal in junior classrooms is more satisfying when it's a word kids might know.
- **Structure:** compile the list into a **trie or DAWG** at server start. Memory ~ a few MB; lookup O(word length).
- **Solver:** DFS from every cell over the 8-neighbour adjacency graph, pruning via the trie, with combo tiles ("Qu", "AI") consuming their full string. Runs in tens of milliseconds even on 6×6 — cheap enough to run on every generation for the quality gate, phonics count, and longest-word answer.
- **Player-side validation UX:** on submit, instant feedback — green tick (+points), grey "already found", red shake (not a word / not on board / too short). Netflix-style swipe input on the grid rather than typing: it's faster, self-enforces adjacency, and prevents typo frustration. Provide a type-to-enter fallback for accessibility.

## 10. Scoring & leaderboard

Classic Boggle scoring (adjust the floor to the minimum-length setting):

| Word length | Points |
|---|---|
| 3–4 | 1 |
| 5 | 2 |
| 6 | 3 |
| 7 | 5 |
| 8+ | 11 |

Optional "unique words" variant (closer to Netflix's framing of rewarding unique finds): words found by only one player score double, or classic rules where duplicated words are struck out entirely — make this the "Classic (strike duplicates)" vs "Everyone scores" toggle, since striking duplicates can feel harsh for younger students.

**Results sequence (online mode):** per-player word counts → duplicates resolution animation → leaderboard (podium top 3 + full ranked list) → "Best finds" (longest word any player found, rarest word) → "The one that got away": the longest possible word with its path animated on the board. End with per-player recap on their own device (their words, their score, which were unique).

## 11. Joining, names, lockout

- Room code: 4–5 characters, unambiguous alphabet (no O/0, I/1). QR encodes the join URL with the code embedded.
- Custom names: 2–12 characters. Moderate them: profanity blocklist check (including leet-speak normalisation: 3→e, 1→i, @→a), and a teacher-side "rename/kick" control in the lobby for anything the filter misses. Duplicate names get an automatic suffix (Ava → Ava 2).
- Identity: server issues a session token stored in the device's localStorage → reconnect restores the same player and word list mid-round.
- Class size: design for 35 concurrent players per room (beyond Netflix's 8). No technical barrier with WebSockets; the main design consequence is the leaderboard needs a scrolling full list, not just eight slots.
- **Lockout:** server timestamps `round_end` at round start (`start + duration`). Any submission arriving after it → rejected with "Time's up!". Clients also freeze input at local zero. Players cannot join the PLAYING state; they queue for the next round.

## 12. Data model (sketch)

```json
Room {
  code: "BRK7",
  state: "PLAYING",
  settings: { durationSec: 180, size: 4, minLen: 3, mode: "online",
              phonics: { phoneme: "aI", graphemes: ["igh","i_e","y"] },
              scoring: "classic" },
  board: { tiles: ["T","R","AI","N", ...], comboTiles: [2] },
  roundEndsAt: 1723190400000,
  solution: { words: [...], longest: "TRAINS", phonicsWords: [...] },   // host/server only until RESULTS
  players: { <playerId>: { name: "Ava", token: "...", connected: true,
                           words: [{ w: "RAIN", pts: 1, ts: ... }], score: 0 } }
}
```

Rooms are ephemeral (in-memory + optional Redis if scaling beyond one server node); nothing persists after the session unless you later add teacher accounts/reports.

## 13. Screens inventory

**Host/big screen:** Lobby (code, QR, joining names, settings panel, phonics reminder card) · Countdown · Board + timer + live word-count ticker · Time's up · Results sequence · Workbook reveal sequence (paced by teacher with next/back).

**Player device:** Join (code + name) · Waiting room · Swipe board + own word list + slim timer · Locked screen · Personal recap.

Design notes: big-screen typography must be readable from the back of a classroom (board tiles ≥ 8% of screen height on 4×4); timer turns amber at 30s, red with a subtle pulse at 10s (avoid harsh flashing — photosensitivity); optional sound cues (tick at 10s, gong at zero) with a mute toggle since classroom volume policies vary.

## 14. Edge cases & classroom realities

- **Teacher laptop sleeps / tab refresh:** host reclaims the room via the same code + a host token; round state survives on the server.
- **Student closes tab / battery dies:** reconnection token restores them; if they never return, their words still count at results.
- **Cheating (multiple tabs, name spoofing):** one session token per join; teacher kick control; server-side adjacency validation means external anagram solvers only help if typed-entry fallback is enabled — consider making swipe-only the default in class.
- **Shared devices:** allow "pass-and-play observer" — a joined device with two names is out of scope for v1; note it for later.
- **No student wifi day:** that's exactly what Workbook mode is for — make it reachable in two clicks.
- **Projector-only rooms:** everything on the host view must work without the host needing to see student screens.

## 15. Build phases

**Phase 1 — Core loop (workbook-mode-first):** board generation from dice, solver + dictionary, host screen with timer, lock at zero, full answer reveal + longest word. *This alone is classroom-usable.*

**Phase 2 — Online multiplayer:** rooms, join flow with names + moderation, swipe input, server-authoritative submission + lockout, results sequence + leaderboard, reconnection.

**Phase 3 — Phonics:** CMUdict alignment pipeline, phoneme/grapheme picker UI, combo-tile seeding, target-word highlighting in reveals, bonus scoring toggle.

**Phase 4 — Polish:** animations for the results ceremony, sounds, junior word list tier, settings persistence, 5×5/6×6 tuning, accessibility pass (dyslexia-friendly font option like Lexend, colour-contrast, typed-entry mode with screen-reader labels).

## 16. Test checklist (highlights)

- Submission at `roundEnd − 50ms` accepted; at `+50ms` rejected, across clients with skewed clocks.
- Every solver word is actually traceable (property test: solver output ⊆ brute-force validator output).
- Phonics: *bread* never appears under /iː/ *ea*; *bead* does; highlight positions correct for split digraphs (*i_e* in *time* highlights **i** and **e**).
- 35 simultaneous players submitting in the final 5 seconds — no dropped valid words.
- Reconnect mid-round restores name, words, and score.
- Blocklist words: rejected on submit, absent from all reveals, blocked as player names including leet variants.
- Board quality gate: 1,000 generated boards per size all meet the minimum-word threshold.
