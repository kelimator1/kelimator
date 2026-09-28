# C3 — Fixture format: archived xml64.php vs the 2012 Base64 protocol

Task: C3 — Reference Harness (Ruffle Web + Static Fixtures)
Started: 2026-09-28T13:36:05Z (probe that measured the fixture decoding)
Ended: 2026-09-28T14:46:00Z (reconstruction + final two-run matrix verified)
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)

Commands executed (exact; all exit 0 unless noted):
- `node verify/reference/make-fixture.mjs` (writes `verify/reference/fixtures/xml64.base64.php` + `fixture-meta.json`)
- `node verify/reference/make-fixture.mjs --check` (idempotency; exit 0)
- `node verify/reference/capture.mjs --runs 2` (matrix re-run on the derived fixture)
- `node verify/reference/check.mjs` (includes the `V1fixture` round-trip/structure check)
- `shasum -a 256 ../kelimator-nostalji/calistir/xml64.php` (input unchanged)
- `curl -sS "http://web.archive.org/cdx/search/cdx?url=games.lg.web.tr/kelimator/xml64.php&output=json&limit=40"` (archive probe)

Exit codes: 0 (all; the pre-resolution `check.mjs` exit 1 on the incomplete
validation tree is the only non-zero intermediate run and is superseded).

Output summary: the archived round data is transported to the 2012 client as a
deterministic Base64(UTF-8) re-encoding (`fixtures/xml64.base64.php`), so the
board loads with 8 letter tiles, S5–S8 are reachable, and the reference flow
through all-found, its return path and a fresh round is captured.

Artifact SHA-256 hashes (fixture pipeline):
- input (archived, unmodified) `../kelimator-nostalji/calistir/xml64.php` `854b7287c2e6878938671b7490f908605b9986ba28f4abe6f0eb2a62af3c2bed`
- script `verify/reference/make-fixture.mjs` `e4f5198a1ddd94eceeb20639a41855a2bb385e75782e169a5768205272007788`
- output `verify/reference/fixtures/xml64.base64.php` `80506d3ef3b58a4d8fdb5779debd4819271d57a5635276963a5d01eab91cd8bf`
- record `verify/reference/fixtures/fixture-meta.json` (input/script/output hashes + per-entry transform table)
- codec `verify/reference/swf-codec.mjs` (SWF decoder port used by the round-trip check)
- reference SWF `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39`, md5 `af059ff9d75cefbc244f03814b47be9c` (unchanged)

Result: RESOLVED (2026-09-28) — orchestrator amendment adopted option (a): the
harness serves a deterministic Base64(UTF-8) re-encoding of the archived
xml64.php word list; the archived file stays unmodified. The original BLOCKER
analysis is preserved below as the historical record.

---

## 0. Resolution (2026-09-28)

**Decision** (task amendment, `tasks/C3-reference-harness.md` Inputs): "the
fixture served to the 2012 SWF must be a Base64(UTF-8)-encoded variant of the
archived round data (transformation script + input/output SHA-256 recorded;
`../kelimator-nostalji/` remains unmodified)."

**Implementation** — `verify/reference/make-fixture.mjs`:

- reads the archived ISO-8859-9 file through the Latin-5 mapping (`swf-codec.mjs`);
- replaces **exactly the values the 2012 client decodes** — every
  `<kelime harf="2".."8">` `<txt>` value (the client Base64-decodes
  `al(8)` and `al(i)` for i = 8…2) — with `Base64(UTF-8)` of their text;
- preserves the `harf="9999"` checksum raw (the client reads it via `al(9999)`
  and only embeds it in the excluded `hiscore.php` URL), and leaves XML
  structure, attributes, whitespace and the file's trailing bytes unchanged;
- verifies the round trip with the SWF's own decoder (`swfBase64Decode`) for
  every transformed entry and writes the input/script/output SHA-256 to
  `fixtures/fixture-meta.json`.

**Transformed entries** (from the script report): harf 8 → 1 word (main word
`FİNALİZM`), harf 3 → 28 words, harf 4 → 41, harf 5 → 17, harf 6 → 4,
harf 7 → empty, harf 9999 → preserved raw. Total 91 words.
`make-fixture.mjs --check` re-derives the output and exits 0 (byte-stable).

**Observed effect in the reference** (final matrix runs 2026-09-28T14:29/14:34Z,
`tests/fixtures/reference/run1|run2/`):

- round board loads with **8 letter tiles** (`S10-next-round.png` shows the
  shuffled `İ İ M F A N Z L` in one run);
- S4 click scan: 3/3 registered; S5 `FAL` accepted (+450); S6 `MİZ` rejected
  (entry kept); S7 bonus: run 1 saw the bright bonus ball on the first attempt;
  run 2 never saw it in 40 attempts yet the bonus was still paid (the roll can
  mark the next ball, which never arrived — A2's O02 rule); both recorded;
- S8 scripted submission: 91 fixture words submitted, 89 accepted, all 35
  listed boxes filled → `bittimi()` completion (completing word `İNFİAL`) →
  end screen;
- the end screen's return path ("Gönder") posted to the excluded `hiscore.php`
  with `x=19c4701ab499f750987eebe0bff07f9c` — the raw `harf="9999"` value —
  proving the preserved checksum entry is what the client reads;
  the local server answered 501 (POST unsupported), nothing stubbed; the
  requests are logged: round 1 `?491311`/`?561837`, round 2 `?62403`/`?733761`,
  round 3 `?298471`/`?410589`;
- the return path played the intro and started a new round, whose clock was
  then waited out (S9 timeout state with the unfound words revealed), and
  `Yeni Oyun` started round 3 (S10).

**Verification**: `check.mjs` `V1fixture` (round trip + raw-preserved `9999` +
input/output/script hashes + `--check` idempotency) passes; see
`evidence/logs/C3-check-output.log`.

**Proposed docs/08 line** (orchestrator transcribes):

```
RESOLVED 2026-09-28 — evidence/C3-fixture-format.md — harness fixture = Base64(UTF-8) re-encoding of the archived xml64.php word list (input/script/output sha256 recorded; archived file unmodified)
```

---

## 1. Original BLOCKER analysis (historical record)

### 1.1 Fact (measured, reproducible)

`artifacts/decompiled/scripts/frame_131/DoAction.as` `myOnLoad` decodes every
round value before use:

```
enbuyukkelime = Base64.decode(al(harfsayisi));
…
k = Base64.decode(al(i));
```

The decoder is `frame_5/DoAction.as` `Base64` (base64 → UTF-8). The archived
fixture stores **plain ISO-8859-9** text (`xxd`: `<txt>F\xddNAL\xddZM</txt>` =
`FİNALİZM`). Decoding the archived values with the SWF's own decoder yields:

- main word `FİNALİZM` → 2 code points `[64704, 64908]` (no Turkish letters, no renderable glyphs);
- the `harf="3"` list → one 30-char non-letter string.

Consequences observed before the resolution (matrix runs 2026-09-28T13:47/13:51):

- `yerlestir()` created `enbuyukkelime.length = 2` letter tiles (the other 6 visible slots were non-interactive `bosbuton` placeholders);
- clicking all 8 slots registered only 2 tiles; typed fixture words were accepted 0 times;
- S8's 91 scripted words produced only tick-sized timer changes; no word accepted;
- the only reachable "valid word" was the 2-char decoded main word when the two tiles happened to be clicked in deck order (run 2: +200 points).

### 1.2 Independent cross-checks

1. **A2 (O12, same SWF, same Ruffle):** with a Base64(UTF-8) re-encoded fixture
   in `$TMPDIR`, the Ruffle log contains **zero**
   `SetProperty: Invalid target String("buttonN")` warnings, i.e. all 8 tiles
   were created (`evidence/A2-kelimatorid.md`; raw logs
   `evidence/logs/A2-ruffle-base64-fixture.log`,
   `evidence/logs/A2-ruffle-archived-fixture.log`).
2. **Wayback Machine:** the original server response is not archived — the CDX
   index lists three captures of `xml64.php` (2009/2010/2014) and all share
   digest `3I42H3S6NNFQ2MSVX7XZKYAYSCX5QBYJ` = base32(SHA-1("")) = empty
   content; replaying the 2014 capture returns HTTP 200 with
   `content-length: 0` (`evidence/logs/C3-fixture-archive-probe.log`).
   `../kelimator-nostalji/README.md` §2 documents the local file as an
   unverified 2007-format copy.

### 1.3 Impact (before the resolution)

- `docs/07` §5 states **S5** (valid word), **S6** (non-list entry), **S7**
  (bonus word) and **S8** (all found) could not be produced by the reference.
- E2's S5–S7 reference comparisons and F2's reference-side playthrough steps
  depended on states that did not exist.
- G4's reference side could not be verified.

Resolved by §0: the transport encoding is reconstructed from the archived word
list (the sole word source), no reference file is altered, and the S5–S8 target
states are reachable again (see `evidence/C3-harness.md` §7).
