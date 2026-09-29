# Y5 — Speaker click: immediate visual feedback (owner follow-up) — evidence

Task: Y5 — speaker immediate feedback (`tasks/Y5-speaker-immediate-feedback.md`)
Started: 2026-09-29T15:15:22+03 (first Y5 command; prefix-spec copy mtime; baseline log 15:15)
Ended: 2026-09-29T15:21+03 (this file is the last evidence write)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host · Node v22.14.0 · @playwright/test 1.63.0
Result: **PASS** (final statuses in §7)

All browser work used muted Chromium (`--mute-audio`, EXECUTION.md §8; Playwright
project launch args and the probe's own launch). No sound was played or decoded.
No network access, no git operation, no `../kelimator-nostalji/` access, no
`docs/**` edit (proposals in §9; the task registration line already present in
`docs/08-open-items.md` was left untouched).

---

## 1. Defect, root cause and owner decision (owner-investigated; relied upon)

Owner findings (quoted from the task/root-cause record, not re-litigated here):

- Every click toggles the persisted volume reliably: **36/36 inset-grid points**,
  **43/43 instrumented clicks** resolved to `btn_speaker`, rapid clicks
  `100→0→100→0→100` — no dead zones.
- The icon does **not** repaint at click time: faithful to the reference (C3
  plain-click probe **0 px**; sprite 88 re-evaluates `vol` on frame entry only),
  but it makes users re-click; a fast even click count flips straight back, so
  the toggle "sometimes does nothing".
- **Owner decision: flip the icon immediately on click; do NOT add debouncing**
  (a double-click flipping twice is normal toggle behavior; the fix is instant
  feedback, not input filtering).

## 2. Fix (`src/ui/hud.ts`, owned path)

Functional change is exactly one call in the delegated handler:

```ts
const onSpeakerClick = (event: Event): void => {
  ...
  toggleMute();
  syncSpeakerVisual(options.board);   // Y5: immediate feedback
};
```

- `syncSpeakerVisual` (unchanged) flips `data-speaker`, hides/shows the waves
  `use` (sprite-88 character 85) and applies/removes the frame-"off"
  `feComponentTransfer` filter on the icon (character 87) from `isMuted()`.
- Comments in the same file updated to record the deviation (module header,
  handler comment with the owner-approval `// evidence:` line, and the
  `syncSpeakerVisual` doc): the reference timing (frame-entry only; C3 0 px) is
  deliberately superseded for usable feedback — `evidence/Y5-speaker-feedback.md`
  §6; no other code touched.
- `tests/speaker.test.ts` (audio-level unit tests) is unaffected — it never
  asserted the icon timing (9/9 within the 238-test run, §7). Its header comment
  (lines 14–18) still describes boot/render-only icon timing; it is outside this
  task's owned paths, so a proposed replacement is in §9.

## 3. Probe method (`tests/e2e/speaker/y5-feedback-probe.mjs`, new)

Manual run (like X3's `capture-states.mjs`; not picked up by `npm run e2e`),
muted Chromium, stage 550×400, deviceScaleFactor **1 and 2**, fresh context per
dsf (boot default `vol = 100`, no stored value):

- **43 clicks per dsf**, mirroring the owner instrumentation count:
  - *immediate phase*: 2 clicks (mute/unmute) with the state read right after the
    click — no keyboard input, no render — plus element screenshots;
  - *grid phase*: 6×6 inset grid (**36 points**, 3 px inset) over the element box
    `(513.98,364.74,33.53,34.08)` = `layout.json` `btn_speaker`
    `(513.99,364.74,33.54,34.09)`; every point clicked;
  - *rapid phase*: **5 quick clicks** (the `100→0→100→0→100` reference sequence).
- **No-render guard**: a `MutationObserver` on the board root counts board
  childList records (`board.apply` clears and re-creates its children → a render
  writes records) plus the speaker DOM node identity (a render replaces the
  node). Both must hold for every click.
- **Hit attribution**: a one-shot capturing click listener records whether the
  click target resolved to `btn_speaker` (the owner's 43/43 finding).
- Per click the probe records stored volume, `data-speaker`, waves display,
  mutation count, node identity and hit. Exit 0 iff all 43 clicks per dsf toggle
  the volume, hit the element, flip the icon immediately with no render, and the
  off screenshot differs from ON while the restored ON equals the initial ON.

Outputs: `evidence/visual/Y5/prefix/**` and `evidence/visual/Y5/postfix/**`
(`dsf1|dsf2/probe.json`, `on.png`, `off.png`, `on-restored.png`, `after-43.png`,
`on-zoom.png`, `off-zoom.png`), combined `evidence/visual/Y5/probe-{prefix,postfix}.json`.

## 4. Pre-fix run (un-fixed `hud.ts`, recorded)

**Old assertions (committed spec, copied before editing).** The old suite passed
5/5 on the un-fixed code — it encoded the defect (`click` → `data-speaker`
stays `on`, screenshot equal):

- copy: `evidence/visual/Y5/probe/speaker.spec.prefix.ts` (sha `1dc8ef59…` =
  the committed file before the rewrite);
- run: `evidence/logs/Y5-prefix-old-suite.log` — **5 passed, exit 0**.

**New immediate-feedback assertions, pre-fix.** `evidence/logs/Y5-prefix-new-suite-fail.log`
— **5 failed / 2 passed, exit 1**; every immediate assertion failed exactly as
the defect predicts, e.g. test 1 line 168 `Expected: "off" Received: "on"`, and
the dsf-1/dsf-2 tests line 305 likewise. (The 2 passes are the unrelated Y4
corner-alpha guard.)

**Probe, pre-fix** (`evidence/logs/Y5-probe-prefix.log`, exit 1):

| Measure per dsf 1 / 2 | Pre-fix result |
|---|---|
| clicks | 43 / 43 |
| volume toggled (parity `100→0→100→…`) | **43/43** and **43/43** |
| clicks that hit `btn_speaker` | **43/43** and **43/43** |
| icon state matches the just-stored volume inside the click | **21/43** and **21/43** (only the "expected on" half) |
| icon screenshot off vs ON | **identical, 0/1225 px** and **0/4900 px** |
| restored ON vs initial ON | identical (trivially, icon never changed) |
| board renders during the 43 clicks | **0** and **0** |
| `data-speaker` state after all 43 clicks (stored `0`) | still `on` (stale) |

So the root cause is confirmed independently: clicks are reliable; the icon is
what lags. The click log ((`evidence/visual/Y5/prefix/dsf{1,2}/probe.json`) shows
`stored 0→100→0→…` with `data-speaker` constant `on` throughout.

## 5. Post-fix run

**Probe, post-fix** (`evidence/logs/Y5-probe-postfix.log`, exit 0, both dsf):

| Measure per dsf 1 / 2 | Post-fix result |
|---|---|
| clicks | 43 / 43 |
| volume toggled | **43/43** and **43/43** (same parity as pre-fix) |
| clicks that hit `btn_speaker` | **43/43** and **43/43** |
| icon state matches the just-stored volume inside the click | **43/43** and **43/43** (`off→on→off→…`, no render) |
| board renders during the 43 clicks | **0** and **0** (`boardMutationsMax` 0) |
| speaker node identity preserved across all clicks | 43/43 and 43/43 |
| icon screenshot off vs ON | **differs: 435/1225 px raw (35.510 %) / 117 tolerant (9.551 %)** · **1427/4900 raw (29.122 %) / 541 tolerant (11.041 %)** |
| restored ON vs initial ON | **identical, 0 px** both dsf (ON frame restored exactly) |
| state after all 43 clicks (stored `0`) | `off` and `off` — matches, no render needed |

- The ON capture is byte-identical pre-fix vs post-fix (dsf1 `65370ec7…`, dsf2
  `cc93d7ca…`): only the click repaint changed, the frame rendering did not.
- `after-43.png` equals `off.png` post-fix (dsf1 `5ba98b38…`, dsf2 `883fae00…`)
  and equals `on.png` pre-fix — the "stale icon" signature.
- Zoom crops for the record: `evidence/visual/Y5/postfix/dsf1/on-zoom.png` /
  `off-zoom.png` (dsf1 ×8; dsf2 ×4) show the waves hidden and the pale icon in
  the off frame.

## 6. Dated amendment — deliberate deviation + SUPERSEDING note

**Amendment 2026-09-29 (owner wave Y5).** The rebuild deliberately deviates from
the measured reference behavior: the C3 probe measured a plain reference click
as **0 px** changed (sprite 88 evaluates `_root.vol` on frame entry only and the
frames `stop()`; `evidence/C3-speaker-capture.md` §1), while the rebuild now
repaints the icon **inside the click event**. This is by owner preference for
usable feedback (the no-repaint behavior made users re-click and an even count
flipped the mute straight back). No debouncing is added — a multi-click flipping
multiple times remains normal toggle behavior. Toggle/persistence semantics
(`vol` 0/100, `stopAllSounds`, `kelimator.volume`) and the boot/render sync are
unchanged.

**SUPERSEDING note for the X3/O24 timing record** (old evidence is not
rewritten; `evidence/X3-speaker.md` §7.3 and the O24 closure text stay as
history):

```
SUPERSEDING 2026-09-29 — evidence/Y5-speaker-feedback.md §6 — the X3/O24 timing
record "click toggles vol + persistence only; the icon applies at boot/render
from the persisted volume" is superseded for the rebuild by owner decision (task
Y5): the click now also repaints the sprite-88 on/off frame immediately — a
deliberate deviation from the measured reference behavior (C3 plain-click probe:
0 px), chosen for usable feedback; no debouncing. Toggle/persistence semantics
and the boot/render sync are unchanged.
```

## 7. Final suite results (logs in `evidence/logs/`)

| Suite | Command | Result |
|---|---|---|
| Speaker (3 X3 semantics + 2 Y5 immediate dsf1/2 + 2 Y4 corner) | `npm run e2e -- speaker` | **7 passed, exit 0** — `Y5-speaker-final.log`; pre-fix fail `Y5-prefix-new-suite-fail.log`; pre-fix old suite `Y5-prefix-old-suite.log` |
| Visual (V5+V2+V7+Y2) | `npm run e2e -- visual` | **18 passed, exit 0** — S2 dsf1 tolerant 0.659 %, dsf2 0.178 % (allowance ignored 65 930 / 263 720) — `Y5-visual-final.log` |
| Unit/integration | `npm test` | **14 files / 238 tests passed, exit 0** — `Y5-test.log` |
| Lint | `npm run lint` | **exit 0** — `Y5-lint.log` |
| Build | `npm run build` | **exit 0** (tsc + Vite; pre-existing >500 kB chunk-size warning only) — `Y5-build.log` |
| Probe pre-fix | `node tests/e2e/speaker/y5-feedback-probe.mjs <url> prefix` | expected **exit 1** (allPassed=false; §4) — `Y5-probe-prefix.log` |
| Probe post-fix | `node tests/e2e/speaker/y5-feedback-probe.mjs <url> postfix` | **exit 0** (allPassed=true; §5) — `Y5-probe-postfix.log` |

The closing `tools/verify-all.sh` is orchestrator-run; nothing under `evidence/`
was written by the suites above (record flags unset — outputs go to
`test-results/`).

## 8. Hash inventory

| Artifact | SHA-256 |
|---|---|
| `src/ui/hud.ts` (fixed) | `0b115231f05c4841e377fbcaf19cb75c44dbe929bfd47f9d5922ef8a70ad30bb` |
| `tests/e2e/speaker/speaker.spec.ts` (rewritten) | `9ce10b5d5df649ee0e2f56f6688b23abd32798bb2f4e021d618fdc65fc41bccc` |
| `tests/e2e/speaker/y5-feedback-probe.mjs` (new) | `2ec76795a59c29ebb3c23ba9fc47e616838f72bd5df8b0f8b2b431b853267803` |
| `evidence/visual/Y5/probe/speaker.spec.prefix.ts` (= pre-fix committed spec) | `1dc8ef598f6842dda601f4e9e3cd470a68e52ec2f937d69cad3d35c2e869c6d8` |
| `evidence/visual/Y5/probe-prefix.json` | `63743fa4f133d12e533946d45480ca6b7feb9350906333c13f922bd422b1065c` |
| `evidence/visual/Y5/probe-postfix.json` | `0dd985db9dd53c6ae18f482256a160bb1af4f47a17255d47c8942b393bcd5e87` |
| ON crop dsf1 (pre = post) | `65370ec7c731f17c29d9650d46e009cf4a402b9591c3fd65ceaa06f871c4b0eb` |
| OFF crop dsf1 pre-fix (= ON) | `65370ec7c731f17c29d9650d46e009cf4a402b9591c3fd65ceaa06f871c4b0eb` |
| OFF crop dsf1 post-fix | `5ba98b388d1de8688e8cebc95af31ffa6eb4e6d37d5884443b3f8bd8e72b3f07` |
| ON crop dsf2 (pre = post) | `cc93d7ca1f87f5202446ac6082a81a0120882c92686acf9fdfb7e9c09b6dfd1e` |
| OFF crop dsf2 post-fix | `883fae00c6028cb48aee174dee66d251a529c94cc7166bbe55a79fa2607c6756` |

## 9. Proposed docs lines (single-writer: the orchestrator applies these)

**`docs/08-open-items.md` — SUPERSEDING line for the X3/O24 timing record**
(append after the X3/O24 resolved lines; exact text in §6 above):

> SUPERSEDING 2026-09-29 — evidence/Y5-speaker-feedback.md §6 — the X3/O24
> timing record "click toggles vol + persistence only; the icon applies at
> boot/render from the persisted volume" is superseded for the rebuild by owner
> decision (task Y5): the click now also repaints the sprite-88 on/off frame
> immediately — a deliberate deviation from the measured reference behavior (C3
> plain-click probe: 0 px), chosen for usable feedback; no debouncing.
> Toggle/persistence semantics and the boot/render sync are unchanged.

**`docs/08-open-items.md` — Y5 resolved entry:**

> RESOLVED 2026-09-29 — evidence/Y5-speaker-feedback.md — speaker immediate
> feedback: the icon flips inside the click (`onSpeakerClick` → `toggleMute()`
> + `syncSpeakerVisual`, no debouncing; deliberate deviation from the
> reference's frame-entry timing). Speaker e2e asserts the immediate flip at
> dsf 1+2 with a board-render MutationObserver + node-identity guard, keeping
> reload/persistence coverage; probe re-verified 43/43 clicks per dsf (volume
> toggles + hit attribution + icon flips; 36-point grid + 5 rapid; 0 board
> renders; off vs ON 35.5 %/29.1 % raw). Suites: speaker 7, visual 18, full
> 238; lint/build exit 0.

**`docs/07-verification.md` §4 (Amendments) — amendment:**

> Amendment 2026-09-29c (owner final wave Y5): the speaker icon is deliberately
> repainted inside the click handler for immediate usable feedback; the measured
> reference timing (a plain click changes 0 px — C3 probe; sprite 88 evaluates
> `_root.vol` on frame entry only) is deviated from by owner decision, with no
> input debouncing. Speaker e2e asserts the immediate flip at dsf 1+2 with a
> board-render MutationObserver + node-identity guard and keeps the
> reload/persistence checks. Evidence: `evidence/Y5-speaker-feedback.md`
> §2/§4–§6; matching entry in `docs/08-open-items.md`.

**Minor drift (not in this task's owned paths).** `tests/speaker.test.ts`
header lines 14–18 still say "the sprite-88 'on'/'off' frame follows the
persisted volume at boot/render (C3 probe: a plain reference click changes
0 px)". Proposed replacement sentence for the orchestrator:

> The icon timing is HUD-level, not audio-level: a click toggles `vol` +
> `stopAllSounds` + persistence and (Y5, owner decision) repaints the sprite-88
> "on"/"off" frame immediately; boot/render keeps applying the persisted volume.
> That timing is asserted by tests/e2e/speaker/speaker.spec.ts; this file covers
> the audio semantics.

## 10. Silent witness and hygiene

- Every browser run (probe pre/post, all suites) used Chromium with
  `--mute-audio`; no sound was played or decoded; no Ruffle run.
- No network access, no git operation, no `docs/**` file written, no
  `../kelimator-nostalji/` access.
- Owned-path discipline: writes limited to `src/ui/hud.ts`,
  `tests/e2e/speaker/**`, `evidence/Y5-*`, `evidence/visual/Y5/**`,
  `evidence/logs/Y5-*`. `npm run build` refreshed `dist/` (build output only).
  Playwright wrote transient `test-results/` only.
- Comment text inside the owned `src/ui/hud.ts` was refreshed in the same edit
  as the functional one-line change so no statement contradicts the code.

## 11. Result

**PASS** — `onSpeakerClick` calls `syncSpeakerVisual` after `toggleMute()`
(single-functional-call change, owner-approval comment). Pre-fix the new
assertions fail 5/5 (dsf 1+2) and the probe measures the stale icon
(43/43 volume toggles, 21/43 icon flips, 0 px off-vs-on); post-fix the speaker
suite is 7/7, the probe is 43/43 on every counter at dsf 1 and 2 with 0 board
renders, and `visual` 18/18, `npm test` 238/238, lint and build are all exit 0.
The deliberate deviation from the measured reference timing and the
SUPERSEDING note for X3/O24 are recorded in §6; the orchestrator runs the
closing `tools/verify-all.sh`.
