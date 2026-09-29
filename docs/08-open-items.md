# 08 — Open Items (Unknowns Queue)

Rules (see `EXECUTION.md` §5):
- An item may be closed **only** by evidence produced via its documented
  procedure. No inference from similar builds or documentation.
- Tasks whose `Unknowns` list contains an OPEN item must not start.
- A BLOCKER halts its branch; independent branches continue.
- Status values: `OPEN` · `RESOLVED` · `BLOCKER`.

When closed, append: `RESOLVED <date> — <evidence file> — <one-line finding>`.

---

| ID | Question | Resolution procedure | Evidence target | Dependent tasks | Status |
|---|---|---|---|---|---|
| O01 | Timer initial value, tick interval, and pause semantics | A2: locate timer initialization and decrement in decompiled AS; confirm by observing the reference (screenshots at fixed offsets) | `evidence/A2-timer.md`; `data/constants.json` | D3, D5 | RESOLVED — evidence/A2-timer.md |
| O02 | Bonus-letter selection rule (which letter, when chosen, per round) | A2: trace `bonusball`, `bonusrnd`, `bonusmin`, `bonusrange` usage | `evidence/A2-bonus.md`; `constants.bonusLetter` | D5, E3 | RESOLVED — evidence/A2-bonus.md |
| O03 | Does the client validate the `harf="9999"` checksum before starting a round? | A2: trace parsing/verification code after XML load | `evidence/A2-checksum.md` | D1 | RESOLVED — evidence/A2-checksum.md |
| O04 | Key handling specifics (key codes vs characters; Turkish letters; which keys act when) | A2: read input handlers and confirm against reference behavior | `evidence/A2-input.md` | D2 | RESOLVED — evidence/A2-input.md |
| O05 | Exact user-visible strings and their display conditions | A2/A3: read static text and dynamic text fields; confirm via reference screenshots | `evidence/A2-strings.md`; layout catalog | E2 | RESOLVED — evidence/A2-strings.md |
| O06 | Sound trigger map (event → sound ID) | A2: trace `ses_cikart`/sound calls for all 9 sounds | `evidence/A2-sounds.md`; `data/sound-map.json` | D4, F2 | RESOLVED — evidence/A2-sounds.md |
| O07 | FPS and frame spans of every animation | A3: read header FPS; measure spans from FLA/timeline | `evidence/A3-timing.md`; `data/animation.json` | E3, F2 | RESOLVED — evidence/A3-timing.md |
| O08 | Layout coordinates of all elements, colors, font metrics | A3: extract from FLA/SVG placement + stage data | `evidence/A3-layout.md`; `data/layout.json` | E1, E2 | RESOLVED — evidence/A3-layout.md |
| O09 | Font names/styles used by the 2012 build | A1: read DefineFont2 records; cross-check A3 text metrics | `evidence/A1-fonts.md` | E2 | RESOLVED — evidence/A1-fonts.md + evidence/A3-layout.md |
| O10 | Bitmap dimensions and usage locations in the 2012 build | A1/A3: export and inspect; map placements via PlaceObject2 | `evidence/A1-bitmaps.md` | E1 | RESOLVED — evidence/A1-bitmaps.md + evidence/A3-layout.md |
| O11 | Streaming sound (`SoundStreamHead2`) content and purpose | A1/A3: extract stream blocks; determine whether it is music/SFX; confirm audibility in reference | `evidence/A1-stream.md` | D4, E3 | RESOLVED — evidence/A1-stream.md (EXCLUDED: zero streaming content; D4 disposition) |
| O12 | Role of `kelimatorid` and `Base64.decode` | A2: trace usage; classify as EXCLUDED (score/identity) or needed for core flow | `evidence/A2-kelimatorid.md` | D1 | RESOLVED — evidence/A2-kelimatorid.md |
| O13 | Meaning/sequence of `preall`, `hepsiburda`, `bravo` labels | A2: trace frame transitions; confirm in reference | `evidence/A2-labels.md`; `constants.flows` | D5, E3 | RESOLVED — evidence/A2-labels.md |
| O14 | Timeout semantics (mid-entry, timer stop on completion, time-bonus timing) | A2 + reference observation | `evidence/A2-timeout.md` | D3, D5 | RESOLVED — evidence/A2-timeout.md |
| O15 | Edge-case input rules (duplicates, re-submit, backspace on empty, scramble with entry) | A2 + reference observation | `evidence/A2-edges.md` | D2 | RESOLVED — evidence/A2-edges.md |
| O16 | Round-bank threshold T measurement | B3: generate candidate banks per `docs/06` §3; record sizes; apply selection rule | `evidence/B3-threshold.md`; `tools/build-config.json` | D1 | RESOLVED — evidence/B3-threshold.md |
| O17 | Entry-type filters discovered in the TDK snapshot (abbreviations, proper nouns) | B2: inspect snapshot structure; apply and record filter decisions | `evidence/B2-filters.md` | B3 | RESOLVED — evidence/B2-filters.md |
| O18 | Any visual difference between 2007 and 2012 builds relevant to layout | A3: compare extracted geometry; record differences; 2012 wins | `evidence/A3-diffs.md` | E1, E2 | RESOLVED — evidence/A3-diffs.md |
| O19 | MochiAds removal points (which scripts/tags to strip) | A1/A2: identify ad initialization/resume paths; ensure removal does not alter game flow | `evidence/A2-mochi.md` | D5 | RESOLVED — evidence/A2-mochi.md |
| O20 | Repeat-capture stability of the reference harness (same screenshots across runs) | C3: capture the matrix twice; compare hashes; if unstable, identify cause and record | `evidence/C3-stability.md` | F2 | RESOLVED — evidence/C3-stability.md |
| O21 | Which fixture is served to the 2012 reference harness? | C3 + amendment 2026-09-28 (`tasks/C3-reference-harness.md`): the 2012 client Base64-decodes every round value; serve a deterministic Base64(UTF-8) re-encoding of the archived `xml64.php` word list (input/script/output SHA-256 recorded; archived file unmodified) | `evidence/C3-fixture-format.md`; `verify/reference/fixtures/` | E2, E3, F2 | RESOLVED — evidence/C3-fixture-format.md |
| O22 | `viroloji` round fixture (docs/06 §5) absent from both trees; the cited 2007-05-14 Wayback URL was not in the package; B3 was network-frozen | B3 availability search; orchestrator fetched the cited capture when the Internet Archive returned; fixture committed unchanged; the gated structural test activates on it | `evidence/B3-viroloji-blocker.md`; `tests/fixtures/rounds/viroloji.xml` | B3 (test), F2 (fixture list) | RESOLVED — evidence/B3-viroloji-blocker.md |
| O23 | Intro/preloader timed motion: the reference plays frames 5–130 (~3.5 s: falling logo, glow, sun) before its first stable frame; the rebuild starts at the settled state (D5 skips the intro), so those keyframes cannot be compared | Recorded divergence; resolution = implement the timed intro/preloader (D5 sequencing + E3 animations) with reference keyframe captures (C3 scenario mode), or an explicit owner decision to exclude | `evidence/E3-animations.md` §3 rows 1–2/5–6; `data/animation.json` | E3 (animations), D5 (sequencing) | OPEN |
| O24 | X3 off-frame pixel fidelity: sprite-88 frame "off" CXFORM (tags.xml: multTerm 108, addTerm 148) mapped to an SVG feComponentTransfer (slope 108/256, intercept 148/255) in `src/ui/hud.ts` | Verify against a reference capture (C3 `--scenario`: click `btn_speaker` at stage (530.8, 381.8), capture before/after, muted); if they differ, adjust the filter only (no semantics change) | `evidence/X3-speaker.md` §7; `tests/fixtures/reference/speaker/` | X3 (filter), C3 (capture) | RESOLVED — evidence/X3-speaker.md §7 |
| O25 | Speaker icon spatial residual: the app draws the icon at a 0.5-px phase with bilinear resampling; E2's frozen S2 baseline equals the app ON capture (0 px in the box), both 466 px from the C3 reference (filter mapping is exact — O24) | E2-side: adjust the icon element's position/rendering (sub-pixel offset or crisp scaling) to match the reference, or record the E2 decision; verify by region diff against `tests/fixtures/reference/speaker/` | `evidence/X3-speaker.md` §7; `evidence/X3-o24/` | E2 (layout), X3 (verify) | SUPERSEDED — evidence/Y1-remaster.md §7 |

---

## Resolved items

RESOLVED 2026-09-28 — evidence/A2-timer.md — Timer starts at 200 s; the remaining value decrements once per 1000 ms of wall clock; the timer clip is stopped (`gotoAndStop(1)`) at round start, round end and timeout and restarted only by `baslat()` for a new round.
RESOLVED 2026-09-28 — evidence/A2-bonus.md — Bonus selection: 5% per added letter (`random(1000) < 50`) while `bonusball == -1`; `bonusball = kelime.length` marks the next-added ball as the bright one; +5000 is paid on the next valid submit while `bonusball > -1`; reset when the bright ball is removed or a non-empty entry is cleared.
RESOLVED 2026-09-28 — evidence/A2-checksum.md — The client never validates the `harf="9999"` checksum: `kelimatorid = al(9999)` is stored raw and only used in the excluded `hiscore.php` URL.
RESOLVED 2026-09-28 — evidence/A2-input.md — Input is matched by numeric Flash key codes for 29 Turkish uppercase letters (Ç 220, Ğ 219, İ 222, Ö 191, Ş 186, Ü 221); a letter is accepted only while a deck tile carrying it is visible; SPACE/ENTER/BACKSPACE act only while `bitti == 0`.
RESOLVED 2026-09-28 — evidence/A2-strings.md — Exact user-visible strings extracted (buttons Karıştır/Ekle/Sil/Yeni Oyun, status Geçerli/Girildi, results TEBRİKLER/Puanınız/Kelime Sayısı/Süre, `N harfli:` counters, loading text) with their display conditions; excluded screens' strings listed.
RESOLVED 2026-09-28 — evidence/A2-sounds.md — All 10 sound call sites map to the 9 DefineSound ids; `data/sound-map.json` written with `docs/03` §1 runtime names (`sfx_<id>_<slug>.mp3`, slugs = evidenced SWF clip identifiers), durations and A1 byte sizes (sha256 `fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09`).
RESOLVED 2026-09-28 — evidence/A2-kelimatorid.md — `Base64.decode` is REQUIRED for the original round data (every `<txt>` value is Base64(UTF-8); the archived plain-text `xml64.php` is not valid 2012 fixture input — Ruffle cross-check); `kelimatorid` is EXCLUDED (score-submission URL only).
RESOLVED 2026-09-28 — evidence/A2-labels.md — `main`=frame 5, `preall`=130, `hepsiburda`=131 (gameplay/round controller), `bravo`=132 (celebration); all words found → `gotoAndStop("bravo")` + play; only the first 10 words per length are listed/counted.
RESOLVED 2026-09-28 — evidence/A2-timeout.md — On timeout the in-progress entry is discarded without scoring, tiles are hidden, all unfound listed words are revealed, `finishsound` plays and input is blocked (`bitti = 1`); the time bonus is applied only on all-found completion, from the last integer remaining second.
RESOLVED 2026-09-28 — evidence/A2-edges.md — Duplicate letters consume one tile instance each; re-submitting a found word is rejected with `boing` and keeps the entry; BACKSPACE on an empty entry only plays the sound; scramble clears a partial entry (and skips the reset on an empty entry).
RESOLVED 2026-09-28 — evidence/A2-mochi.md — MochiAds lives entirely in the SWF frame-1 DoAction (10,480 bytes; `MochiAd.showPreGameAd` call at L582); removal = drop that script, no other script reads MochiAds state and the game continues without it (Ruffle blocks `*.mochiads.com`; the round still loads).
RESOLVED 2026-09-28 — evidence/A3-timing.md — FPS = 36 (header); all 24 animation sequences catalogued in `data/animation.json` with numeric SWF frame spans and frames ÷ 36 durations (4 main-timeline states, 3 element-motion paths with 214/86/19 Move tags, 17 sprite timelines); keyframe offsets defined for capture per `docs/07` §4.
RESOLVED 2026-09-28 — data/layout.json + evidence/A3-layout.md — all 62 stage-placed symbols of the 2012 build catalogued (x/y/w/h from PlaceObject2 matrices × definition bounds, board state = SWF frame 131; 26 text elements with Verdana metrics); schema-valid (ajv), asset paths verified, screenshot cross-check ≤1.2 px on solid edges.
RESOLVED 2026-09-28 — evidence/A1-fonts.md + evidence/A3-layout.md — three `DefineFont2` records all named Verdana (Bold/Regular/BoldItalic); all 26 text elements carry their size/bold/align metrics from the tag records; no other family is used.
RESOLVED 2026-09-28 — evidence/A1-bitmaps.md + evidence/A3-layout.md — the two bitmaps (id 47 550×400 RGB, id 86 21×29 RGBA) are used only as clipped fills inside shapes 48/87, never placed directly; fill id 65535 is referenced without a bitmap definition (no export exists).
RESOLVED 2026-09-28 — evidence/A1-stream.md — zero streaming content: all 38 `SoundStreamHead2` are empty, no `SoundStreamBlock` exists; EXCLUDED (nothing to integrate; D4 disposition).
RESOLVED 2026-09-28 — evidence/A3-diffs.md — 2007 vs 2012 compared for 44 shared roles: 22 identical (incl. background, sockets, wordball, logo, xmlload, speaker, puanmovie, high-score form, marquee); 12 differ (credit block replaced, new "Sil" button, b3–b8 counters added, bottom buttons repositioned ≤45.8 px, timer bar/digits +(6,15) px, status sprite +6.1 px, Puan/Süre colour/shadow updates); 2012 wins and is the only geometry in `data/layout.json`.
RESOLVED 2026-09-28 — evidence/C3-stability.md — Repeat-capture stability over two full S1–S10 matrix runs with the reconstructed Base64(UTF-8) fixture: capture mechanics deterministic (S1 and the timeout state S9 byte-identical; within-run stable streak 3), every state within the docs/07 §4 static threshold (max 1.22 %), residual differences are the reference's own randomness (deck shuffle, bonus ball incl. the invisible-bonus case, timing-dependent score/time values, end-screen fireworks) each localized by the F1 bbox and quantified; stabilization = stable-frame sampling + measured region/state detectors (sun mask, tile-entry detectors, timer gauge, end-of-round button bar, end-screen probe pixels).
RESOLVED 2026-09-28 — evidence/C3-fixture-format.md — harness fixture = Base64(UTF-8) re-encoding of the archived xml64.php word list (input/script/output sha256 recorded; archived file unmodified)
RESOLVED 2026-09-28 — evidence/B2-filters.md — Snapshot entry types inventoried (2,150 proper-noun-style capital-initial forms / 1,692 "özel isim" census flags; "DNA" the only letter-only abbreviation; 17,685 multi-word, 135 punctuation, 34 digit-bearing fixture and 1,232 circumflex bundle forms; 78 case-collisions; non-lexical bundle artifacts "GFGF"/"SFSFS"); only docs/06 §2 filters applied (no proper-noun/abbreviation filter and no junk filter rule added); blocklist = 53 offensive terms + the 2 fixture exclusions "GFGF"/"SFSFS" (recorded orchestrator decision 2026-09-28) = 55 entries with per-entry documented basis; gaps recorded (no citable offline offensive-word corpus; PİÇLEŞME/PİÇLEŞMEK and borderline terms left out).
RESOLVED 2026-09-28 — evidence/B3-viroloji-blocker.md + tests/fixtures/rounds/viroloji.xml — Wayback capture 2007-05-14 of xml.php provided by the orchestrator (bytes unchanged, 559 B, ISO-8859, sha256 594e6a53…c8621; comma-separated <txt> lists per harf, same format as the archived fixtures); the gated structural test activated and passes (main VİROLOJİ, words 3–7 = 4/1/0/0/0; all words 3–8 letters, multisets ⊂ main, main present, no duplicates); fixtures suite 20/20, full suite 97/97; src/data/rounds.json unchanged (7e4e149b…b9a96).
RESOLVED 2026-09-28 — evidence/X3-speaker.md — speaker `spk_btn` (DefineButton2_90) implemented: `on(release)` toggles `_root.vol` (0 = mute + stopAllSounds, 1 = full), persisted as `kelimator.volume` (D4 manager, default 100, clamp 0–100); E2's `btn_speaker` element gets the delegated listener plus the sprite-88 frames "on"/"off" (waves removed + frame-off CXFORM icon); 9 unit + 3 e2e tests, visual/playthrough suites unchanged.
RESOLVED 2026-09-29 — evidence/X3-speaker.md §7 — O24 closed: frame-off feComponentTransfer (108/256, 148/255) equals the reference CXFORM (app 18/18 within 2/255; ref 240/241, outlier a removed wave pixel) — no mapping change; residual spatial (app icon 0.5-px phase; E2 S2 baseline == app ON 0 px, both 466 px from C3), proposed as separate E2-side OPEN item O25; timing reconciled (click toggles vol + persistence only; icon applies at boot/render).
RESOLVED 2026-09-28 — evidence/B3-threshold.md — Round-bank threshold measured per docs/06 §3: bank sizes T=10→8,935, T=15→8,638, T=20→8,269, T=25→7,834, T=30→7,393 rounds (9,107 candidates); selected T=30 (largest T with bank ≥ 500); written to tools/build-config.json; emitted bank src/data/rounds.json = 7,393 rounds, sha256 7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96.
SUPERSEDED 2026-09-29 — evidence/Y1-remaster.md §7 — the speaker-knob spatial residual (old 2012 bitmap drawn through the inline pattern at a 0.5-px phase) is superseded by the owner-approved HD remaster of bitmap 86: the knob is now an intentionally different texture (ON C3 box raw 34.2 % / tolerant 10.8 %; knob bbox 83.0 %/45.0 %; OFF 26.5 %/5.8 %) and is covered by the approved allowance rect (515,367,22,30). Semantics (ON/OFF frames, persistence) unchanged and suite-verified.

## Amendments

- 2026-09-28 — C1-created schemas for `docs/02` §8 and `docs/03` §5–§6: the
  canonical blocks are data shapes, not JSON Schema documents, so a verbatim
  copy was impossible; they were encoded as draft-07 schemas (key names and
  nesting unchanged; every key shown is required). Evidence:
  `evidence/C1-scaffold.md` §3.2, `evidence/logs/C1-verbatim-probe.log`.
- 2026-09-28 — runtime data path mapping after C1 (`docs/04` §5): A2/A3 author
  under `data/`, E1 copies layout/animation to `src/data/`, B3 authors
  `src/data/rounds.json`; consumers per their task files. Evidence:
  `evidence/C1-scaffold.md` §5.
- 2026-09-28 — Task-scope additions required by Verify blocks: A2 additionally
  owns `tests/constants.test.mjs` (`npm test -- constants`); C2 additionally
  owns `tests/e2e/**` and the `src/main.ts` bootstrap wiring (stage-shell mount
  only). Concurrent workers propose `docs/08` status lines via their evidence;
  the orchestrator applies them (single-writer rule).
- 2026-09-28 — `docs/02` §1: A2's extra confirmation bullet (round values are
  Base64(UTF-8); the archived plain fixture is not valid 2012 input) is
  ratified as an addition beyond the `[TBC]` slots. Evidence:
  `evidence/A2-kelimatorid.md`.
- 2026-09-28 — A2 sound-map naming (`docs/03` §1): `sounds[].file` uses
  `sfx_<soundId>_<slug>.mp3` with slugs from the SWF's evidenced clip
  identifiers; the A1 export path mapping lives in evidence only. Evidence:
  `evidence/A2-sounds.md`; task note in `tasks/A2-mechanics-extraction.md`.
- 2026-09-28 — C3 fixture encoding: the 2012 client Base64-decodes every round
  value, so the harness serves a Base64(UTF-8)-encoded variant of the archived
  `xml64.php` (plain input yields a broken board: 6/8 tiles fail). Evidence:
  `evidence/A2-kelimatorid.md`, `evidence/logs/A2-ruffle-*.log`; task note in
  `tasks/C3-reference-harness.md`.
- 2026-09-28 — Silent witness runs (user directive, `EXECUTION.md` §8): Ruffle
  CLI runs use `--volume 0`; Playwright Chromium launches with `--mute-audio`;
  audio behavior is asserted via state, never audibility. Applied to
  `playwright.config.ts` (orchestrator; verified by the C2 smoke suite —
  `evidence/logs/orchestrator-silent-runs.log`).
- 2026-09-28 — T05 command reconciled (`docs/07` §1): the sound-map V7 check
  runs as `npm test -- audio` (D4's `tests/audio.test.ts`); semantics
  unchanged. Evidence: `evidence/D4-audio.md`.
- 2026-09-28 — E1 dependency ownership: `tasks/E1-asset-integration.md`
  additionally owns the minimal pinned `svgo` devDependency addition to root
  `package.json`/`package-lock.json`; C1's verification set (build/test/lint)
  is re-run by E1 after the change. Silent witness runs apply (`EXECUTION.md`
  §8): sound files are hashed, never played.
- 2026-09-28 — E1 text-catalog destination (`docs/03` §1): the 26 text-catalog
  files are committed to `src/assets/text/<symbolId>.txt` so runtime `asset`
  references resolve in a fresh clone (provenance only). Evidence:
  `evidence/E1-assets.md` §11.1/§13.
- 2026-09-28 — E2 test-scope + wiring: `tasks/E2-static-layout-match.md`
  additionally owns `tests/e2e/**` (visual suite) and the `src/main.ts`
  bootstrap wiring for the board mount; dsf2 reference fixtures remain C3's
  (`tests/fixtures/reference/dsf2/`).
- 2026-09-28 — C3 reference matrix completed at `deviceScaleFactor` 1 and 2
  (dsf2 = 1100×800); Chromium launch explicitly muted (`--mute-audio`, recorded
  in the run manifests); fixture unchanged (`854b7287…`). Evidence:
  `evidence/C3-harness.md`, `verify/reference/check.mjs` (V2dsf2/V5dsf2/Vmute).
- 2026-09-28 — V5 comparison basis (`docs/07` §4): static/animation checks use
  the symmetric 5×5 anti-aliasing-tolerant metric (threshold unchanged at
  2.0 %; raw ratio remains reported). Basis/measurements:
  `evidence/logs/orchestrator-tolerance-probe.log`, `evidence/E2-layout.md`
  §4/§6. Tool support lands in F1 (`verify/diff/`); E2/E3/F2 evaluate on the
  tolerant ratio.
- 2026-09-28 — Evidence freeze for suite re-runs: live Playwright runs write
  transient artifacts under `test-results/` (gitignored); committed
  `evidence/visual/**` copies stay frozen from each owning task's recording
  run. `C2_RECORD=1` / `E2_RECORD=1` re-record (`tests/e2e/smoke.spec.ts`,
  `tests/e2e/visual.spec.ts`).
- 2026-09-28 — B1 scope reduced (owner directive): API enumeration discontinued
  early (~1,150/1,644 pages); final headwords from the cached app bundle +
  sitemap per `artifacts/tdk/bundle_coverage.json`; `abartmasız` and
  `karzıhasen` excluded silently. Evidence: `evidence/B1-acquisition.md`,
  `evidence/logs/orchestrator-B1-halt.log`; task note in
  `tasks/B1-tdk-acquisition.md`.
- 2026-09-28 — B2 test-scope: `tasks/B2-wordlist-normalization.md` additionally
  owns `tests/normalize-wordlist.test.mjs` (`npm test -- normalize`).
- 2026-09-28 — Non-lexical fixture exclusion (`docs/06` §2): `GFGF` and `SFSFS`
  (site-bundle test fixtures found by B2) are excluded via `data/blocklist.txt`
  as undesired entries. Evidence: `evidence/B2-filters.md` §1.2/§4.3.
- 2026-09-28 — B3 test-scope: `tasks/B3-round-generation.md` additionally owns
  `tests/rounds-fixtures.test.mjs` (`npm test -- fixtures`).
- 2026-09-28 — `id` uniqueness (`docs/06` §4): duplicate slugs are accepted
  (the transliteration folds Turkish diacritics; 33 pairs inside the emitted
  bank); consumers must not assume uniqueness; no disambiguation suffix.
  Evidence: `evidence/B3-bank.md` §6.
- 2026-09-28 — viroloji fixture provided (B3 BLOCKER resolved): Wayback capture
  `2007-05-14 06:32:46` of `xml.php`, committed unchanged at
  `tests/fixtures/rounds/viroloji.xml` (sha256 `594e6a53…`, 559 B, ISO-8859);
  B3's gated structural test activates. Evidence:
  `evidence/B3-viroloji-blocker.md`.
- 2026-09-28 — constants `bonusLetter.seed` (`docs/02` §8): the probabilistic
  O02 bonus rule gets a seeded RNG seed recorded in constants (value 2012,
  deterministic-test value; distribution unchanged). Schema + data amended;
  D1 consumes it.
- 2026-09-28 — D5 test-scope + wiring: `tasks/D5-lifecycle.md` additionally owns
  `tests/e2e/playthrough/**` (basic playthrough spec) and the `src/main.ts`
  game wiring; `tests/fixtures/playthrough.json` stays F2's.
- 2026-09-28 — D2 key mapping (`docs/05` §3): `keyCode`-primary with
  `event.key`/`event.code` fallbacks (I/İ indistinguishable via `key` alone).
  Evidence: `evidence/D2-input.md` §6.2.
- 2026-09-28 — shuffle determinism: deck shuffle is a seeded permutation
  (`shuffleOrder(count, seed)`, mulberry32); seed 2012 recorded as test vector;
  production seed/advance is D5's. Evidence: `evidence/D2-input.md` §4/§6.1.
- 2026-09-28 — O15(g): CTRL (`Key.isDown(17)` + `songecerlikelime`) is
  reference-only and intentionally not implemented. Evidence:
  `evidence/A2-edges.md` §2(g), `evidence/D2-input.md` §6.4.
- 2026-09-28 — `window.__game.selectRound(main)` test hook (`docs/04` §6) for
  E2E round selection (F2/FİNALİZM); test-only, no production UI.
- 2026-09-28 — C3: reference harness scenario mode (`--scenario`) added for
  E3/F2 scripted captures; schema documented in `verify/reference/README.md`.
  Evidence: `evidence/C3-harness.md`, `evidence/logs/C3-scenario.log`.
- 2026-09-28 — E3 test-scope + wiring: `tasks/E3-animations.md` additionally
  owns `tests/e2e/**` (animation suite), `src/main.ts` animation wiring, and
  `tests/fixtures/reference/animations/**` (reference keyframes via C3's
  scenario mode).
- 2026-09-28 — F2 harness scope: `tasks/F2-e2e-playthrough.md` drives the
  reference via C3's `--scenario` mode and owns
  `tests/fixtures/reference/playthrough/**` for its reference captures.
- 2026-09-28 — E3 animation-check coverage (`docs/07` §4): keyframe checks apply
  to timeline sequences painted in the rebuild; other classes verified by
  duration/trigger/state checks (evidence: `evidence/E3-animations.md` §3).
  Intro/preloader timed motion divergence queued as O23 (OPEN).
- 2026-09-28 — **Owner defect wave X1–X3** (EXECUTION.md §9.4; tasks `X1`–`X3`):
  (1) tile center clicks dead (letter label swallows pointer events) → X1;
  (2) `s58_letter_tile.svg` embeds the FLA authoring "A" glyph → X2 removes it in
  the asset pipeline with a regression guard (`docs/07` §4 guard note added by
  X2's evidence) and refreshed S2–S7 raw+tolerant ratios;
  (3) speaker control inert (no handler anywhere) → X3 implements the toggle
  with persisted volume from evidenced semantics.
  F3 waits until the wave is verified and committed.
- 2026-09-28 — X2 tile-template guard (`docs/07` §4): structural check that
  `s58_letter_tile.svg` carries no authoring glyph (`font_Verdana` spans/text
  counts; deliberate-probe verified); thresholds unchanged. Evidence:
  `evidence/X2-tile-glyph.md`.
- 2026-09-28 — Defect wave extension **X4** (found by F2's S9 variant): timeout
  reveal colour — the reference's `tamamla()` sets revealed words `#ff6600`;
  the rebuild dropped the `revealed` flag and rendered `#000` (S9 tolerant
  2.0145 % > 2.000 %). Fix task `tasks/X4-timeout-reveal-colour.md`; F2 re-runs
  after the fix.
- 2026-09-29 — X4 timeout reveal colour (`src/ui/board.ts`/`src/main.ts`): the
  lifecycle's `ListedWordView.revealed` flag now reaches the board view and
  revealed (timeout) slots render the reference's `#ff6600` (16737792,
  `tamamla()` L568–570); player-found slots keep black. Focused e2e
  `tests/e2e/timeout/reveal-colour.spec.ts` (fake-clock expiry through the real
  timer path; pre-fix run fails on the revealed colour) + F2's S9 re-runs:
  tolerant 2.0145 % → 0.901 % (raw 7.730 %), pass. Evidence:
  `evidence/X4-reveal-colour.md`.
- 2026-09-29 — F3 test-scope: `tasks/F3-final-matrix.md` additionally owns
  `tests/e2e/offline/**` (T14 offline check); `tools/verify-all.sh` runs suites
  without recording flags (frozen evidence; transient outputs in
  `test-results/`).
- 2026-09-29 — F3 transcript location: `tools/verify-all.sh`'s verified
  transcript is written to `artifacts/verify-all/F3-verify-all.log`
  (Playwright wipes `test-results/` at every run) and committed as
  `evidence/logs/F3-verify-all.log`; suites stay recording-flag-free.
- 2026-09-29 — F3 completion: `tools/verify-all.sh` exit 0 (11/11 steps);
  gate checklists G1–G5 complete; T14 asserts the built `dist/` runs offline
  with zero non-local requests; README §2 fixed decisions re-checked PASS;
  O23 and O25 remain OPEN with resolution pointers in
  `evidence/F3-final-report.md` §7 (neither is a G5 blocker).
- 2026-09-29 — **Owner final presentation wave Y1–Y2** (EXECUTION.md §9.4;
  tasks `Y1`–`Y2`): (Y1) HD asset remaster of bitmap 47/86 into
  `s48_board_backdrop.svg`/`s90_btn_speaker.svg` with smooth rendering and a
  region-scoped V5 allowance (owner-approved deviation from the reference
  texture; diff `--ignore-rect` mechanism); (Y2) clean omission of the two site
  credit sprites (`credit_line`/`credit_site`) with absence assertions and the
  owner-approved omission region (0,367,105,36). Serialized (shared files);
  G4 + `tools/verify-all.sh` re-run after the wave.
- 2026-09-29 — Wave follow-up **Y3** (owner defect, pre-investigated): the
  `CONTROL_RECTS` lookups in `src/ui/hud.ts` swap `scramble`/`delete` — the
  reference BUTTONCONDACTION files map kbuton→`karistir()` (x=156.25),
  sbuton→`sil()` (x=308.6), ebuton→`ekle()` (x=232.85). Fix + static mapping
  test + center-of-label e2e; superseding note for the same-wave D5 evidence
  record; serialized after Y2 (HMR safety). Evidence: `evidence/Y3-buttons.md`.
- 2026-09-29 — Owner final wave Y1 (`docs/07` §4 allowance + `docs/03` §2
  deviation): HD remaster of bitmaps 47/86 embedded into s48/s90 (8x WebP,
  hash-pinned, deterministic, skippable), smooth rendering, V5 `--ignore-rect`
  set (138 rects, 28.4 % of stage, 97.7 %/98.6 % deviation coverage), suites
  re-run green. Evidence: `evidence/Y1-remaster.md`.
- 2026-09-28 — X1 tile center clicks (`docs/05` §3): the tile letter field is
  pointer-events-transparent; the single click delegation matches `buttonN`
  only; center-click e2e at dsf 1/2 plus O15 edges. Evidence:
  `evidence/X1-tile-click.md`.
