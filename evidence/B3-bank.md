# B3 — Round Bank (`src/data/rounds.json`)

Task: B3 — Round Generation and Bank
Started: 2026-09-28T18:18:30Z (first artifact: `tools/build-rounds.mjs`)
Ended: 2026-09-28T18:30:20Z (viroloji fixture activated; bank build finished 18:24:10Z)
Host+OS: dev-host.home / macOS (arm64 / arm64 host, Node v22.14.0)

Commands executed (exact): §2 `node tools/build-rounds.mjs` (run 1/run 2,
redirected to `evidence/logs/B3-build-run{1,2}.log`); §4 `npx ajv-cli validate -s
data/rounds.schema.json -d src/data/rounds.json`, `node tools/build-rounds.mjs
--check`, `npm test -- fixtures`, `npm test`, `npx eslint tools/build-rounds.mjs
tests/rounds-fixtures.test.mjs`; §5 `node tools/build-rounds.mjs --out
"$TMP/run-a.json"` / `--out "$TMP/run-b.json"` + `cmp` ×2 + `shasum -a 256`.
Full shell traces: `evidence/logs/B3-verify.log`, `B3-v8.log`,
`B3-build-run1.log`, `B3-build-run2.log`, `B3-tests-fixtures.log`,
`B3-tests-full.log`, `B3-fixture-bytes.log`.

Exit codes: 0 for every command above (V3/V4/V8/V2 all green, including the
viroloji structural test after the orchestrator provided
`tests/fixtures/rounds/viroloji.xml` — see `evidence/B3-viroloji-blocker.md` §0).

Output summary: `src/data/rounds.json` — 7,393 rounds at the measured T = 30,
sorted by `main`, word arrays sorted, stable 2-space JSON with trailing newline;
12,257,523 bytes; two consecutive builds byte-identical (V8). Fixture suite:
**20/20 pass** (the viroloji structural check now runs on the
orchestrator-provided `tests/fixtures/rounds/viroloji.xml`; §3). Recorded
spec observation: the docs/06 §4 `id` rule collides for 33 round pairs in the
bank (45 pairs over all candidates); orchestrator decision (a) ACCEPT duplicate
slugs — docs/06 §4 amendment by the orchestrator; §6.

Artifact SHA-256 hashes:

| Artifact | SHA-256 |
|---|---|
| `src/data/rounds.json` | `7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96` |
| `tools/build-rounds.mjs` | `a10c1eeed3d6c0bab9b192f6f30e3fe3377807e6a320f3c75703ca704a5660d5` |
| `tools/build-config.json` | `48e48715d1012d95f8394f8ad20221a5ef3e5ba97a4a2c1e16199146a8095a7b` |
| `tests/rounds-fixtures.test.mjs` | `8fe7703e71fc036bacc56a48c6a8434b712320fbc0ae296378b35e923c01a60b` |
| input `tools/wordlist.txt` (B2) | `ac9987ce0d07688ce5db913f5cb112efe0e035f227d908431350c2d96fde8758` |
| `evidence/logs/B3-build-run1.log` | `ebaf3ae77d90fbd508c4f612ea5e6cd58fae9cff116b69e42f7595ed2c58f93a` |
| `evidence/logs/B3-build-run2.log` | `e431283a4df00a753760b86e57ba5f1bd4c34168ab8fd24adf9a64710b46bfa7` |
| `evidence/logs/B3-verify.log` | `6b37653cf3102fa66300044ce77c216865ded60dca98d691ff1b7df44091c445` |
| `evidence/logs/B3-v8.log` | `0352f02249038f60949411e6029ac2b0f39e6927e56aed4c7196d79efd5f3563` |
| `evidence/logs/B3-tests-fixtures.log` | `7a6b27f5f809cb5f0adb8b397582899bd6db1d57d0407c9943a24f0b51da9696` (follow-up re-run; 20/20 pass) |
| `evidence/logs/B3-tests-full.log` | `ea23c2cddba6cd58b0c5642189c671969b560eb337104a6112f3bbfead882f3a` (follow-up re-run; 97/97 pass) |
| `evidence/logs/B3-viroloji-fixture.log` | `8204c72cd6fb950d5b57c3c0ee17be1094931cd09355b0bfd6abee77b6628d43` (viroloji byte-wise format record) |
| `evidence/logs/B3-fixture-bytes.log` | `4f9facced7bc4cc9e7bcb5e09e9da2e801935127605cf2d586dd94bec4a40385` |
| `evidence/logs/B3-crosscheck.log` | `e798f578fea0ce043e2ddba5e73dcb8656769a3a0ea85548b89dc65efa18c7c5` |
| `evidence/logs/B3-threshold.log` | `7e39c9ce2e3e6c7f7920fbf603e2db96259c56f76877eb58d0a093e5eef12196` |

Result: PASS (all steps, including the viroloji fixture structural check after
the orchestrator provided `tests/fixtures/rounds/viroloji.xml` on 2026-09-28;
resolution recorded in `evidence/B3-viroloji-blocker.md` §0).

---

## 1. Build (docs/06 §3, exact)

`tools/build-rounds.mjs` implements the algorithm exactly:

- candidates = 8-letter words (9,107);
- subwords = 3–7-letter words whose letter multiset is contained in the
  candidate's multiset;
- `"8"` list contains only the candidate itself;
- round validity = `(3–7 list + main) ≥ T`, `T` read from
  `tools/build-config.json` (30, chosen in `evidence/B3-threshold.md`);
- output sorted by `main` (code-point order), word arrays sorted
  (collected in the code-point-sorted wordlist), 2-space indent, LF, trailing
  newline;
- `id` = docs/06 §4 transliteration (Turkish lower case + `ID_TRANSLITERATION`
  table, unit-tested in `tests/rounds-fixtures.test.mjs`).

`letters` decision (recorded; docs/06 §4 leaves the order unspecified,
docs/05 §2 calls the field "multiset of main word letters"): `letters` = the
letters of `main` **in main-word order** — the original client's tile-creation
order (`enbuyukkelime` characters, then shuffle) and a fully deterministic
choice. Consumers may sort if they need a canonical bag.

Build log (`evidence/logs/B3-build-run1.log`, exit 0):

```
[B3] wordlist: tools/wordlist.txt (62809 words, sha256=ac9987ce0d07688ce5db913f5cb112efe0e035f227d908431350c2d96fde8758)
[B3] batch: candidates(length 8)=9107 subwords(3..7)=22772
[B3] config: tools/build-config.json thresholdT=30 evidence=evidence/B3-threshold.md
[B3] rounds: 7393 (total words per round >= 30)
[B3] words length 3: total=149345 distinct=757
[B3] words length 4: total=178376 distinct=2053
[B3] words length 5: total=122758 distinct=5195
[B3] words length 6: total=37801 distinct=4581
[B3] words length 7: total=14571 distinct=3912
[B3] words length 8: total=7393 distinct=7393
[B3] words per round: min=30 max=268 mean=69.02
[B3] output: src/data/rounds.json (12257523 bytes, sha256=7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96)
```

| Metric | Value |
|---|---|
| Rounds | 7,393 |
| Chosen T | 30 |
| Words total per length (3/4/5/6/7/8) | 149,345 / 178,376 / 122,758 / 37,801 / 14,571 / 7,393 |
| Distinct words per length (3/4/5/6/7/8) | 757 / 2,053 / 5,195 / 4,581 / 3,912 / 7,393 |
| Words per round | min 30, max 268, mean 69.02 |
| Output | `src/data/rounds.json`, 12,257,523 bytes, sha256 `7e4e149b…b9a96` |

First bank round: `ABACILIK` (id `abacilik`, 53 words); last: `ŞİŞİRTME`
(id `sisirtme`; `Ş` sorts after `Z` in code-point order). Spot check of the
FİNALİZM round: id `finalizm`, letters `FİNALİZM`, words 3..8 =
28/41/17/4/0/1; `words` keys in schema order `3,4,5,6,7,8`; round keys
`id,main,letters,words` (no extra fields).

## 2. Fixture findings (byte-wise; raw logs `evidence/logs/B3-fixture-bytes.log`, `evidence/logs/B3-viroloji-fixture.log`)

| Fixture | File | `file` says | SHA-256 | Main | 3/4/5/6/7 counts |
|---|---|---|---|---|---|
| finalizm | `../kelimator-nostalji/calistir/xml.php` | ISO-8859 text | `854b7287c2e6878938671b7490f908605b9986ba28f4abe6f0eb2a62af3c2bed` | `FİNALİZM` | 28/41/17/4/0 (total 91 with main) |
| finalizm (copy) | `../kelimator-nostalji/calistir/xml64.php` | ISO-8859 text | `854b7287…c2bed` (byte-identical to `xml.php`) | `FİNALİZM` | 28/41/17/4/0 |
| leavings | `../kelimator-nostalji/calistir/xml_eng.php` | ASCII text | `ba36b137fde8a4363e4435c0c48fc257fcbb1ac684e244b2062abc6140be7da8` | `LEAVINGS` | 19/41/24/8/0 (total 93 with main) |
| viroloji (orchestrator-provided 2026-09-28) | `tests/fixtures/rounds/viroloji.xml` | ISO-8859 text | `594e6a5377fbe8edef05f93850ac9eea4fc50c25fd5e6e9facf33186d4cd8621` | `VİROLOJİ` | 4/1/0/0/0 (total 6 with main) |
| archived dictionary | `../kelimator-nostalji/kayitlar/sozluk_29749_kelime.xml` | XML 1.0, ISO-8859 | `558269a0fa7de05e90e96d62f583dcbb1c4a95510a0e7fe360629ffa40f47f00` | — | 29,749 `<li>` entries |

Viroloji format (same family as the other fixtures; raw log
`evidence/logs/B3-viroloji-fixture.log`): root `<kelimeler>`, one
`<kelime harf="N">` per length with a single `<txt>` value holding
**comma-separated words** (empty `<txt>` for an empty list), `harf="8"` = the
main word, `harf="9999"` = the raw checksum entry
(`5eaa5927c04aeaeec8409860bbb21460`), ISO-8859-9 (`0xDD` = `İ`; main bytes
`56 DD 52 4F 4C 4F 4A DD`), 559 B, no Base64.

Byte-wise record (xxd): `xml.php` stores `<txt>F\xddNAL\xddZM</txt>` —
`0x46 0xDD 0x4E 0x41 0x4C 0xDD 0x5A 0x4D` = `FİNALİZM` in **ISO-8859-9**
(0xDD = `İ`). The archive is plain text; the `harf="9999"` checksum entry
`19c4701ab499f750987eebe0bff07f9c` is present in `xml.php`/`xml64.php` and
absent from `xml_eng.php`. Collation: the FİNALİZM lists 3/4/5 are **not**
code-point sorted (they use Turkish-alphabet collation, e.g. `İ…` before `Z…`);
the LEAVINGS lists are code-point sorted. Sortedness is not part of the
docs/06 §5 structural checks; the emitted bank uses code-point order (B2 basis).

**Wire-form decision (recorded):** B3 parses the archived fixtures as they
actually are (plain ISO-8859-9) and performs **no re-encoding**. No B3 fixture
check requires the 2012 Base64(UTF-8) wire form (the C3 harness owns that
fixture: `verify/reference/fixtures/xml64.base64.php`). Cross-check of the
list sizes against the C3 fixture record (`verify/reference/fixtures/fixture-meta.json`)
matches exactly: harf 8→1, 3→28, 4→41, 5→17, 6→4, 7→0 words.

## 3. Fixture tests (docs/06 §5; raw output `evidence/logs/B3-tests-fixtures.log`)

`npm test -- fixtures` — exit 0; **20 tests: 20 passed, 0 skipped**
(viroloji included; resolution in `evidence/B3-viroloji-blocker.md` §0).

- **finalizm structural** (`../kelimator-nostalji/calistir/xml.php` used; the
  canonical `tests/fixtures/rounds/finalizm.xml` does not exist):
  all words 3–8 letters; every word's multiset ⊂ `FİNALİZM`'s; main word
  present; no duplicates; `xml.php` = `xml64.php` byte-identical; plain-text
  `0xDD`-byte check asserted.
- **finalizm enumeration** (archived dictionary normalized per docs/06 §2:
  29,749 raw / 27,856 unique raw / **27,814 normalized**; 11 entry instances
  dropped by casing+charset+shape, 32 removed by `data/blocklist.txt`):
  90 fixture subwords, **83 in the dictionary, 83 producible, 0 exceptions**;
  **7 dictionary gaps** recorded (not silenced): `ALİ, FAN, LAN, LİM, AMİN,
  İZAN, ZİFİN`.
- **finalizm bank round** (additional enumeration check against the production
  wordlist): generated 90 words; 89 archived words present in
  `tools/wordlist.txt`; **missing 0**; 1 word added since 2007 (`ZİLİ`) — the
  opposite-direction delta recorded (the 2007-only word `İLMİ` is absent from
  the current TDK snapshot).
- **leavings structural** (`xml_eng.php`): all checks pass; 19/41/24/8/0.
  No dictionary cross-check (English out of scope, docs/06 §5).
- **viroloji structural** (`tests/fixtures/rounds/viroloji.xml`, provided by the
  orchestrator 2026-09-28; sha256 `594e6a5377…8621`): all checks pass; main
  `VİROLOJİ`, counts 3/4/5/6/7 = 4/1/0/0/0 (`LOR,LİR,ROL,İRİ`, `VOLİ`); same
  plain ISO-8859-9 comma-separated `<txt>` format as the other fixtures.
- **id transliteration table** (docs/06 §4): all 29 core letters mapped through
  Turkish lower case + ASCII fold (`I→ı→i`, `İ→i`, `Ç→c`, `Ğ→g`, `Ö→o`,
  `Ş→s`, `Ü→u`); `FİNALİZM → finalizm`, `LEAVINGS → leavings`; table emits only
  `[a-z0-9-]`; unknown characters throw.
- **bank invariants**: `schemaVersion 1`; every `main` length 8 and every
  `letters` length 8 (V2); letters multiset = main multiset; `"8"` list = main
  only; word arrays strictly sorted; every total ≥ configured T; rounds sorted
  by `main`; `id = roundId(main)`.

## 4. Verify results

| Check | Command | Result |
|---|---|---|
| V3 | `npx ajv-cli validate -s data/rounds.schema.json -d src/data/rounds.json` | `src/data/rounds.json valid`, exit 0 |
| V2 | `node tools/build-rounds.mjs --check` | all invariants hold, exit 0 |
| V2 (explicit) | Python: `len(main) == 8` and `len(letters) == 8` on all 7,393 rounds | main min/max 8/8, letters min/max 8/8, **0 violations** each; T compliance 0 violations |
| V4 | `npm test -- fixtures` | 20 passed, 0 skipped, exit 0 |
| V4 (full) | `npm test` | 7 files, 97 passed, 0 skipped, exit 0 |
| lint | `npx eslint tools/build-rounds.mjs tests/rounds-fixtures.test.mjs` | exit 0 |
| format | Python: `json.dumps(load(file), indent=2, ensure_ascii=False) + "\n" == file` | `True` (no CR, no tab, LF, trailing newline) |

## 5. Idempotency (V8)

Raw log: `evidence/logs/B3-v8.log` (exit 0).

```sh
node tools/build-rounds.mjs --out "$TMP/run-a.json"   # exit 0
node tools/build-rounds.mjs --out "$TMP/run-b.json"   # exit 0
cmp "$TMP/run-a.json" "$TMP/run-b.json"               # exit 0
cmp src/data/rounds.json "$TMP/run-a.json"            # exit 0
shasum -a 256 ...   # all three files: 7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96
```

Run 1 and run 2 are byte-identical and identical to the committed artifact.

## 6. Recorded spec observation — `id` collisions (orchestrator decision (a): ACCEPT)

The docs/06 §4 rule ("lowercased main word with Turkish casing applied then
transliterated to `[a-z0-9-]`") folds distinct Turkish letters onto one ASCII
letter (`I/İ→i`, `C/Ç→c`, `G/Ğ→g`, `O/Ö→o`, `S/Ş→s`, `U/Ü→u`), so distinct main
words can share an `id`. Measured: **45 colliding pairs over all 9,107
candidates; 33 colliding pairs within the emitted bank** (7,393 rounds). The
frozen schema does not require unique `id`s, docs/06 §4 defines no
disambiguation, and sequential round loading is unaffected — B3 therefore
emitted the literal result of the documented rule and **did not invent a
suffix**. Bank collisions (also logged by the tool and the tests):

```
asabilme <- ASABİLME, AŞABİLME       asilanma <- ASILANMA, AŞILANMA
asiverme <- ASIVERME, AŞIVERME       astirmak <- ASTIRMAK, AŞTIRMAK
bahsedis <- BAHSEDİŞ, BAHŞEDİŞ       bahsetme <- BAHSETME, BAHŞETME
beslemek <- BESLEMEK, BEŞLEMEK       estirmek <- ESTİRMEK, EŞTİRMEK
fislamak <- FISLAMAK, FIŞLAMAK       hafizali <- HAFIZALI, HAFIZALİ
kasinmak <- KASINMAK, KAŞINMAK       munakasa <- MÜNAKASA, MÜNAKAŞA
mutevazi <- MÜTEVAZI, MÜTEVAZİ       nakislik <- NAKISLIK, NAKIŞLIK
sadiklik <- SADIKLIK, SADİKLİK       suratsiz <- SURATSIZ, SÜRATSİZ
taharrus <- TAHARRÜS, TAHARRÜŞ       taslamak <- TASLAMAK, TAŞLAMAK
taslatma <- TASLATMA, TAŞLATMA       yaslanis <- YASLANIŞ, YAŞLANIŞ
yaslanma <- YASLANMA, YAŞLANMA       yaslilik <- YASLILIK, YAŞLILIK
islenmek <- İSLENMEK, İŞLENMEK      saklamak <- SAKLAMAK, ŞAKLAMAK
saklatma <- SAKLATMA, ŞAKLATMA       saklayis <- SAKLAYIŞ, ŞAKLAYIŞ
samanlik <- SAMANLIK, ŞAMANLIK       saplamak <- SAPLAMAK, ŞAPLAMAK
saplatma <- SAPLATMA, ŞAPLATMA       siklasma <- SIKLAŞMA, ŞIKLAŞMA
sirlamak <- SIRLAMAK, ŞIRLAMAK       sislemek <- SİSLEMEK, ŞİŞLEMEK
sislenme <- SİSLENME, ŞİŞLENME
```

Options considered (both require a dated `docs/06` §4 amendment; none applied
by B3):

- **(a) accept** duplicate slugs (spec as written; consumers must not assume
  uniqueness), or
- **(b) disambiguate** colliding ids with a documented deterministic suffix and
  rebuild `src/data/rounds.json` (this changes the artifact hash and the
  ids of 66 rounds; D1/E2/F2 consumers would need the amended rule).

**Orchestrator decision (2026-09-28): option (a) ACCEPT duplicate slugs** —
`docs/06` §4 is being amended accordingly by the orchestrator; no artifact
change, no suffix, `src/data/rounds.json` unchanged
(`7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96`).

Proposed `docs/08` entry (orchestrator transcribes; single-writer rule) —
orchestrator decision (a), 2026-09-28:

```
RESOLVED 2026-09-28 — evidence/B3-bank.md §6 — docs/06 §4 id rule folds
I/İ, C/Ç, G/Ğ, O/Ö, S/Ş, U/Ü: 45 colliding pairs over all 8-letter candidates,
33 within the emitted bank. Orchestrator decision: option (a) ACCEPT duplicate
slugs (the frozen schema requires no uniqueness; sequential round loading is
unaffected); docs/06 §4 amended accordingly; no artifact change.
```
