# B2 — Word List Normalization and Filtering — Evidence

**Task:** B2 — Word List Normalization and Filtering
**Started:** 2026-09-28T17:53:48Z (first artifact written; session began earlier the same hour)
**Ended:** 2026-09-28T18:06:41Z (follow-up amendment applied: GFGF/SFSFS exclusions)
**Host+OS:** dev-host.home / macOS

**Commands executed (exact):** see §3.1, §4.1, §5.1; the normalization command and the
test commands are quoted verbatim, and the full V2/V1/V8 check commands (with their
exact quoting) are recorded in `evidence/logs/B2-verify.log` via shell `set -x`. Raw
outputs are in `evidence/logs/B2-*.log`.
**Exit codes:** 0 for every command listed below (normalizer runs, V2/V1/V8 checks,
`npm test -- normalize`, full `npm test`, `npx eslint` on the two new files).
**Output summary:** `tools/wordlist.txt` = 62,809 words, produced deterministically
from the 63,967-word B1 snapshot by the docs/06 §2 pipeline (casing → 29-letter
charset → shape ≥ 3 → dedup → blocklist); the 55-entry `data/blocklist.txt` (53
offensive terms + the 2 fixture exclusions decided by the orchestrator on 2026-09-28)
removed 55 words; two independent runs are byte-identical (V8); the output contains
only the 29 core Turkish letters, is sorted, duplicate-free and LF-terminated (V2).
**Artifact SHA-256 hashes:** see §6 table.
**Result: PASS**

---

## 1. Scope and inputs

- Spec applied: `docs/06-dictionary-and-rounds.md` §2 (steps 1–5), exactly; no
  additional filter was invented (entry-type findings and decisions: see
  `evidence/B2-filters.md`, closes O17).
- Input: `artifacts/tdk/headwords.txt` — 63,967 lines, sha256
  `79ad954e569e806b230a82582f1b4e6167faf6a78163d93db9982b325a6a9a89` (re-hashed
  during this task; equals the B1-recorded value in `evidence/B1-acquisition.md`).
- Blocklist input: `data/blocklist.txt` (created here; amended 2026-09-28 with two
  fixture exclusions), sha256
  `2094d3b09a90ef5ca4f3750c4800f55f3ef659ae472db5d3294cadcfdfc58b0a`, 55 entries
  (53 offensive terms + `GFGF`/`SFSFS`); per-entry basis table in
  `evidence/B2-filters.md` §3.
- Owner directive 2026-09-28 carried by the B1 artifact: `abartmasız` and
  `karzıhasen` are 10 letters and can never enter gameplay; they are absent from
  the B1 output (letters-only bundle/sitemap source) and are neither re-added nor
  questioned here.

## 2. Implementation

`tools/normalize-wordlist.mjs` (committed; sha256
`3d3577b58bfdf21465d4f047bc6c37052fe1ceeef85b6535be4b6d23476f0df9`):

1. **Casing** — explicit, ICU-independent Turkish mapping for the 29 core letters
   plus `â→Â, î→Î, û→Û` (`i → İ`, `ı → I`); display form = comparison form.
   Characters outside the map cannot survive the charset step, so the kept set is
   identical to `toLocaleUpperCase('tr')` (verified in §4).
2. **Charset** — keep only words whose characters are all in the 29-letter set
   `A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z`; anything else
   (circumflex forms, punctuation, whitespace, digits, other letters) drops the
   word entirely.
3. **Shape** — single token (implied by step 2), length ≥ 3.
4. **Dedup** — display-form duplicates after casing are collapsed
   (step 1 merges `Akrep`/`akrep` → `AKREP`).
5. **Blocklist** — exact-match removal of `data/blocklist.txt` entries.
6. **Output** — sorted by Unicode code point (= UTF-8 byte order, same basis as
   the B1 input), one word per line, LF, UTF-8.

Exit code 0 only on a clean run; a malformed blocklist entry aborts with a
non-zero exit (no silent no-op). Unmatched blocklist entries are reported as a
warning line (none occurred; see run log).

## 3. Per-step counts (docs/06 §2)

### 3.1 Command

```sh
node tools/normalize-wordlist.mjs > evidence/logs/B2-normalize-run1.log 2>&1   # exit 0
```

### 3.2 Counts (identical in run 2)

| Step (docs/06 §2) | Words | Delta | Note |
|---|---|---|---|
| input lines | 63,967 | — | `artifacts/tdk/headwords.txt` |
| 1. after casing | 63,967 | 0 | casing never drops |
| 2. after charset | 63,156 | −811 | 810 words with circumflex (â/î/û/Â/Î/Û) + `dswwee` (contains `w`) |
| 3. after shape (length ≥ 3) | 62,918 | −238 | token instances of length 1–2 (`a`, `ab`, …) |
| unique after dedup | 62,864 | −54 | 54 display-form collision keys (`Akrep`/`akrep` → `AKREP`, …) |
| 4. removed by blocklist | −55 | −55 | all 55 `data/blocklist.txt` entries matched and were removed (53 offensive terms + `GFGF`/`SFSFS`) |
| 5. output words | **62,809** | 62,864 − 55 | `tools/wordlist.txt` |

## 4. Casing equivalence check (explicit table vs `toLocaleUpperCase('tr')`)

### 4.1 Command

```sh
node --input-type=module - <<'EOF' > evidence/logs/B2-casing-equivalence.log 2>&1
# imports tools/normalize-wordlist.mjs, compares turkishUpperCase(line) with
# line.toLocaleUpperCase('tr') for all 63,967 input lines; see log for full output
EOF
```

### 4.2 Result (from `evidence/logs/B2-casing-equivalence.log`)

- `toLocaleUpperCase('tr')`: `i → İ`, `ı → I` (Node v22.14.0, full ICU).
- 1 difference over all 63,967 input lines: `dswwee` → `DSwwEE` (explicit table)
  vs `DSWWEE` (ICU); both are dropped by the charset step (`w` is not a core
  letter).
- **0 differences on the kept set** (all-core, length ≥ 3): the implemented table
  and `toLocaleUpperCase('tr')` produce identical kept words.
- Spot checks: `normalizeWord('kâse') = null` (circumflex dropped),
  `'iyi' → 'İYİ'`, `'ırmak' → 'IRMAK'`, `'kişi' → 'KİŞİ'`, `'k-t'`/`'k t'`/`'ab'`
  → null.

## 5. Verification results

### 5.1 V2 / V1 / V8 (raw log: `evidence/logs/B2-verify.log`)

```sh
wc -l tools/wordlist.txt; wc -c tools/wordlist.txt; file tools/wordlist.txt
LC_ALL=C sort -c tools/wordlist.txt
LC_ALL=C sort -u tools/wordlist.txt | wc -l
LC_ALL=C uniq -d tools/wordlist.txt | wc -l
shasum -a 256 artifacts/tdk/headwords.txt data/blocklist.txt tools/wordlist.txt tools/normalize-wordlist.mjs
python3 -c '…exact regex ^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$ over every line…'
```

| Check | Expected | Result |
|---|---|---|
| V2 output exists | yes | `tools/wordlist.txt`, UTF-8, LF |
| V2 line count > 10,000 | yes | **62,809** (`wc -l`), 686,509 bytes |
| V2 every line matches `^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$` | yes | **0 non-matching lines** (Python `re.fullmatch` on all 62,809 lines; alphabet printed = 29 letters) |
| V2 no duplicates | yes | `sort -u \| wc -l` = 62,809; `uniq -d` = 0; strict set comparison = 0 duplicates |
| V2 sorted | yes | `LC_ALL=C sort -c` exit 0; code-point-sorted = true |
| V2 shape | length ≥ 3 | min length 3, max length 25 |
| V2 blocklist applied | none present | `blocklist ∩ wordlist` = ∅ (55 entries) |
| V2 fixture exclusions absent | `GFGF`, `SFSFS` gone | `fixture_words_present: []` in `B2-verify.log` |
| V1 output SHA-256 recorded | — | `ac9987ce0d07688ce5db913f5cb112efe0e035f227d908431350c2d96fde8758` |
| V8 rerun identical | same hash | run 1 = run 2 = `ac9987c…e8758`; run logs byte-identical (`b8c1838a…ccfc`) |

### 5.2 V4 — unit tests (raw logs: `evidence/logs/B2-tests-normalize.log`, `B2-tests-full.log`)

```sh
npm test -- normalize      # exit 0: tests/normalize-wordlist.test.mjs — 19 tests passed
npm test                   # exit 0: 6 files, 77 tests passed (0 failed)
npx eslint tools/normalize-wordlist.mjs tests/normalize-wordlist.test.mjs   # exit 0
```

Covers the named cases: casing (`i→İ`, `ı→I`, mixed), circumflex rejection
(`KÂSE`/`kâse`/`kîtap` dropped), punctuation/whitespace/digit rejection, length
rejection, blocklist application, dedup + sort, blocklist format validation, the
explicit removal of the fixture exclusions `GFGF`/`SFSFS`, and the V2 format of the
committed artifacts (> 10,000 lines, 29-letter alphabet, strictly sorted, no
blocklisted word present).

## 6. Artifact SHA-256 hashes

| Artifact | SHA-256 |
|---|---|
| `tools/wordlist.txt` | `ac9987ce0d07688ce5db913f5cb112efe0e035f227d908431350c2d96fde8758` |
| `data/blocklist.txt` | `2094d3b09a90ef5ca4f3750c4800f55f3ef659ae472db5d3294cadcfdfc58b0a` |
| `tools/normalize-wordlist.mjs` | `3d3577b58bfdf21465d4f047bc6c37052fe1ceeef85b6535be4b6d23476f0df9` |
| `tests/normalize-wordlist.test.mjs` | `91a1b7c879897419685f247fa894f3649ce860836521ed51bad83490a7d10743` |
| `evidence/logs/B2-normalize-run1.log` | `b8c1838aa01e78b08a59257f7e5e0aa49b5f9364ae864d1440e8998381a4ccfc` |
| `evidence/logs/B2-normalize-run2.log` | `b8c1838aa01e78b08a59257f7e5e0aa49b5f9364ae864d1440e8998381a4ccfc` |
| `evidence/logs/B2-verify.log` | `67190ad698eb9c487cd7609f469dee6efcec8da745b80f877b67399bea7afe53` |
| `evidence/logs/B2-casing-equivalence.log` | `b95bc31bae6aaec956c117f3b0e44c102411e4ecbed8a0aafc7b44ce5ac2d171` |
| `evidence/logs/B2-entry-types.log` | `208b5c0984e68977e2820f67e2959d8874923da256461a555add498c4cef865b` |
| `evidence/logs/B2-tests-normalize.log` | `9f5abd73e55a6cbe79661c9d2565638e19465e9eda69ae30ecf7a7a2fb672be5` |
| `evidence/logs/B2-tests-full.log` | `4b95055b1ce45efbbf63db8e5a959eba25a7bdb7a57e74df45ca14cbb813b73a` |
| input `artifacts/tdk/headwords.txt` (B1) | `79ad954e569e806b230a82582f1b4e6167faf6a78163d93db9982b325a6a9a89` |

## 7. Notes and decisions

- **Sort basis:** Unicode code-point order, which equals UTF-8 byte order for
  every word in the output (all characters are BMP); this is the same order as
  the B1 input. Under this basis `İ` (U+0130) sorts after `Z` (U+005A).
- **Display = comparison:** after step 1 the game's display form and the
  comparison form are one and the same upper-case word (docs/06 §2.1).
- **Casing step never drops words**; charset and shape drops are itemized in §3.2.
- **Blocklist matched exactly:** the tool prints a warning for unmatched entries;
  the log shows none, i.e. all 55 entries removed an existing word (53 offensive
  terms + the two non-lexical fixture exclusions `GFGF`/`SFSFS`).
- **Follow-up amendment (2026-09-28, orchestrator decision):** `GFGF` and `SFSFS`
  — non-lexical site-bundle test fixtures found in this task's §4.3 finding — are
  excluded via `data/blocklist.txt` (content-level entries, no new filter rule in
  the normalizer). Counts and hashes in this file are post-amendment.
- **Entry-type findings** (proper nouns, letter-only abbreviations, phrases,
  circumflex forms, case-distinct homographs, non-lexical bundle artifacts) and
  the applied/not-applied filter decisions are in `evidence/B2-filters.md` (§3.5
  for the `GFGF`/`SFSFS` basis); that file also contains the O17 closure proposal
  for the orchestrator to transcribe into `docs/08-open-items.md` (this worker
  does not edit `docs/**`).
