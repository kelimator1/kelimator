# A2 — `harf="9999"` checksum validation (O03)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:50:00Z / 2026-09-28T13:25:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `grep -rn "kelimatorid\|Base64" artifacts/decompiled/scripts/` (2 hits for `kelimatorid`)
- reads of `frame_131/DoAction.as` (`myOnLoad`, `al`), `DefineButton2_153/BUTTONCONDACTION on(release).as`
- `head -c 2000 ../kelimator-nostalji/calistir/xml64.php` (fixture bytes of the `<kelime harf="9999">` entry)
Exit codes: 0 (all)
Output summary: checksum parse path traced; no validation exists; conclusion recorded in `docs/02` §1
Artifact SHA-256 hashes: `docs/02-mechanics-spec.md` `bc0178ae478d5e2f3ba392d1b15ab6bb56a7f81ad1703576a1b365817dcf7e04`
Result: PASS

---

## 1. Procedure

Per `docs/08` O03: trace the parsing/verification code after the XML load.
Searched for every read of the parsed round data and of `kelimatorid`, then
checked whether the value participates in any comparison/branch.

## 2. Excerpts (verbatim)

`artifacts/decompiled/scripts/frame_131/DoAction.as` `function myOnLoad(success)` L175-L182:

```
function myOnLoad(success)
{
   if(success)
   {
      xmlload.gotoAndStop(1);
      kelimatorid = al(9999);
      enbuyukkelime = Base64.decode(al(harfsayisi));
      dizi[0] = enbuyukkelime;
```

`frame_131/DoAction.as` `function al(hs)` L281-L305 — generic lookup of the
`<kelime harf="…">` entry (string/number comparison via `==`), returns `""`
when the entry is absent; there is no hash/checksum computation or comparison:

```
function al(hs)
{
   var _loc3_ = hs;
   temp = "";
   ...
      if(xml1.firstChild.childNodes[_loc2_].attributes.harf == _loc3_)
      {
         ...
            temp = xml1.firstChild.childNodes[_loc2_].childNodes[_loc1_].childNodes[0].toString();
         ...
         break;
      }
   ...
   return temp;
}
```

Every other use of the value:
- `grep -rn "kelimatorid" artifacts/decompiled/scripts/` → only
  `frame_131/DoAction.as:180` and
  `DefineButton2_153/BUTTONCONDACTION on(release).as:18` (`x = _root.kelimatorid;`).
- `DefineButton2_153/BUTTONCONDACTION on(release).as` L18-L27 builds the
  (excluded) score-submission URL:

```
      d = _root.calcMD(toplampuan);
      x = _root.kelimatorid;
      hurl = _root.rooturl + "hiscore.php";
      hurl = hurl + "?d=" + d;
      hurl += "&from=elimato";
      hurl = hurl + "&x=" + x;
      hurl = hurl + "&name=" + name;
      hurl = hurl + "&email=" + email;
      hurl = hurl + "&puan=" + toplampuan;
      hurl = hurl + "&kelime=" + toplamkelime;
      hurl = hurl + "&sure=" + toplamsure;
      loadVariables(hurl,"_level","POST");
```

Fixture entry (`../kelimator-nostalji/calistir/xml64.php`):
`<kelime harf="9999"><txt>19c4701ab499f750987eebe0bff07f9c</txt></kelime>` —
32 hex characters, read raw (not `Base64.decode`d).

## 3. Conclusion

**The client does not validate the `harf="9999"` checksum.** It stores the entry
text in `kelimatorid` during `myOnLoad` and never compares, recomputes or
branchs on it; the only consumer is the excluded `hiscore.php` submission URL.
A missing/broken 9999 entry cannot block a round (`al()` returns the empty
string). `docs/02` §1 slot updated to `[CONFIRMED → O03]`.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
