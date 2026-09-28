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
- Whether the client verifies the `harf="9999"` checksum: **[TBC → O03]**

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
| A tile may be used only as many times as it appears in the deck | **[TBC → O15]** |
| Word already found behavior (reject / no-op) | **[TBC → O15]** |
| Invalid word feedback (visual/audio) | **[TBC → O05/O06]** |

## 3. Scoring (official rules)

| Rule | Formula | Status |
|---|---|---|
| Valid word | `(letter count)² × 50` | **[CONFIRMED: 2004 official page]** |
| Bonus: if the entered letters contain the bright/bonus letter and the word is valid | `(letter count)² × 50 + 5000` | **[CONFIRMED: 2004 official page]** |
| End of round: remaining time added | `remaining seconds × 100` | **[CONFIRMED: 2004 official page]** |

Bonus letter selection rule: **[TBC → O02]** (code hints: `bonusball`,
`bonusrnd`, `bonusmin`, `bonusrange`).

## 4. Round completion and timer

| Rule | Status |
|---|---|
| Finding all words in the round completes it (frame label `hepsiburda`; celebration label `bravo`) | **[CONFIRMED: labels + official note that Top10 requires all words; exact frame semantics TBC → O13]** |
| Timer counts down; end-of-round time bonus uses remaining seconds | **[CONFIRMED: official page]** |
| Timer initial value, tick rate, pause/resume semantics | **[TBC → O01]** |
| Behavior when a word entry is in progress at timeout | **[TBC → O14]** |

## 5. State machine (draft; refined by A2)

```
boot → preloader (`preall`?) → main menu/game (`main`)
     → playing → (all words found → `hepsiburda`/`bravo`) → new round
     → (timeout) → round end → new round
```

Label semantics: `preall` **[TBC → O13]**. No state may be implemented with an
invented structure; A2 records the actual observed flow.

## 6. Display behavior

| Item | Status |
|---|---|
| Found words listed/grouped (counters by length: `harfsayisi`, `toplamkelime`, `bulunanlar`) | **[CONFIRMED: code identifiers; exact layout TBC → O08]** |
| Score display and per-word feedback animations | **[TBC → O07/O08]** |
| Static labels and messages (e.g., "bravo") | **[TBC → O05/O08]** |

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

## 9. Open questions

See `docs/08-open-items.md` — items O01–O05, O13–O15.
