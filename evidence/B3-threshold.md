# B3 — Round-Bank Threshold Measurement (closes O16)

Task: B3 — Round Generation and Bank
Started: 2026-09-28T18:18:30Z (first artifact: `tools/build-rounds.mjs`)
Ended: 2026-09-28T18:24:10Z
Host+OS: dev-host.home / macOS (arm64 / arm64 host, Node v22.14.0)

Commands executed (exact):

```sh
node tools/build-rounds.mjs --measure > evidence/logs/B3-threshold.log 2>&1
# independent cross-check (raw trace in evidence/logs/B3-crosscheck.log):
#   node --input-type=module - <<'EOF' > "$TMP/js-totals2.txt"   (computeTotals over tools/wordlist.txt)
#   python3 - <<'EOF' > "$TMP/py-totals2.txt"                    (sub-multiset enumeration, Counter/defaultdict)
#   diff "$TMP/js-totals2.txt" "$TMP/py-totals2.txt"
#   for T in 10 15 20 25 30; do awk -F'\t' -v t=$T "$TMP/py-totals2.txt" | wc -l; done
#   shasum -a 256 "$TMP/js-totals2.txt" "$TMP/py-totals2.txt"
```

Exit codes: 0 for every command above (`diff` exit 0; both totals files share
SHA-256 `fcf9d570b0236722a8a76fd86fe5e1a723f4d4b2c1ee81ce3e0d8ff9ffd54f5e`).

Output summary: bank sizes measured for T ∈ {10,15,20,25,30} by the docs/06 §3
step-3 procedure; **selected T = 30** (largest T with bank ≥ 500 rounds; bank =
7,393 rounds). `tools/build-config.json` written with `thresholdT = 30` and
`thresholdEvidence = evidence/B3-threshold.md`. Independent Python
implementation reproduces all 9,107 candidate totals and every bank size.

Artifact SHA-256 hashes:
- `tools/wordlist.txt` (input) `ac9987ce0d07688ce5db913f5cb112efe0e035f227d908431350c2d96fde8758`
- `tools/build-rounds.mjs` `a10c1eeed3d6c0bab9b192f6f30e3fe3377807e6a320f3c75703ca704a5660d5`
- `tools/build-config.json` `48e48715d1012d95f8394f8ad20221a5ef3e5ba97a4a2c1e16199146a8095a7b`
- `evidence/logs/B3-threshold.log` `7e39c9ce2e3e6c7f7920fbf603e2db96259c56f76877eb58d0a093e5eef12196`
- `evidence/logs/B3-crosscheck.log` `e798f578fea0ce043e2ddba5e73dcb8656769a3a0ea85548b89dc65efa18c7c5`

Result: PASS

---

## 1. Procedure (docs/06 §3 step 3, applied exactly)

1. Candidates = all 8-letter words of `tools/wordlist.txt` (62,809 words,
   sha256 `ac9987ce…e8758`; B2 output): **9,107 candidates**.
2. Subword pool = all words with `3 ≤ len ≤ 7`: **22,772 words**.
3. For every candidate, total words = `|subwords whose multiset ⊆ candidate| + 1`
   (the main word itself, added to the `"8"` list only).
4. Bank size `bank(T)` = number of candidates with total ≥ T.
5. Rule: select the largest T of the measured set whose `bank(T) ≥ 500`; if none
   qualifies, select T = 10 and open a BLOCKER.

## 2. Measurement table

Raw output: `evidence/logs/B3-threshold.log`.

| T | candidates with total ≥ T (bank size) | bank ≥ 500? |
|---|---|---|
| 10 | 8,935 | yes |
| 15 | 8,638 | yes |
| 20 | 8,269 | yes |
| 25 | 7,834 | yes |
| 30 | 7,393 | yes |

Per-candidate total range: the totals span 1…268 words (minimum: `VIRVIRCI`
with no producible subword; maximum: `KEMALİST` with 268). The selected
threshold keeps every candidate with ≥ 30 words.

## 3. Selection

- Largest qualifying T: **30** → `bank(30) = 7,393 ≥ 500`.
- Written to `tools/build-config.json`:

```json
{
  "schemaVersion": 1,
  "thresholdT": 30,
  "thresholdEvidence": "evidence/B3-threshold.md",
  "selectionRule": "largest T of {10,15,20,25,30} whose bank size (rounds with total words 3-7 + main >= T) is >= 500 (docs/06 §3 step 3)",
  "wordlist": "tools/wordlist.txt",
  "wordlistSha256": "ac9987ce0d07688ce5db913f5cb112efe0e035f227d908431350c2d96fde8758",
  "output": "src/data/rounds.json"
}
```

The build tool fails fast (exit 1) if the config is missing/invalid or if the
pinned wordlist SHA-256 does not match — no silent drift, no partial output.

## 4. Independent cross-check

A second, structurally different implementation (Python: enumerate every letter
sub-multiset of a candidate and look it up in a sorted-signature index of the
3–7 pool) reproduces the algorithm without shared code:

- all 9,107 candidate totals are identical (files byte-equal, diff exit 0);
- the derived bank sizes reproduce the table exactly (8,935 / 8,638 / 8,269 /
  7,834 / 7,393);
- the tool itself is additionally cross-checked against the archived FİNALİZM
  round (28/41/17/4/0 + main, total 91) — see `evidence/B3-bank.md` §3.

Raw trace: `evidence/logs/B3-crosscheck.log`.

## 5. O16 closure proposal (for the orchestrator; B3 does not edit `docs/**`)

Single-writer rule: the two exact replacements below are proposed.

1. Table row `| O16 | … |` — replace the Status cell `OPEN` with:

   `RESOLVED — evidence/B3-threshold.md`

2. Append to the "Resolved items" list (one line):

   `RESOLVED 2026-09-28 — evidence/B3-threshold.md — Round-bank threshold measured per docs/06 §3: bank sizes T=10→8,935, T=15→8,638, T=20→8,269, T=25→7,834, T=30→7,393 rounds (9,107 candidates); selected T=30 (largest T with bank ≥ 500); written to tools/build-config.json; emitted bank src/data/rounds.json = 7,393 rounds, sha256 7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96.`
