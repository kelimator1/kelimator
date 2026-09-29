# C2 — Stage, Scaling, Fullscreen

Task: C2 — Stage, Scaling, Fullscreen
Started: 2026-09-28T12:52:58Z (constants-source decision; first check command)
Ended: 2026-09-28T12:57:52Z
Host+OS: dev-host.home / macOS · node v22.14.0 · npm 10.9.0 · Playwright 1.63.0 (Chromium already installed; no download run)
Commands executed (exact):
  - `if [ -f data/constants.json ]; then echo "EXISTS"; shasum -a 256 data/constants.json; else echo "ABSENT"; fi` (start, 12:52:58Z)
  - `npm test -- stage`
  - `npm run build`
  - `npm run lint`
  - `npx eslint src/stage.ts src/main.ts tests/stage.test.ts tests/e2e/smoke.spec.ts playwright.config.ts`
  - `npm run e2e -- smoke` (fail ×2 → diagnostics, see §5; then pass)
  - `node <scratch matrix dumper> ` (temporary script under the approved temp dir; drives the dev server and prints applied metrics)
  - `npm run e2e`
  - `npm test`
  - `shasum -a 256 <artifacts>`
Exit codes: `npm test -- stage` 0 · `npm run build` 0 · `npm run lint` 1 (fails only on F1-owned `verify/diff/diff.mjs`, see §5.4) · scoped `npx eslint` 0 · `npm run e2e -- smoke` 0 (final; first two runs 1 with root-caused test issues, see §5) · `npm run e2e` 0 · `npm test` 0 · `shasum` 0
Output summary: Stage shell implemented (`src/stage.ts`: pure `computeStageMetrics`, DOM `mountStage`, fullscreen, test hooks); bootstrap mounts it and exposes `window.__game` read-only scaffolding (`src/main.ts`); unit matrix `tests/stage.test.ts` (11 tests) and Chromium smoke `tests/e2e/smoke.spec.ts` (7 tests) pass; `playwright.config.ts` gained the app project + Vite `webServer`; 5 non-blank screenshots recorded. Constants source: `data/constants.json` absent at start and at end → docs/02 §8 placeholder stage values (550×400) for layout only + docs/04 §2 letterbox fallback `#9DAF48`.
Artifact SHA-256 hashes: §6 below (full list in `evidence/logs/C2-hashes.log`)
Result: PASS

---

## 1. Constants-source decision (no guessing)

`data/constants.json` was **absent at start (2026-09-28T12:52:58Z) and still
absent at end (2026-09-28T12:57:52Z)** (A2 runs concurrently; `data/` untouched
by C2). Per the task input rule, the placeholder stage values from
`docs/02-mechanics-spec.md` §8 (`stage.width = 550`, `stage.height = 400`) are
used for **layout/scaling only**; no gameplay value was taken or written.

Letterbox fill: the frozen `data/constants.schema.json` has no background
color field, so no extracted value can come from `data/constants.json`.
docs/04 §2 specifies the documented fallback `#9DAF48`, which is what
`LETTERBOX_FALLBACK` applies. The extracted-value path is preserved as
`StageOptions.letterbox` (docs/03 §4: "the extracted value wins" when A1/A3
evidence supplies it); C2 does not invent one.

## 2. Implementation (owned paths only)

- `src/stage.ts`
  - `STAGE_WIDTH = 550`, `STAGE_HEIGHT = 400`, `LETTERBOX_FALLBACK = '#9DAF48'`
    with `// evidence:` doc references.
  - `computeStageMetrics(vw, vh, sw = 550, sh = 400)` → `scale = min(vw/550,
    vh/400)`, `offsetX/offsetY = (vw − sw·s) / 2`, `(vh − sh·s) / 2`
    (docs/04 §2, fractional scaling allowed).
  - `mountStage(options)` builds `data-testid` elements: `stage-shell`
    (viewport wrapper/letterbox, fixed inset 0), `stage-root` (550×400 logical
    root, `transform: scale(s)`, positioned by the computed offsets,
    `transform-origin: 0 0`), `fullscreen-button` (user-gesture element,
    docs/04 §6 "buttons"). A `<style id="stage-shell-styles">` sets
    `html/body`/shell letterbox and stage-root box; no other file changes.
  - Recompute listeners: `resize`, `orientationchange` (window),
    `fullscreenchange` (document). Inside fullscreen the shell's own
    `clientWidth/clientHeight` feed the same formula (docs/04 §2).
  - `toggleFullscreen()`: `shell.requestFullscreen()` / `document.exitFullscreen()`;
    ESC remains native and is not intercepted.
  - `StageHandle.destroy()` removes listeners and the mounted DOM.
- `src/main.ts`: `mountStage()` + read-only `window.__game` getters
  (`state`, `roundId`, `foundWords`, `score`, `remainingMs`, `lastAudioEvent`)
  returning explicitly un-wired placeholders (`null`/`0`/`[]`); real values
  belong to D2/D3/D5. `GameTestHooks` interface exported for them.
- `tests/stage.test.ts`: viewport matrix (320×480, 550×400, 1920×1080,
  3840×2160, 3440×1440 ultra-wide, plus 2560×1080 and 600×1200) with
  hardcoded expected scale/offsets, fit + centering + aspect assertions,
  determinism (V2 invariance), explicit-stage case.
- `tests/e2e/smoke.spec.ts` (Chromium): page load + testids + `__game` hooks +
  `orientationchange` no-page-error check; the five-viewport matrix asserting
  applied scale/offsets vs the spec formula (±0.01 px), letterbox
  `rgb(157, 175, 72)`, and non-blank screenshots; fullscreen V2 assertion.
- `playwright.config.ts`: app project `tests/e2e/**` (Chromium, baseURL,
  1280×720) and `reference` project `verify/**` (C3, no app baseURL); shared
  Vite `webServer` (`npm run dev -- --host 127.0.0.1 --port 5199 --strictPort`,
  `reuseExistingServer` outside CI). Verified both with Playwright spawning the
  server itself and with a pre-started server.

## 3. Verification results

| Type | Check | Exact command | Exit | Log |
|---|---|---|---|---|
| V4 | Unit: scale function, full matrix | `npm test -- stage` | 0 | `evidence/logs/C2-unit.log` (11 tests) |
| V4 | Full suite stays green | `npm test` | 0 | `evidence/logs/C2-test-full.log` (27 tests: 11 C2 + 16 F1) |
| V5 | Smoke, 5-viewport matrix + screenshots | `npm run e2e -- smoke` | 0 | `evidence/logs/C2-e2e-smoke.log` (7 tests) |
| V5 | Full Playwright run (app+reference projects) | `npm run e2e` | 0 | `evidence/logs/C2-e2e-full.log` (7 tests) |
| V2 | Fullscreen scale invariance | inside `npm run e2e -- smoke` test 7 | 0 | same log |
| — | Strict typecheck + static build | `npm run build` | 0 | `evidence/logs/C2-build.log` |
| — | Lint, C2-owned files | `npx eslint src/stage.ts src/main.ts tests/stage.test.ts tests/e2e/smoke.spec.ts playwright.config.ts` | 0 | `evidence/logs/C2-lint-scope.log` |
| — | Repo-wide lint (informational) | `npm run lint` | 1 | `evidence/logs/C2-lint.log` — fails only on F1-owned `verify/diff/diff.mjs` (§5.4) |
| — | Applied-metrics dump | `node <scratch matrix dumper>` | 0 | `evidence/logs/C2-matrix.log` |

### 3.1 V4 matrix (hardcoded expectations in `tests/stage.test.ts`)

| Viewport | Expected scale | Expected offset (x, y) |
|---|---|---|
| 320×480 | 0.581818182 | (0, 123.6364) |
| 550×400 | 1.000000000 | (0, 0) |
| 1920×1080 | 2.700000000 | (217.5, 0) |
| 3840×2160 | 5.400000000 | (435, 0) |
| 3440×1440 (ultra-wide) | 3.600000000 | (730, 0) |
| 2560×1080 (21:9) | 2.700000000 | (537.5, 0) |
| 600×1200 (tall) | 1.090909091 | (0, 381.8182) |

All 11 unit tests pass (`npm test -- stage`, exit 0).

### 3.2 V5 smoke — applied values (`evidence/logs/C2-matrix.log`)

| Viewport | Applied scale | Applied offset (x, y) | Letterbox | Result |
|---|---|---|---|---|
| 320×480 | 0.581818182 | (0.0000, 123.6250) | rgb(157, 175, 72) | OK |
| 550×400 | 1.000000000 | (0.0000, 0.0000) | rgb(157, 175, 72) | OK |
| 1920×1080 | 2.700000000 | (217.5000, 0.0000) | rgb(157, 175, 72) | OK |
| 3840×2160 | 5.400000000 | (435.0000, 0.0000) | rgb(157, 175, 72) | OK |
| 3440×1440 | 3.600000000 | (730.0000, 0.0000) | rgb(157, 175, 72) | OK |

`offsetY` at 320×480 reads 123.625 instead of 123.6364 because Chromium
quantizes `getBoundingClientRect` to 1/64 px (documented in §5.1); the applied
inline style is exactly `top: 123.636px`.

Screenshots (non-blank checked in-browser: ≥ 2 distinct pixel colors sampled
from the encoded PNG via canvas; the current shell contains the letterbox fill
and the Fullscreen button — the stage interior is intentionally empty until
E1/E2 supply visuals):

| File | SHA-256 |
|---|---|
| `evidence/visual/C2-smoke/smoke-320x480.png` | `593ab88dc74871b6b91c32b61a188c97ad7453da8e5b1fde0af47aa9945c32dc` |
| `evidence/visual/C2-smoke/smoke-550x400.png` | `90ed53be78a0ffe3d967dda14f2cdd3d30898b17f4db7ec5731529657faea8c4` |
| `evidence/visual/C2-smoke/smoke-1920x1080.png` | `b460e456b48e82dc68d5353826888f4c5866f8379854cc1c406dc7007c2da278` |
| `evidence/visual/C2-smoke/smoke-3840x2160.png` | `b432bf373a345d71b828354afb584eae79a9a65cde41849e752fb23de4a24e1e` |
| `evidence/visual/C2-smoke/smoke-3440x1440.png` | `f047fb0968c9f9877c47af13c7c55831fc22181788538fc43af78e71c3741569` |

### 3.3 V2 fullscreen assertion (headless Chromium, app viewport 1280×720)

1. Before toggle: applied scale matches `min(1280/550, 720/400) = 1.8` (±0.01).
2. Click `fullscreen-button` (real user gesture) → `document.fullscreenElement`
   is `stage-shell`; `clientWidth×clientHeight` remain 1280×720.
3. Inside fullscreen: applied scale matches the formula for the fullscreen
   element's dimensions and equals the pre-toggle scale (±0.01).
4. Exit via `document.exitFullscreen()` (native path, §5.2) → scale returns to
   the same value; no page errors collected anywhere in the test.

## 4. Raw logs

`evidence/logs/`: `C2-env.log`, `C2-unit.log`, `C2-test-full.log`,
`C2-e2e-smoke.log`, `C2-e2e-full.log`, `C2-build.log`, `C2-lint.log`,
`C2-lint-scope.log`, `C2-matrix.log`, `C2-hashes.log`.

## 5. Findings and deviations (all resolved inside C2 scope; no product change to hide a failure)

1. **Chromium rect quantization (test tolerance).** First smoke run failed
   320×480 because `getBoundingClientRect().top` read back 123.625 vs the exact
   computed 123.6364 — a 1/64 px LayoutUnit floor, not an app defect (inline
   style verified exact: `top: 123.636px`). The spec's ±0.01 px is kept for
   scale; offset assertions allow `0.01 + 1/64` px, documented in the spec.
2. **Headless ESC.** Headless Chromium does not route the ESC key to the
   fullscreen controller, so the exit step of the V2 test calls
   `document.exitFullscreen()` — the same native API the browser runs on ESC.
   The app still leaves ESC to the browser (docs/04 §2); no key handling added.
3. **Stage interior empty.** Expected at this gate: assets/layout arrive via
   E1/E2; screenshots prove shell, letterbox color and button render.
4. **Repo-wide lint is red on a foreign file.** `npm run lint` exits 1 only for
   `verify/diff/diff.mjs` (F1-owned; 3 × `preserve-caught-error`). C2-owned
   files lint clean (exit 0). Recorded, not fixed (file ownership).
5. **Data/constants decision.** See §1; no `data/` write was made by C2.

## 6. Artifact SHA-256 hashes (final state)

```
141fec5c8ae962eae2b21e639cda92b6536cf0043bbd5e909475f0b3730d6b0b  src/stage.ts
4476427e50ad395e8db8c900be07a2daaa8c8d76399d8c6b55cfb96d35cc81b5  src/main.ts
29361b98645505fcf0a29fb022bf3855f27c88ac516c35106e402131368611b1  tests/stage.test.ts
9067fcb5b5697919b8db1ebde78275de6872dab3b74d96da85a4278d65030519  tests/e2e/smoke.spec.ts
a09d3d92a0b82d57fc9b94110db70bab4b58e871fca8029d3ad8141892364ccf  playwright.config.ts
593ab88dc74871b6b91c32b61a188c97ad7453da8e5b1fde0af47aa9945c32dc  evidence/visual/C2-smoke/smoke-320x480.png
90ed53be78a0ffe3d967dda14f2cdd3d30898b17f4db7ec5731529657faea8c4  evidence/visual/C2-smoke/smoke-550x400.png
b460e456b48e82dc68d5353826888f4c5866f8379854cc1c406dc7007c2da278  evidence/visual/C2-smoke/smoke-1920x1080.png
b432bf373a345d71b828354afb584eae79a9a65cde41849e752fb23de4a24e1e  evidence/visual/C2-smoke/smoke-3840x2160.png
f047fb0968c9f9877c47af13c7c55831fc22181788538fc43af78e71c3741569  evidence/visual/C2-smoke/smoke-3440x1440.png
```

Log hashes (generated 2026-09-28T12:57:52Z) are in `evidence/logs/C2-hashes.log`.

---

## Follow-up (D5 wiring) — `window.__game` smoke assertion

Task: C2 follow-up — align the smoke `__game` assertion with the D5-wired hooks
(D5 evidence §9.4)
Started: 2026-09-28T19:37:57Z (first follow-up artifact: before-run log)
Ended: 2026-09-28T19:39:08Z
Host+OS: dev-host.home / macOS (same host as the original record)

Commands executed (exact), exit codes, results:

| # | Command | Exit | Result | Log |
|---|---|---|---|---|
| 1 | `npm run e2e -- smoke` (before fix) | 1 | 6/7 — stale placeholder assertion fails exactly as D5 §9.4 predicted: received `state: "playing"`, `roundId: "abacilik"`, `remainingMs: 200000`, `lastAudioEvent: "roundStart"`, `score: 0`, `foundWords: []` | `evidence/logs/C2-followup-smoke-before.log` |
| 2 | `npm run e2e -- smoke` (after fix) | 0 | **7/7 pass** | `evidence/logs/C2-followup-e2e-smoke.log` |
| 3 | `npm run e2e -- visual` | 0 | **17/17 pass** (S1–S7/S10 × dsf1/dsf2 + V7 layout cross-consistency) | `evidence/logs/C2-followup-e2e-visual.log` |
| 4 | `npm test` | 0 | **12 files, 217/217 pass** | `evidence/logs/C2-followup-test.log` |
| 5 | `npm run lint` | 0 | no diagnostics | `evidence/logs/C2-followup-lint.log` |
| 6 | `npm run build` | 0 | static build; expected >500 kB chunk warning (documented by D5 §8 #4, not a failure) | `evidence/logs/C2-followup-build.log` |

### Change (only `tests/e2e/smoke.spec.ts`)

The C2 placeholder deep-equality (`state: null`, `roundId: null`,
`remainingMs: 0`, `lastAudioEvent: null`, …) is replaced by the wired getter
contract (D5 §9.4):

- `state` is the FSM string `'playing'` at boot;
- `roundId` is a non-empty string;
- `foundWords` is an array of strings;
- `score` is a finite number ≥ 0;
- `remainingMs` is a finite number, `> 0` (live countdown) and `≤ 200000`
  (200 s initial, `data/constants.json` `timer.initialSeconds`);
- `lastAudioEvent` is `null` or a string.

All stage/scale/letterbox/non-blank/fullscreen assertions are unchanged; no new
waits were added (the same single `page.goto` + poll structure as the original
record). The file header comment now names the D5 query. Live smoke runs write
transient screenshots to `test-results/c2-smoke-live/` via the pre-existing
`C2_RECORD` mechanism, so the original evidence PNGs stay frozen (verified
below).

`data/constants.json` is now present (A2; SHA-256
`ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661`): its
`stage.width/height` are 550/400, matching the C2 constants, and the letterbox
fallback is unchanged (the frozen constants schema still has no background
color field, §1 of this record).

### Refreshed hashes (`evidence/logs/C2-followup-hashes.log`)

```
171069a7e3372e53e3f14dd2d61899cffa6afdacc661899ec2f0ca3970d55ac8  tests/e2e/smoke.spec.ts
1129b89ac2ea0abb96615ca66cd6732fe0ca6da0a75315b643ff0303dad6f87b  evidence/logs/C2-followup-smoke-before.log
8f90c7c0f532ed6531f6a6f7a706db53b4d6f066ee20441ed62ebcbae4e49b51  evidence/logs/C2-followup-e2e-smoke.log
75b033823baf4c50c438caa18119e6a552bf6dd54c793337d01a0eec4612585a  evidence/logs/C2-followup-e2e-visual.log
74f6ee2bd201ecaaa732139267e127b97b38ce346d35a941402ad607473837ba  evidence/logs/C2-followup-test.log
1127abec44245b91cc3e51990e56293ddb992d67248afcfa1440f5ffa3f11ad1  evidence/logs/C2-followup-lint.log
1296ae2d7c258938a5dbc4dc4e044cab33d4a002540436015263a9825e170e02  evidence/logs/C2-followup-build.log
593ab88dc74871b6b91c32b61a188c97ad7453da8e5b1fde0af47aa9945c32dc  evidence/visual/C2-smoke/smoke-320x480.png   (frozen, unchanged)
90ed53be78a0ffe3d967dda14f2cdd3d30898b17f4db7ec5731529657faea8c4  evidence/visual/C2-smoke/smoke-550x400.png   (frozen, unchanged)
b460e456b48e82dc68d5353826888f4c5866f8379854cc1c406dc7007c2da278  evidence/visual/C2-smoke/smoke-1920x1080.png (frozen, unchanged)
b432bf373a345d71b828354afb584eae79a9a65cde41849e752fb23de4a24e1e  evidence/visual/C2-smoke/smoke-3840x2160.png (frozen, unchanged)
f047fb0968c9f9877c47af13c7c55831fc22181788538fc43af78e71c3741569  evidence/visual/C2-smoke/smoke-3440x1440.png (frozen, unchanged)
ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661  data/constants.json (input, unchanged by this follow-up)
```

Result: PASS

---

## Follow-up (Y8 boot sequence) — settled `playing` state

Task: C2 follow-up — smoke awaits the Y8 boot sequence
(`preloader → intro(5–130) → playing`) before the wired `__game` assertions
(Y8 evidence §2, §6 #10)
Started: 2026-09-29T20:04:30Z (first follow-up artifact: before-run log)
Ended: 2026-09-29T20:05:51Z (hash log)
Host+OS: dev-host.home / macOS (same host as the original record)

Commands executed (exact), exit codes, results:

| # | Command | Exit | Result | Log |
|---|---|---|---|---|
| 1 | `npm run e2e -- smoke` (before fix) | 1 | 6/7 — first test failed at `expect(hooks.state).toBe('playing')`, received `"preloader"` (the pre-Y8 synchronous-boot expectation during the intro) | `evidence/logs/C2-followup-y8-smoke-before.log` |
| 2 | `npm run e2e -- smoke` (after fix) | 0 | **7/7 pass** (first test 4.8 s: boot + contract checks) | `evidence/logs/C2-followup-y8-e2e-smoke.log` |
| 3 | `npm run e2e -- visual` | 0 | **18/18 pass** (S1–S7/S10 × dsf1/dsf2, V7 layout, Y2 credit omission) | `evidence/logs/C2-followup-y8-e2e-visual.log` |
| 4 | `npm test` | 0 | **15 files, 242/242 pass** | `evidence/logs/C2-followup-y8-test.log` |
| 5 | `npm run lint` | 0 | no diagnostics | `evidence/logs/C2-followup-y8-lint.log` |
| 6 | `npm run build` | 0 | static build; expected >500 kB chunk warning (D1 note) | `evidence/logs/C2-followup-y8-build.log` |

### Change (only `tests/e2e/smoke.spec.ts`)

- Added `SETTLED_PLAYING_TIMEOUT_MS = 10_000` with the Y8 citation: boot is
  preloader 111.1 ms + intro 3500 ms (`evidence/Y8-intro.md` §2), so 10 s is
  the intro duration plus ≈6.4 s margin.
- After `page.goto('/')`, the first test now waits with
  `expect.poll(() => page.evaluate(() => window.__game?.state ?? null), {
  timeout: SETTLED_PLAYING_TIMEOUT_MS }).toBe('playing')` before reading the
  hooks. The `__game` contract assertions (state/roundId/foundWords/score/
  remainingMs/lastAudioEvent, §Follow-up (D5 wiring)) are unchanged and now run
  on the settled state; stage/scale/letterbox/non-blank/fullscreen assertions
  are untouched.
- No intro-suite duplication: the spec never inspects `__bootLog` or intro
  elements; the boot sequence itself stays covered by `tests/e2e/intro/**`.
  Other smoke tests need no wait (they assert stage geometry/letterbox/screenshot
  only, which hold during the intro).

### Refreshed hashes (`evidence/logs/C2-followup-y8-hashes.log`)

```
b1c27d949404f353923d3650483feaa680da3f37da72fe4f6eff930d4d921616  tests/e2e/smoke.spec.ts
e302339181edaaea4c5cdf841530824717f6367b5af8f3b83c232918ef5686dd  evidence/logs/C2-followup-y8-smoke-before.log
9bfb34f99100a0070de351a5d0e8e672849d10aaccee0b15cbfc4fe25fc47aee  evidence/logs/C2-followup-y8-e2e-smoke.log
b88708129fc2d2b5205d9fc485969f86ce517080e0f092a70e803800bd464b00  evidence/logs/C2-followup-y8-e2e-visual.log
8743f41a7a34cbd46370f0adcca6f82c836749068426e76ce040d9db651637e7  evidence/logs/C2-followup-y8-test.log
1127abec44245b91cc3e51990e56293ddb992d67248afcfa1440f5ffa3f11ad1  evidence/logs/C2-followup-y8-lint.log
4fc5fa795e5382dfab595d6d707f50d2e9d4482f759cf0c1c87bd9a7e48e89e9  evidence/logs/C2-followup-y8-build.log
593ab88dc74871b6b91c32b61a188c97ad7453da8e5b1fde0af47aa9945c32dc  evidence/visual/C2-smoke/smoke-320x480.png   (frozen, unchanged)
90ed53be78a0ffe3d967dda14f2cdd3d30898b17f4db7ec5731529657faea8c4  evidence/visual/C2-smoke/smoke-550x400.png   (frozen, unchanged)
b460e456b48e82dc68d5353826888f4c5866f8379854cc1c406dc7007c2da278  evidence/visual/C2-smoke/smoke-1920x1080.png (frozen, unchanged)
b432bf373a345d71b828354afb584eae79a9a65cde41849e752fb23de4a24e1e  evidence/visual/C2-smoke/smoke-3840x2160.png (frozen, unchanged)
f047fb0968c9f9877c47af13c7c55831fc22181788538fc43af78e71c3741569  evidence/visual/C2-smoke/smoke-3440x1440.png (frozen, unchanged)
```

Result: PASS
