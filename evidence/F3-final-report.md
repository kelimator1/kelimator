# F3 — Final Matrix (single gate report)

Task: F3 — Final Matrix (`tasks/F3-final-matrix.md`; 2026-09-29 orchestrator amendment)
Started: 2026-09-28T21:32:59Z (first F3 artifact written: `tests/e2e/offline/offline.spec.ts`)
Ended: 2026-09-28T21:43:34Z (report written; matrix run ended 21:40:27Z — timestamps in §3)
Host+OS: dev-host.home / macOS (arm64 / arm64 host), Node v22.14.0, bash 3.2.57
Commands executed (exact): §3 (full transcript: `evidence/logs/F3-verify-all.log`)
Exit codes: `tools/verify-all.sh` **exit 0** — 11/11 steps PASS (§3); support checks §3/§6
Output summary: final matrix finalized and green; G1–G5 recorded complete (§5); README §2
fixed decisions re-checked (§6); T14 offline check implemented (§4); carried OPEN items
O23/O25 documented with resolution pointers (§7); committed `evidence/` stayed frozen
during the matrix run (§8); artifact hashes §9
Artifact SHA-256 hashes: §9
Result: **PASS**

---

## 1. Scope and deliverables

| Deliverable | Path | State |
|---|---|---|
| Single gate entry point (finalized) | `tools/verify-all.sh` | executable, `set -euo pipefail`, 11 steps, exit 0 only when all pass |
| T14 offline check (new) | `tests/e2e/offline/offline.spec.ts` | 1 test, PASS; serves the built `dist/` from a local preview and blocks every non-local request |
| Run transcript (committed run log) | `evidence/logs/F3-verify-all.log` | full output of the green matrix run (11/11) |
| Failed first run (recorded, not hidden) | `evidence/logs/F3-attempt1.log` | console capture of attempt 1 (tooling defect in the transcript location, fixed; see §3.4) |
| T14 recorded output | `evidence/logs/F3-offline-report.log` | machine-readable offline report (JSON) from the green run |
| Gate / fixed-decision re-checks | `evidence/logs/F3-gates.log` | T01–T03 re-runs, network/font/language/stage scans, hygiene status |

No `docs/**` file was edited; proposed `docs/08` lines are listed in §10.

## 2. The single entry point (`tools/verify-all.sh`)

Runs in this fixed order, records every step's PASS/FAIL and exit code, continues after
failures, and exits 0 only when all steps pass (task step 1; `docs/07` §1/§6):

1. lint — `npm run lint`
2. unit/integration — `npm test`
3. schema validations (T06) — `npx ajv-cli validate` for
   `data/rounds.schema.json → src/data/rounds.json`,
   `data/constants.schema.json → data/constants.json`,
   `data/sound-map.schema.json → data/sound-map.json`,
   `data/layout.schema.json → data/layout.json` (strict: a missing data file fails)
4. fixtures (T07) — `npm test -- fixtures`
5. idempotency (T10) — `node tools/build-rounds.mjs` twice → identical SHA-256, and equal to
   the committed artifact hash recorded by G2/O16
6. cross-consistency (T04/T05) — `npm test -- constants`, `npm test -- audio`
7. visual (T11) — `npm run e2e -- visual`
8. animation (T12) — `npm run e2e -- animation`
9. playthrough (T13) — `npm run e2e -- playthrough`
10. offline (T14) — `npm run e2e -- offline`
11. frozen-evidence check — `git status --porcelain -- evidence/ | wc -l` must be 0

Suites run **without** recording flags: the script unsets `C2_RECORD`, `E2_RECORD`,
`E3_RECORD`, `F2_RECORD`, `F3_RECORD`, so all transient outputs stay under `test-results/`
and committed `evidence/**` remains frozen (evidence-freeze amendment 2026-09-28; F3
amendment 2026-09-29). The combined transcript is written to
`artifacts/verify-all/F3-verify-all.log` (gitignored, not wiped by Playwright); the
committed copy is `evidence/logs/F3-verify-all.log`.

## 3. Matrix run — commands with exit codes

Run window (attempt 2, green): 2026-09-28T21:35:34Z → 2026-09-28T21:40:27Z.
Transcript: `evidence/logs/F3-verify-all.log`.

| # | Exact command | Exit | Key result |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint clean |
| 2 | `npm test` | 0 | 227/227 tests, 13 files |
| 3 | schema step (4 × `npx ajv-cli validate -s <schema> -d <data>`) | 0 | all 4 pairs valid (T06) |
| 4 | `npm test -- fixtures` | 0 | 20/20 (T07) |
| 5 | `node tools/build-rounds.mjs` ×2 (+ SHA-256 compare) | 0/0 | both runs `7e4e149b…b9a96` = committed (T10/V8) |
| 6 | `npm test -- constants` | 0 | 3/3 (T04/V7) |
| 6 | `npm test -- audio` | 0 | 17/17 (T05/V7, amended command) |
| 7 | `npm run e2e -- visual` | 0 | 17 passed; 16 tolerant comparisons, worst **1.359 %** (S4 dsf1; limit 2 %); raw max 6.719 % (S6 dsf2, monitoring) |
| 8 | `npm run e2e -- animation` | 0 | 8 passed; keyframes worst tolerant **1.104 %** (`sprite_wordball_timeline` @ 1.0556 s) |
| 9 | `npm run e2e -- playthrough` | 0 | 3 passed (D5 basic 2.3 s; F2 40 steps, worst tolerant **1.740 %** (`00-selected`…`38-valid` loop); S9 timeout **0.901 %**, app wait 200,480 ms) |
| 10 | `npm run e2e -- offline` | 0 | 1 passed — see §4 |
| 11 | frozen-evidence check | 0 | `evidence/` changed entries: **0** (expected 0) |
| | **`tools/verify-all.sh` overall** | **0** | **RESULT: PASS — all 11 steps green** |

Support checks (manual, outside the matrix; raw output `evidence/logs/F3-gates.log`):

| Command | Exit | Result |
|---|---|---|
| `md5 ../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf` | 0 | `af059ff9d75cefbc244f03814b47be9c` — match (T01) |
| `python3 artifacts/tools/a1-verify.py <swf> artifacts/decompiled ../kelimator-nostalji/sesler` | 0 | **RESULT: PASS (0 failures)** — inventory counts, 521/521 SVGs well-formed, 9/9 sound payloads byte-verified against the raw SWF (T02/T03) |
| `afinfo` over `artifacts/decompiled/sounds/*` (10) and `../kelimator-nostalji/sesler/*` (9) | 0 | 0 failures (T03) |

### 3.4 First run (attempt 1) — recorded defect and fix

Attempt 1 (2026-09-28T21:33:58Z) passed steps 1–7 and died **exit 1** at the step-result
write after `visual`: the transcript lived in `test-results/verify-all/`, and Playwright
wipes its `test-results/` output directory at the start of every run, deleting the
transcript mid-matrix; the next append failed under `set -e`. No product check failed.
Fix (recorded in the script header): transcript moved to `artifacts/verify-all/` (not
Playwright-managed), `run_step` now derives the verdict from the command's own
`PIPESTATUS[0]` only, and `say` tolerates transcript-write failures. Attempt 1's captured
console output: `evidence/logs/F3-attempt1.log`. Attempt 2 (fixed) is the green run above.

## 4. T14 — runtime offline check (new spec)

`tests/e2e/offline/offline.spec.ts` (task amendment 2026-09-29; owned path
`tests/e2e/offline/**`):

- **Build**: `npm run build` inside the spec (exit 0, 2,574 ms) → 15 static files in `dist/`;
  `dist/index.html` SHA-256 `035e570c…`.
- **Serve**: `node_modules/.bin/vite preview --host 127.0.0.1 --port 5288 --strictPort`
  (started by the suite, ready in 266 ms, killed in `finally`).
- **Block**: `page.route('**/*')` — every non-localhost request is aborted and recorded;
  localhost-only requests continue.
- **Assertions (all pass)**: boot `window.__game.state === 'playing'`, round `abacilik`,
  board visible, 8 letter tiles; basic interaction tile 0 `C` → entry `C` → BACKSPACE →
  entry empty; **11 requests observed, all localhost, 0 non-local attempts**; 0 page errors.
- **Recorded output**: `test-results/F3-offline/offline-report.json` (transient);
  committed copy `evidence/logs/F3-offline-report.log`.

Result: **T14 PASS** — the built app runs fully functional with zero non-local requests.

## 5. Gate checklists (`docs/07` §6; re-run against current evidence)

| Gate | Conditions | Current re-verification | Status |
|---|---|---|---|
| **G1** | T01–T03 pass; no OPEN critical items in A2/A3 | T01 md5 match; T02/T03 `a1-verify.py` RESULT PASS (0 failures) + afinfo 10/10 exported, 9/9 source; A2/A3 items RESOLVED, no BLOCKER (`evidence/G1-gate.md`; `docs/08` status column) | **COMPLETE** |
| **G2** | T06, T07, T10 pass | §3 rows 3–5: 4/4 schemas valid, fixtures 20/20, idempotency identical + equal to committed `7e4e149b…` (7,393 rounds) | **COMPLETE** |
| **G3** | T04, T05, T08, T09 pass; T13 basic variant passes | §3 rows 6/2/9: constants 3/3, audio 17/17, scoring 17/17 and input 29/29 within `npm test` 227/227, playthrough 3/3 incl. D5 basic playthrough | **COMPLETE** |
| **G4** | T11, T12 pass; sound-event mapping matches `data/sound-map.json` | §3 rows 7/8: visual 17/17 (worst tolerant 1.359 % ≤ 2 %), animation 8/8 (worst 1.104 %), audio 17/17 (event names ≡ map keys); F2 playthrough/S9 in row 9 | **COMPLETE** |
| **G5** | T14, T15 pass; G1–G4 evidence complete | T14 §4 PASS; T15 `tools/verify-all.sh` exit 0, 11/11; G1–G4 rows above plus `evidence/G{1,2,3,4}-gate.md` | **COMPLETE** |

Gate checklist details of the earlier gate runs remain in `evidence/G1-gate.md` …
`evidence/G4-gate.md` (unchanged, frozen).

## 6. Fixed decisions (`README` §2) — re-check

| # | Decision | Re-check (current evidence) | Status |
|---|---|---|---|
| 1 | Reference build = 2012–2013 Turkish SWF | md5 `af059ff9d75cefbc244f03814b47be9c` re-verified (§3; T01) | **PASS** |
| 2 | No network features (hiscore/Top10/e-mail/counters/translator/MochiAds removed) | T14: 11/11 requests localhost, 0 non-local attempts; `src/` contains no `fetch`/XHR/WebSocket/sendBeacon; excluded-feature names appear only as asset ids (`btn_top10`, `hiscore_form`). Dist scan only findings are XML namespace URIs (`www.w3.org/...`) and a decompiler string — never fetched | **PASS** |
| 3 | Score computation stays; no submission/storage/leaderboard | scoring tests 17/17 + F2 oracle spot checks (450 / 5800 / 3200) pass; no submission code in `src/` (see #2) | **PASS** |
| 4 | Word list built from TDK snapshot with the documented filters | `tools/wordlist.txt` 62,809 words; charset re-check: 0 non-core characters (29-letter core set); B2/B3 evidence (`B2-filters.md`, `B3-threshold.md`, `B3-bank.md`) | **PASS** |
| 5 | Visual/mechanical fidelity 1:1, established empirically | T11 visual 17/17 (16 comparisons ≤ 2 % tolerant), T12 animation 8/8, T13 playthrough 3/3 (40/40 compared steps + S9); thresholds per `docs/07` §4 amendments | **PASS** |
| 6 | System font stack starting with `Verdana`; no embedded font files | `FONT_STACK = 'Verdana, "DejaVu Sans", sans-serif'` (`src/ui/board.ts`, `src/ui/message.ts`); `data/layout.json` family `Verdana`; 0 font files in `dist/`; A1-fonts evidence | **PASS** |
| 7 | Single language: Turkish only | `<html lang="tr">`; all layout text values Turkish; no language switcher/English build in `src/`; A2-strings evidence | **PASS** |
| — | Stage scaling at the documented formula (`docs/04` §2) | `computeStageMetrics`: `scale = Math.min(viewportWidth/550, viewportHeight/400)`, centered both axes (`src/stage.ts` L48/55–56); `tests/stage.test.ts` 11/11 green inside `npm test`; smoke evidence `evidence/G3-gate.md` | **PASS** |
| — | Static build | `npm run build` exit 0 → 15 static files; served by `vite preview` with zero non-local requests (T14, §4) | **PASS** |

## 7. Carried OPEN items (not G5 blockers)

- **O23 — intro/preloader timed motion.** The rebuild presents preloader/intro
  synchronously (D5 design) while the reference plays ~3.5 s of intro motion (frames 5–130)
  before its first stable frame, so those keyframes cannot be pixel-compared.
  Resolution pointer: `docs/08-open-items.md` O23; `evidence/E3-animations.md` §3 rows 1–2
  and 5–6; `data/animation.json` sequences `preloader` (1–4), `intro` (5–130),
  `intro_glow_motion`, `intro_logo_motion`. Resolution = implement the timed
  intro/preloader (D5 sequencing + E3 animations) with fresh reference keyframe captures
  (C3 scenario mode), or an explicit owner decision to exclude. Not a blocker under the
  recorded animation-coverage rule (`docs/07` §4 amendment 2026-09-28b).
- **O25 — speaker icon 0.5-px phase.** The speaker colour mapping is exact (O24 resolved:
  app 18/18 within 2/255; `evidence/X3-speaker.md` §7); the residual is spatial — the icon
  renders at a ~0.5-px phase with bilinear resampling vs the reference rasterization.
  Resolution pointer: `evidence/X3-speaker.md` §7; `evidence/X3-o24/` (region reports and
  analysis); E2-side fix (sub-pixel offset or crisp scaling) or a recorded E2 decision.
  Within the G4 thresholds (no gate impact).

Both items remain **OPEN** in `docs/08-open-items.md`; no BLOCKER exists anywhere in the
queue.

## 8. Frozen-evidence hygiene

- In-run check (step 11 of the matrix): `git status --porcelain -- evidence/ | wc -l` → **0**
  (`frozen-evidence PASS` in `evidence/logs/F3-verify-all.log`). No suite wrote into
  `evidence/` (recording flags unset; live outputs under `test-results/`).
- After the run, F3's own evidence files were added (the ones listed in §1 plus this
  report). On a tree where those files are still uncommitted, the frozen check counts them
  (`??`, 4 files) — they are the task's new evidence, committed together with it
  (`EXECUTION.md` §3), not churn from the suites. Any future gate run after that commit
  reports 0 again.

## 9. Artifact SHA-256

| Artifact | SHA-256 |
|---|---|
| `tools/verify-all.sh` | `839a522f8238d2f5ca0a98a3740f0ad40bebee1ede5958e5b4b8372b6d23124d` |
| `tests/e2e/offline/offline.spec.ts` | `b2cd952a89f7b95c2996164dd3f7cb97ba8874ada554fffb58a54ea14aa2844e` |
| `src/data/rounds.json` (T10; unchanged) | `7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96` |
| `data/constants.json` | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |
| `data/sound-map.json` | `fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09` |
| `data/layout.json` | `eb8a098cab21df360cf24dea2f38c2b6b2e56cd16c248b4d6447ce51d3cb292d` |
| `data/animation.json` | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |
| `data/rounds.schema.json` | `44fd8ead39a03f890c9934be94d9c673a19137f8fa4ad6eca575aaedd8e148fc` |
| `data/constants.schema.json` | `e33b5dfa20cb68aa5a339ac98135adc89952ebc718ae799e46d881c5a7b32053` |
| `data/sound-map.schema.json` | `1ebac08dfed6859cbc414ba8ad5984707b45f73f27cab88a671964d2b11186ac` |
| `data/layout.schema.json` | `089e2fd4facae3803a59974181d5ab1dc641cfa149b698c460e9640ab160d96a` |
| `verify/diff/diff.mjs` | `f211ed94002d1220b7c48951c4e63bca55316e73669b0fa1b976be572ffec148` |
| Reference SWF (read-only source) | sha256 `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39`; md5 `af059ff9d75cefbc244f03814b47be9c` |
| `dist/index.html` (T14 build) | `035e570cc19edcf72f959e2e7af66b98db44fe659d633bf5b4754a05a136e91d` |
| `evidence/G1-gate.md` | `0aba1300c0f834533dbcd7519d9e59644b907eefa9cb0bb7747c8dd970d58ef0` |
| `evidence/G2-gate.md` | `74809c74ecf23702ef503631565aa2b3fa170be37439470f1a51b2b2e401d50a` |
| `evidence/G3-gate.md` | `b0abbcf197b75cd3d65fc80fed38d0defff2cc747e41d8099ef4bb216e79f03b` |
| `evidence/G4-gate.md` | `72f4d7f1f2ce62144d59e60d596fcb510395d6c004496cc4e0874839d7b9f51e` |
| `evidence/F2-report.json` | `4dd333cd33c36bdcd87c3acadf0de95baf6485d12880683e15004ab919366820` |
| `evidence/logs/F3-verify-all.log` | `6f21d7029a6e4da8f86610a8e3177be4e1ff8556ccd8d8ade8bcf082f1fa5f05` |
| `evidence/logs/F3-attempt1.log` | `b29d33a8b7c1724dfb96e77bd4027203f0bbe30f041cabbd6b51e4b1cfb95609` |
| `evidence/logs/F3-gates.log` | `b8b3050b9d0df64ad6a4451c278531a2c9710b93e7688bb6779ee8adc1fe550b` |
| `evidence/logs/F3-offline-report.log` | `89e63d76c22153832ba6e3a7ecbf20c035cd6fbf1f1afa00c8eb70a0c3fadedd` |

## 10. Proposed `docs/08` lines (not applied — owned by the orchestrator)

- `docs/08-open-items.md` (Amendments): clarify that F3's verified transcript is written to
  `artifacts/verify-all/F3-verify-all.log` (Playwright wipes `test-results/` at every run)
  and committed as `evidence/logs/F3-verify-all.log`; suites stay recording-flag-free.
- `docs/08-open-items.md` (Amendments): F3 completion — `tools/verify-all.sh` exit 0,
  11/11 steps; G1–G5 complete; O23 and O25 remain OPEN with the resolution pointers in
  `evidence/F3-final-report.md` §7.
- No change is proposed to O23/O25 status: both remain OPEN, neither is a G5 blocker.

## 11. Result

**PASS** — single green report. `tools/verify-all.sh` exits 0 (11/11 steps); T14 asserts the
built `dist/` runs offline with zero non-local requests; G1–G5 recorded complete; README §2
fixed decisions re-checked PASS; committed evidence stayed frozen during the run; the two
carried OPEN items (O23, O25) are documented with resolution pointers and no BLOCKER exists.
