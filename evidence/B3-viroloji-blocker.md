# B3 — BLOCKER record: `viroloji` fixture unavailable (docs/06 §5 step 4) — RESOLVED 2026-09-28

Task: B3 — Round Generation and Bank
Started: 2026-09-28T18:18:30Z (first artifact); blocker confirmed 2026-09-28T18:25:21Z
Ended: 2026-09-28T18:30:20Z (follow-up: fixture provided by the orchestrator, test activated)
Host+OS: dev-host.home / macOS (arm64 / arm64 host, Node v22.14.0)

Commands executed (exact; full trace `evidence/logs/B3-viroloji-search.log`):

```sh
find . -path ./node_modules -prune -o -iname "*viroloji*" -print
find ../kelimator-nostalji -iname "*viroloji*" -print
ls tests/fixtures/
grep -rn "viroloji\|VİROLOJİ" docs/ tasks/ tools/wordlist.txt
grep -rn "2007-05-14\|20070514" ../kelimator-nostalji/README.md docs/ tasks/
grep -n "xml.php" ../kelimator-nostalji/README.md
grep -rl "ROLOJ" artifacts verify src tests data tools docs tasks
for f in ../kelimator-nostalji/calistir/*.swf; do strings -a "$f" | grep -ci "VIROLOJ"; done
# follow-up (2026-09-28, after the orchestrator provided the fixture):
file tests/fixtures/rounds/viroloji.xml; wc -c tests/fixtures/rounds/viroloji.xml; shasum -a 256 tests/fixtures/rounds/viroloji.xml
xxd tests/fixtures/rounds/viroloji.xml | head -8
npm test -- fixtures    # exit 0; 20 passed | 0 skipped (viroloji test activated)
npm test                # exit 0; 97 passed | 0 skipped
node tools/build-rounds.mjs --check   # exit 0
```

Exit codes: historical blocker phase 0 (the suite exited 0 with the viroloji
test explicitly skipped; find/grep returning no match exit 1 inside the log
where nothing was found). Follow-up: 0 for `npm test -- fixtures` (20/20),
`npm test` (97/97) and `node tools/build-rounds.mjs --check`.

Output summary: historical (blocker phase) — no `viroloji` round fixture
existed anywhere in the repository or in the read-only
`../kelimator-nostalji/` package; the source cited by docs/06 §5 was not
reachable under task B3's no-network rule. Follow-up 2026-09-28 — the
orchestrator provided `tests/fixtures/rounds/viroloji.xml`; the gated
structural test activated and passes; every B3 deliverable is complete and the
bank is unchanged (§0; `evidence/B3-threshold.md`, `evidence/B3-bank.md`).

Artifact SHA-256 hashes:
- `evidence/logs/B3-viroloji-search.log` `3864637c18aa92f42ad306d3f783b18059e72864496b069c3755396fa0ae10c8`
- archived sources inspected: `xml.php`/`xml64.php` `854b7287c2e6878938671b7490f908605b9986ba28f4abe6f0eb2a62af3c2bed` (FİNALİZM), `xml_eng.php` `ba36b137fde8a4363e4435c0c48fc257fcbb1ac684e244b2062abc6140be7da8` (LEAVINGS)

Result: RESOLVED (2026-09-28) — fixture provided by the orchestrator; the gated
structural test runs and passes; O22 closed (see §0). Original BLOCKER record
preserved below as the historical analysis.

---

## 0. Resolution (2026-09-28) — O22 closed

**Status: RESOLVED.** The orchestrator provided the missing fixture and made the
`id` decision; B3 made no network request.

- **Fixture (provenance):** `tests/fixtures/rounds/viroloji.xml` — Wayback
  capture `2007-05-14 06:32:46` of `xml.php`, bytes unchanged, 559 B, ISO-8859,
  sha256 `594e6a5377fbe8edef05f93850ac9eea4fc50c25fd5e6e9facf33186d4cd8621`.
- **Discovered format** (recorded byte-wise in
  `evidence/logs/B3-viroloji-fixture.log`): same family as the other archived
  fixtures — root `<kelimeler>`, one `<kelime harf="N">` per length with a
  single `<txt>` value holding **comma-separated words** (empty `<txt>` for an
  empty list), `harf="8"` = the main word, `harf="9999"` = the raw checksum
  entry; ISO-8859-9 (`0xDD` = `İ`; main `VİROLOJİ` bytes
  `56 DD 52 4F 4C 4F 4A DD`), no XML declaration, no Base64. Lists:
  3 = `LOR,LİR,ROL,İRİ`, 4 = `VOLİ`, 5/6/7 = empty; checksum
  `5eaa5927c04aeaeec8409860bbb21460`.
- **Activated test** (`npm test -- fixtures`, exit 0):
  `[B3] viroloji source: tests/fixtures/rounds/viroloji.xml sha256=594e6a53…`
  and `[B3] viroloji structural: main=VİROLOJİ counts(3..7)=4/1/0/0/0` — all
  words 3–8 letters, every word's multiset ⊂ the main word's multiset, main
  word present, no duplicates. Suite: **20 passed, 0 skipped** (was 19 + 1
  explicit skip); full `npm test`: **97 passed, 0 skipped** (was 96 + 1 skip).
  Raw logs: `evidence/logs/B3-tests-fixtures.log`,
  `evidence/logs/B3-tests-full.log`.
- **Bank unchanged:** `src/data/rounds.json` sha256
  `7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96` (VİROLOJİ's
  current-dictionary round has 6 words < T = 30 and stays out of the bank; no
  rebuild needed; `node tools/build-rounds.mjs --check` exit 0).
- **`id` decision:** the orchestrator chose option (a) ACCEPT duplicate slugs;
  `docs/06` §4 is being amended accordingly; no artifact change, no suffix
  (`evidence/B3-bank.md` §6).

**O22 closure line (exact; for the orchestrator to transcribe):**

```
RESOLVED 2026-09-28 — evidence/B3-viroloji-blocker.md + tests/fixtures/rounds/viroloji.xml — Wayback capture 2007-05-14 of xml.php provided by the orchestrator (bytes unchanged, 559 B, ISO-8859, sha256 594e6a53…c8621; comma-separated <txt> lists per harf, same format as the archived fixtures); the gated structural test activated and passes (main VİROLOJİ, words 3–7 = 4/1/0/0/0; all words 3–8 letters, multisets ⊂ main, main present, no duplicates); fixtures suite 20/20, full suite 97/97; src/data/rounds.json unchanged (7e4e149b…b9a96).
```

**`docs/08` row replacement:** replace the O22 Status cell `BLOCKER` with
`RESOLVED — evidence/B3-viroloji-blocker.md`.

---

## 1. Expected input (docs/06 §5)

| Fixture | Source | Test |
|---|---|---|
| `viroloji.xml` | "Wayback: `xml.php` capture 2007-05-14 (URL in `../kelimator-nostalji/README.md`)" | Structural: all words 3–8 letters; every word's multiset ⊂ main multiset; main word present; no duplicates |

The fixture is also listed by `tasks/F2-e2e-playthrough.md` and
`docs/07-verification.md` §2 as `tests/fixtures/rounds/*.xml`.

## 2. Search results (all negative)

1. `find` for `*viroloji*` over the repository and over
   `../kelimator-nostalji/` — **no file**.
2. `tests/fixtures/` contains only `reference/`; the documented
   `tests/fixtures/rounds/` directory does not exist
   (`finalizm.xml` and `leavings.xml` are likewise absent; B3's fixture tests
   therefore read the archived sources directly, which is what
   `tasks/B3-round-generation.md` Inputs list).
3. `grep -rn "viroloji|VİROLOJİ"` — only doc/task references plus the two
   dictionary words `VİROLOJİ`/`VİROLOJİK` in `tools/wordlist.txt` (the words
   themselves are not round fixtures).
4. `../kelimator-nostalji/README.md` documents **no 2007-05-14 URL**; its only
   `xml.php` Wayback reference is the **2007-08-15** capture of the FİNALİZM
   round (line 123: `.../web/20070815162108id_/.../xml.php`), whose content is
   the local `calistir/xml.php` (sha256 `854b7287…c2bed`). The only other round
   file in the package is `xml64.php`, documented by the README as an
   unverified 2007-format copy, and it is byte-identical to `xml.php`
   (FİNALİZM).
5. `grep -rl "ROLOJ"` over `artifacts verify src tests data tools docs tasks` —
   only `tools/wordlist.txt` (the word entries). No decompiled script, asset or
   cache carries the round.
6. All four archived SWFs contain zero `VIROLOJ` strings
   (`strings -a <swf> | grep -ci VIROLOJ` = 0 for each), so the round is not
   embedded in any build either.
7. Network requests are forbidden by task B3 (and by the B1 owner directive
   recorded in `docs/08`), so the Wayback capture cannot be fetched to close
   the gap.

Context (not a substitution): `VİROLOJİ` is itself an 8-letter candidate of the
current wordlist (line 51,903), but its current-dictionary round totals only
**6 words** (`LOR, LİR, ROL, İRİ, VOLİ` + main) — below the measured T = 30 —
so it is not in the emitted bank and cannot serve as a stand-in for the
archived round.

## 3. Impact and what B3 did instead (historical — superseded by §0)

- Impact: only the `viroloji` structural check of step 4. Steps 1–3, 5, 6 and
  Verify V2/V3/V4/V8 are complete and green.
- `tests/rounds-fixtures.test.mjs` contains the full viroloji structural test,
  gated on availability (`it.skipIf`): it **runs automatically** as soon as a
  fixture appears at `tests/fixtures/rounds/viroloji.xml` (or another source is
  added to the resolver). Until then the test is **explicitly skipped** and a
  blocker line is printed to stderr on every run — the condition is visible,
  never a silent pass.
- The 2012 wire form is not involved: the archived fixtures are plain
  ISO-8859-9 and are parsed as such (`evidence/B3-bank.md` §2); no re-encoding
  was performed.

## 4. Proposals for the orchestrator (historical — superseded by §0: Option A was applied)

Option A — provide the fixture (preferred if the capture exists):

1. Download the Wayback capture of `xml.php` (the round with main word
   `VİROLOJİ`; the docs cite 2007-05-14) and commit it unchanged as
   `tests/fixtures/rounds/viroloji.xml` (ISO-8859-9 bytes, no re-encoding).
2. Re-run `npm test -- fixtures`: the skipped test activates and asserts the
   structural checks; append its output to this file's task evidence.

Option B — amend the plan if the capture is not recoverable:

1. Dated `> Amendment 2026-09-28` note in `docs/06` §5 replacing the
   `viroloji.xml` row (e.g. with the already-archived `xml_eng.php` fixture or
   with a note that the round's Wayback capture does not exist), plus the
   matching entry in `docs/08-open-items.md` (Amendments).
2. Update `tasks/B3-round-generation.md` step 4 and `docs/07` §2 fixture lists
   accordingly; B3's test file drops the skip when the source is chosen.

Proposed `docs/08` BLOCKER entry (transcribe or assign a free ID; O22 is the
next free ID after O21 as of this task):

```
| O22 | viroloji round fixture (docs/06 §5: "Wayback xml.php capture
2007-05-14"; task step 4 requires its structural check) is absent from the
repository and from ../kelimator-nostalji/; the cited URL is not in
../kelimator-nostalji/README.md; network requests are forbidden by task B3 |
B3: availability search (find/grep/strings), fixture test gated on
availability; close by providing the archived capture as
tests/fixtures/rounds/viroloji.xml, or by a dated docs/06 §5 amendment
replacing the fixture | evidence/B3-viroloji-blocker.md | B3 (fixture test),
F2 (fixture list) | BLOCKER |
```

And the matching "Resolved items"/blocker log line:

```
BLOCKER 2026-09-28 — evidence/B3-viroloji-blocker.md — viroloji fixture
unavailable locally (no file in either tree; README lacks the cited 2007-05-14
URL; no network allowed); structural test implemented and explicitly skipped;
all other B3 deliverables PASS.
```
