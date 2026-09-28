# D2 — Input and Tiles

Task: D2 — Input and Tiles
Started: 2026-09-28T18:55:37Z (first artifact of this session: `src/game/tiles.ts`)
Ended: 2026-09-28T19:03:00Z
Host+OS: dev-host.home / macOS (hidden, arm64 / arm64 host; Node v22.14.0,
npm 10.9.0, vitest 5.0.2)

Commands executed (exact; `src/game/tiles.ts`, `src/game/input.ts` and
`tests/input.test.ts` were written with the editor tools, not shell commands):

```sh
NO_COLOR=1 npm test -- input > evidence/logs/D2-test-input.log 2>&1            # V4/V7/V2, final state
NO_COLOR=1 npm test -- timer > evidence/logs/D2-timer-check.log 2>&1          # concurrent-state probe (see §7)
NO_COLOR=1 npm test > evidence/logs/D2-test-full-rerun.log 2>&1               # full suite after D3 settled
NO_COLOR=1 npm run lint > evidence/logs/D2-lint.log 2>&1
NO_COLOR=1 npm run build > evidence/logs/D2-build.log 2>&1
NO_COLOR=1 npm test -- input > evidence/logs/D2-test-input.log 2>&1           # final state (after comment edits)
NO_COLOR=1 npm test > evidence/logs/D2-test-full.log 2>&1                     # final state
grep -n "O15(" tests/input.test.ts > evidence/logs/D2-rule-annotations.log
{ date -u +%Y-%m-%dT%H:%M:%SZ; hostname; sw_vers; uname -m; sysctl -n machdep.cpu.brand_string; node --version; npm --version; npx vitest --version; } > evidence/logs/D2-env.log 2>&1
shasum -a 256 src/game/tiles.ts src/game/input.ts tests/input.test.ts src/game/round.ts data/constants.json evidence/logs/D2-*.log > evidence/logs/D2-hashes.log 2>&1
```

Exit codes: **0** for every final-state command. The only non-zero exit is the
intentional concurrent-state probe `npm test -- timer` (exit 1 while D3's
`tests/timer.test.ts` was mid-edit; §7).

Output summary:

- **V4** `npm test -- input` → 1 file, **29/29 tests pass** (`tests/input.test.ts`;
  every O15 edge rule annotated with its rule ID, `evidence/logs/D2-rule-annotations.log`).
- **V7** `ACTION_KEY_NAMES` `SPACE`/`ENTER`/`BACKSPACE` asserted `===`
  `data/constants.json` `input.scrambleKey`/`submitKey`/`deleteKey`, including
  through `resolveKey` (test "V7 — action key names vs data/constants.json").
- **V2** `shuffleOrder(8, 2012)` equals the recorded golden permutation
  `[3,4,1,6,5,7,2,0]`; repeated calls identical; multiset equality with `0..7`
  asserted for five seeds; `deck.shuffle(seed)` preserves the letter multiset.
- **Full gates (final state)**: `npm test` 11 files / **194/194** pass;
  `npm run lint` exit 0; `npm run build` exit 0 (`dist/assets/index-*.js`
  334.04 kB / gzip 112.36 kB — unchanged: D5 wires these modules into the app).
- **Silent witness runs** (`EXECUTION.md` §8): the new modules and tests never
  construct or play audio; no test emits sound.

Artifact SHA-256 hashes (full list in §8):

| Artifact | SHA-256 |
|---|---|
| `src/game/tiles.ts` | `7d9c47fc3112c2d8ff8901d89c421cd53b12753f72ad6cc2fecd4d6684394b66` |
| `src/game/input.ts` | `797cb8b0b9b5387d11595d0456b5660d547e0da8ac44b057d84d50dc8c3277fd` |
| `tests/input.test.ts` | `a07c9e5c84e1ddc164069431c2c0912993aa9d04147b1b2da5ee1716be5a97d1` |
| `src/game/round.ts` (RNG dependency, unchanged) | `5a17d833d714b09a8247564a1e03c896cd24bedcd8b1311399d021aa2e6957bd` |
| `data/constants.json` (V7 input source) | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |

Result: PASS

---

## 1. API contract

### `src/game/tiles.ts`

```ts
export const DECK_SIZE = 8;                          // harfsayisi = 8 (evidence)
export interface TileInstance { id: number; letter: string }
export interface DeckSnapshot { tiles; available: boolean[]; order: number[] }
export interface DeckOptions { onDeckChanged?: (snapshot: DeckSnapshot) => void }

export function shuffleOrder(count: number, seed: number): readonly number[];
export function createDeck(letters: readonly string[], options?: DeckOptions): Deck;

export interface Deck {
  size: number;
  tiles(): readonly TileInstance[];                  // button0..7 order
  order(): readonly number[];                        // display slot -> instance id
  letterOf(id): string | undefined;
  isAvailable(id): boolean;                          // reference _visible
  containsLetter(letter): boolean;
  availableCount(letter): number;                    // duplicates counted
  consume(letter): number | null;                    // keyboard add path
  consumeTile(id): boolean;                          // click add path
  restoreLastHidden(letter): number | null;          // sil()
  restoreAll(): number;                              // karistir()/ekle()
  shuffle(seed): readonly number[];                  // shuffle()
  snapshot(): DeckSnapshot;                          // deckChanged payload
}
```

- Instances are the 8 letters of the round in main-word order (`yerlestir()`:
  `button<i>.word = enbuyukkelime.substring(i,i+1)`); duplicates stay separate
  instances. The frozen round schema guarantees 8 letters; any other length is
  a `RangeError`.
- `consume` scans instance order for `letter && available` (reference
  `while(i < harfsayisi) ... if(t.word == h && t._visible) ... break`) —
  evidence/A2-input.md §2, evidence/A2-edges.md §2(a).
- `restoreLastHidden` scans instance order for `letter && !available`
  (reference `sil()`), **not** the most recently consumed instance —
  evidence/A2-edges.md §2(c).
- `restoreAll` matches `karistir()` and a successful `ekle()` (`t._visible =
  true` for every tile) — evidence/A2-edges.md §2(b)/(d).
- `onDeckChanged` is the docs/05 §1 `deckChanged` output; it fires only for
  actual availability/order changes (consume/restore) or a shuffle.

### `src/game/input.ts`

```ts
export const ACTION_KEY_NAMES = { scramble: 'SPACE', submit: 'ENTER', delete: 'BACKSPACE' };
export const LETTER_KEY_CODES: readonly (readonly [number, string])[];      // 29 O04 pairs
export function resolveKey(event: { keyCode?; key?; code? }): KeyResolution;

export function createInputController(options: { deck: Deck; onEvent? }): InputController;

export interface InputController {
  readonly entry: string;                    // word-entry buffer
  readonly locked: boolean;                  // reference bitti gate
  setLocked(locked: boolean): void;
  handleKey(event: KeyEventLike): InputEvent;
  handleTileClick(tileId: number): InputEvent;
  clearEntry(): void;                        // successful-submit clear only
}

export type InputEvent =
  | { type: 'letter'; letter; tileId; source: 'key' | 'click'; entryLengthAfter }
  | { type: 'delete'; entryWasEmpty; letter | null; tileId | null; entryLengthBefore }
  | { type: 'scramble'; hadEntry; entryLengthBefore }
  | { type: 'submit'; entry }
  | { type: 'rejected'; reason: 'locked' | 'unknown-key' | 'letter-not-in-deck'
      | 'no-available-tile' | 'invalid-tile' | 'tile-unavailable' };
```

- Event names cover the docs/05 §1 outputs: `letter` = `entryChanged`;
  `submit`/`delete`/`scramble` as named. Length fields feed D1's O02 tracker
  (`addLetter(entryLengthAfter)`, `removeLastLetter(entryLengthBefore)`,
  `clearEntry(entryLengthBefore)`).
- `submit` never clears the entry (O15(b)); D3/D5 call `clearEntry()` only for
  a valid new word (reference `ekle()` success: `duzenle("temizle")`,
  `kelime = ""`, all tiles visible).
- `locked` mirrors `bitti`: set by D5's state machine for completion sequences
  and before a round is active (docs/05 §3; evidence/A2-edges.md §3 quirk 3).
- Rejected events are ignored keys/clicks: no mutation and no typer sound
  (D4 maps sounds from `letter`/`delete`/`scramble`/`submit` only).

## 2. Key-mapping table (O04)

Numeric table — primary source (`KeyboardEvent.keyCode`; same Windows
virtual-key values as Flash `Key.getCode()`), transcribed verbatim from
`evidence/A2-input.md` §2 (`harf`/`codes` in `frame_131/DoAction.as init()`):

| Letter | Ç | Ğ | İ | Ö | Ş | Ü | … | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | R | S | T | U | V | Y | Z |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| keyCode | 220 | 219 | 222 | 191 | 186 | 221 | | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79 | 80 | 82 | 83 | 84 | 85 | 86 | 89 | 90 |

The dotted/dotless pair follows the layout, not ASCII: keyCode **73**
(dotless-ı key) → `I`, keyCode **222** (dotted-i key) → `İ`.

Action keys (constants names, `data/constants.json` `input`):

| Action | constants name | keyCode (`Key.isDown`) | `event.key` fallback | `event.code` fallback |
|---|---|---|---|---|
| scramble | `SPACE` | 32 | `' '` | `Space` |
| submit | `ENTER` | 13 | `Enter` | `Enter` |
| delete | `BACKSPACE` | 8 | `Backspace` | `Backspace` |

Browser resolution order (recorded decision; `resolveKey`):

1. `keyCode` against the numeric tables (primary, per O04). A present but
   unmapped `keyCode` (e.g. `0`, punctuation, IME `229`) does **not** block the
   fallbacks.
2. `event.key` (produced character) uppercased with `toLocaleUpperCase('tr-TR')`
   so `i`→`İ`, `ı`→`I`; accepted only if the result is one of the 29 letters.
3. `event.code` matched as `/^Key([A-Z])$/`; `KeyA`..`KeyZ` sit at the same
   positions on Turkish-Q and US QWERTY for the ASCII alphabet, so `KeyI`→`I`
   (dotless-ı key) and `KeyQ`/`KeyW`/`KeyX`→none. The Turkish-specific letters
   live on remapped positions (`Quote`, `Semicolon`, `BracketLeft`, …); these
   are resolved through keyCode/`key` only — no positional guess is made.

Not mapped (no O04 evidence): `NumpadEnter` (real browsers report keyCode 13
for it, which is handled by the primary table), legacy `'Spacebar'`, modifiers,
digits, punctuation. The reference CTRL extra behavior
(`songecerlikelime`, evidence/A2-edges.md §2(g)) is deliberately **not**
implemented. Letters are accepted only while a tile carrying them is available
in the deck, and only the deck's letters can be produced.

## 3. O15 rules → code → tests

| Rule (evidence/A2-edges.md §2) | Implementation | Test |
|---|---|---|
| (a) duplicate letters consume one tile instance each; no tile ⇒ no-op | `Deck.consume`/`consumeTile`, `appendLetter` | "O15(a) duplicate-letter words…", "O15(a) pointer clicks…", deck accounting tests |
| (b) re-submitting a found word is rejected and keeps the entry | `submit` event never clears; `clearEntry()` is the only clear | "O15(b) re-submitting a found word keeps the entry…" |
| (c) BACKSPACE on an empty entry is sound only | `deleteLast` emits `delete` with `entryWasEmpty: true`, no tile change | "O15(c) BACKSPACE on an empty entry is sound only" |
| (d) scramble clears a partial entry (empty entry skips the clear) | `scramble` clears + `restoreAll()`; `hadEntry` carries the O02 quirk | "O15(d) scramble clears a partial entry…" |
| (e) keys for letters not in the deck / not in the alphabet are no-ops | `appendLetter` → `letter-not-in-deck` / `resolveKey` → `unknown-key` | "O15(e) keys for letters not in the deck are no-ops" |
| (f) submit with an empty entry reaches the invalid-word buzz | `submit` emitted with `entry: ''` | "O15(f) ENTER with an empty entry…" |
| (g) CTRL extra behavior is reference-only, not required | not implemented; `resolveKey` → none | "O15(g) the reference CTRL extra behavior is not implemented" |

Round-active gate (`if(!bitti)`, O04; docs/05 §3): `setLocked(true)` blocks keys
and clicks with `rejected('locked')` — test "locked (bitti) blocks keys and
clicks without mutations".

## 4. Shuffle — recorded seed, algorithm, golden

- Algorithm: one seeded draw per display slot picks uniformly among the
  not-yet-placed deck indices (equivalent to the reference `shuffle()` loop
  that accepts `deck<rand>` until a non-`"empty"` index appears; recorded in
  evidence/A2-input.md §2 and `_X = 60 + t*60`). RNG: the project's mulberry32
  `createSeededRandom` from `src/game/round.ts` (amendment 2026-09-28b,
  docs/02 §8; golden stream in evidence/D1-round.md §4). `src/game/round.ts`
  hash equals D1's recorded value — the dependency is unchanged.
- **Recorded test seed: `2012`** (the same deterministic-test value as
  `data/constants.json` `bonusLetter.seed`; a test vector, not a new constant).
- **Golden permutation** for count 8: `[3, 4, 1, 6, 5, 7, 2, 0]`
  (`order[slot]` = displayed instance id). Second recorded vector, seed 7:
  `[0, 1, 7, 5, 4, 3, 2, 6]`.
- The test asserts the golden, repeated-call determinism, multiset equality for
  seeds 0/1/7/2012/99999, and that mapping the shuffled order through the deck
  preserves the letter multiset.

## 5. V7 — key names vs `data/constants.json`

`ACTION_KEY_NAMES` literals are the only place the three names appear; the
`resolveKey` tests assert the resolved action name equals
`constants.input.scrambleKey`/`submitKey`/`deleteKey` exactly (module never
reads the JSON at runtime — docs/05 §1 bootstrap rule). The V7 test fails if
either side changes.

## 6. Hand-offs and deviations (recorded, orchestrator-owned docs)

1. **D5 — production shuffle seed.** The reference reshuffles with unseeded
   Flash `random()`; the rebuild takes a seed. `deck.shuffle(seed)` with a
   fixed seed would reproduce the same order on every scramble, so D5 must own
   the seed source/advance (proposal: base 2012 for the opening deal, seed +
   number of shuffles per round/session — D5 decides and records). D2 does not
   implement or guess a production seed. Round start must call
   `deck.shuffle(seed)` (reference `yerlestir()` → `shuffle()`); the scramble
   event leaves the reshuffle to D5.
2. **docs/05 §3 wording** ("Key handling uses `event.key`"). Implemented as
   `keyCode`-primary with `key`/`code` fallbacks: O04 evidences numeric codes,
   and `event.key` alone cannot distinguish `I`/`İ` on the Turkish layout
   (evidence/A2-input.md §2). Proposed docs/08 amendment line: "D2: browser
   keys resolve via `KeyboardEvent.keyCode` (primary, O04 table 65…Ü 221) with
   `event.key` (Turkish-locale uppercase) and `event.code` (`Key[A-Z]`)
   fallbacks; `key` alone is insufficient (I/İ)."
3. **docs/08 proposal — shuffle determinism:** "2026-09-28 — D2: deck shuffle
   is a seeded permutation (`shuffleOrder(count, seed)`, mulberry32); seed 2012
   recorded as test vector; production seed handling is D5's (see D5 evidence)."
4. **docs/08 proposal — O15(g):** "CTRL (`Key.isDown(17)` + `songecerlikelime`)
   is reference-only and intentionally not implemented (evidence/A2-edges.md
   §2(g))."
5. **Audio wiring (D4/D5):** map `letter` → `letterKey`/`tileClick` (source
   field), `delete` → `delete`, `scramble` → `scramble`, `submit` → D3's
   submitValid/submitAlreadyFound/submitInvalid decision. `rejected` events
   play nothing.

## 7. Concurrent-worker note (full-suite state)

At 18:57:38Z the first full `npm test` of this session (before D3's timer work
settled) failed 4/194 tests, all in `tests/timer.test.ts` (`expected +0 to be
1`), while D3 was actively editing `src/game/timer.ts` (21:55 local) and
`tests/timer.test.ts` (21:57 local). The probe log is
`evidence/logs/D2-timer-check.log` (exit 1, timer only); neither that suite nor
its module imports `tiles.ts`/`input.ts` (verified by source grep). After D3's
edit settled, the full suite is green and stayed green for the final recorded
runs (`D2-test-full-rerun.log`, `D2-test-full.log`: 11 files, 194/194).

## 8. Hash list

| Artifact | SHA-256 |
|---|---|
| `src/game/tiles.ts` | `7d9c47fc3112c2d8ff8901d89c421cd53b12753f72ad6cc2fecd4d6684394b66` |
| `src/game/input.ts` | `797cb8b0b9b5387d11595d0456b5660d547e0da8ac44b057d84d50dc8c3277fd` |
| `tests/input.test.ts` | `a07c9e5c84e1ddc164069431c2c0912993aa9d04147b1b2da5ee1716be5a97d1` |
| `src/game/round.ts` | `5a17d833d714b09a8247564a1e03c896cd24bedcd8b1311399d021aa2e6957bd` |
| `data/constants.json` | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |
| `evidence/logs/D2-build.log` | `b047165494087e41f23b864dd4f2a341ffc0c42c5296bc8926ecaba8f876f1cb` |
| `evidence/logs/D2-env.log` | `2e6ca2c9500f78fe05c1752d748dac738bb8ae5e4405ff93cf0d16db50a6a636` |
| `evidence/logs/D2-hashes.log` | (see file; hashes self-excluded) |
| `evidence/logs/D2-lint.log` | `1127abec44245b91cc3e51990e56293ddb992d67248afcfa1440f5ffa3f11ad1` |
| `evidence/logs/D2-rule-annotations.log` | `b755b57b0563619c7a13a54efacd94777e9edced592a31491e93635fa7a213c7` |
| `evidence/logs/D2-test-full-rerun.log` | `c7c665ca826a85cdcb81bdb976977281c2c933f47c432721c87c20f818f187f0` |
| `evidence/logs/D2-test-full.log` | `2b2a601cbb0bfd59bdfcaa93bee8cc5d625e79d7b0dec78f83da61be9537601f` |
| `evidence/logs/D2-test-input.log` | `3856460e4e2b21e56814f8e9fd9f1dd841ae49eac781bdbfd482d1a7e2d29cc3` |
| `evidence/logs/D2-timer-check.log` | `b09485a3fcb4973d4f98f04c8006685171eba1aa542f5c79e38410e1a273f214` |

(`evidence/logs/D2-hashes.log` lists the same values; the log excludes itself.)

## 9. Reproduction

```sh
npm test -- input        # V4 + V7 + V2 (29 tests)
npm test                 # full suite (11 files, 194 tests)
npm run lint
npm run build
```
