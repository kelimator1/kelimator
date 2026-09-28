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
| O01 | Timer initial value, tick interval, and pause semantics | A2: locate timer initialization and decrement in decompiled AS; confirm by observing the reference (screenshots at fixed offsets) | `evidence/A2-timer.md`; `data/constants.json` | D3, D5 | OPEN |
| O02 | Bonus-letter selection rule (which letter, when chosen, per round) | A2: trace `bonusball`, `bonusrnd`, `bonusmin`, `bonusrange` usage | `evidence/A2-bonus.md`; `constants.bonusLetter` | D5, E3 | OPEN |
| O03 | Does the client validate the `harf="9999"` checksum before starting a round? | A2: trace parsing/verification code after XML load | `evidence/A2-checksum.md` | D1 | OPEN |
| O04 | Key handling specifics (key codes vs characters; Turkish letters; which keys act when) | A2: read input handlers and confirm against reference behavior | `evidence/A2-input.md` | D2 | OPEN |
| O05 | Exact user-visible strings and their display conditions | A2/A3: read static text and dynamic text fields; confirm via reference screenshots | `evidence/A2-strings.md`; layout catalog | E2 | OPEN |
| O06 | Sound trigger map (event → sound ID) | A2: trace `ses_cikart`/sound calls for all 9 sounds | `evidence/A2-sounds.md`; `data/sound-map.json` | D4, F2 | OPEN |
| O07 | FPS and frame spans of every animation | A3: read header FPS; measure spans from FLA/timeline | `evidence/A3-timing.md`; `data/animation.json` | E3, F2 | OPEN |
| O08 | Layout coordinates of all elements, colors, font metrics | A3: extract from FLA/SVG placement + stage data | `evidence/A3-layout.md`; `data/layout.json` | E1, E2 | OPEN |
| O09 | Font names/styles used by the 2012 build | A1: read DefineFont2 records; cross-check A3 text metrics | `evidence/A1-fonts.md` | E2 | OPEN — A1 partial: 3× Verdana (Bold/Regular/BoldItalic), TTF hashes recorded; pending A3 text metrics |
| O10 | Bitmap dimensions and usage locations in the 2012 build | A1/A3: export and inspect; map placements via PlaceObject2 | `evidence/A1-bitmaps.md` | E1 | OPEN — A1 partial: id 47 550×400 RGB, id 86 21×29 RGBA; used as shape fills 48/87; pending A3 placement mapping |
| O11 | Streaming sound (`SoundStreamHead2`) content and purpose | A1/A3: extract stream blocks; determine whether it is music/SFX; confirm audibility in reference | `evidence/A1-stream.md` | D4, E3 | OPEN — A1 partial: 38 empty `SoundStreamHead2`, zero `SoundStreamBlock`; no streaming audio content exists |
| O12 | Role of `kelimatorid` and `Base64.decode` | A2: trace usage; classify as EXCLUDED (score/identity) or needed for core flow | `evidence/A2-kelimatorid.md` | D1 | OPEN |
| O13 | Meaning/sequence of `preall`, `hepsiburda`, `bravo` labels | A2: trace frame transitions; confirm in reference | `evidence/A2-labels.md`; `constants.flows` | D5, E3 | OPEN |
| O14 | Timeout semantics (mid-entry, timer stop on completion, time-bonus timing) | A2 + reference observation | `evidence/A2-timeout.md` | D3, D5 | OPEN |
| O15 | Edge-case input rules (duplicates, re-submit, backspace on empty, scramble with entry) | A2 + reference observation | `evidence/A2-edges.md` | D2 | OPEN |
| O16 | Round-bank threshold T measurement | B3: generate candidate banks per `docs/06` §3; record sizes; apply selection rule | `evidence/B3-threshold.md`; `tools/build-config.json` | D1 | OPEN |
| O17 | Entry-type filters discovered in the TDK snapshot (abbreviations, proper nouns) | B2: inspect snapshot structure; apply and record filter decisions | `evidence/B2-filters.md` | B3 | OPEN |
| O18 | Any visual difference between 2007 and 2012 builds relevant to layout | A3: compare extracted geometry; record differences; 2012 wins | `evidence/A3-diffs.md` | E1, E2 | OPEN |
| O19 | MochiAds removal points (which scripts/tags to strip) | A1/A2: identify ad initialization/resume paths; ensure removal does not alter game flow | `evidence/A2-mochi.md` | D5 | OPEN |
| O20 | Repeat-capture stability of the reference harness (same screenshots across runs) | C3: capture the matrix twice; compare hashes; if unstable, identify cause and record | `evidence/C3-stability.md` | F2 | OPEN |

---

## Resolved items

(none yet)

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
