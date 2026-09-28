# D1 — Round Module

Task: D1 — Round Module
Started: 2026-09-28T18:39:20Z (first recorded command of this session; baseline
`npm test` at 21:39:20 local = 18:39:20Z)
Ended: 2026-09-28T18:47:33Z
Host+OS: dev-host.home / macOS (hidden, arm64 / arm64 host; Node v22.14.0,
npm 10.9.0)

Commands executed (exact; implementation edits: `src/game/round.ts`,
`tests/round.test.ts` — written with the editor tools, not shell commands):

```sh
NO_COLOR=1 npm test -- round > evidence/logs/D1-test-round.log 2>&1
npx ajv-cli validate -s data/rounds.schema.json -d src/data/rounds.json > evidence/logs/D1-ajv.log 2>&1
NO_COLOR=1 npm test > evidence/logs/D1-test-full.log 2>&1
NO_COLOR=1 npm run lint > evidence/logs/D1-lint.log 2>&1
NO_COLOR=1 npm run build > evidence/logs/D1-build.log 2>&1
shasum -a 256 src/game/round.ts tests/round.test.ts src/data/rounds.json data/rounds.schema.json data/constants.json data/constants.schema.json > evidence/logs/D1-hashes.log 2>&1
npx tsc --noEmit --listFiles 2>&1 | grep -E "round\.ts|rounds\.json" > evidence/logs/D1-typecheck.log 2>&1
date -u +%Y-%m-%dT%H:%M:%SZ ; hostname ; sw_vers ; uname -m ; sysctl -n machdep.cpu.brand_string ; node --version ; npm --version > evidence/logs/D1-env.log 2>&1
```

Exit codes: 0 for every command listed (the `grep` in the typecheck probe
matched both files; the baseline `npm test` before the change was also 0).

Output summary:

- **V4** `npm test -- round` → 2 files, **54/54 tests pass**: D1 34 + B3
  `rounds-fixtures` 20 (Vitest's name filter matches both files).
- **V3** test `src/data/rounds.json vs frozen schema` compiles
  `data/rounds.schema.json` with `ajv` (v8.20.0, installed through the
  `ajv-cli` devDependency — no `ajv` import exists in `src/**`)
  and asserts **zero errors**; the same document also passes D1's compact
  dependency-free validator with zero issues. CLI cross-check:
  `npx ajv-cli …` → `src/data/rounds.json valid`.
- **V2** sequence test: 7,393 rounds yielded in file order; first `ABACILIK`,
  last `ŞİŞİRTME`; full `main`/`id` arrays equal the raw file read.
- **Full gates**: `npm test` 8 files / **131/131** pass; `npm run lint` exit 0;
  `npm run build` exit 0 (`dist/assets/index-*.js` 334.04 kB, gzip 112.36 kB —
  unchanged, see note below). No Vite chunk-size warning occurred: `D1`'s module
  is not imported by the app entry yet (`src/main.ts` is owned by C2/E2; D5
  wires the core). Once D5 imports `round.ts`, the 12 MB JSON bank will inline
  into the entry chunk and a >500 kB chunk-size warning is expected — per the
  task that warning is not a failure.
- Silent witness runs: no audio path is executed by D1; nothing was played.

Artifact SHA-256 hashes (full list in §7):

| Artifact | SHA-256 |
|---|---|
| `src/game/round.ts` | `5a17d833d714b09a8247564a1e03c896cd24bedcd8b1311399d021aa2e6957bd` |
| `tests/round.test.ts` | `a07d82d4106885f3a4b3f9405024bbd15cec1da8f6811dadd56167b44c3082e1` |
| `src/data/rounds.json` (input/B3) | `7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96` |
| `data/rounds.schema.json` (frozen, C1) | `44fd8ead39a03f890c9934be94d9c673a19137f8fa4ad6eca575aaedd8e148fc` |
| `data/constants.json` (seed 2012) | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |

Result: PASS

---

## 1. API contract (`src/game/round.ts`)

```ts
export const ROUNDS_SOURCE = 'src/data/rounds.json';

export type WordLength = 3 | 4 | 5 | 6 | 7 | 8;
export type RoundLetters = readonly [string, string, string, string, string, string, string, string];
export type RoundWords = Readonly<Record<WordLength, readonly string[]>>;

export interface Round {
  readonly id: string;                 // may repeat (docs/06 §4 amendment)
  readonly main: string;               // 8-letter display form
  readonly letters: RoundLetters;      // multiset of main, main-word order (B3)
  readonly bonusLetter: string | null; // null at load; see §4
  readonly words: RoundWords;          // display forms, sorted
}

export interface RoundsDocument { readonly schemaVersion: 1; readonly rounds: readonly Round[] }
export interface RoundValidationIssue { readonly path: string; readonly message: string }
export class RoundValidationError extends Error {
  readonly issues: readonly RoundValidationIssue[];
}
export function validateRoundsDocument(data: unknown): RoundValidationIssue[];
export function parseRoundsDocument(data: unknown, source?: string): RoundsDocument;
export const ROUNDS: readonly Round[];  // validated at module load (fail fast)

export interface RoundSequence {
  readonly size: number;
  readonly nextIndex: number;
  hasNext(): boolean;
  next(): Round;   // RangeError when exhausted
  reset(): void;
}
export function createRoundSequence(rounds?: readonly Round[]): RoundSequence;

export interface RandomSource { randomInt(range: number): number }
export function createSeededRandom(seed: number): RandomSource;

export interface BonusLetterTracker {
  readonly ball: number;             // reference `bonusball`
  readonly hasPendingBonus: boolean; // ball > -1
  addLetter(entryLengthAfterAdd: number): void;
  removeLastLetter(entryLengthBeforeRemove: number): void;
  clearEntry(entryLengthBeforeClear: number): void;
  reset(): void;
}
export function createBonusLetterTracker(random: RandomSource): BonusLetterTracker;
```

Design notes (plan references):

- Loading is a static JSON import (`docs/04` §4/§5 runtime artifact path; Vite
  bundles it), so the loader works unchanged in the app and in Vitest — no
  `fetch`, no network request at runtime (`docs/04` §3).
- `docs/05` §2 sketches `words: Record<3|4|5|6|7, string[]>`. The frozen schema
  requires the `"8"` key as well (it holds only the main word; docs/02 §1 and
  every fixture), so the typed view is a **superset** `Record<3..8>` — no frozen
  key is dropped. Proposal in §6.1.
- Fields are `readonly`: the bank is a shared singleton; the only dynamic
  per-round state is the bonus tracker (§4), which keeps `Round` immutable.

## 2. Validation behavior

- Runs **at module load** (`parseRoundsDocument(roundsJson, ROUNDS_SOURCE)`);
  a malformed file fails fast with `RoundValidationError` before any round is
  handed out.
- Error message shape:
  `src/data/rounds.json: 2 schema violation(s): $.rounds[0].main: …; $.rounds[0].words.7: …`
  — every failing path is included. `error.issues` exposes the structured list.
- Path format (JSONPath-like): `$`, `$.schemaVersion`, `$.rounds`,
  `$.rounds[7]`, `$.rounds[7].id`, `$.rounds[7].letters[2]`,
  `$.rounds[7].words.3`, `$.rounds[7].words.3[0]`, `$.rounds[7].extra`.
- The compact validator re-implements the **frozen schema constraints only**
  (`data/rounds.schema.json`, draft-07; EXECUTION.md §5 frozen interfaces; no
  `ajv` import anywhere in `src/**` — runtime deps are none, docs/04 §1):
  root object with exactly `schemaVersion` (`const 1`) + `rounds`
  (`minItems 1`); per round: required `id`/`main`/`letters`/`words`, no extra
  keys, `id` matches `^[a-z0-9-]+$`, `main` exactly 8 Unicode code points
  (JSON-Schema `minLength`/`maxLength` semantics), `letters` exactly 8 items of
  exactly 1 code point, `words` object with exactly the keys `3`–`8` (each an
  array of strings). All violations are collected (not just the first).
- Additionally tested: the same document passes both validators (ajv and the
  compact one) with zero errors; a mutated document per constraint class is
  rejected with the expected path (`tests/round.test.ts`, 13 malformed cases).
- `id` values are **not** required to be unique (docs/06 §4 amendment):
  `SAKLAMAK`/`ŞAKLAMAK` both load as `saklamak`.

## 3. Selection semantics (docs/05 §6)

- `ROUNDS` is exactly the file array mapped one-to-one; array order is the
  identity (duplicate `id`s included).
- `createRoundSequence()` keeps a cursor: `next()` returns `ROUNDS[nextIndex++]`
  in file order (deterministic; no random selection). `size` = 7,393,
  first = `ABACILIK` (`abacilik`), last = `ŞİŞİRTME` (`sisirtme`).
- `reset()` restarts at index 0. `next()` throws `RangeError` when the bank is
  exhausted: docs/05 §6 does not define end-of-bank behavior, so D5 decides
  (reset, or stop); proposal in §6.5.

## 4. Bonus-letter helper (O02) — API for D5/D3

Mechanism reproduced exactly from `evidence/A2-bonus.md` §2–§3 (O02):

- round start (`init()`): `bonusball = -1`; `Round.bonusLetter` is therefore
  `null` at load (no bonus exists until a letter is added — the docs/05 §2
  "set at round start" comment predates the O02 resolution; proposal §6.3).
- on **every accepted letter add** while `ball === -1`:
  `roll = random(1000)`; if `roll < 50` (5 %) → `ball = entryLengthAfterAdd`
  (reference `bonusball = kelime.length`). The ball that lights is the **next**
  added ball (0-based index = `ball`); the triggering add never lights.
- while `ball > -1` no further rolls happen; the next **valid** submit pays
  `constants.scoring.bonusPoints` (5000) once, then the reference clears the
  entry (`duzenle("temizle")`), i.e. `clearEntry(entryLength)` resets it.
  Invalid / already-found submits keep the entry and the pending bonus.
- resets: `removeLastLetter(n)` when the removed ball (`n - 1`) is the pending
  `ball`; `clearEntry(n)` for any non-empty clear (`n > 0`); `reset()`.
- preserved quirks (evidence/A2-bonus.md §3): (a) submit immediately after the
  lucky roll still pays, although no bright ball was shown (and `ball` can be 8
  after a lucky roll on the 8th letter — no ball ever lights); (b) an
  **empty-entry** clear (scramble with nothing typed) does **not** reset;
  (c) a pending bonus survives deleting non-bright balls.
- `createSeededRandom(seed)` is mulberry32 (32-bit); the seed is supplied by the
  caller from `data/constants.json` `bonusLetter.seed` = **2012** (amendment
  2026-09-28b; the app loads constants once at bootstrap and passes typed
  values, docs/05 §1 — this module never reads `constants.json`).
  Recorded golden stream for seed 2012, `randomInt(1000)`:
  `394, 477, 205, 796, 679, 724, 783, 670, 512, 414, 129, 798, 350, 552, 582,
  523, 283, 418, 115, 866, …`; the first value below the 50/1000 cut is roll
  index 52 (0-based) = `0` → first lucky add for seed 2012 is add 53
  (round 7, letter 5). Both are asserted in the tests; changing the RNG
  algorithm changes these recorded values on purpose.

D5/D3 consumption pattern (also asserted in the tests):

```ts
import constants from '../../data/constants.json'; // loaded once at bootstrap
import { createBonusLetterTracker, createRoundSequence, createSeededRandom } from '../game/round';

const sequence = createRoundSequence();                       // one per session
const round = sequence.next();                                 // newRound(): file order
const bonus = createBonusLetterTracker(createSeededRandom(constants.bonusLetter.seed));

// letter added (keyboard or tile click); n = entry length AFTER the add
bonus.addLetter(n);
const lightsBrightBall = bonus.ball === n - 1;                 // duzenle("ekle") decision
const brightLetter = bonus.ball >= 0 && bonus.ball < 8 ? round.main[bonus.ball] : null;

// valid submit: score first, then clear (reference ekle())
const bonusPoints = bonus.hasPendingBonus ? constants.scoring.bonusPoints : 0;
bonus.clearEntry(n);                                           // duzenle("temizle") + kelime = ""

// BACKSPACE: call BEFORE removing the last letter (reference sil())
bonus.removeLastLetter(n);
// scramble: karistir() calls duzenle("temizle") then kelime = ""
bonus.clearEntry(n);
// round start: init()
bonus.reset();
```

## 5. Checksum (`harf="9999"`) — O03

None implemented, by evidence: the 2012 client stores the 9999 entry in
`kelimatorid` during `myOnLoad` and never compares, recomputes or branches on
it; its only consumer was the excluded `hiscore.php` URL
(`evidence/A2-checksum.md` §1–§3; `docs/02` §1; O12/`evidence/A2-kelimatorid.md`
classifies `kelimatorid` EXCLUDED). The frozen bank schema has no checksum
field. Recorded in the `round.ts` header comment.

## 6. Rules / deviations — proposed `docs/08` lines (orchestrator-owned)

1. **`docs/05` §2 `words` sketch omits `"8"`.** D1 types
   `Record<3|4|5|6|7|8, readonly string[]>` (superset of the sketch, exact for
   the frozen schema). Proposed line: "2026-09-28 — D1: `Round.words` keeps all
   six frozen keys `3`–`8` (the sketch in docs/05 §2 lists only 3–7); no data is
   dropped."
2. **`docs/05` §2 prod fallback not implemented.** The sketch says a prod build
   "logs and picks the next valid round"; D1 implements document-level
   fail-fast (task step 1) and the frozen bank validates completely at G2, so
   the fallback is unreachable on the shipped artifact. Proposed line: "D1:
   round loading is fail-fast in all builds; per-round skip-on-invalid is not
   implemented (bank fully valid at G2)."
3. **`docs/05` §2/§6 "set bonus letter at round start".** O02 governs: the
   selection happens per added letter; `Round.bonusLetter` is `null` at load and
   the dynamic state lives in the tracker. Proposed line: "D1: bonus selection
   is dynamic per O02; `Round.bonusLetter` is null until selection."
4. **O16 status** is still `OPEN` in `docs/08` although B3 executed its
   procedure (`evidence/B3-threshold.md`; `tools/build-config.json`
   `thresholdT = 30`, bank 7,393 ≥ 500). Proposed status line: `RESOLVED
   2026-09-28 — evidence/B3-threshold.md — T = 30 selected (largest T with bank
   ≥ 500 rounds); config written.`
5. **End-of-bank selection** (7393rd round played): docs/05 §6 is silent; D1's
   `next()` throws `RangeError` and `reset()` restarts. Proposed line if a
   cycling behavior is wanted: "D1/D5: sequence end-of-bank behavior defined as
   …".

## 7. Hash list

| Artifact | SHA-256 |
|---|---|
| `src/game/round.ts` | `5a17d833d714b09a8247564a1e03c896cd24bedcd8b1311399d021aa2e6957bd` |
| `tests/round.test.ts` | `a07d82d4106885f3a4b3f9405024bbd15cec1da8f6811dadd56167b44c3082e1` |
| `src/data/rounds.json` | `7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96` |
| `data/rounds.schema.json` | `44fd8ead39a03f890c9934be94d9c673a19137f8fa4ad6eca575aaedd8e148fc` |
| `data/constants.json` | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |
| `data/constants.schema.json` | `e33b5dfa20cb68aa5a339ac98135adc89952ebc718ae799e46d881c5a7b32053` |
| `evidence/logs/D1-ajv.log` | `0e574d5966d70cd87863b8cbaa00b3e07f34397a0b89577467e877544b073834` |
| `evidence/logs/D1-build.log` | `d7c883588196f9a5961ca07d39a8a92e7ac47acf8ae4c9fa3eb7e98adac40fd0` |
| `evidence/logs/D1-env.log` | `472374dce91685a2f8eb4f6f90eba942eb445838947c8c5f071bce71f4d3efa4` |
| `evidence/logs/D1-hashes.log` | `dc8d5d34d82fca771228edea762dfee020d1c587585059624d8124779acff19d` |
| `evidence/logs/D1-lint.log` | `90e92eae30e2e06b63ff15cc5aaca5aca3979ea685ca39b64bb40b64fba928af` |
| `evidence/logs/D1-test-full.log` | `efb6c18e10679f0d6f79e00434d56986add2db9d92b13f4fb739e6cb90d83198` |
| `evidence/logs/D1-test-round.log` | `1213e7d3d3a32cb57c9a3c1d267d11aa6ceb907820acaaddc458ec4f47a9f63b` |
| `evidence/logs/D1-typecheck.log` | `511b7fa94cc04d548c047b8c4fef27cbf49db65a9b15baf53bbe46b12778cf0d` |

## 8. Reproduction

```sh
npm test -- round                 # V4 + V3 + V2 (D1 34 + B3 20 tests)
npx ajv-cli validate -s data/rounds.schema.json -d src/data/rounds.json   # V3 CLI
npm test                          # full suite
npm run lint
npm run build
```
