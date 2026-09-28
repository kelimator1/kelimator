# A2 — MochiAds removal points (O19)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:55:00Z / 2026-09-28T13:30:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `grep -rli "mochi" artifacts/decompiled/scripts/`
- `grep -rn "mochiad\|MochiAd" artifacts/decompiled/scripts/ | grep -v "frame_1/"`
- `grep -rn "getURL\|loadVariables\|loadMovie\|\.load(" artifacts/decompiled/scripts/`
- reads of `frame_1/DoAction.as` (582 lines) and `frame_2..5`
- Ruffle cross-checks: `evidence/logs/A2-ruffle-archived-fixture.log`, `A2-ruffle-base64-fixture.log`
Exit codes: 0 (all)
Output summary: ad code localised to one frame script; removal point and no-dependency proof recorded
Artifact SHA-256 hashes: `artifacts/decompiled/scripts/frame_1/DoAction.as` (A1 export; hash in `artifacts/decompiled/SHA256SUMS.txt`); `artifacts/decompiled/tags.txt` `f162cac65cf8c3c61bae2465f9f6e97df45a71a784b69cefb43cb61c57f2d10c`
Result: PASS

---

## 1. Procedure

1. Located every script/tag mentioning MochiAds (`grep -rli`).
2. Checked whether any other script or frame reads MochiAds state.
3. Read the invoking call and the timeline part it controls (frame 1).
4. Observed the reference build with the ad endpoint blocked
   (`x.mochiads.com` unreachable) and recorded the log lines.
5. Listed the game's other network call sites so the removal list is complete
   (the others are already `[EXCLUDED]` in `docs/02` §7).

## 2. Excerpts (verbatim)

Removal target — the entire `artifacts/decompiled/scripts/frame_1/DoAction.as`
(582 lines, top-level `DoAction` tag 3: `len= 10480`,
`evidence/logs/A2-swf-frames.log` `frame 1: DoAction len=10480`). Header
(`frame_1/DoAction.as` L1-L4) and invocation (L582):

```
var MochiAd = {getVersion:function()
{
   return "2.2";
},showPreGameAd:function(options)
```

```
MochiAd.showPreGameAd({id:"951545f2fdfbf4a6",res:"550x400",background:16777161,color:16729600,outline:13994812,no_bg:false});
```

The ad pauses/resumes the main timeline through its callbacks
(`frame_1/DoAction.as` L7-L13):

```
   var DEFAULTS = {clip:_root,ad_timeout:3000,fadeout_time:250,regpt:"o",method:"showPreloaderAd",color:16747008,background:16777161,outline:13994812,ad_started:function()
   {
      this.clip.stop();
   },ad_finished:function()
   {
      this.clip.play();
   }};
```

Dependency check: `grep -rli "mochi" artifacts/decompiled/scripts/` →
only `artifacts/decompiled/scripts/frame_1/DoAction.as`; `grep -rn
"mochiad\|MochiAd" … | grep -v "frame_1/"` → no matches. All ad state
(`_mochiad*`, `mochiad_options`) is created and consumed inside that one script.

Reference run with the endpoint blocked (`evidence/logs/A2-ruffle-*.log`, both runs):

```
INFO ruffle_core::context: Loaded SWF version 6, resolution 550x400 @ 36 FPS
WARN ruffle_core::stub: Encountered stub: AVM1 System.security.allowDomain()
WARN ruffle_core::stub: Encountered stub: AVM1 System.security.allowInsecureDomain()
INFO ruffle_core::compatibility_rules: Blocking url due to compatibility ruleset 'mochiads'
ERROR ruffle_core::loader: Error during movie loading of "http://x.mochiads.com/srv/1/951545f2fdfbf4a6.swf": BlockedHost("*.mochiads.com")
```

…and the run continues into the preloader/game (`GET /xml64.php?408468 HTTP/1.1 200`,
`GET /xml64.php?592444 HTTP/1.1 200` in `A2-ruffle-server.log`).

Complete network call-site list (for `docs/02` §7 EXCLUDED coverage):
`frame_1` `_loc2_.loadMovie(server + ".swf","POST")` (MochiAds) and
`lv.loadMovie(.../com/1/...)`; `frame_131` `xml1.load(url)` (`xml64.php`, replaced
by `rounds.json` per `docs/06`); `DefineButton2_153` `loadVariables(hurl,…)`
(`hiscore.php`); `DefineButton2_102`/`96` `getURL(...)`;
`DefineButton2_108` `getURL("javascript:openWin('top10.php…')")`.

## 3. Conclusion

- **Removal point: exactly one script** — the frame-1 `DoAction`
  (`artifacts/decompiled/scripts/frame_1/DoAction.as`, SWF frame 1, tag payload
  10,480 bytes). Dropping it removes the ad with no stubs needed: no other
  script references `MochiAd` or any `_mochiad*` property, and no timeline
  frame depends on the ad's stop/play callbacks.
- **Flow without the ad:** with the script gone the main timeline plays frame 1
  immediately instead of being stopped by `ad_started`; frames 2-4 (volume
  restore + preloader) and everything after are unchanged. In the reference,
  the ad request is blocked and the game still reaches the round load, which is
  the same observable flow.
- No SWF tag beyond that DoAction needs editing for the ad; the `Protect` tag
  (tag #1, `tags.txt`) only protects editing and does not affect runtime.
- `docs/02` §7 already lists "MochiAds startup ad" as `[EXCLUDED]`; this
  evidence supplies the exact removal point and the no-dependency proof.

## 4. Verification (V3/V2/V7/V4)

Raw outputs: `evidence/logs/A2-verify.log`.

| Type | Command (exact) | Exit | Result |
|---|---|---|---|
| V3 | `npx ajv-cli validate -s data/constants.schema.json -d data/constants.json` | 0 | `data/constants.json valid` |
| V3 | `npx ajv-cli validate -s data/sound-map.schema.json -d data/sound-map.json` | 0 | `data/sound-map.json valid` |
| V2 | python check of every sound: `sounds[id].file` is the `docs/03` §1 name `sfx_<id>_<slug>.mp3`, and the A1 export `artifacts/decompiled/sounds/<id>.mp3` exists with the A1 manifest §6 byte size (follow-up run 2026-09-28b) | 0 | PASS — 9/9 (table in the log; 1950/4030/910/1560/21840/2730/1430/1690/2730) |
| V7 | `npm test -- constants` | 0 | 3/3 tests pass (no `""`/`0` placeholders in required fields; evidence strings present and referenced files exist) |
| V4 | `npm test` | 0 | whole suite green: 3 files, 30 tests |

Artifact SHA-256 (final): `data/constants.json`
`569cdda52c22a540d2b0b9f198db975e8f5d64fba39a57156c51e87ef302c8a1`,
`data/sound-map.json`
`fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09`,
`tests/constants.test.mjs`
`c27a5c1865eb695554b49986a0b9dd179345786655b44212a1dbce6cb8d3a370`,
`docs/02-mechanics-spec.md`
`bc0178ae478d5e2f3ba392d1b15ab6bb56a7f81ad1703576a1b365817dcf7e04`.

## 5. docs/08 proposal (O01–O06, O12–O15, O19) — proposed lines for the orchestrator

Format per `docs/08-open-items.md`: `RESOLVED <date> — <evidence file> — <one-line finding>`.
Proposed entries for the "Resolved items" section and matching Status-cell
replacements (`RESOLVED — <evidence file>`).

**Resolved items (append in ID order):**

```
RESOLVED 2026-09-28 — evidence/A2-timer.md — Timer starts at 200 s; the remaining value decrements once per 1000 ms of wall clock; the timer clip is stopped (`gotoAndStop(1)`) at round start, round end and timeout and restarted only by `baslat()` for a new round.
RESOLVED 2026-09-28 — evidence/A2-bonus.md — Bonus selection: 5% per added letter (`random(1000) < 50`) while `bonusball == -1`; `bonusball = kelime.length` marks the next-added ball as the bright one; +5000 is paid on the next valid submit while `bonusball > -1`; reset when the bright ball is removed or a non-empty entry is cleared.
RESOLVED 2026-09-28 — evidence/A2-checksum.md — The client never validates the `harf="9999"` checksum: `kelimatorid = al(9999)` is stored raw and only used in the excluded `hiscore.php` URL.
RESOLVED 2026-09-28 — evidence/A2-input.md — Input is matched by numeric Flash key codes for 29 Turkish uppercase letters (Ç 220, Ğ 219, İ 222, Ö 191, Ş 186, Ü 221); a letter is accepted only while a deck tile carrying it is visible; SPACE/ENTER/BACKSPACE act only while `bitti == 0`.
RESOLVED 2026-09-28 — evidence/A2-strings.md — Exact user-visible strings extracted (buttons Karıştır/Ekle/Sil/Yeni Oyun, status Geçerli/Girildi, results TEBRİKLER/Puanınız/Kelime Sayısı/Süre, `N harfli:` counters, loading text) with their display conditions; excluded screens' strings listed.
RESOLVED 2026-09-28 — evidence/A2-sounds.md — All 10 sound call sites map to the 9 DefineSound ids; `data/sound-map.json` written with `docs/03` §1 runtime names (`sfx_<id>_<slug>.mp3`, slugs = evidenced SWF clip identifiers), durations and A1 byte sizes (sha256 `fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09`).
RESOLVED 2026-09-28 — evidence/A2-kelimatorid.md — `Base64.decode` is REQUIRED for the original round data (every `<txt>` value is Base64(UTF-8); the archived plain-text `xml64.php` is not valid 2012 fixture input — Ruffle cross-check); `kelimatorid` is EXCLUDED (score-submission URL only).
RESOLVED 2026-09-28 — evidence/A2-labels.md — `main`=frame 5, `preall`=130, `hepsiburda`=131 (gameplay/round controller), `bravo`=132 (celebration); all words found → `gotoAndStop("bravo")` + play; only the first 10 words per length are listed/counted.
RESOLVED 2026-09-28 — evidence/A2-timeout.md — On timeout the in-progress entry is discarded without scoring, tiles are hidden, all unfound listed words are revealed, `finishsound` plays and input is blocked (`bitti = 1`); the time bonus is applied only on all-found completion, from the last integer remaining second.
RESOLVED 2026-09-28 — evidence/A2-edges.md — Duplicate letters consume one tile instance each; re-submitting a found word is rejected with `boing` and keeps the entry; BACKSPACE on an empty entry only plays the sound; scramble clears a partial entry (and skips the reset on an empty entry).
RESOLVED 2026-09-28 — evidence/A2-mochi.md — MochiAds lives entirely in the SWF frame-1 DoAction (10,480 bytes; `MochiAd.showPreGameAd` call at L582); removal = drop that script, no other script reads MochiAds state and the game continues without it (Ruffle blocks `*.mochiads.com`; the round still loads).
```

**Table Status-cell replacements (column 6):**

```
O01 → RESOLVED — evidence/A2-timer.md
O02 → RESOLVED — evidence/A2-bonus.md
O03 → RESOLVED — evidence/A2-checksum.md
O04 → RESOLVED — evidence/A2-input.md
O05 → RESOLVED — evidence/A2-strings.md
O06 → RESOLVED — evidence/A2-sounds.md
O12 → RESOLVED — evidence/A2-kelimatorid.md
O13 → RESOLVED — evidence/A2-labels.md
O14 → RESOLVED — evidence/A2-timeout.md
O15 → RESOLVED — evidence/A2-edges.md
O19 → RESOLVED — evidence/A2-mochi.md
```

**Additional note proposed for the Amendments section (orchestrator decision):**

```
2026-09-28 — A2 finding for the reference harness (C3): the 2012 client Base64-decodes every round `<txt>` value; the archived `calistir/xml64.php` is plain ISO-8859-9 (README §2: assumed 2007-format copy) and must be Base64(UTF-8)-encoded before it can serve as a deterministic 2012 fixture (cross-check: Ruffle 0.6.0 log, evidence/A2-kelimatorid.md, evidence/logs/A2-ruffle-*.log).
```
