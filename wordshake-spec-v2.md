# WordShake — Spec v2

*Written by Claude (chat), 19 September 2026, from a planning conversation with the teacher. This supersedes `classroom-boggle-implementation-guide.md` and `wordshake-end-product-design-brief.md` wherever they disagree. Hand this to Claude Code to build.*

*Updated by Claude Code, 24 September 2026, with the teacher's answers to Claude Code's review: Google sign-in with school accounts, workbook mode open without sign-in, no private rank, scoring clarifications, the plural-tagging method and the database choice. Changed items are marked **(updated)**.*

**Context locked in during planning:** Years 3–4, 25–35 students, one device per student (school iPads/Chromebooks/laptops), reliable wifi that blocks some things, school requires teacher Google/Microsoft sign-in for any tool touching student data, free hosting only, other teachers will also use the app, and the teacher wants student progress tracked over time.

A few items below are marked **(assumption)** — reasonable defaults filled in because they weren't explicitly decided in conversation. Check these before Claude Code builds against them.

---

## 1. Decisions table

### Student joining
| Decision | Chosen option | Reason |
|---|---|---|
| Primary join method | Tap your name from a teacher-uploaded class list | Zero typing for 8–9 year olds; feeds progress tracking |
| Backup join method | Type room code + type a guest name | Covers QR failures, cover teachers, unlisted students |
| Duplicate device join | Block second device with "you're already in this game" | Stops one student double-submitting |
| Late joiners | Wait, admitted at next round | Unchanged from original plan |

### Teacher / hosting
| Decision | Chosen option | Reason |
|---|---|---|
| Host login **(updated)** | Google sign-in, open to any Google account (school or personal) | The game will be distributed to other teachers and schools. Microsoft sign-in was dropped because the department blocks staff from registering apps |
| Workbook mode without sign-in **(updated)** | Allowed. Sign-in is needed for online games and saved settings only | Workbook stores no student data and must keep working as the fallback, including for relief teachers |
| Multi-teacher separation | Each teacher's account is their own namespace | Falls out of requiring sign-in anyway |
| Host recovery on refresh/sleep | Reattach to the room via the signed-in account | Same infrastructure as sign-in |
| Students opening host screen | Blocked implicitly | Students don't hold a teacher-role account |

### Scoring
| Decision | Chosen option | Reason |
|---|---|---|
| Points by word length | Unchanged (1/2/3/5/11 as today) | Already tuned |
| Duplicate words (found by 2+ *teams*) | Score normally for every team that found them | Not classic strike-to-zero — feels harsh for this age group |
| Unique words (found by only one team) | Score **double** | Rewards spreading out rather than overlap |
| "Unique" is scoped | Across teams, not across individuals within a team | Keeps team strategy meaningful |
| Teams off **(updated)** | Each student counts as their own team when judging "unique" | The same rule works with or without teams |
| Same word found by two teammates **(updated)** | Scores once for the team | A team scores its distinct words |
| A student's own score **(updated)** | Same formula applied to the student's own words; "unique" is still judged across teams | Used for the top-5 spotlight and the private recap |
| Target-sound bonus | Flat **+2** per word, not doubled | Easier for the class to reason about than a doubled score |
| Bonus + uniqueness order **(assumption)** | Uniqueness doubles the length-score only; the +2 bonus is added after, un-doubled | See worked example 2 below; flag if you wanted the bonus doubled too |
| Rejected real word (Sounds-Write round) | Message: "Not on today's list"; no penalty | A real word shouldn't feel like a mistake |
| Invalid submission (not a word/not on board/too short) | No penalty | Avoids discouraging fast swiping |
| Totals across a lesson's rounds | Not combined — each round scores separately | Explicit teacher choice |
| Tie-break | Total words found → longest word → alphabetical | Simple enough to explain mid-lesson |
| Team mode | Included | Explicit teacher choice |
| Workbook mode scoring | Unchanged (self-marking) | No devices in that fallback |

### Word entry (device)
| Decision | Chosen option | Reason |
|---|---|---|
| Touchscreen devices (iPads) | Swipe across tiles | Matches Boggle Party feel |
| Trackpad/mouse devices (Chromebooks/laptops) | Click-and-drag, same underlying rule | Swipe doesn't map cleanly to a trackpad |
| Typing | Kept as accessibility fallback | Original plan, plus screen-reader labels (see Look & feel) |
| Own found-word list on device **(assumption)** | Shown, private to that student | Doesn't conflict with hiding scores on the *shared* screen |
| Slim timer bar on device **(assumption)** | Shown | Small, useful, no downside |
| Feedback | Green tick / grey "already found" / red shake, plus a non-colour icon for each | Colour-blind accessibility |

### Live big screen
| Decision | Chosen option | Reason |
|---|---|---|
| Live counts during a round | None — board and timer only | Explicit teacher choice, protects weaker readers from live pressure |
| Lobby names popping in | Kept | Unchanged from original plan |

### Results ceremony
| Decision | Chosen option | Reason |
|---|---|---|
| Best finds (longest/rarest word) | Named, even if outside the top 5 | Explicit teacher choice — positive spotlight, not a ranking |
| Team leaderboard | Full, all teams ranked | Aggregated, so it doesn't expose individuals |
| Individual ranking | Top 5 named only, nothing below | "At all costs" keep the bottom half anonymous |
| Below-top-5 feedback | Private, on the student's own device only | Only way for those students to see their result at all |
| Private recap contents **(updated)** | The student's score and words only. No rank or placement | Teacher decision: no student sees a ranking outside the public top 5 |
| "Rarest word" **(updated)** | The longest word that only one team found | Many words are found by just one team, so "rarest" needs a tie-break |

### Teacher controls (v1)
| Control | Included? |
|---|---|
| Pause / resume | Yes (core) |
| End round early | Yes (core) |
| Add time | Yes (core) |
| Play again | Yes (core) |
| Kick or rename a student | Yes |
| Lock the room (block joins once started) | Yes |
| Skip straight to results | No — out of scope for v1 |
| Mute sound effects mid-round | No — out of scope for v1 |

### Saving & reporting
| Decision | Chosen option | Reason |
|---|---|---|
| Per-student progress by sound | Included | Core reason tracking was requested |
| Class history view (teacher-facing) | Included | Supports tracking |
| CSV export | Not for v1 | Lower priority; add later if actually needed |
| Data retention **(assumption)** | Kept indefinitely under the teacher's account until they delete it | Not discussed explicitly — confirm against your school's data policy |

### Word lists & content safety
| Decision | Chosen option | Reason |
|---|---|---|
| Clear-cut slurs | Blocked, plus whole word family (plurals, -ed, -ing) | Closes the exact-match loophole |
| Words with other meanings (*chink, gyp, welsh, dyke, homo*) | Blocked, same as above | Their "innocent" meanings are above this age group's usage |
| Name-like words in Sounds-Write list (*alan, anna, matt...*) | Removed | Avoids "the game said my name" moments; low phonics value anyway |
| Sounds-Write plurals **(updated)** | Must be present/tagged in the certified table | About 2,850 Sounds-Write words are missing their -s form (*badges, lances, clasps*). Tag only those forms, from their real pronunciations: the Carnegie Mellon Pronouncing Dictionary plus the existing aligner and audit tests. No other words are added, and existing tags are unchanged. The singular's tags are **not** copied, because that mis-tags words like *babies* (y→ie) and *leaves* (f→v). Plurals missing from the pronouncing dictionary stay out |
| "Junior mode" (Sounds-Write without a target sound) | Not added | Not needed for this classroom |
| Year-level-specific lists | Deferred to v2 | Out of scope for one teacher's own class |

**(updated)** The slur, word-family and name-word changes above were done early, before Phase 1.
- A wider scan also blocked slurs the brief missed, including Australian ones (*abo, wog*), plus forms of already-blocked words that slipped through (*nudes, bitching, kikes*).
- Innocent look-alikes stay in: *assess, scatter, spicy, cocky, titter*.
- 37 name-like words were removed from the Sounds-Write list; everyday-word names such as *bill, jack, rose, joey* stay.
- Awaiting the teacher's call: *gypsy, gringo, redneck, kraut, papoose, dink, cretin, midget, greaser, papist*.

### Game modes & settings
| Decision | Chosen option | Reason |
|---|---|---|
| Existing settings (round time, board size, shortest word, sound, sound effects, word count) | Unchanged | Already working |
| Online vs Workbook picker | Added, Online default | Matches existing "Workbook is the fallback" decision |
| "Qu" tile | Kept (not split into plain Q) | Matches official Boggle dice |
| Remember last-used settings | Added | Cheap now that teacher accounts exist |
| Solo/home practice | Not for v1 | Explicit teacher choice — classroom-only |

### Look & feel, accessibility
| Decision | Chosen option | Reason |
|---|---|---|
| Lexend font option | Added | Low-cost accessibility win |
| Non-colour feedback (icons, not just colour) | Added | Colour-blind accessibility |
| Screen-reader labels for typing mode | Added | The fallback only works as a fallback if it's accessible |
| Branding (name, logo, colours) | Kept as-is for v1 | Teacher plans a future redesign in a "Claude" visual style — separate project, not blocking v1 |

### Hosting & reliability (facts to design around, not decisions)
- Test that live multiplayer (WebSocket connections) actually gets through the school's firewall before relying on it in a real lesson — the wifi is known to block some things.
- Open the site ~2 minutes before class; the free Render tier sleeps after 15 minutes idle.
- Never push an update during a live lesson — rooms live in server memory and a restart wipes any game in progress.
- Design holds for up to 35 simultaneous devices, as already scoped.

---

## 2. Screen-by-screen

### Host (big screen)
1. **Sign in** — school Google account **(updated)**. Needed for online games; workbook mode works without it.
2. **Setup** — round time, board size, shortest word, today's sound + spellings, +2 bonus toggle, sound effects, show-word-count, Online/Workbook picker, team mode toggle, class list picker (or "skip, guests only"). Settings pre-filled from last session. *Start Room* button.
3. **Lobby** — room code + QR code, live list of names (and teams, if on) as students join, *Lock Room* control, *Start Round* button.
4. **Countdown** — 3-2-1, board hidden.
5. **Live round** — board, timer (amber at 30s, red-pulse + beeping at 10s, gong at zero). No score or count of any kind. Pause/resume/end-early/add-time available to the teacher.
6. **Pens down** — transition screen.
7. **Stats** — total words, how many had today's sound, bar chart by length. No names.
8. **Target-sound words** *(if a sound was picked)* — grouped by spelling, spelling highlighted.
9. **Answers by word length** — one screen per length, target-sound words underlined.
10. **The one that got away** — longest word(s), animated path on the board.
11. **Best finds** — longest word and rarest word, **named**, regardless of overall rank.
12. **Team leaderboard** — full ranking, all teams.
13. **Individual spotlight** — top 5 students by name and score. Nothing below 5th shown here.
14. **Play again / change settings**.

### Student device
1. **Join** — enter room code (or scan QR, pre-fills it), then either tap your name from the class list, or "Join as guest" and type a name.
2. **Waiting** — confirms you're in, shows your team if assigned.
3. **Live round** — the same board as the big screen, mirrored. Swipe (touch) or click-drag (trackpad) to select a word; typing available as a fallback. Instant feedback per submission (tick/grey/shake, each with its own icon, not colour alone). A private running list of your own found words. A private running personal score. A slim timer bar.
4. **Round end** — "check the big screen" holding message while the host runs the reveal sequence.
5. **Your recap** *(private, end of ceremony)* — your score and your words, with duplicate, unique and bonus words marked. No rank or placement is shown **(updated)**.
6. **Waiting for next round / play again**.

### Workbook mode (unchanged)
No student devices. Teacher runs the existing reveal sequence on the big screen; students self-mark in their exercise books using the self-scoring table, as built today.

---

## 3. Joining / login flow

1. Teacher signs in with their school account → setup screen. First-time teachers are prompted to upload a class list (can skip and add later).
2. Teacher configures the round, optionally attaches a class list to this room, clicks *Start Room* → room code and QR generated, lobby opens.
3. Students go to the join URL or scan the QR. If a class list is attached to this room, they see a grid of names and tap their own. If no list is attached, or a student isn't on it (a casual/cover-teacher scenario, or a visiting student), they use *Join as guest*: type the code manually, then type a name — the existing name filter (profanity, symbol-swap detection) applies here exactly as in the current build, including the "Ava 2" duplicate suffix for guest names.
4. A class-list join locks that identity to one active device at a time. If a student tries to join the same name on a second device while the first is still connected, they see "You're already in this game on another device." If their first device genuinely dropped (lost connection), rejoining on a new device reclaims their in-progress words and score.
5. Guest joins reconnect the same way the current build does — a token saved in that device's browser, not tied to any account.
6. Late joiners (after a round has started) sit in the lobby and are admitted automatically when the next round starts — unchanged from the existing decision.
7. A kicked student's device shows a message and returns to the join screen; their words and score for that round are dropped.
8. Locking the room (teacher control) blocks all new joins — guest or class-list — until unlocked, independent of whether a round is currently live.

---

## 4. Scoring — exact rules and worked examples

**Formula for one word:**
```
score = (points for word length) × (2 if this word was found by only one team, else 1)
       + (2 if today's-sound bonus is on AND this word contains the target sound/spelling)
```
No penalty is ever applied for an invalid, rejected, or duplicate submission.

**Worked example 1 — no sound picked, teams on, bonus not applicable**
Team A and Team B both submit "GAME" (4 letters → 1 point). Because two different teams found it, it is **not unique** — each team scores the plain **1 point**. Team A also submits "PLANET" (6 letters → 3 points), which no other team found — that's unique, so Team A scores **3 × 2 = 6 points**.

**Worked example 2 — today's sound is /ai/ (spellings: ai, ay, a-e), bonus on**
A student on Team C submits "TRAY" (4 letters → 1 point, contains the *ay* spelling). No other team found it, so it's unique: 1 × 2 = 2, then the flat sound bonus is added un-doubled: **2 + 2 = 4 points**. If Team D had also found "TRAY," it would no longer be unique for either team: 1 × 1 = 1, plus the bonus: **1 + 2 = 3 points** each.

**Worked example 3 — Sounds-Write round, a real word not on today's list**
A student submits a real English word that isn't in the Sounds-Write list for this round (e.g. a word too advanced for the certified list). The device shows **"Not on today's list"** rather than "Not a word," awards **0 points**, and applies **no penalty** — the round continues as normal.

---

## 5. Data storage

| What | Where | How long |
|---|---|---|
| Teacher account (name/email from school sign-in) | Persistent database | As long as the account exists |
| Class list(s) (student names, team assignments) | Persistent database, tied to the teacher's account | Until the teacher edits or deletes it |
| Per-game results for class-list students (words found, score, team, sound/spelling tags) | Persistent database | Indefinitely under the teacher's account **(assumption — confirm against school data policy)** |
| Guest players | Not persisted beyond the game itself | Discarded when the game ends, same as today |
| Live round state (current board, timer, in-progress answers) | Server memory only | Lost on server restart — this is why updates must not be pushed mid-lesson |
| Workbook mode | Nothing stored | Unchanged |

**(updated)** The database is Google Firebase Firestore on the free plan, located in Australia (Melbourne region). Sign-in uses Firebase's built-in Google sign-in, in the same project. The game server itself runs on Render, outside Australia.

---

## 6. Build phases

**Phase 1 — Teacher sign-in, no students yet**
**(updated)**
- Add Google sign-in with school accounts. It's optional for workbook mode.
- Remember the last settings for each signed-in teacher.
- Add a connection-test page (`/check`) that confirms the school wifi allows live games.

*Done when:*
- a teacher can sign in, and their settings come back on the next visit;
- workbook mode still works signed out;
- `/check` passes on student devices at school.

**Phase 2 — Class list and joining, no live scoring yet**
Teacher can upload/manage a class list. Students join by code and tap their name, or join as a guest. Lobby shows names (and teams) as they arrive. Round itself still runs as workbook mode.
*Done when:* a full class can join a room by name in a real lesson.

**Phase 3 — Live word entry on devices**
Mirror the board to each device; add swipe/click-drag input and typing fallback; instant local feedback with icons. No comparison between students yet.
*Done when:* a class can play a full round entering words on devices instead of paper.

**Phase 4 — Teams, scoring rules, and the revised ceremony**
Add team assignment; implement the scoring formula above; implement the ceremony order in section 2 — best finds named, team leaderboard full, individual top 5 only, private per-student recap.
*Done when:* a class can play with teams and no student outside the top 5 is ever named in a ranking context.

**Phase 5 — Progress tracking and remaining controls**
Persist per-student, per-sound history; build the teacher's class history view; add kick/rename and lock-room.
*Done when:* after several lessons, the teacher can look up a student and see which sounds/spellings they've found words for over time.

**Phase 6 — Content and accessibility**
Fix Sounds-Write plural tagging, and add the Lexend option, non-colour feedback icons and screen-reader labels. The blocklist, word-family and name-word changes were already done early **(updated)**.
*Done when:* the updated word lists are live and an accessibility pass has been done on host and device screens.

---

## 7. Out of scope for v1

- Solo or at-home practice mode
- Year-level-specific or teacher-authored word lists
- "Junior mode" (Sounds-Write list without a target sound)
- CSV export of results
- A running/session total across multiple rounds in one lesson
- "Skip straight to results" and "mute sound effects mid-round" controls
- Visual/brand redesign (a future pass, separate from this build)
- Rebuilding the phonics word-table generation pipeline (pre-existing limitation, unrelated to this project)
