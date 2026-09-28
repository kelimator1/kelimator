# 02 — Mechanics Specification (Single Source of Truth)

This document defines game behavior. Every statement is tagged:

- **[CONFIRMED]** — verified in this project (source named)
- **[TBC]** — must be confirmed by the named task before dependent code exists
- **[EXCLUDED]** — deliberately out of scope

All numeric values used by code must end up in `data/constants.json` with an
evidence reference. Code must not hardcode any value that is not in that file
(cross-checked by V7).

---

## 1. Round data (original flow)

- At round start the SWF fetched a word list from `xml64.php` (same directory,
  random query number appended). **[CONFIRMED-OBSERVED: local run logged
  `GET /xml64.php?853466` → 200]**
- Response format (XML): **[CONFIRMED: archived fixtures
  `../kelimator-nostalji/calistir/xml.php`, `xml64.php`, `xml_eng.php`]**

```
<kelimeler>
  <kelime harf="8"><txt>MAINWORD</txt></kelime>          <!-- the round's 8-letter word -->
  <kelime harf="3"><txt>W1,W2,...</txt></kelime>         <!-- valid 3-letter words, comma-separated -->
  ...
  <kelime harf="7"><txt>...</txt></kelime>
  <kelime harf="9999"><txt>32-hex-checksum</txt></kelime> <!-- checksum entry -->
</kelimeler>
```

- Encoding: XML declares `iso-8859-9`; the client sets `useCodePage`.
  **[CONFIRMED: code string + fixture bytes]**
- 8-letter list contains only the main word in every archived fixture.
  **[CONFIRMED: fixtures]**
- Whether the client verifies the `harf="9999"` checksum: **[CONFIRMED → O03: no — `kelimatorid = al(9999)` is stored but never compared or validated; used only in the excluded `hiscore.php` URL; `evidence/A2-checksum.md`]**
- Round `<txt>` values are Base64(UTF-8) encoded before the client can use them (`Base64.decode`); the archived plain-text fixture cannot be used as the 2012 fixture as-is. **[CONFIRMED → O12: `evidence/A2-kelimatorid.md`]**

Our build replaces the server with a build-time generated `rounds.json`
(`docs/06`); the round model and validation semantics stay identical.

## 2. Tiles and word entry

| Rule | Status |
|---|---|
| 8 tiles per round, letters of the main word (duplicates possible) | **[CONFIRMED: official page "8 Keys"; fixtures contain duplicate letters, e.g., FİNALİZM has two İ]** |
| Word built by clicking tiles or typing on the keyboard | **[CONFIRMED: official page]** |
| SPACE scrambles the letters | **[CONFIRMED: official page ("Karıştır - [SPACE]")]** |
| ENTER adds the word to the list if valid | **[CONFIRMED: official page]** |
| BACKSPACE removes letters | **[CONFIRMED: official page]** |
| A tile may be used only as many times as it appears in the deck | **[CONFIRMED → O15: each tile instance is consumed (`_visible=false`); a letter is usable only while such a tile is visible; `evidence/A2-edges.md`]** |
| Word already found behavior (reject / no-op) | **[CONFIRMED → O15: rejected — plays the "boing" sound, no score, entry is kept; `evidence/A2-edges.md`]** |
| Invalid word feedback (visual/audio) | **[CONFIRMED → O05/O06: "buzz" sound (ID 40) on submit; live status via the `status` sprite: "Geçerli" for a valid new word, "Girildi" for an already-found word; `evidence/A2-strings.md`, `evidence/A2-sounds.md`]** |

## 3. Scoring (official rules)

| Rule | Formula | Status |
|---|---|---|
| Valid word | `(letter count)² × 50` | **[CONFIRMED: 2004 official page]** |
| Bonus: if the entered letters contain the bright/bonus letter and the word is valid | `(letter count)² × 50 + 5000` | **[CONFIRMED: 2004 official page]** |
| End of round: remaining time added | `remaining seconds × 100` | **[CONFIRMED: 2004 official page]** |

Bonus letter selection rule: **[CONFIRMED → O02: 5% per added letter — while `bonusball == -1`, `random(1000) < 50` sets `bonusball = kelime.length`; the next valid submit scores +5000 while `bonusball > -1`; clearing the entry resets it to -1; `evidence/A2-bonus.md`]**. (Code identifiers: `bonusball`, `bonusrnd`, `bonusmin`, `bonusrange`.)

## 4. Round completion and timer

| Rule | Status |
|---|---|
| Finding all words in the round completes it (frame label `hepsiburda`; celebration label `bravo`) | **[CONFIRMED → O13: gameplay runs on SWF frame 131 (`hepsiburda`); all words found → `gotoAndStop("bravo")` + play; only the first 10 words of each length are listed and counted (`if(k > 10) { k = 10; }`), and completion means every listed slot is filled; `evidence/A2-labels.md`]** |
| Timer counts down; end-of-round time bonus uses remaining seconds | **[CONFIRMED: official page]** |
| Timer initial value, tick rate, pause/resume semantics | **[CONFIRMED → O01: starts at 200 s; the remaining value decrements at 1000 ms wall-clock boundaries; the timer sprite is stopped (`gotoAndStop(1)`) at round start, round end and timeout, and restarted only by `baslat()` for a new round; `evidence/A2-timer.md`]** |
| Behavior when a word entry is in progress at timeout | **[CONFIRMED → O14: the entry is discarded (no scoring), tiles are hidden, every missing word is revealed, "finishsound" plays; `evidence/A2-timeout.md`]** |

## 5. State machine (refined by A2 — [CONFIRMED → O13])

```
boot → preloader (SWF frames 1–4) → intro animation (`main`, frame 5)
     → gameplay (`hepsiburda`, frame 131; the round starts once the word list has loaded)
     → all words found → celebration (`bravo`, frame 132) → end-of-round screen (timeline stops at frame 241)
     → timeout → board revealed in place on frame 131
     → "Yeni Oyun" → next round (init → reload word list → frame 131)
```

Label semantics: `preall` **[CONFIRMED → O13: frame 130, the frame immediately before `hepsiburda` ("all letters placed"); `main` = frame 5 (intro start), `hepsiburda` = frame 131 (gameplay/round controller), `bravo` = frame 132 (completion celebration); `evidence/A2-labels.md`]**. No state may be implemented with an invented structure; A2 records the actual observed flow.

## 6. Display behavior

| Item | Status |
|---|---|
| Found words listed/grouped (counters by length: `harfsayisi`, `toplamkelime`, `bulunanlar`) | **[CONFIRMED: code identifiers; exact layout TBC → O08]** |
| Score display and per-word feedback animations | **[TBC → O07/O08]** |
| Static labels and messages (e.g., "bravo") | **[CONFIRMED → O05: `Karıştır`/`Ekle`/`Sil`/`Yeni Oyun` button labels, `Geçerli`/`Girildi` status, results screen `TEBRİKLER`/`Puanınız`/`Kelime Sayısı`/`Süre`, counters `3 harfli:`…`8 harfli:`, loading `Kelimeler Yükleniyor\rLütfen Bekleyiniz...`; placement/layout remains O08 — `evidence/A2-strings.md`]** |

## 7. Network features — all [EXCLUDED]

Score submission (`hiscore.php`), Top10 (`top10.php`), e-mail entry, online
counters, translator, MochiAds startup ad. The rebuilt game performs **zero
network requests** at runtime.

## 8. constants.json (canonical shape; created by C1)

```json
{
  "schemaVersion": 1,
  "stage": { "width": 550, "height": 400, "fps": 0, "frameCount": 0 },
  "timer": { "initialSeconds": 0, "tickMs": 0 },
  "scoring": { "perLetterSquaredFactor": 50, "bonusPoints": 5000, "timeFactor": 100 },
  "bonusLetter": { "selectionRule": "", "evidence": "" },
  "input": { "scrambleKey": "SPACE", "submitKey": "ENTER", "deleteKey": "BACKSPACE" },
  "flows": { "allFoundLabel": "hepsiburda", "celebrationLabel": "bravo" },
  "evidence": { "<field>": "<evidence file / doc ref>" }
}
```

Zeros and empty strings are placeholders that **must** be replaced by A2 with
evidence-backed values before any dependent task starts (schema allows 0 only
as "unresolved"; V7 test fails on unresolved placeholders for fields marked
required).

> Amendment 2026-09-28 (orchestrator): the block above is a canonical *shape*
> (an example instance), not a JSON Schema document; a verbatim copy cannot pass
> `ajv-cli compile`. C1 encoded it as `data/constants.schema.json` (draft-07):
> every key shown is required, key names/spelling and nesting unchanged, zeros
> and empty strings remain schema-valid placeholders, and the V7 dry-run above
> remains the enforcement point. Probe: `evidence/logs/C1-verbatim-probe.log`;
> decision record: `evidence/C1-scaffold.md` §3.2. Matching entry:
> `docs/08-open-items.md` (Amendments).

> Amendment 2026-09-28b (orchestrator): `bonusLetter.seed` (number) added to
> `data/constants.schema.json` and `data/constants.json` (value 2012). D1's task
> requires the probabilistic O02 rule to run on a seeded RNG with the seed
> recorded in constants (`tasks/D1-round-module.md` step 2). The seed is a
> deterministic-test implementation value, not a reference constant; the O02
> distribution semantics (5 % per added letter) are unchanged. Matching entry:
> `docs/08-open-items.md` (Amendments).

## 9. Open questions

See `docs/08-open-items.md` — items O01–O05, O13–O15.
