# WordShake — End-Product Design Brief

*Handover from Claude Code, 18 September 2026. Use it to plan the finished product with Claude (chat).*

---

## How to use this file

1. Start a new chat and upload this file. Optionally also upload `classroom-boggle-implementation-guide.md` (the original plan). **Where the two disagree, this file is newer.**
2. Paste the starter prompt below.
3. Work through section 5 one area at a time.
4. When you're done, ask chat for the deliverable in section 7 and bring it back to Claude Code to build.

**Starter prompt:**

> I'm a teacher building WordShake, a classroom version of Netflix's Boggle Party for my students. The attached brief describes what's already built and live, and lists the design decisions still open. Please help me decide what the finished product should look like — especially how students and I sign in or join, and how scoring works. Start with the questions in section 4, then take the section 5 decisions one at a time: explain the options in plain language, recommend one for my classroom, and ask me when it depends on my school. Don't write code. When we've covered everything, write the spec described in section 7 so I can hand it to Claude Code.

---

## 1. What WordShake is

A web-based classroom word game in the style of Netflix's *Boggle Party*. The letter grid and timer are projected on the big screen and students race the clock to find words.

- **Live now:** https://wordshake.onrender.com
- **Code:** github.com/RedNoot/wordshake
- **How it's built:** by the teacher with Claude Code. The teacher is not a developer, so specs need to be explicit about behaviour.

Two things set it apart from the Netflix game:

1. **Workbook mode** — students write words in their exercise books instead of using devices. The app then reveals every answer for checking.
2. **Phonics targeting (Sounds-Write)** — the teacher picks a sound and its spellings. The board is built so those spellings appear, and the answers highlight them.

---

## 2. What's built and live today (workbook mode only)

Only the teacher's screen exists so far; there are no student devices.

### Setup screen (teacher's laptop, projected)

| Setting | Options | Default |
|---|---|---|
| Round time | 1, 2, 3, 4, 5 minutes | 3 min |
| Board size | 4×4 Classic, 5×5 Big, 6×6 Super | 4×4 |
| Shortest word allowed | 2, 3 or 4 letters | 3 |
| Today's sound | Off, or one of 39 Sounds-Write sounds: 5 Initial Code vowels, 14 Extended Code vowels and 20 consonants | Off |
| Spellings | Each sound lists its spellings (160 in total). The "first spellings" are ticked by default, and the teacher can tick or untick any of them. | — |
| +2 bonus for target-sound words | on / off | off |
| Sound effects | on / off | on |
| Show how many words are hiding | on / off | on |

Settings reset on every visit; they're not remembered.

### Word lists (decided 17 Sep 2026)

| Today's sound | Word list used for the board, answers and scoring | Size |
|---|---|---|
| **Off** | Full dictionary: the ENABLE word list minus a classroom blocklist | 172,641 words |
| **A sound is picked** | **Sounds-Write words only**: a certified list of high-frequency words, each tagged with its sounds and spellings | 17,802 words |

The setup menu tells the teacher which list is in use. The in-game counts also say "Sounds-Write words" when that list is active.

### How boards are made (on the server)

- The official Boggle dice are used (16, 25 or 36 dice), with "Qu" as one tile. 6×6 has a die with two-letter faces: An, Er, He, In, Qu, Th.
- **Content screen:** any board where a blocklisted word can be traced is thrown away before anyone sees it.
- **No dud boards:** the server reshuffles (up to 60 tries) looking for a board with enough words. On a 4×4 board the target is 40 words for the full dictionary or 18 for Sounds-Write. If no board reaches it, the server keeps the best one it found.
- **Phonics seeding:** the server plants words so that every ticked spelling has at least one findable word. This worked on 100% of test boards. Target spellings can appear as combined tiles (e.g. one "Ai" tile), so the spelling is visible on the board. Those tiles get an amber underline.

### A round

- A 3-2-1 countdown runs with the board hidden.
- The timer turns amber at 30 seconds and red, with a gentle pulse, at 10 seconds. It beeps for the last 5 seconds and gongs at zero.
- The teacher can pause, resume or end the round early.

### Reveal sequence (the teacher clicks Next, or uses the arrow keys or a presentation clicker)

1. **Pens down!**
2. **Stats:** the total words in the grid, how many have today's sound, and a bar chart by word length.
3. *(if a sound is set)* **Target-sound words**, grouped by spelling, with the spelling highlighted. Split spellings like a‑e highlight both letters, as in m**a**k**e**.
4. **One screen per word length** showing every answer, with target-sound words underlined.
5. **"The one that got away":** the longest word or words, with the path animated on the board.
6. **Self-scoring table**, then Play again or Change settings.

### Scoring today (students mark their own books)

| Word length | Points |
|---|---|
| 3–4 letters (2–4 when 2-letter words are allowed) | 1 |
| 5 | 2 |
| 6 | 3 |
| 7 | 5 |
| 8+ | 11 |

When the bonus toggle is on, target-sound words earn **+2** each (this is +2, not double points). Duplicates aren't struck out and nothing is scored automatically, because there are no student devices yet.

### How many words a board typically has

These are medians for a random board with the shortest word set to 3 letters. They help when planning scoring and results screens.

| Board | Full dictionary | Sounds-Write only | Target-sound words per board, Sounds-Write (average) |
|---|---|---|---|
| 4×4 | 86 | 39 | about 12 (about 1 in 4 answers) |
| 5×5 | 211 | 91 | about 16 |
| 6×6 | 342 | 144 | about 20 |

### The tech in one breath

- A React front end and a Node/Express server run on Render's free tier.
- The server generates and solves boards; the browser only displays them.
- There's no database and there are no accounts. Nothing is stored after a game.

---

## 3. Decisions already made (don't reopen these unless you mean to)

- **Big screen and devices:** the big screen is the shared spectacle. Student devices are only for entering words and seeing your own list.
- **The server is in charge** of the board, the timer and checking words. Students never receive the answer list before the results.
- **Late joiners** wait for the next round.
- **Class size:** design for up to 35 players in a room.
- **Workbook mode stays** as the no-wifi fallback, reachable in two clicks.
- **Word lists:** a chosen sound means Sounds-Write words only; Off means the full dictionary.
- **The tested game engine is kept as it is:** the dice, the word finder, the content screen, the phonics tagging and seeding, and the certified word table. It gets moved around, never rewritten.
- **Hosting:** Render, with the code on GitHub, built with Claude Code.

---

## 4. Questions only the teacher can answer (chat: ask these first)

- **Year level and class size:** which year level(s) will play, and how many students?
- **Devices:** do students have school iPads, Chromebooks, laptops or their own phones? Can they scan a QR code? Is there one device per student, or do they share?
- **Wifi:** is it reliable? Does the school network block anything?
- **Privacy:** what's the school or department policy on typing student names into web apps? Must teachers sign in with a school Google or Microsoft account?
- **Budget:** free only, or would a few dollars a month be OK? That would stop the site sleeping, or pay for a database.
- **Other users:** is it just this teacher, or will other teachers use it too?
- **Tracking:** should progress be tracked over time (e.g. which sounds each student finds), or is every game standalone?

---

## 5. Open decisions for the end product

Each area has the original plan (from the implementation guide), the options, and notes from Claude Code on what each option costs to build.

### 5.1 Student joining ("login")

**Original plan:**
- The big screen shows a room code (4–5 characters, avoiding look-alikes such as O/0 and I/1) and a QR code.
- Students type their name (2–12 characters). The name filter catches rude names, including number and symbol swaps like 3 for e.
- Duplicate names become "Ava 2".
- A token saved in the device's browser brings a student back, with their words and score, if they drop out mid-round.
- No accounts.

| Option | How it works | Good | Watch out |
|---|---|---|---|
| **A. Name each game** (original plan) | Enter the code, type a name | Zero setup; nothing stored | Silly names (filter plus a teacher kick/rename button); no history |
| **B. Class list** | The teacher saves a class list once. Students enter the code, then tap their own name. | No typing and no silly names; history is possible | Needs a teacher sign-in and a database; student names are stored |
| **C. Student accounts** | Username and password, or school Google/Microsoft sign-in | Strongest identity | Heaviest setup; school sign-in usually needs IT approval; young students struggle with passwords |

**Also decide:**
- Can one student join from two devices?
- What happens with shared devices?

**Builder note:** A needs almost nothing extra. B and C need a database, because Render's free tier has no permanent storage, plus a decision about storing student names.

### 5.2 Teacher access ("host login")

**Today:** anyone with the link can run a game.

**Options:**
1. **No login.** Whoever opens the host page runs a room.
2. **A simple teacher PIN or password.**
3. **Teacher accounts** (email link, or school Google/Microsoft sign-in). These are needed for saved class lists, history, or settings that follow you between devices.

**Also decide:**
- Should students be blocked from opening the host screen?
- Should the teacher be able to recover the room if the laptop sleeps or the page refreshes? The original plan did this with a host token.

### 5.3 Scoring

- **Points by length:** keep the current table?
- **Duplicates:** choose one:
  - *Everyone scores* (current workbook behaviour)
  - *Strike duplicates* (classic Boggle: a word found by 2 or more players scores 0)
  - *Unique words score double*

  The original plan offered a toggle and noted that striking can feel harsh for younger students.
- **Target-sound bonus:** +2 per word (current), double points, or off?
- **Rejected real words in Sounds-Write rounds:** only Sounds-Write words count. When a student submits a real word that isn't on the list, what do they see? For example "Not on today's list" rather than "Not a word". Does it cost anything?
- **Invalid submissions** (not a word, not on the board, too short): no penalty (original plan), or a small penalty?
- **Totals:** per round only, or a running total across several rounds (a session "tournament")?
- **Ties.** How are they broken?
- **Teams:** should a team option (tables or groups) exist?
- **Workbook mode:** keep self-marking?

### 5.4 Entering words on student devices

**Original plan:**
- Students swipe across the tiles, Netflix-style. This enforces the joining rules and avoids typos.
- Typing is available as a fallback for accessibility.
- Instant feedback: green tick (+points), grey "already found", red shake (not a word, not on the board, or too short).
- Swipe-only in class stops pasting from anagram solvers.

**Decide:**
- Swipe, tap tile-by-tile, typing, or a mix?
- Do students see their own found-word list?
- Should devices show a slim timer bar?

### 5.5 The big screen during a live round

**Original plan:**
- Names pop up in the lobby as students join (kids love this).
- During play: the board, the timer, and live word **counts** per student, never the words themselves.

**Decide:** show live counts, or keep scores hidden until the end? Hiding them puts less pressure on weaker readers.

### 5.6 Results ceremony

**Original plan, in order:**
1. Per-student word counts
2. Duplicates resolved
3. A podium for the top 3, plus a full scrolling ranked list (up to 35 students)
4. Best finds: the longest word and the rarest word
5. "The one that got away"
6. The target-sound showcase
7. Each student's own recap on their device

**Decide:**
- **Public ranking?** For young students, alternatives include a class total, personal bests, or celebrating everyone who found a target-sound word.
- **Devices:** what does each student's device show at the end?
- **Length:** how long should the ceremony take?

### 5.7 Teacher controls

Which of these do you need for the first version?

- Kick or rename a student
- Lock the room
- Pause the round
- End the round early
- Add time
- Skip to the results
- Play again with the same class
- Mute

### 5.8 Saving and reporting (only relevant if 5.1 or 5.2 includes accounts)

Nothing is saved today. The options are:

- Nothing is saved; each game disappears when it ends
- Export results to a spreadsheet (CSV) at the end of a game
- Class history
- Per-student progress by sound, e.g. "found 8 /ae/ words spelled *ay*"

**Builder note:** saving anything means a database, privacy decisions, and ongoing care.

### 5.9 Word lists and content safety

**Blocklist gaps in the full dictionary**

The blocklist only matches exact words, so word forms slip through. These are currently allowed:

- **Clear-cut slurs:** *wetbacks* (the singular is blocked), *gook, wop, dago, squaw, redskin, spaz, pickaninny, golliwog, jewed, jewing*
- **Also have innocent meanings:** *chink, gyp, welsh, dyke, homo*

Decide which to block. Also decide whether blocking a word should block its whole family (plurals, -ed, -ing).

**Names in the Sounds-Write list**

The list includes words children will read as names or abbreviations, e.g. *alan, anna, matt, tony, mike, joe, pam, al, ed, mon*. They are real dictionary words (a breed of dog, a coin, and so on). Should they be removed?

**Other word-list questions**

- **Sounds-Write list without a target sound:** should teachers be able to choose the Sounds-Write list on its own, as a "Junior" mode? Today it only switches on when a sound is picked.
- **Year-level lists:** should there be different lists by year level, or teacher-chosen lists?

### 5.10 Game modes and settings

- **Keep:** round time, board size, shortest word, today's sound, sound effects, and the word count.
- **Maybe add:**
  - Online vs Workbook mode picker (original plan: Online is the default)
  - "Qu" vs plain "Q"
  - Scoring style (see 5.3)
  - Remember the last-used settings (not built yet)
  - Team mode
  - Solo practice at home

### 5.11 Look and feel, and accessibility

**Today:**
- Dark navy with amber accents
- Fredoka for headings and Atkinson Hyperlegible for text (a font designed to be easy to read)
- Honours the device's "reduce motion" setting
- Large tiles, readable from the back of the room

**Decide:**
- Name, logo and branding
- Sound effects
- A Lexend font option (from the original plan)
- Feedback that doesn't rely on red and green alone, for colour-blind students
- Screen-reader labels for typing mode

### 5.12 Hosting and reliability (facts to design around)

- **Sleep:** the free Render plan sleeps after 15 minutes with no visitors and takes about a minute to wake. Open the site 2 minutes before class, or pay to keep it awake.
- **Rooms live in memory:** live multiplayer rooms will be held in the server's memory, so a restart or update wipes games in progress. Don't push updates during lessons, or pay for storage that survives restarts.
- **Up to 35 devices** on school wifi at the same moment.

---

## 6. Known issues (Claude Code will fix these; listed so chat doesn't design around them)

- **Dictionary download:** the full dictionary is downloaded from GitHub each time the server starts. If that fails, the server quietly falls back to a starter list of about 2,600 words. It should be bundled with the app instead.
- **Settings reset:** settings aren't remembered between visits.
- **Narrow screens:** on screens narrower than about 1,100 pixels, the answer-reveal screens lose a few pixels at the edges. It gets worse on phones. The student-device view will need its own phone-first design anyway.
- **Blocklist gaps:** see 5.9.
- **Rebuilding the phonics word table isn't possible right now.** The build script needs pronunciation and word-frequency files that aren't in the project, and it looks for an old filename. The certified table works fine as it is.

---

## 7. What to bring back to Claude Code

Ask chat to write **`wordshake-spec-v2.md`**, containing:

1. **A decisions table:** every item in section 5, with the chosen option and a one-line reason.
2. **Screen-by-screen descriptions**, in order, of the big screen (host) and the student device. For each screen: what's shown, and what the teacher or student can do.
3. **The joining/login flow, step by step.** Include refreshes, dropouts, late joiners, duplicate names and kicked students.
4. **Exact scoring rules**, with 2–3 worked examples. Include duplicates, the target-sound bonus, and a word that's rejected in a Sounds-Write round.
5. **What data is stored**, where, and for how long. "Nothing" is a valid answer.
6. **Build phases:** small milestones, each ending in something testable in a real lesson, with "done when…" checks.
7. **Out of scope for version 1:** an explicit list.

Remind chat: **no code**. Claude Code builds it on top of the existing, tested engine.
