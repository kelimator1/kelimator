# A2 — `kelimatorid` and `Base64.decode` (O12)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:55:00Z / 2026-09-28T13:30:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `grep -rn "kelimatorid\|Base64" artifacts/decompiled/scripts/`
- reads of `frame_131/DoAction.as` (`myOnLoad`, `al`), `frame_5/DoAction.as` (Base64/calcMD helpers), `DefineButton2_153`
- `xxd ../kelimator-nostalji/calistir/xml64.php | head -5` and `python3 -c "open(...).read()"` on `xml64.php` (fixture byte check)
- Ruffle cross-check (two runs, `evidence/logs/A2-ruffle-*.log`):
  - run 1: `python3 sunucu.py 8791` inside `../kelimator-nostalji/calistir/` + `./Ruffle.app/Contents/MacOS/ruffle --volume 0 http://127.0.0.1:8791/kelimator_tr_2012_mochiads.swf`
  - run 2: Base64-re-encoded fixture in `$TMPDIR/a2ref/` served on port 8792 (same SWF, symlinked) + the same Ruffle command against port 8792
Exit codes: 0 (all; `pgrep`/`grep -c` returning 0 matches are noted)
Output summary: `Base64.decode` classified REQUIRED for the original round flow; `kelimatorid` classified EXCLUDED; fixture-format finding recorded; `docs/02` §1 line added
Artifact SHA-256 hashes: `artifacts/decompiled/scripts/frame_131/DoAction.as` (A1 export, in `artifacts/decompiled/SHA256SUMS.txt`)
Result: PASS

---

## 1. Procedure

1. Traced every occurrence of `kelimatorid` and `Base64` (grep above).
2. Read `Base64.decode` and the round-loading path (`myOnLoad`).
3. Checked the archived fixture bytes against the decoding the client performs.
4. Cross-checked with the reference build in Ruffle: once with the archived
   fixture as-is, once with the same round data Base64-encoded.

## 2. Excerpts (verbatim)

Round load + decode — `artifacts/decompiled/scripts/frame_131/DoAction.as` `function myOnLoad(success)` L175-L203:

```
      kelimatorid = al(9999);
      enbuyukkelime = Base64.decode(al(harfsayisi));
      ...
         k = Base64.decode(al(i));
         if(k != "")
         {
            tmp = k.split(",");
```

Decoder — `artifacts/decompiled/scripts/frame_5/DoAction.as` L177 and L210-L242:
`var Base64 = {_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",`
`decode:function(input) { ... _loc1_ = Base64._utf8_decode(_loc1_); return _loc1_; }`
(UTF-8 decoding after the Base64 step; no error checking of `_keyStr.indexOf`
results).

`kelimatorid` consumers — only `DefineButton2_153/BUTTONCONDACTION on(release).as`
(L18, inside the excluded score-submission handler): `x = _root.kelimatorid;` …
`hurl = hurl + "&x=" + x;` … `loadVariables(hurl,"_level","POST");`.

Fixture bytes — `../kelimator-nostalji/calistir/xml64.php` (hexdump):
`<txt>F\xddNAL\xddZM</txt>` = plain ISO-8859-9 `FİNALİZM`, **not** Base64.
`../kelimator-nostalji/README.md` §2 documents this file as "a copy assumed to
be in the same format as the 2007 version (the 2012 version requests this; the
original is not in the archive, not byte-for-byte verified)".

Reference cross-check (logs copied to `evidence/logs/`):

- run 1 (archived fixture): server log `GET /xml64.php?408468 HTTP/1.1 200`;
  Ruffle log shows tile duplication failing for 6 of 8 tiles:
  `WARN ruffle_core::avm1::activation: SetProperty: Invalid target String("button2")`
  … up to `button7` (the Base64 decoder turns the plain word into garbage, so
  `enbuyukkelime.length` is < 8 and `yerlestir()` duplicates fewer tiles).
- run 2 (Base64(UTF-8) fixture, same SWF): server log `GET /xml64.php?592444`;
  Ruffle log contains **zero** `SetProperty: Invalid target` warnings →
  all 8 tiles were created from the round data.
- both runs: `INFO ruffle_core::compatibility_rules: Blocking url due to
  compatibility ruleset 'mochiads'` followed by
  `ERROR … BlockedHost("*.mochiads.com")` — the game continues (see A2-mochi.md).

The Ruffle desktop window could not be captured in this session (macOS screen
recording permission is not granted; `screencapture -x` returned only the
desktop background — no window pixels). The cross-check therefore uses log
lines only; visual capture belongs to C3's harness.

## 3. Conclusion

- **`Base64.decode`: REQUIRED for the original data flow.** Every round word
  (`harf="8"` main word and each `harf="N"` list) is Base64(UTF-8) encoded in
  the XML and decoded by the client before use. This is not an identity/score
  feature; without it no round can be built (run-1 cross-check). Our rebuild
  does not need the decoder (rounds come from `rounds.json`), but the original
  round format — and any harness fixture for the 2012 build — must be
  Base64(UTF-8) encoded, which the archived plain-text `xml64.php` is not.
- **`kelimatorid`: EXCLUDED.** It is the raw text of the `harf="9999"` entry
  (not decoded), never validated (see `evidence/A2-checksum.md`), and its only
  consumer is the excluded `hiscore.php` score submission.
- Classification recorded in `docs/08` proposal (O12).

**Scope note for the orchestrator:** besides the `[TBC]` slot updates, one
confirmation bullet was added under `docs/02` §1 (line after the O03 slot) so
that the encoder/harness facts are visible to C3/B1/B3 from the mechanics spec;
revert if the orchestrator prefers to keep that section byte-stable.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
