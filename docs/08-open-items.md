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
| O07 | FPS and frame spans of every animation | A3: read header FPS; measure spans from FLA/timeline | `evidence/A3-timing.md`; `data/animation.json` | E3, F2 | OPEN |
| O08 | Layout coordinates of all elements, colors, font metrics | A3: extract from FLA/SVG placement + stage data | `evidence/A3-layout.md`; `data/layout.json` | E1, E2 | OPEN |
| O09 | Font names/styles used by the 2012 build | A1: read DefineFont2 records; cross-check A3 text metrics | `evidence/A1-fonts.md` | E2 | OPEN — A1 partial: 3× Verdana (Bold/Regular/BoldItalic), TTF hashes recorded; pending A3 text metrics |
| O10 | Bitmap dimensions and usage locations in the 2012 build | A1/A3: export and inspect; map placements via PlaceObject2 | `evidence/A1-bitmaps.md` | E1 | OPEN — A1 partial: id 47 550×400 RGB, id 86 21×29 RGBA; used as shape fills 48/87; pending A3 placement mapping |
| O11 | Streaming sound (`SoundStreamHead2`) content and purpose | A1/A3: extract stream blocks; determine whether it is music/SFX; confirm audibility in reference | `evidence/A1-stream.md` | D4, E3 | OPEN — A1 partial: 38 empty `SoundStreamHead2`, zero `SoundStreamBlock`; no streaming audio content exists |
| O12 | Role of `kelimatorid` and `Base64.decode` | A2: trace usage; classify as EXCLUDED (score/identity) or needed for core flow | `evidence/A2-kelimatorid.md` | D1 | RESOLVED — evidence/A2-kelimatorid.md |
| O13 | Meaning/sequence of `preall`, `hepsiburda`, `bravo` labels | A2: trace frame transitions; confirm in reference | `evidence/A2-labels.md`; `constants.flows` | D5, E3 | RESOLVED — evidence/A2-labels.md |
| O14 | Timeout semantics (mid-entry, timer stop on completion, time-bonus timing) | A2 + reference observation | `evidence/A2-timeout.md` | D3, D5 | RESOLVED — evidence/A2-timeout.md |
| O15 | Edge-case input rules (duplicates, re-submit, backspace on empty, scramble with entry) | A2 + reference observation | `evidence/A2-edges.md` | D2 | RESOLVED — evidence/A2-edges.md |
| O16 | Round-bank threshold T measurement | B3: generate candidate banks per `docs/06` §3; record sizes; apply selection rule | `evidence/B3-threshold.md`; `tools/build-config.json` | D1 | OPEN |
| O17 | Entry-type filters discovered in the TDK snapshot (abbreviations, proper nouns) | B2: inspect snapshot structure; apply and record filter decisions | `evidence/B2-filters.md` | B3 | OPEN |
| O18 | Any visual difference between 2007 and 2012 builds relevant to layout | A3: compare extracted geometry; record differences; 2012 wins | `evidence/A3-diffs.md` | E1, E2 | OPEN |
| O19 | MochiAds removal points (which scripts/tags to strip) | A1/A2: identify ad initialization/resume paths; ensure removal does not alter game flow | `evidence/A2-mochi.md` | D5 | RESOLVED — evidence/A2-mochi.md |
| O20 | Repeat-capture stability of the reference harness (same screenshots across runs) | C3: capture the matrix twice; compare hashes; if unstable, identify cause and record | `evidence/C3-stability.md` | F2 | OPEN |

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
