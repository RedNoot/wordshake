# The shop

Students earn ⭐ stars by playing and spend them on looks for their own device. This is the contract the shop is
built to. The code it points at is the detail.

## Rules that don't bend

- **Stars = round score + 5** for every saved round (`starsForRound` in `shared/shop.js`). Everyone starts at 0.
- **Nothing is ever taken away.** Purchases are permanent, nothing expires, and no teacher control removes stars.
- **No ranking.** Balances never show on the big screen or in the Progress class table (it may be on a projector);
  a teacher sees one student's stars only in that student's own view. Avatars are the one thing the class sees
  (in the big-screen lobby), and that's deliberate.
- **The big screen is always classic.** Shop looks only ever show on their owner's device.
- **The teacher can turn it off**: "Let students use their own looks" (setting `ownLooks`, default on). Off = every
  device shows classic, but avatars still show and the shop still works.
- **Readable first.** Every theme, dice style and sticker book passes `test/looks.test.js` (contrast on every pair a
  child reads). Effects stop under reduced motion. A marble set may change the colours but never what they mean: its
  five colours (3, 4, 5, 6, 7+ letters) must stay easy to tell apart, and every jar shape must have no pocket a marble
  could get stuck in (both tested).
- **Guests** (not on the class list) have no stars and no shop, like trophies.
- **Wallets belong to a class**, like trophies: a student in two classes has two wallets.

## Slots

| slot | what it changes | file(s) | default |
|---|---|---|---|
| `theme` | the device's colours (`data-ws-theme`) | `shared/looks/themes.js` | `classic` (free) |
| `dice` | die faces only (`data-ws-dice`), on top of any theme | `shared/looks/dice.js` | the theme's dice |
| `effect` | a burst on the board when a word counts | `shared/looks/effects.js` + drawing in `src/effects.jsx` | none |
| `avatar` | an emoji beside the name: device, splash, big-screen lobby | `shared/looks/avatars.js` | none |
| `cover` | trophy cabinet and sticker book (`data-ws-cover`) | `shared/looks/covers.js` | the theme's (or classic's) |
| `marble` | the word jar's marbles: five colours (one per word length) and a finish (`data-ws-marble`) | `shared/looks/marbles.js` + drawing in `src/jarArt.js` | rainbow glass |
| `jar` | the word jar's shape (also its physics), glass tint, lid and decorations (`data-ws-jar`) | `shared/looks/jars.js` + drawing in `src/jarArt.js` | the plain glass jar |

Each file's header says the item format. Every item has `{ id, slot, name, emoji, price, unlock? }`.
`unlock: "<trophy id>"` means the item can't be bought: it's free once that trophy is won.

The looks become CSS in `src/looks.js`. The selectors work on any element, so `/preview` can show many side by side.
A device decides how it looks in one place only: **`applyLooks(worn, ownLooks)`**.

`/preview` is the proofing gallery: every item drawn as a student sees it, a mix-and-match device, and 👍/👎 notes.

## Data: teachers/{uid}/classes/{classId}/students/{studentId}

- `stars`: every star ever earned. It's in the reward summary (`applyRound`, `SUMMARY_FIELDS`), so it's saved in the
  same transaction as the round and a retried save never counts twice.
- `spent`, `owned` (id → time), `equipped` (slot → id): the wallet. These are **not** summary fields. Only their own
  transactions change them (`buyItem` / `equipItem` in `store.js`, written like `addAward`). Round saves never touch
  them, and those transactions never touch the summary.
- Spendable = `stars − spent` (`balanceOf`). What's worn = `wornLooks(wallet, trophies)`: anything no longer owned or
  no longer in the catalogue falls back to the default.

## Socket contract (server ⇄ student device)

- `player:join` / `player:rejoin` ack gains `looks` (slot → id or null, from `wornLooks`; null for guests) and
  `ownLooks` (bool), so the device dresses itself before it first draws.
- `room:looks` → `{ ownLooks }`, sent to every device when the teacher flips the setting. It replaces `room:theme`,
  which goes. The room has no `theme` any more.
- `player:shop` → `{ ok, wallet: { stars, spent, balance, owned, equipped }, trophies, worn }` | `{ error: "guest" | "not-joined" | "slow-down" }`.
- `player:buy { id }` → `{ ok, wallet, worn }` | `{ error: "not-enough" | "owned" | "unlock-only" | "no-item" | "guest" | "not-joined" | "not-now" }`.
  Lobby only (`not-now` during a round). A bought item isn't worn automatically.
- `player:equip { slot, id | null }` → `{ ok, worn }` | `{ error: "not-owned" | "no-item" | "no-slot" | "guest" | "not-joined" | "not-now" }`.
  Equipping an avatar updates the host's lobby straight away.
- `round:rewards` (to one device) gains `stars` (earned this round) and `balance`.
- The host's room view: each player gains `avatar` (an emoji, or null).

Teacher side: the settings gain `ownLooks` and lose `theme`. An old saved `theme` is ignored, not an error.
`host:open` takes `ownLooks`. `host:own-looks { on }` changes it live. `host:theme` goes. In Progress, a single
student's view shows their stars (balance, earned) and the items they own.

## Seasonal shelves

`shared/seasons.js` lists the seasons and when each is open (Australian days): **Halloween** all October,
**Christmas** all December, **Easter** from two weeks before Easter Sunday to a week after.

- A seasonal item is an ordinary item of any slot plus `season: "<id>"`. Each season's items live in
  `shared/looks/seasons/<id>.js` (word-sparkle drawings in `src/effects/<id>.jsx`), and the slot files add them to
  their lists, so every rule and test above applies to them unchanged.
- **Buying waits for the season; keeping doesn't.** `cantBuy(wallet, trophies, id, t)` says `not-in-season` outside
  the dates. `owns`, `cantEquip` and `wornLooks` ignore seasons: a Halloween theme bought in October is worn in March.
- **The server's clock decides.** `player:shop` gains `seasons` (the open ones, from `openSeasons(now)`), and
  `player:buy` can answer `not-in-season`. The Shop shows a shelf per open season, first; an owned seasonal item
  also sits on its slot's shelf all year, and an unowned one is away until its season comes round.
- `/preview` has a tab per season whatever the date, so shelves can be proofed ahead of time.
