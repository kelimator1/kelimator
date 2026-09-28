# verify/reference — C3 reference harness (Ruffle 0.6.0 web + 2012 SWF)

Runs the **original 2012 reference build**
(`../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf`, md5
`af059ff9d75cefbc244f03814b47be9c` — T01) inside the pinned **Ruffle 0.6.0 web
self-hosted** player and captures the S1–S10 state matrix of
`docs/07-verification.md` §5 under Playwright Chromium.

## Files

| File | Role |
|---|---|
| `ruffle/ruffle-0.6.0-web-selfhosted.zip` | pinned Ruffle web asset (SHA-256 recorded before extraction) |
| `ruffle/web/` | extracted Ruffle web self-hosted build |
| `index.html` | harness page: embeds Ruffle, loads `kelimator_tr_2012_mochiads.swf` |
| `server.py` | static server: harness root + served fixture, request logging |
| `swf-codec.mjs` | the SWF's own Base64/UTF-8 codec + ISO-8859-9 decoding helpers |
| `make-fixture.mjs` | transforms the archived fixture into the served Base64(UTF-8) fixture |
| `fixtures/xml64.base64.php` | served fixture: Base64(UTF-8) re-encoding of the archived round values |
| `fixtures/fixture-meta.json` | input/script/output SHA-256 + per-entry transform record |
| `capture.mjs` | Playwright driver: probe mode + S1–S10 matrix (two runs) + stability compare |
| `check.mjs` | reproducible V1 / V1fixture / V2 / V5 / V6 report (exit 0) |

## Fixture reconstruction (task amendment 2026-09-28)

The 2012 client Base64-decodes every round value (`frame_131/DoAction.as`
`myOnLoad`), while the archived `xml64.php` stores plain ISO-8859-9 — the board
would load broken. `make-fixture.mjs` therefore reads the archived file
(read-only, never modified) and writes `fixtures/xml64.base64.php`, in which
**exactly the values the client decodes** (`<kelime harf="2".."8">` `<txt>`
values) are replaced by `Base64(UTF-8)` of their text; the `harf="9999"`
checksum is preserved raw (the client reads it via `al(9999)` and only uses it
in the excluded `hiscore.php` URL); XML structure, attributes and whitespace are
unchanged. The script verifies the round trip with the SWF's own decoder and
records the input/script/output SHA-256 in `fixtures/fixture-meta.json`.
`server.py` maps `GET /xml64.php?<random>` to the derived fixture.

## Run

```bash
node verify/reference/make-fixture.mjs          # (re)generate the served fixture
node verify/reference/capture.mjs --probe --probe-dir <dir>   # observation probe
node verify/reference/capture.mjs --runs 2 --port 8797        # full matrix + stability
node verify/reference/check.mjs                 # V1/V1fixture/V2/V5/V6 report
```

`capture.mjs` starts `server.py` itself and appends the server's request log to
`evidence/logs/C3-server.log` (run markers included). Ports: default `8797`
(`C3_PORT` env or `--port`); the harness refuses to start if the port is in use.

## Serving model (EXECUTION.md §6)

```
GET /kelimator_tr_2012_mochiads.swf -> ../kelimator-nostalji/calistir/…   (read-only)
GET /xml64.php?<random>            -> verify/reference/fixtures/xml64.base64.php (derived)
GET /ruffle/web/*                  -> verify/reference/ruffle/web/*
```

No ad/network request is stubbed or intercepted: the MochiAds startup call is
blocked by Ruffle's own compatibility rules (`BlockedHost("*.mochiads.com")`,
recorded in the interaction logs), and the end screen's own return path posts to
the excluded `hiscore.php`, which the local server answers with 501 (unsupported
method) — both are recorded, neither is altered.

## State-based waits (no fixed delays)

- **S1 boot**: white Ruffle splash is skipped by a content check (stage must be
  ≥20 % non-white/non-black); then a stable-frame check with the intro's sun
  animation region masked (measured diff bbox x 218–309, y 0–160).
- **S2 idle board**: waits for the `xml64.php -> 200` line in the server log
  (resource evidence), then a stable frame, then verifies the board by the
  measured timer gauge (`TIMER_BOX`: red fraction ≥ 0.2).
- **S5/S6/S7**: clear the entry, type the word with the SWF's physical key
  codes; acceptance = the reference clears the wordball entry row. S7 waits for
  the reference's bright/orange bonus ball (`random(1000) < 50` per letter,
  O02) to appear before submitting, within a bounded retry budget. The bonus can
  also be paid without a visible bright ball (the roll marks the *next* ball,
  which may never arrive — observed in one matrix run: 40 attempts without a
  bright ball, bonus still paid at submit); both cases are recorded.
- **S8 all-found**: scripted submission of every fixture word; acceptance and
  completion are detected from the reference (`bittimi()` hides
  Karıştır/Ekle/Sil), then the all-found end screen (night sky + TEBRİKLER
  panel) is detected and captured.
- **S9 timeout**: the end screen's own return path ("Gönder" → excluded
  `hiscore.php` 501 → `gotoAndPlay("main")`) starts round 2; its clock is then
  waited out (`tamamla()`: gauge empty + buttons hidden + unfound words
  revealed) — the literal timeout state.
- **S10 next round**: click `Yeni Oyun` (visible on the timed-out board) and
  wait for the next `xml64.php -> 200`, then a stable frame.

## Reference-fidelity notes

- The stage is 550×400 at `deviceScaleFactor: 1`, Ruffle `scale=exactFit`, so
  stage coordinates map 1:1 to CSS pixels (tile row: `_X = 60 + t*60`,
  `_Y = 330`; `Yeni Oyun` at (491, 206); end-screen form fields at the headings
  in `capture.mjs`).
- Ruffle's headless-only "hardware acceleration is disabled" player notice is
  dismissed through its own close button before input (recorded in the logs).
- Keyboard input uses the physical key codes the SWF maps in `frame_131`
  (`codes` → `harf`, Turkish-Q layout positions).
- Residual non-determinism: the deck shuffle (`shuffle()`, random per run), the
  5 %/letter bonus ball, and the end screen's fireworks particles. Numbers and
  consequences are measured per state in `evidence/C3-stability.md`.
