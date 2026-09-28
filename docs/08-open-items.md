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
| O16 | Round-bank threshold T measurement | B3: generate candidate banks per `docs/06` §3; record sizes; apply selection rule | `evidence/B3-threshold.md`; `tools/build-config.json` | D1 | OPEN |
| O17 | Entry-type filters discovered in the TDK snapshot (abbreviations, proper nouns) | B2: inspect snapshot structure; apply and record filter decisions | `evidence/B2-filters.md` | B3 | OPEN |
| O18 | Any visual difference between 2007 and 2012 builds relevant to layout | A3: compare extracted geometry; record differences; 2012 wins | `evidence/A3-diffs.md` | E1, E2 | RESOLVED — evidence/A3-diffs.md |
| O19 | MochiAds removal points (which scripts/tags to strip) | A1/A2: identify ad initialization/resume paths; ensure removal does not alter game flow | `evidence/A2-mochi.md` | D5 | RESOLVED — evidence/A2-mochi.md |
| O20 | Repeat-capture stability of the reference harness (same screenshots across runs) | C3: capture the matrix twice; compare hashes; if unstable, identify cause and record | `evidence/C3-stability.md` | F2 | RESOLVED — evidence/C3-stability.md |
| O21 | Which fixture is served to the 2012 reference harness? | C3 + amendment 2026-09-28 (`tasks/C3-reference-harness.md`): the 2012 client Base64-decodes every round value; serve a deterministic Base64(UTF-8) re-encoding of the archived `xml64.php` word list (input/script/output SHA-256 recorded; archived file unmodified) | `evidence/C3-fixture-format.md`; `verify/reference/fixtures/` | E2, E3, F2 | RESOLVED — evidence/C3-fixture-format.md |

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
