# Kelimatör — Personal 1:1 Recreation

Personal, non-published project. Goal: recreate the **2012–2013 Turkish build** of
Kelimatör (`games.lg.web.tr/kelimator`) as a modern static web app whose gameplay,
layout, visuals, and audio match that build 1:1. The project is executed end-to-end
by an AI agent following this plan strictly, with zero guesses and zero assumptions.

This document set is self-contained: a fresh agent session with no prior context
must be able to execute it using only this folder and the read-only source
material in `../kelimator-nostalji/`.

---

## 1. Reference build (source of truth)

| Field | Value |
|---|---|
| File | `../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf` |
| Size | 188,830 bytes |
| MD5 | `af059ff9d75cefbc244f03814b47be9c` |
| SWF version | 6 (CWS / zlib), stage 550 × 400 |
| Provenance | Internet Archive Wayback Machine, `games.lg.web.tr/kelimator/svvf.php?hash=fa80139e6dc500a67e8e08b5987e7c38` (2013-04-21) |
| Wayback URL | https://web.archive.org/web/20130421211839id_/http://games.lg.web.tr/kelimator/svvf.php?hash=fa80139e6dc500a67e8e08b5987e7c38 |
| Equivalent captures | 2012–2013 captures with hashes `2200ad…`, `030bfe…`, `66f81be…`, `107fb4be…` serve byte-identical content |

If the local file is missing or its MD5 differs, re-download from the Wayback URL
and verify the MD5 before any other work. If neither local nor Wayback is
available: STOP and record a BLOCKER (see `EXECUTION.md` §9).

Other files in `../kelimator-nostalji/` are supporting material (2007 and 2005
builds, archived round fixtures, extracted sounds, archived page HTML, Ruffle
0.6.0). They are read-only inputs. All rights remain with the original author;
this project is a private, non-published recreation.

---

## 2. Fixed decisions (do not revisit)

1. **Reference build**: the 2012–2013 Turkish SWF identified above.
2. **No network features**: score submission (`hiscore.php`), Top10, e-mail,
   online counters, translator, and the original MochiAds startup ad are out of
   scope and are not reimplemented. The game must run with zero network requests.
3. **Score computation stays** (it is part of the mechanics), but no score
   submission, storage, or leaderboard exists.
4. **Word list**: built at build time from a current TDK headword snapshot.
   Words containing non-core characters (`â`, `û`, `î`, `^`, `'`, spaces,
   hyphens, digits) are excluded. Core Turkish letters
   (`a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z`) are kept.
5. **Visual/mechanical fidelity**: layout, colors, timings, animations, and
   sound mapping must match the reference build 1:1, established by extraction
   and empirical comparison — never by assumption.
6. **Text rendering**: system font stack beginning with `Verdana` (matching the
   original's Verdana-family usage). No font files are embedded.
7. **Single language**: Turkish only. The English build is out of scope.

---

## 3. Ground rules (mandatory)

1. **No guesses, no assumptions.** Every behavior constant must originate from
   decompilation evidence or an empirical test, and must carry an
   `// evidence:` reference in code. Unresolved facts live in
   `docs/08-open-items.md` and block dependent tasks.
2. **Plan loyalty.** Tasks are executed exactly as written in `tasks/`. Any
   deviation requires the blocker protocol (`EXECUTION.md` §9).
3. **Empirical verification.** Every task ends with a `Verify` block that must
   pass before the task is considered done. Failed verification stops the line.
4. **English only** in all project files.
5. **No time estimates** anywhere in this project's documents.
6. **Self-containment.** Everything an executing agent needs is in this folder
   or in the read-only `../kelimator-nostalji/` directory.

---

## 4. Source material map

| Path | Role |
|---|---|
| `../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf` | Primary reference build (2012) |
| `../kelimator-nostalji/calistir/kelimator_tr_2007.swf` | Secondary reference (2007 build; comparison only) |
| `../kelimator-nostalji/calistir/xml.php`, `xml64.php` | Archived round fixtures (FİNALİZM round) |
| `../kelimator-nostalji/calistir/xml_eng.php` | Archived English round fixture (LEAVINGS; structure reference only) |
| `../kelimator-nostalji/sesler/*.mp3` | Sounds already extracted from the builds (verify hashes in A1) |
| `../kelimator-nostalji/kayitlar/*.html` | Archived official pages (2004 TR / 2006 EN / 2015 TR) — behavioral documentation |
| `../kelimator-nostalji/kayitlar/sozluk_29749_kelime.xml` | Archived site dictionary (fixture / cross-check only) |
| `../kelimator-nostalji/Ruffle.app/Contents/MacOS/ruffle` | Ruffle 0.6.0 CLI (running the original for empirical comparison) |
| `../kelimator-nostalji/calistir/sunucu.py` | Local static server used for Ruffle testing (pattern reused by C3) |
| `../kelimator-nostalji/README.md` | Full Wayback source URL list |

---

## 5. Document map

| Document | Purpose |
|---|---|
| `README.md` | This file: mission, scope, decisions, rules, map |
| `EXECUTION.md` | Agent operating manual: DAG, parallel groups, gates, evidence protocol, failure policy |
| `docs/01-reverse-engineering.md` | Tooling and extraction procedure for the reference SWF |
| `docs/02-mechanics-spec.md` | Single source of truth for game behavior; `[CONFIRMED]` / `[TBC]` status |
| `docs/03-assets-and-visuals.md` | Asset handling, naming, visual-fidelity method, thresholds pointer |
| `docs/04-architecture.md` | Stack, stage scaling, fullscreen, offline constraints, module layout |
| `docs/05-game-core.md` | Module contracts, state machine, edge cases, test hooks |
| `docs/06-dictionary-and-rounds.md` | TDK pipeline, normalization rules, round generation, data schemas |
| `docs/07-verification.md` | Test matrix, fixtures, reference capture spec, pixel-diff thresholds, gates |
| `docs/08-open-items.md` | Unknowns queue: every open question with its resolution procedure |
| `tasks/*.md` | Self-contained work units; one file per parallel work item |

---

## 6. Directory contract (created during execution)

| Directory | Committed | Purpose |
|---|---|---|
| `docs/`, `tasks/` | yes | This plan |
| `data/` | yes | Frozen interfaces: `rounds.schema.json`, `constants.schema.json`, `sound-map.schema.json` (created by C1) |
| `src/` | yes | Web application source |
| `tools/` | yes | Build/processing scripts + `verify-all.sh` |
| `tests/` | yes | Unit/integration tests + `fixtures/` |
| `verify/` | yes | Reference harness (Ruffle web embed + Playwright drivers) |
| `evidence/` | yes | Per-task evidence files and logs |
| `artifacts/` | no | Raw extractions, exports, downloaded snapshots (working data) |

The `../kelimator-nostalji/` directory is read-only. Nothing in it is ever
modified.

---

## 7. How to execute

1. Read `EXECUTION.md` fully.
2. Execute tasks in dependency order, in parallel groups where possible
   (`EXECUTION.md` §7).
3. Pass every gate (G1–G5) before starting dependent groups.
4. Do not invent, infer, or "reasonably choose" any value that is not backed by
   evidence. When in doubt: consult `docs/08-open-items.md`; if still
   unresolved, BLOCKER protocol.
