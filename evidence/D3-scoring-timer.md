# D3 — Scoring and Timer

Task: D3 — Scoring and Timer
Started: 2026-09-28T18:55:09Z (first recorded command of this session: the env log below)
Ended: 2026-09-28T19:01:57Z (last recorded command: final hash consistency check)
Host+OS: dev-host.home / macOS (hidden, arm64 / arm64 host; Node v22.14.0, npm 10.9.0)

Commands executed (exact; implementation edits: `src/game/scoring.ts`,
`src/game/timer.ts`, `tests/scoring.test.ts`, `tests/timer.test.ts` — written
with the editor tools, not shell commands):

```sh
{ date -u +%Y-%m-%dT%H:%M:%SZ; hostname; sw_vers; uname -m; sysctl -n machdep.cpu.brand_string; node --version; npm --version; } > evidence/logs/D3-env.log 2>&1
NO_COLOR=1 npm test > evidence/logs/D3-test-baseline.log 2>&1
NO_COLOR=1 npm test -- scoring > evidence/logs/D3-test-scoring.log 2>&1
NO_COLOR=1 npm test -- timer > evidence/logs/D3-test-timer.log 2>&1
NO_COLOR=1 npm test > evidence/logs/D3-test-full.log 2>&1
NO_COLOR=1 npm run lint > evidence/logs/D3-lint.log 2>&1
NO_COLOR=1 npm run build > evidence/logs/D3-build.log 2>&1
grep -nE '[0-9]' src/game/scoring.ts src/game/timer.ts > evidence/logs/D3-literal-listing.log 2>&1
node --input-type=module -e '
import { readFileSync } from "node:fs";
const gameValues = [200, 1000, 50, 5000, 100];
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}
function scan(source, label) {
  const raw = source.split("\n");
  const code = stripComments(source).split("\n").map((line) => {
    const index = line.indexOf("//");
    return index === -1 ? line : line.slice(0, index);
  });
  const flagged = [];
  const problems = [];
  code.forEach((line, index) => {
    const literals = line.match(/\d+(?:\.\d+)?/g) ?? [];
    if (literals.length === 0) return;
    const annotated = raw[index].includes("// evidence:") || (index > 0 && raw[index - 1].includes("// evidence:"));
    for (const literal of literals) {
      flagged.push({ line: index + 1, literal, annotated });
      if (!annotated) problems.push(label + ":" + (index + 1) + " unannotated " + literal);
      if (gameValues.includes(Number(literal))) problems.push(label + ":" + (index + 1) + " hardcoded game value " + literal);
    }
  });
  return { flagged, problems };
}
for (const file of ["src/game/scoring.ts", "src/game/timer.ts"]) {
  const result = scan(readFileSync(file, "utf8"), file);
  console.log(file + " flagged literals: " + JSON.stringify(result.flagged));
  console.log(file + " problems: " + JSON.stringify(result.problems));
}
const synthetic = "const rogue = 200;\n// evidence: test\nconst zero = 0;\n";
console.log("injected problems: " + JSON.stringify(scan(synthetic, "<injected>").problems));
' > evidence/logs/D3-v7-witness.log 2>&1
shasum -a 256 src/game/scoring.ts src/game/timer.ts tests/scoring.test.ts tests/timer.test.ts data/constants.json evidence/logs/D3-build.log evidence/logs/D3-env.log evidence/logs/D3-lint.log evidence/logs/D3-literal-listing.log evidence/logs/D3-test-baseline.log evidence/logs/D3-test-full.log evidence/logs/D3-test-scoring.log evidence/logs/D3-test-timer.log evidence/logs/D3-v7-witness.log > evidence/logs/D3-hashes.log 2>&1
shasum -a 256 evidence/logs/D3-hashes.log
```

Exit codes: 0 for every command in the final sequence above.

Output summary:

- **V4 scoring** — `npm test -- scoring`: 1 file, **17/17 pass**; the docs/07
  §1 oracle table is asserted exactly (§2).
- **V4 timer** — `npm test -- timer`: 1 file, **17/17 pass**; boundary ticks,
  stop/restart, wall-clock jumps and expiry (§3).
- **V2** — expiry fires exactly once per round is asserted (three dedicated
  tests, §3.2).
- **V7** — both D3 sources are scanned in both test files; every numeric
  literal in code carries an `// evidence:` comment and no game value from
  `data/constants.json` appears as a literal; the scanner itself is self-tested
  with synthetic failing/annotated sources (§4).
- **Full gates** — `npm test`: 11 files, **194/194 pass** (baseline before this
  task: 8 files, 131/131; D2's `tests/input.test.ts`, 29 tests, landed
  concurrently in parallel group 4); `npm run lint` exit 0 (no diagnostics);
  `npm run build` exit 0 (`✓ built in 35ms`, `dist/assets/index-Dw7rYk6O.js`
  334.04 kB / gzip 112.36 kB).
- **Silent witness runs** (EXECUTION.md §8): the timer tests drive an injected
  fake wall clock (no real time passes); no audio element is constructed,
  nothing is played and no browser is launched. No network access was used.
- No docs were edited; no `docs/08` line is proposed (§6).

Artifact SHA-256 hashes (full list, including logs, in §7):

| Artifact | SHA-256 |
|---|---|
| `src/game/scoring.ts` | `f9fd5123f938df262eb5a01e46db3705427222e70906891810aef30c69e98cb4` |
| `src/game/timer.ts` | `4e256b5841d1f0d62dd644b0af020bf3800e70be0b7e0c572dfaa5024f84f76e` |
| `tests/scoring.test.ts` | `4679650c1bcad9b168fd8c599b5edae6778361707ddb4fce52a73ff445543b59` |
| `tests/timer.test.ts` | `868795294e78a4e14ab2295c037985e993895c6a0069fa64396c2d0493a780f5` |
| `data/constants.json` (input, A2) | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |

Result: PASS

---

## 1. Scoring contract (`src/game/scoring.ts`)

```ts
export interface ScoringConstants {
  readonly perLetterSquaredFactor: number; // data/constants.json scoring.*
  readonly bonusPoints: number;
  readonly timeFactor: number;
}
export const NO_BONUS_BALL = -1; // reference bonusball sentinel (init(), O02)

export interface WordScore {
  readonly letterCount: number;  // [...entry].length (code points)
  readonly basePoints: number;   // n² × perLetterSquaredFactor
  readonly bonusApplied: boolean;// bonusBall > -1
  readonly bonusPoints: number;  // bonusPoints once, else 0
  readonly totalPoints: number;  // basePoints + bonusPoints
}
export function scoreWord(entry: string, bonusBall: number, constants: ScoringConstants): WordScore;
export function scoreTimeBonus(remainingSeconds: number, constants: ScoringConstants): number;
```

- **Formulas** — docs/02 §3 (`[CONFIRMED: 2004 official page]`): valid word
  `n² × 50`; bonus word adds `5000` once; time bonus `remaining × 100`. The
  factors are not literals in the module: every value is a `ScoringConstants`
  field passed by the caller from `data/constants.json` (docs/05 §1: modules
  never read the JSON directly). All operations are integer-only.
- **Bonus condition (O02)** — the reference `ekle()` scores
  `if(bonusball > -1) { n² × puankatsayi + 5000 }`
  (`evidence/A2-bonus.md` §2). `scoreWord` therefore pays exactly once iff
  `bonusBall > -1`, where callers pass `BonusLetterTracker.ball` from D1's
  `round.ts` — the single RNG owner; `scoring.ts` never rolls and never touches
  the RNG (asserted). The recorded quirk (a) is preserved: a lucky roll on the
  last added letter leaves `ball === entry length` and still pays
  (`evidence/A2-bonus.md` §3).
- **Time bonus (O14)** — `scoreTimeBonus` is called once on the all-found
  completion with the last displayed integer second; the timeout path adds no
  time bonus (`evidence/A2-timeout.md` §3). `remainingSeconds` is the last
  integer second, so the fractional second is lost exactly as in the
  reference.
- **Validation (structural only)** — `bonusBall` must be an integer ≥ -1,
  `remainingSeconds` an integer ≥ 0, constants non-negative integers; anything
  else throws `RangeError`. No game behavior is invented.

## 2. Scoring oracle — docs/07-verification.md §1 (T08)

| Oracle input | Call | Result |
|---|---|---|
| 3-letter word, no bonus | `scoreWord('ABA', NO_BONUS_BALL, constants.scoring)` | `450` (base 450, bonus 0) |
| 8-letter main word, no bonus | `scoreWord('FİNALİZM', NO_BONUS_BALL, constants.scoring)` | `3200` (base 3200, bonus 0) |
| 4-letter word containing bonus letter | `scoreWord('KELİ', 1, constants.scoring)` | `5800` (base 800, bonus 5000) |
| Remaining time 100 s at completion | `scoreTimeBonus(100, constants.scoring)` | `10000` |

All four rows pass; `data/constants.json` is asserted to be
`{ perLetterSquaredFactor: 50, bonusPoints: 5000, timeFactor: 100 }`, and the
timer test reaches `remainingSeconds === 100` after 100 000 ms of fake wall
clock before applying the bonus (integration of oracle row 4 across both
modules). Additional assertions: n² × factor for lengths 3–8, bonus once for
an 8-letter bonus word (8200), exact-integer results for every length and for
remaining seconds 0–200, O02 tracker integration (lucky `49` → 5800 then the
submit clear → 800; unlucky `50` → 800; quirk (a) at `ball === 4` → 5800).

## 3. Timer contract and semantics (`src/game/timer.ts`)

```ts
export interface TimerConstants { readonly initialSeconds: number; readonly tickMs: number }
export interface TimerClock { now(): number; setTimeout(cb: () => void, delayMs: number): number; clearTimeout(handle: number): void }
export interface TimerOptions {
  readonly constants: TimerConstants;
  readonly onTick?: (remainingSeconds: number) => void; // docs/05 §1 "tick(remaining)"
  readonly onExpired?: () => void;                      // docs/05 §1 "expired"
  readonly clock?: TimerClock;                          // tests inject a fake
}
export interface CountdownTimer {
  readonly initialSeconds: number; readonly remainingSeconds: number;
  readonly running: boolean; readonly expired: boolean;
  start(): void; stop(): void;
}
export function createTimer(options: TimerOptions): CountdownTimer;
```

- **O01 semantics** (`evidence/A2-timer.md` §2–§3): `initialSeconds = 200`,
  `tickMs = 1000` (asserted against `data/constants.json`). The remaining value
  is `int(initialSeconds − elapsedMs / tickMs)` against a captured origin, so
  it decrements at exact 1000 ms wall-clock boundaries, not per callback
  count; a late/blocked callback jumps to the correct wall-clock value and the
  boundary grid is preserved (tested with a 3500 ms jump → 197, next boundary
  500 ms later → 196).
- **Start/stop** — `start()` is `baslat()`: it re-captures the origin and
  restarts from `initialSeconds` (O01: a hypothetical resume restarts from
  200; the original flow starts it exactly once per round). `stop()` is the
  clip's `gotoAndStop(1)`: it cancels the pending boundary and freezes the
  last integer second (`bittimi()` applies the bonus from that value before
  stopping — contract for D5). `stop()` is idempotent and safe before start,
  after stop and after expiry. There is no resume.
- **Expiry** — at zero the timer emits `onTick(0)` (the reference sets
  `timex = 0` first), then `onExpired()` once, then stays stopped/expired;
  further wall clock yields no ticks and no second event (V2). `start()` resets
  the per-round state, so a new round can expire once again.

### 3.1 Test coverage (`tests/timer.test.ts`, 17 tests)

Boundary ticks at 999/1000/2000 ms; full 200 → 0 sequence equals
`[200, 199, …, 0]`; late callback; very late callback; integer-only values;
expiry exactly once; expiry once again after a new `start()`; stop freezes the
value and ticking; restart-from-initial after stop; idempotent stop; a
listener calling `stop()` from inside `onTick` cancels the pending boundary;
time-bonus integration (100 s → 10000); constant validation.

### 3.2 V2 — expiry exactly once per round

Asserted in `tests/timer.test.ts` ("expiry (V2: exactly once per round)"):
after the 200 000 ms boundary the expiration log is exactly
`[200000]`; 60 000 ms more wall clock changes neither the tick list nor the
expiration count; a new `start()` produces exactly one more expiration.

## 4. V7 — source scan (both D3 modules, in both test files)

`tests/scoring.test.ts` and `tests/timer.test.ts` each contain the same
`scanModuleSource` implementation and scan **both** `src/game/scoring.ts` and
`src/game/timer.ts`, so either filtered command enforces the full claim. Rule:

1. Comments are blanked (line numbers preserved), then every numeric literal
   left in code must have an `// evidence:` comment on its line or the line
   above — otherwise the scan reports
   `…:<line>: numeric literal <n> lacks an // evidence: comment`.
2. No literal may equal a value from `data/constants.json` `timer`/`scoring`
   (200, 1000, 50, 5000, 100) — otherwise
   `…:<line>: hardcoded game value <n> (must come from data/constants.json)`.
3. The code must not read `data/constants.json` directly (docs/05 §1).

The scanner is self-tested with a synthetic unannotated literal, a synthetic
hardcoded game value and a synthetic properly annotated source, so the pass is
not vacuous. Actual module literals: `const ZERO = 0;` in both files and
`export const NO_BONUS_BALL = -1;` in `scoring.ts`, each with an
`// evidence:` comment on the preceding line;
`evidence/logs/D3-literal-listing.log` lists every digit-bearing line of both
modules (all other hits are comments).

Independent witness (`evidence/logs/D3-v7-witness.log`, same rule implemented
outside the test harness): `src/game/scoring.ts` flagged literals
`[{line:40, literal:"0", annotated:true}, {line:47, literal:"1", annotated:true}]`,
`src/game/timer.ts` `[{line:86, literal:"0", annotated:true}]`, both problems
lists empty; a synthetic injected `const rogue = 200;` is reported as
`unannotated 200` **and** `hardcoded game value 200`.

## 5. Development iterations and silent witness

Two development iterations failed before the recorded passing gate runs; both
were test-authoring mistakes, fixed and re-run immediately (the redirected
logs hold the passing runs):

1. `npm test -- scoring` — fixture `'YEDİLİ'` in the length table has 6, not 7,
   letters (`expected 6 to be 7`); fixture replaced with `'YEDİLİK'` (7).
2. `npm test -- timer` — the harness exposed the expiration counter through an
   object getter, which destructuring evaluated once (`expected +0 to be 1`);
   replaced with an `expirations: number[]` log array.

Implementation code was not changed by either fix. Silent witness: the timer
suite uses only an injected fake clock; no real timer, no audio, no browser,
no network.

## 6. docs/08 proposal

None. The implemented behavior is exactly the resolved O01/O02/O14 semantics
and the docs/05 §1/§4/§5 contracts; no document needs an amendment. Interface
notes for D5 (self-capture): pass `constants.scoring` / `constants.timer` from
the bootstrap load; apply `scoreWord(entry, bonus.ball, …)` before
`bonus.clearEntry(n)`; read `timer.remainingSeconds` and call
`scoreTimeBonus(...)` before `timer.stop()` on all-found completion only. If
D5's `window.__game.remainingMs` hook wants milliseconds, it can multiply the
integer second by 1000 — the evidenced timer itself is integer-second.

## 7. Hash list

| Artifact | SHA-256 |
|---|---|
| `src/game/scoring.ts` | `f9fd5123f938df262eb5a01e46db3705427222e70906891810aef30c69e98cb4` |
| `src/game/timer.ts` | `4e256b5841d1f0d62dd644b0af020bf3800e70be0b7e0c572dfaa5024f84f76e` |
| `tests/scoring.test.ts` | `4679650c1bcad9b168fd8c599b5edae6778361707ddb4fce52a73ff445543b59` |
| `tests/timer.test.ts` | `868795294e78a4e14ab2295c037985e993895c6a0069fa64396c2d0493a780f5` |
| `data/constants.json` | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |
| `evidence/logs/D3-build.log` | `699e2b93cfb8722dc180d56f6b6d73ba9389d5646f29b49b907ff9b842b6bdc1` |
| `evidence/logs/D3-env.log` | `623f4b83ce030a62f6107bd00d2c0e08fe302683f2491eadb963e6eb8347ff93` |
| `evidence/logs/D3-hashes.log` | `a2e63f4f753a0dcab4bd4d75fdf706336787f245f8ae1a9083b2b106f8e9204e` |
| `evidence/logs/D3-lint.log` | `1127abec44245b91cc3e51990e56293ddb992d67248afcfa1440f5ffa3f11ad1` |
| `evidence/logs/D3-literal-listing.log` | `772cbe2e0aa8a40345652539f5dc6187f2eebbfa9f996e66785aeb92aa5f24c5` |
| `evidence/logs/D3-test-baseline.log` | `e5845a0e56f2ed7aebb6722c605679d3884355cbcd085e70f340884e2677fb25` |
| `evidence/logs/D3-test-full.log` | `0f81e35717c94ad29173f920b15f09fe0794fff05c71972828273f0f9d81229a` |
| `evidence/logs/D3-test-scoring.log` | `fb305b1981dd02dbc4de1e9e3d32405a141509698b4853772664c844167bdb1f` |
| `evidence/logs/D3-test-timer.log` | `1546c5fcc36199b8cd07d6d9c9b3ec9675d6ba08504631279dd05124463f78cc` |
| `evidence/logs/D3-v7-witness.log` | `418d35834e72d5269a47ddf176e7b0ef977e6c0ce6d6f595ad0615a0aa5987a9` |

## 8. Reproduction

```sh
npm test -- scoring   # V4 oracle + V7 scan, 17/17
npm test -- timer     # V4 semantics + V2 expiry-once + V7 scan, 17/17
npm test              # full suite
npm run lint
npm run build
```
