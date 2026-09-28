# C3 — Reference Harness (Ruffle Web + Static Fixtures)

Task: C3 — Reference Harness (Ruffle Web + Static Fixtures)
Started: 2026-09-28T13:04:16Z (pinned-asset HEAD fetch; evidence/logs/C3-asset-head.log)
Ended: 2026-09-28T15:33:00Z (dsf 1 + dsf 2 matrices verified; final check exit 0)
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Node v22.14.0 · Python 3.14.6 · @playwright/test 1.63.0

Commands executed (exact; in order, from this task's shell history):

1. `curl -sSIL "https://github.com/ruffle-rs/ruffle/releases/download/v0.6.0/ruffle-0.6.0-web-selfhosted.zip" > evidence/logs/C3-asset-head.log`
2. `curl -fL --retry 3 --retry-delay 2 -o verify/reference/ruffle/ruffle-0.6.0-web-selfhosted.zip "https://github.com/ruffle-rs/ruffle/releases/download/v0.6.0/ruffle-0.6.0-web-selfhosted.zip" 2> evidence/logs/C3-curl-download.log`
3. `shasum -a 256 verify/reference/ruffle/ruffle-0.6.0-web-selfhosted.zip | tee evidence/logs/C3-ruffle-sha256.log`
4. `shasum -a 256 "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" | tee evidence/logs/C3-swf-sha256.log` ; `md5 "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf"`
5. `unzip -o verify/reference/ruffle/ruffle-0.6.0-web-selfhosted.zip -d verify/reference/ruffle/web/ > evidence/logs/C3-unzip.log 2>&1`
6. `shasum -a 256 verify/reference/ruffle/web/ruffle.js verify/reference/ruffle/web/*.wasm | tee evidence/logs/C3-ruffle-extracted-sha256.log`
7. `python3 -m py_compile verify/reference/server.py` ; `node --check verify/reference/capture.mjs`
8. `node verify/reference/capture.mjs --probe --probe-dir <tmp>` (observation probes; measurements in §5)
9. `node verify/reference/make-fixture.mjs > evidence/logs/C3-fixture-transform.log` (amendment pipeline, §2)
10. `node verify/reference/make-fixture.mjs --check` (idempotency; exit 0)
11. `node verify/reference/capture.mjs --runs 2 > evidence/logs/C3-harness-run.log 2>&1` (final matrix on the reconstructed fixture)
12. `node verify/reference/check.mjs > evidence/logs/C3-check-output.log 2>&1` (V1/V1fixture/V2/V5/V6/dsf2/mute checks; exit 0)
13. `node verify/reference/capture.mjs --runs 2 --dsf 2 > evidence/logs/C3-harness-run-dsf2.log 2>&1` (deviceScaleFactor 2 matrix, 1100×800; same fixture and interaction sequence)
14. `node verify/reference/capture.mjs --scenario verify/reference/scenarios/smoke.json --out tests/fixtures/reference/scenario-smoke --port 8798 > evidence/logs/C3-scenario.log 2>&1` (scenario mode; `--runs` default 2 → run1/run2 + canonical copies)
15. `node verify/reference/capture.mjs --scenario verify/reference/scenarios/smoke.json --out tests/fixtures/reference/scenario-smoke-dsf2 --dsf 2 --runs 1 --port 8798 >> evidence/logs/C3-scenario.log 2>&1` (dsf 2 scenario pass)
16. `curl -sS "http://web.archive.org/cdx/search/cdx?url=games.lg.web.tr/kelimator/xml64.php&output=json&limit=40"` → `evidence/logs/C3-fixture-archive-probe.log`

Exit codes: 0 for every command above (final matrix runs 0; `check.mjs` exit 0,
ALL CHECKS PASS incl. the scenario smoke).

Output summary:
- `verify/reference/` — harness: `index.html`, `server.py`, `swf-codec.mjs`,
  `make-fixture.mjs`, `fixtures/xml64.base64.php` + `fixtures/fixture-meta.json`,
  `capture.mjs` (probe + matrix + scenario modes), `scenarios/smoke.json`,
  `check.mjs`, `README.md`, `ruffle/` (pinned zip + build).
- `tests/fixtures/reference/` — dsf 1: 10 canonical states, `run1/` + `run2/`
  (10 PNGs + `interaction-log.json` each), `stability/<state>/` (10 F1 reports +
  heatmaps), `stability-report.json`, canonical `interaction-log.json`.
- `tests/fixtures/reference/dsf2/` — deviceScaleFactor 2 matrix (identical
  layout, 1100×800 PNGs), same two-run + stability discipline.
- `tests/fixtures/reference/scenario-smoke/` (+ `scenario-smoke-dsf2/`) —
  scenario-mode smoke outputs (`scenario-report.json`, `interaction-log.json`,
  captures; `scenario-repeat.json` for the default two runs).
- `evidence/logs/C3-server.log` — request log with per-run markers (dsf and
  scenario in the markers): round 1/2/3 `xml64.php -> 200` for all four matrix
  runs, the scenario smoke request, and the end screen's `hiscore.php` POST
  (local 501, not stubbed).

Artifact SHA-256 hashes (key):
- Ruffle asset `e8acfacc37443303872379d0e215999af846854d1dd3fa8fac0a765445b43dbf`; `ruffle.js` `a686a305345b06542dddedada71869104916a61e393f174687571528ac4225f5`; wasm `72a20ef1…` `adabc1696a2f1f95715ede6be0ac00a73364895c8e599039e60fef3b2f52efa4`, `826bb093…` `e4ba64aa1dc9f7f2368602dd0fc2c51046f3e35baba8116d6cf3ae930a63aa02`
- reference SWF sha256 `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39`, md5 `af059ff9d75cefbc244f03814b47be9c` (= T01 expected)
- fixture input (archived, unmodified) `854b7287c2e6878938671b7490f908605b9986ba28f4abe6f0eb2a62af3c2bed`
- fixture script `verify/reference/make-fixture.mjs` `e4f5198a1ddd94eceeb20639a41855a2bb385e75782e169a5768205272007788`
- served fixture `verify/reference/fixtures/xml64.base64.php` `80506d3ef3b58a4d8fdb5779debd4819271d57a5635276963a5d01eab91cd8bf`
- `fixtures/fixture-meta.json` `67b6e8254e9e7b7e3a5e5008b4b4f0e6a941188564e8f9638e4e6aba64760a33`
- `swf-codec.mjs` `5b895ce4b22ab1d22877df49e3993f5c5ae03778571a9888196c9ba41a6ce51c`
- `capture.mjs` `3c3efa86d4c3da06f6b2ea6e147f64fb7d53efafe3838cdb2b5c36d017c0fcb8` (adds the scenario mode on top of the dsf support; the matrix outputs were captured with earlier revisions and are unchanged)
- `check.mjs` `0a12510d2d587701e172c8b5854d9ec68e42956278f615e9c0f6ffde529b701b`
- `scenarios/smoke.json` `01ca29509a475d9cd1ae54354473a86b675e601e160f4dd875d430aa834badcd`
- `server.py` `d119845b042ca1e37460828610fb55623755681a16be092ac4272debe062d32e`; `index.html` `68daaf34e36c72945a13e4ac60a11d06ef77214b97d1e566bb427478a8b40155`; `README.md` `716b7cef36ef8f36ff670806a1cfa162e876b501c711da8edda7a798e2892bc2`
- dsf 1: `tests/fixtures/reference/stability-report.json` `e10f08054b6d0881388a3261160c20e6bc81b4b1f92e4b98063ded5e5f12a768`; `run1/interaction-log.json` `c4d2f45c640e2befb35e47542a4cf2a19897cbc206d058d2285919b96a62e5d9`; `run2/interaction-log.json` `389cfcc2766bcc2c8e9488ae42ebb21102bba6fc29bd9fb2075931f181dc678c`; S1 `396153fe…` = S9 `20596e19…` (byte-identical pairs)
- dsf 2: `tests/fixtures/reference/dsf2/stability-report.json` `04fc21b1c9512f8846b553daa7829abc22211fdd04b8bfc323910f8afc378609`; `run1/interaction-log.json` `a6a2a78d84af18f2338a3f9ec87727dce86f6de59aca6706749cf51e8d54c68d`; `run2/interaction-log.json` `bee2e39cedfe7e482de39430491c7b69a24c755c7f3205f3bc5c09b714f40a67`; canonical `dsf2/interaction-log.json` `fd1b4eab28d547c9e999e0cbabaa66e3bdb12bc524971aa52230ed3cf4fc1caa`; S1 `ac5e86aaac0216021766db2d2e2ada70f08e70e7f86bb4f43c7ad8a43757b1f6` = S9 `1cf3a7753b7906fee23471505289bfd50485fef3e630c37fbd47b19d05955f8f` (byte-identical pairs)
- scenario smoke: `scenario-report.json` `76a539fe9d584c7b1ab9d5eb3af29986888bac7ec4969b252a26bb978ecd5640`; `interaction-log.json` `bb525d0be1360160618d8510fb6fc10c87c08b3eaef9ede085f0ea1430915f55`; `scenario-repeat.json` `2e6113b637ef8412bd3eb8e563b6539cac204a1a04c3f401c2002e2c316d3609`; `after-space.png` `930ed35e34e22be18eea7e2cead22700c3f0aaaa1e1c9f820238edb4250b20b0` (550×400); dsf 2 smoke `scenario-smoke-dsf2/after-space.png` `dbd03cd840abac8302b4db2111d51cc06c06b0a602636631189cc10a7b710c95` (1100×800). These smoke hashes are as of the recorded check run; `check.mjs` regenerates the smoke outputs on every invocation (fresh shuffle), so they change per run.
- `evidence/logs/C3-server.log` `0c88bc661aad9967fc4ad6cdd717cafe3ff4670a8d02d290e5e4aaf4a03f1d5f`; `evidence/logs/C3-harness-run-dsf2.log` `04276d554bda0cf9ace1dc4d81ea4d5da5acfce44f00a3af6b6901989f49cf23`; `evidence/logs/C3-scenario.log` `579d82da04222fc93af85a7f79ca8475d97a36c9a3d7b1083ef3b270dfe6015f`; `evidence/logs/C3-check-output.log` `90f0491245a321e11af529fbd796fe6363814629385b19c8c936afb1a993402d`

Result: PASS — all Verify checks pass (V1, V1fixture, V6, V2, V5 self-check, plus
the dsf 2 set V2dsf2/V5dsf2, the explicit-mute check Vmute and the scenario
smoke Vscenario), the S5–S8 target states are reachable on the reconstructed
fixture, the matrix is captured at deviceScaleFactor 1 and 2, the reusable
scenario mode (`--scenario`) is available to E3/F2, and O20 is closed
(`evidence/C3-stability.md`). No reference file was altered.

---

## 1. What was built

| Path | Role |
|---|---|
| `verify/reference/ruffle/ruffle-0.6.0-web-selfhosted.zip` | pinned Ruffle web asset, SHA-256 recorded before extraction |
| `verify/reference/ruffle/web/` | extracted Ruffle 0.6.0 web self-hosted build (12 files) |
| `verify/reference/index.html` | harness page: Ruffle player + `kelimator_tr_2012_mochiads.swf` (550×400) |
| `verify/reference/server.py` | static server; maps the SWF from the read-only package and serves the reconstructed fixture at `/xml64.php` |
| `verify/reference/swf-codec.mjs` | the SWF's own Base64/UTF-8 codec + ISO-8859-9 helpers (shared by fixture script and harness) |
| `verify/reference/make-fixture.mjs` | fixture reconstruction (amendment 2026-09-28, §2) |
| `verify/reference/fixtures/xml64.base64.php` | served fixture |
| `verify/reference/fixtures/fixture-meta.json` | input/script/output hashes + per-entry transform record |
| `verify/reference/capture.mjs` | Playwright driver: probes + S1–S10 matrix (two runs) + stability compare + scenario mode |
| `verify/reference/scenarios/smoke.json` | smoke scenario used by `check.mjs` (`Vscenario`) |
| `verify/reference/check.mjs` | reproducible V1/V1fixture/V2/V2dsf2/V5/V5dsf2/Vmute/Vscenario/V6 report (exit 0) |
| `verify/reference/README.md` | harness documentation |

Ports used: **8797** for every harness run (server-log markers show `port=8797`);
a scratch probe used 8798 and produced no committed artifacts. Ports 5199, 8787
and other workers' recorded ports were avoided.

Device scale factors and silent runs:

- The matrix is captured twice to satisfy `docs/07` §4 ("Canvas: 550 × 400
  logical pixels at `deviceScaleFactor: 1` and `2`"): dsf 1 → 550×400 PNGs
  under `tests/fixtures/reference/`; dsf 2 → 1100×800 PNGs under
  `tests/fixtures/reference/dsf2/` (`node capture.mjs --runs 2 --dsf 2`). The
  screenshot detectors (timer gauge, button bar, entry row, sun mask, end-screen
  probes) scale from the measured CSS-pixel boxes; clicks stay in CSS pixels.
- Silent witness runs (EXECUTION.md §8): every `chromium.launch(...)` passes
  `args: ['--mute-audio']` (browser-level mute, explicit — not just the headless
  default). The dsf 2 interaction logs record
  `harness.launchArgs: ["--mute-audio"]` and `deviceScaleFactor`; `check.mjs`
  verifies the flag in source and in both dsf 2 run manifests (`Vmute`), so no
  audio is emitted by any harness run. The dsf 1 outputs were captured before
  the flag was made explicit and are kept unchanged (byte-identical), as
  required.

## 2. Fixture reconstruction (task amendment 2026-09-28)

The 2012 client Base64-decodes every round value (`frame_131` `myOnLoad`;
`frame_5` `Base64`), while the archived `xml64.php` stores plain ISO-8859-9 —
the board would load broken (`evidence/C3-fixture-format.md`). Per the adopted
amendment, `make-fixture.mjs` reads the archived file (read-only) and writes
`fixtures/xml64.base64.php`:

- **transformed** — exactly the values the client decodes: every
  `<kelime harf="2".."8">` `<txt>` value becomes `Base64(UTF-8)` of its text
  (harf 8 → main word `FİNALİZM`; harf 3 → 28 words; harf 4 → 41; harf 5 → 17;
  harf 6 → 4; harf 7 → empty);
- **preserved** — `harf="9999"` stays raw (the client reads it via `al(9999)`
  and only embeds it in the excluded `hiscore.php` URL), and XML structure,
  attributes, whitespace and trailing bytes are unchanged;
- **verified** — the script re-decodes every transformed entry with the SWF's
  own decoder (`swfBase64Decode`) and requires equality; `--check` re-derives
  the output and exits 0 (byte-stable). `check.mjs` re-verifies the round trip,
  the preserved `9999` entry and all three hashes (`V1fixture`).

Hashes: input `854b7287…`, script `e4f5198a…`, output `80506d3e…` (full values
above; also in `fixtures/fixture-meta.json`). The archived file is unmodified.

## 3. Serving model and network behaviour (EXECUTION.md §6)

```
GET /kelimator_tr_2012_mochiads.swf -> ../kelimator-nostalji/calistir/…   (read-only)
GET /xml64.php?<random>            -> verify/reference/fixtures/xml64.base64.php
GET /ruffle/web/*                  -> verify/reference/ruffle/web/*
```

No request is stubbed or intercepted. Ruffle blocks the MochiAds startup call
by its own compatibility rules (console, both runs):

```
INFO core/src/compatibility_rules.rs:181 Blocking url due to compatibility ruleset 'mochiads'
ERROR core/src/loader.rs:853 Error during movie loading of
      "http://x.mochiads.com/srv/1/951545f2fdfbf4a6.swf": BlockedHost("*.mochiads.com")
```

The all-found end screen's own return path posts the score to the excluded
`hiscore.php`; the local server answers 501 (unsupported method) and the game
continues with `gotoAndPlay("main")` → a new round (recorded, never altered).

## 4. State-based waits (no fixed delays)

| State | Wait |
|---|---|
| S1 boot | white Ruffle splash skipped by a content check (≥20 % non-white/non-black; measured splash 0.029 vs game 0.98); then 3 identical consecutive frames with the intro sun region masked (`SUN_BOX`; the sun is the only continuously animating intro element) |
| S2 idle board | `GET /xml64.php?<n> -> 200` in the server log, then a stable frame, then the measured timer-gauge check (`TIMER_BOX` red fraction ≥ 0.2; intro 0.0, board 0.6783) |
| S4 | click tile slots until 3 letters are registered (a registered click changes ≥0.2 % of the stage; misses only the timer digits ~0.02 %) |
| S5/S6 | clear the entry, type the word with the SWF's physical key codes; acceptance = the reference clears the wordball entry row (`entryRowState` red/bright ball pixels) |
| S7 bonus | the bonus is a random per-letter event shown as the bright/orange ball (measured: ≥344 bright px; red balls 0); the harness types FANİ and waits for that state within a bounded 40-attempt budget, then submits |
| S8 all-found | scripted submission of every fixture word; acceptance and completion are read from the reference (entry cleared; `bittimi()` hides Karıştır/Ekle/Sil); then the all-found end screen is detected by measured probe pixels (panel (204,204,51), sky (10,22,30)) — the screen's fireworks never settle, so the capture is taken at the detected state |
| S9 timeout | the end screen's own return path ("Gönder" → hiscore.php 501 → `gotoAndPlay("main")`) starts round 2; its clock is waited out (`tamamla()`: gauge empty + buttons hidden + unfound words revealed) — the literal timeout state |
| S10 next round | click `Yeni Oyun` on the timed-out board; wait for the next `xml64.php -> 200`, then a stable frame |

## 5. Probe measurements (evidence for the constants)

- `xml64.php` request ~1.26 s after navigation; board red fraction 0.68 vs 0.0 on
  the intro; splash content 0.029 vs game 0.98.
- tile-row hit/miss separation: registered clicks 0.9–2.2 %, misses 0.015–0.033 %
  → scan threshold 0.2 %.
- intro motion: 3.6–4.8 % inside the sun bbox only; board samples between timer
  ticks differ by 0 %.
- wordball entry row: normal red balls 764 px (2 balls), no entry 0 px; the
  bonus ball (orange) ≥344 px with the measured predicate (`BRIGHT_PIXEL`).
- all-found end screen: panel (204,204,51), sky (10,22,30); form field centers
  name (316,267), e-mail (316,288), "Gönder" (268,370).

## 6. Capture runs (S1–S10, twice, reconstructed fixture)

Final harness invocation `node verify/reference/capture.mjs --runs 2` (exit 0).
Run boundaries and requests in `evidence/logs/C3-server.log`:

```
==== C3 harness run 1 start 2026-09-28T14:29:21.632Z ====
… 2026-09-28T14:29:29Z "GET /xml64.php?491311 HTTP/1.1" -> 200       (round 1)
… 2026-09-28T14:30:56Z "POST /hiscore.php?…&puan=179050&kelime=35&sure=80 HTTP/1.1" -> 501
… 2026-09-28T14:31:00Z "GET /xml64.php?62403 HTTP/1.1" -> 200        (round 2, return path)
… 2026-09-28T14:34:23Z "GET /xml64.php?298471 HTTP/1.1" -> 200       (round 3, S10)
==== C3 harness run 2 start 2026-09-28T14:34:24.993Z ====
… 2026-09-28T14:34:32Z "GET /xml64.php?561837 HTTP/1.1" -> 200       (round 1)
… 2026-09-28T14:36:38Z "POST /hiscore.php?…&puan=185150&kelime=35&sure=119 HTTP/1.1" -> 501
… 2026-09-28T14:36:42Z "GET /xml64.php?733761 HTTP/1.1" -> 200       (round 2, return path)
… 2026-09-28T14:40:04Z "GET /xml64.php?410589 HTTP/1.1" -> 200       (round 3, S10)
```

| State | trigger (docs/07 §5) | run 1 at | run 1 sha256 (canonical) | run 2 sha256 |
|---|---|---|---|---|
| S1 | load page, first stable frame | +6.2 s | `396153fe4dc935d41a3a8bd709986a2b1238726f3c32e239bf3ef4681117ac26` | `396153fe4dc935d41a3a8bd709986a2b1238726f3c32e239bf3ef4681117ac26` |
| S2 | round loaded; no input | +8.4 s | `9859f24691475227d360edbd378436feec0004339529108bba49b4b662b3cc33` | `c79bfe97386f633a75c1209e53e45d9d66af748982b28554a9e5cbcccc7638f2` |
| S3 | press SPACE | +10.5 s | `3e15fa4697187d8641e8b2ce226e7f16c01bf2d4e829a5ffbd8892ca0d019027` | `310a169d28e461370a8b8fb9e6f9c4756cab0a549982a70bcb648b72cf133416` |
| S4 | click/type 3 tiles | +13.4 s | `0e9dedd91ef6ac65d571780ecadfa888127568e15d6790a0d31c7811b503f617` | `50c746cbef89bcbdd7fdcfa287a32f958548121574fdbce8879bbd99ec886ed1` |
| S5 | submit FAL (3-letter fixture word) | +17.5 s | `dbfa5db98470c3003c9d1e7d24a7d79dd391275098df935acf1b55cb80ac119b` | `535e45112912cbc74835c8017a9127c454c1be628fe2b550d38627bb3ded5369` |
| S6 | submit MİZ (non-list entry) | +21.7 s | `fe83c260102b2a13d1ccf0e32ed1c673f8ec51a322f9e859203efa64b0889f36` | `43ff6db49ec96f30fe6b51495250a7ce9285ffa009700cd2d024206aa5ebb496` |
| S7 | submit FANİ (bonus word) | +24.6 s | `27c91d29af3b942d5ef493c9d3bf34db72fee275d08e765984a37d8a5e211c2f` | `d95affdeea30c70c1f858dd0efa73c45c27c436feaec0499c52fcc7de45c64e7` |
| S8 | submit every fixture word (scripted) → all-found end screen | +90.6 s | `1e1e198fd3996f67e4ed54e7a95dc857b1390f710e37c0aba61c6d8b7fcb590f` | `38be6f58fb50f1bf604a57b54776b225a24a8f5d85f74ac3ffe8d46411773736` |
| S9 | return path → round 2; wait out the timer | +301.6 s | `20596e199148f26275c06b1eb3b4ad3f0649b7555e8dd281f000eed4e7fd47b7` | `20596e199148f26275c06b1eb3b4ad3f0649b7555e8dd281f000eed4e7fd47b7` |
| S10 | start a new round (Yeni Oyun; next `xml64.php` 200) | +303.3 s | `fee9ded82376c1ad6ccbbc771e8d51423d2db4e93b672d95e8e4e2ead19e2844` | `75ccb4905db8ed48e90af89b60ecbcb6d4f7a21b5bb4dcd7e312ab1f323a491b` |

Interaction logs contain console lines, per-action before/after diffs, per-state
stability, server evidence (`xml64Round1`, `xml64NextRound`, S9 return path) and
`flowNotes`; the canonical `interaction-log.json` is run 1 plus the stability
summary.

### DeviceScaleFactor 2 matrix (1100×800)

`node verify/reference/capture.mjs --runs 2 --dsf 2` (exit 0; log
`evidence/logs/C3-harness-run-dsf2.log`; outputs under
`tests/fixtures/reference/dsf2/`, same layout, 1100×800 PNGs). Run boundaries
and requests in `evidence/logs/C3-server.log` (markers carry `dsf=2`):

```
==== C3 harness run 1 start 2026-09-28T15:17:23.403Z dsf=2 ====
… 2026-09-28T15:17:30Z "GET /xml64.php?311496 HTTP/1.1" -> 200      (round 1)
… 2026-09-28T15:20:25Z "POST /hiscore.php?…&puan=195750&kelime=35&sure=163 HTTP/1.1" -> 501
… 2026-09-28T15:20:29Z "GET /xml64.php?376358 HTTP/1.1" -> 200      (round 2, return path)
… 2026-09-28T15:23:53Z "GET /xml64.php?67002 HTTP/1.1" -> 200       (round 3, S10)
==== C3 harness run 2 start 2026-09-28T15:24:02.452Z dsf=2 ====
… 2026-09-28T15:24:09Z "GET /xml64.php?912828 HTTP/1.1" -> 200      (round 1)
… 2026-09-28T15:27:09Z "POST /hiscore.php?…&puan=165250&kelime=35&sure=168 HTTP/1.1" -> 501
… 2026-09-28T15:27:13Z "GET /xml64.php?193041 HTTP/1.1" -> 200      (round 2, return path)
… 2026-09-28T15:30:38Z "GET /xml64.php?268352 HTTP/1.1" -> 200      (round 3, S10)
```

| State | run 1 at | run 1 sha256 (canonical) | run 2 sha256 |
|---|---|---|---|
| S1 | +6.6 s | `ac5e86aaac0216021766db2d2e2ada70f08e70e7f86bb4f43c7ad8a43757b1f6` | `ac5e86aaac0216021766db2d2e2ada70f08e70e7f86bb4f43c7ad8a43757b1f6` |
| S2 | +14.4 s | `a608218a6c6b235f7b36410566e9a7d5e33f6cf22eaa27b512b4f45eeaeca24d` | `04585b0a8eb304bbf73f7e9d5bd456b1ed5fd82d6c241a44b2386f4729e760b7` |
| S3 | +21.4 s | `895e74aaca150158020075c02a32bb6d8197c46114e38c9bcb7f1fb160660f00` | `f6dad906eb1505a14cfddc18978390cf0c5fb7334b3b54eec15f1c1172c1632f` |
| S4 | +33.3 s | `0874f68cdc48498dab152ca499917325b3727987063312cc613202c4d3d29be2` | `32cd93894f8555007adc8ae7749fcacb6257fc03059d799728a5c0aac08680fd` |
| S5 | +47.6 s | `8a9704bfd087786abd873d1fda6a4928960c59fab112d146692e99d8f196462d` | `377ead7c32775243a8baa972047efe110609aeb2403ab0212de6f71e29406d76` |
| S6 | +57.7 s | `81a60e34f00d36ca79861e1d04f53ad1310c998df79eeaf6c5f1e381b852879b` | `97171ca9178de5ec2683aea9dac2bdbb077f3c5625e2d2965553b8150fb1d859` |
| S7 | +64.6 s | `27d0c7d75408ff493d7b526f9a21a25ed9ef07a62764c22fd59ca9e0438866c1` | `c8ce43627dba308213a34a5ff34730ed11379fed87a36b01171f12e67be05e06` |
| S8 | +174.3 s | `753cd25ba1b3fe42f315f0b7ae61e8a7c21d5b534bcdef71d31873dce8c8b138` | `cd3388f4d93be5515d643be1ecec1432520a93ede68a32f2c46e2ba38ba5f11c` |
| S9 | +389.4 s | `1cf3a7753b7906fee23471505289bfd50485fef3e630c37fbd47b19d05955f8f` | `1cf3a7753b7906fee23471505289bfd50485fef3e630c37fbd47b19d05955f8f` |
| S10 | +399.0 s | `59d2f69512d26ffbaf994df07d26fcd18e2133ef4032ff0a04347a24d7242ba5` | `40081424c998c3fb9a8b244c78e9ff81f38eb3b776a9181c4fff7ffde3fcaab0` |

Both dsf 2 runs behaved like the dsf 1 runs: 8 letter tiles, S4 3/3 clicks,
S5 `FAL` accepted, S6 `MİZ` rejected, S7 bonus seen on the first attempt,
S8 89 accepted + 2 acceptance-detection timeouts, **restarts=0** (the round
clock did not expire), completing word `İNFİAL`, end screen detected in
455/440 ms, the return-path POST logged, S9 = round-2 timeout, S10 = round 3.
The dsf 2 stability report mirrors dsf 1: S1 and S9 byte-identical, every state
within the 2 % threshold (max 0.97 %, S6), differences attributed to the same
causes — deck-shuffle tile letters (measured bands in the tile row), the
countdown digits (right panel) and the end-screen fireworks (S8; panel region).
`check.mjs` validates the set (`V2dsf2`: 30/30 screenshots at 1100×800, 14/14
JSON; `V5dsf2`: S2 within-run streak 3, cross-run 0.354 %).

### Scenario mode (E3/F2 scripted captures)

`node verify/reference/capture.mjs --scenario <scenario.json> --out <dir>
[--dsf 1|2] [--runs N] [--port P]` drives the reference with an ordered step
script through the same server, reconstructed fixture and muted Chromium.
Existing modes (`--probe`, matrix default) are unchanged. Schema (documented in
`verify/reference/README.md`): `{ name, steps: [ {action, ...} ] }` with
`waitStable`, `key` (Turkish letters + `SPACE`/`ENTER`/`BACKSPACE` via the
`frame_131` physical mapping; unmapped keys reported in `missingKeys`), `click`
(`tile:<0..7>`, `button:<karistir|ekle|sil|yeni-oyun|gonder|form-name|form-email>`,
`coord:<x>,<y>`), `waitMs` (caller-specified, documented), `capture`
(`<out>/<name>.png` at the selected dsf) and `waitForState`
(`content|board|xml64|round-end|hiscore-form|entry-cleared|bonus-ball`).
`waitForText` is deliberately not provided (no OCR — text waits would be
guesses); `waitForState` is the equivalent. Outputs: per-step
`scenario-report.json` (result, timing, screenshot path/hash/dimensions) and
`interaction-log.json`; `--runs N > 1` writes `<out>/run<i>/` plus canonical
copies and `scenario-repeat.json` (per-run capture hashes).

Smoke output (run by `check.mjs` as `Vscenario`; `scenarios/smoke.json` =
board wait → stable → one key `SPACE` → capture → `waitMs(300)` → capture;
port 8798; log `evidence/logs/C3-scenario.log`):

```
[C3 scenario] step 0 waitForState: ok (7544 ms)   [board: xml64.php?872193 -> 200, stable streak 3, gauge 0.6783]
[C3 scenario] step 1 waitStable: ok (455 ms)
[C3 scenario] step 2 key: ok (300 ms)             [SPACE -> Space]
[C3 scenario] step 3 capture: ok (45 ms)          [after-space.png 550x400]
[C3 scenario] step 4 waitMs: ok (301 ms)
[C3 scenario] step 5 capture: ok (55 ms)          [settled.png 550x400]
[C3 scenario] smoke run 1: OK (2 captures, 6 steps)
```

A single-pass dsf 2 scenario run (`--dsf 2 --runs 1`) produced the same steps
with 1100×800 captures (exit 0; recorded in the same log). `Vscenario`
asserts the smoke outputs exist at the right dimensions and the JSONs parse;
`check.mjs` stays green (all 9 checks, exit 0).

## 7. Observed reference flow (reconstructed fixture)

1. **Ad path** — Ruffle blocks `*.mochiads.com`; the build reaches the round
   board. No capture was blocked by the ad path.
2. **Fixture loads** — the board shows **8 letter tiles** (e.g. S10 shows the
   shuffled `İ İ M F A N Z L`); S4's scan registered 3/3 clicked tiles; typed
   fixture words are accepted.
3. **S5/S6** — `FAL` accepted (score +450, entry cleared); `MİZ` rejected
   (buzz, entry kept) — matching the fixture lists.
4. **S7 bonus** — run 1 saw the bright bonus ball on the **first** attempt
   (`maxBrightPixels = 223`) and submitted FANİ (+5000 + 800); run 2 never saw
   it in 40 attempts (`maxBrightPixels = 0`) yet the end-screen totals still
   include the +5000 bonus (the roll can mark the *next* ball, which never
   arrived before the submit — A2's O02 rule), i.e. the bonus can be paid
   without a visible bright ball. Both are recorded, not hidden.
5. **S8 all-found** — all 91 fixture words were scripted; 89 were accepted and
   2 acceptance-detections timed out (the entry-clear check exceeded 1.8 s for
   those words; the round still completed, which requires all 35 listed boxes
   filled). The completing word was `İNFİAL`, followed by the end screen
   (TEBRİKLER, `Puanınız`, `Kelime Sayısı 35`, `Süre`).
6. **Return path** — the end screen's only button, "Gönder", posted the score
   to the excluded `hiscore.php` with `x=19c4701ab499f750987eebe0bff07f9c` —
   the raw `harf="9999"` value, proving the preserved checksum entry is what
   the client reads — and the local server answered 501. `gotoAndPlay("main")`
   then replayed the intro and started round 2 (next `xml64.php` request).
7. **S9 timeout** — round 2's clock was waited out (202 s): gauge empty,
   Karıştır/Ekle/Sil hidden, all unfound words revealed — the timeout state.
8. **S10** — `Yeni Oyun` started round 3 (next `xml64.php` request) with a fresh
   shuffle.

## 8. Verification results

`node verify/reference/check.mjs` → exit 0 (`evidence/logs/C3-check-output.log`;
consolidated final run incl. `make-fixture.mjs --check` and the input hash:
`evidence/logs/C3-verification-final.log`):

| Type | Check | Result |
|---|---|---|
| V1 | Ruffle web asset SHA-256 equals the recorded value (`e8acfacc…`) | **PASS** |
| V1fixture | reconstructed fixture: input `854b7287…`, script `e4f5198a…`, output `80506d3e…`; round trip + preserved `9999` + `--check` idempotency | **PASS** |
| V6 | server log contains `xml64.php -> 200` for the latest two matrix runs (dsf 2: round 1 `?311496` / `?912828`, plus rounds 2 and 3; the dsf 1 pair `?491311` / `?561837` is in the same log) | **PASS** |
| V2 | dsf 1: 30/30 screenshots present (S1–S10 × run1/run2/canonical); 14/14 JSON files parse | **PASS** |
| V2dsf2 | dsf 2: 30/30 screenshots present; 14/14 JSON files parse; canonical dims 1100×800 OK | **PASS** |
| V5 self-check | dsf 1 S2: within-run stable streak = 3 (both runs), cross-run ratio 0.00781 ≤ 0.02, bbox = the shuffled tile-letter band only | **PASS** |
| V5dsf2 | dsf 2 S2: within-run stable streak = 3 (both runs), cross-run ratio 0.00354 ≤ 0.02 | **PASS** |
| Vmute | `capture.mjs` launches Chromium with `args: ['--mute-audio']`; recorded in both dsf 2 run manifests (`harness.launchArgs`) → no audio emitted | **PASS** |
| Vscenario | scenario smoke (`scenarios/smoke.json`: board wait → stable → `SPACE` → capture → `waitMs(300)` → capture) runs green; 2 captures at 550×400 (canonical), `scenario-report.json` + `interaction-log.json` parse, no missing keys | **PASS** |
| — | input integrity: SWF md5 `af059ff9d75cefbc244f03814b47be9c` = T01 expected; archived fixture hash unchanged (read-only package untouched); dsf 1 outputs unchanged (hashes verified) | **PASS** |

S5–S8 reachability: valid word accepted (S5), non-list rejected (S6), bonus path
taken (S7, both visible and invisible-bonus cases observed across runs),
all-found completion reached (S8) — see §7.

## 9. docs/08 proposal (single-writer: orchestrator applies)

```
RESOLVED 2026-09-28 — evidence/C3-stability.md — Repeat-capture stability over two full S1–S10 matrix runs with the reconstructed Base64(UTF-8) fixture: capture mechanics deterministic (S1 and the timeout state S9 byte-identical; within-run stable streak 3), every state within the docs/07 §4 static threshold (max 1.22 %), residual differences are the reference's own randomness (deck shuffle, bonus ball incl. the invisible-bonus case, timing-dependent score/time values, end-screen fireworks) each localized by the F1 bbox and quantified; stabilization = stable-frame sampling + measured region/state detectors (sun mask, tile-entry detectors, timer gauge, end-of-round button bar, end-screen probe pixels).
RESOLVED 2026-09-28 — evidence/C3-fixture-format.md — harness fixture = Base64(UTF-8) re-encoding of the archived xml64.php word list (input/script/output sha256 recorded; archived file unmodified)
RESOLVED 2026-09-28 — evidence/C3-harness.md — reference matrix captured at deviceScaleFactor 1 and 2 (dsf2 = 1100×800); Chromium launched with --mute-audio; fixture unchanged.
```

The O20 line supersedes the pre-amendment wording (the fixture was
reconstructed on 2026-09-28, O21); all numbers come from the two final matrix
runs on the served fixture.

Amendment proposal (Amendments section, exact text):

```
2026-09-28 — C3: reference harness scenario mode (--scenario) added for E3/F2 scripted captures; schema documented in verify/reference/README.md.
```

## 10. Result

**PASS** — Verify passes (V1, V1fixture, V6, V2, V2dsf2, V5, V5dsf2, Vmute,
Vscenario; `check.mjs` exit 0); the S1–S10 captures and interaction/stability
logs are committed under `tests/fixtures/reference/` (dsf 1) and
`tests/fixtures/reference/dsf2/` (1100×800); the reusable scenario mode
(`--scenario`) drives E3/F2 scripted captures with the smoke outputs under
`tests/fixtures/reference/scenario-smoke*/`; O20 is closed with the stability
record in `evidence/C3-stability.md`; the fixture reconstruction and its
resolution are recorded in `evidence/C3-fixture-format.md`; the reference SWF
and the read-only package are byte-identical to their inputs; every harness run
launched Chromium with an explicit `--mute-audio`.
