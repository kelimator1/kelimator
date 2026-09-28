# 06 — Dictionary and Round Generation

Goal: build the game's round bank at build time from a current TDK headword
snapshot, with deterministic rules and no runtime dictionary lookup.

---

## 1. Source acquisition (task B1)

- Source: TDK Güncel Türkçe Sözlük headwords on `sozluk.gov.tr`.
- Procedure (empirical; the exact method that works is recorded):
  1. Probe the site's search endpoint with known substrings; record the
     response JSON shape and whether exhaustive enumeration via substring
     probing is possible (result caps, pagination).
  2. If exhaustive enumeration is feasible: iterate substring probes with
     polite rate limiting (minimum 1 request per second), collect unique
     headwords, and cache every raw response under `artifacts/tdk/`.
  3. If not feasible: record findings and open a BLOCKER item. Do not switch
     sources silently.
- Snapshot: write the collected headword list to `artifacts/tdk/headwords.txt`,
  sorted, one word per line; record file SHA-256 in evidence.
- Cross-check source (fixture only, not authority):
  `../kelimator-nostalji/kayitlar/sozluk_29749_kelime.xml` (archived site
  dictionary, 29,749 entries). Record overlap statistics against the snapshot.

## 2. Normalization and filtering (task B2)

Deterministic pipeline from `headwords.txt` to `tools/wordlist.txt`:

1. **Casing**: normalize to upper case using Turkish rules
   (`toLocaleUpperCase('tr')` semantics: `i → İ`, `ı → I`). Store display
   form; comparison form is the same (this game displays upper case).
2. **Charset policy** (fixed decision): keep only words consisting of the
   29 core Turkish letters `A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z`.
   Drop any word containing `Â Û Î ^ ' - .` (period), digits, whitespace, or any
   other character. (Removes circumflex forms and multi-word entries.)
3. **Shape filters**: single token; length ≥ 3; no leading/trailing punctuation
   (already covered by step 2).
4. **Blocklist**: `data/blocklist.txt` (created in B2) — explicit list of
   offensive/undesired entries. Initial content is decided by the maintainer
   during B2 and committed; additions are recorded amendments.
5. Output sorted, deduplicated; counts per step recorded in evidence.

## 3. Round generation (task B3)

Algorithm (deterministic):

1. Candidates: all words of length 8 from `tools/wordlist.txt`.
2. For each candidate C (letter multiset M):
   - Subwords: every dictionary word W with `3 ≤ len(W) ≤ 7` whose letter
     multiset is contained in M.
   - Main word: C itself (length-8 list contains only C — matches fixtures).
3. Round validity: total words (3–7 list + main) ≥ **T**, where T is chosen by
   a measurement procedure, not assumed:
   - Generate banks for candidate thresholds T ∈ {10, 15, 20, 25, 30}.
   - Record bank sizes in evidence.
   - Select the largest T whose bank size is ≥ 500 rounds. If none qualifies,
     select T = 10 and record a BLOCKER item for review.
   - Store the chosen T in `tools/build-config.json` with its evidence path.
4. Output `src/data/rounds.json`:
   - Sorted by `main` (deterministic).
   - `words` arrays sorted lexicographically.
   - Stable JSON formatting (2-space indent, `\n` line endings) for V8.
5. Record: total rounds, T, per-length word count stats, output SHA-256.

## 4. Frozen schema (canonical; created verbatim by C1)

`data/rounds.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Kelimatör rounds",
  "type": "object",
  "required": ["schemaVersion", "rounds"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "rounds": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "main", "letters", "words"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "main": { "type": "string", "minLength": 8, "maxLength": 8 },
          "letters": {
            "type": "array", "minItems": 8, "maxItems": 8,
            "items": { "type": "string", "minLength": 1, "maxLength": 1 }
          },
          "words": {
            "type": "object",
            "required": ["3", "4", "5", "6", "7", "8"],
            "additionalProperties": false,
            "properties": {
              "3": { "type": "array", "items": { "type": "string" } },
              "4": { "type": "array", "items": { "type": "string" } },
              "5": { "type": "array", "items": { "type": "string" } },
              "6": { "type": "array", "items": { "type": "string" } },
              "7": { "type": "array", "items": { "type": "string" } },
              "8": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    }
  }
}
```

`id` = lowercased main word with Turkish casing applied then transliterated to
`[a-z0-9-]` (transliteration table lives in `tools/` and is recorded).

## 5. Golden fixtures (algorithm verification)

Fixtures under `tests/fixtures/rounds/`:

| Fixture | Source | Test |
|---|---|---|
| `finalizm.xml` | `../kelimator-nostalji/calistir/xml.php` (archived) | Structural: all words 3–8 letters; every word's multiset ⊂ main multiset; main word present; no duplicates |
| `leavings.xml` | `../kelimator-nostalji/calistir/xml_eng.php` (archived) | Same structural checks (no dictionary cross-check; English out of scope) |
| `viroloji.xml` | Wayback: `xml.php` capture 2007-05-14 (URL in `../kelimator-nostalji/README.md`) | Same structural checks |

Additional fixture test with the archived site dictionary
(`sozluk_29749_kelime.xml` normalized per §2):

- For fixture `finalizm.xml`: every archived subword that exists in the
  archived dictionary must be producible by the algorithm from FİNALİZM's
  letters; record any word that is not (expected only for dictionary gaps).
- This test validates the **enumeration algorithm**, not the original server's
  dictionary (which is not preserved).

## 6. Idempotency (V8)

- Re-running B3 on the same `wordlist.txt` and `build-config.json` must produce
  a byte-identical `rounds.json` (record both SHA-256s).

## 7. Open questions

See `docs/08-open-items.md` — items O16 (threshold measurement), O17 (entry-type
filters discovered in B1/B2).
