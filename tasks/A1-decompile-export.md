# TASK A1 — Decompile and Export Reference Build

- Workstream: A (reverse engineering)
- Parallel group: 1
- Depends on: none
- Owned paths: `artifacts/decompiled/**`, `evidence/A1-*`, `docs/01-reverse-engineering.md` (TBC slots only)

## Inputs
- `../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf`
- `README.md`, `docs/01-reverse-engineering.md`

## Steps
1. Record tool availability: `java -version`, FFDec version (install from the
   official distribution if missing). Check FFDec CLI usage with `-help`;
   record the exact flags available. Do not assume flag names.
2. Verify the source file: `md5` and `shasum -a 256`; MD5 must equal
   `af059ff9d75cefbc244f03814b47be9c`. Mismatch → re-download per README §1,
   re-verify; still failing → BLOCKER.
3. Single FFDec pass, exporting to `artifacts/decompiled/`:
   - FLA export (timeline/layout reference)
   - ActionScript (all scripts)
   - Shapes and sprites as SVG
   - Images as PNG
   - Sounds as files per sound ID
   - Header data (version, dimensions, frame rate, frame count)
   - Tag inventory (tags with IDs/counts)
4. Read DefineFont2 records; record font names and styles (closes part of O09).
5. Read bitmap definitions; record dimensions and format (closes part of O10).
6. Inspect the streaming sound (`SoundStreamHead2`): extract its stream blocks;
   record whether any content exists (closes part of O11).
7. Build the export manifest: for every item in the expected inventory
   (`docs/01` §3), the corresponding exported file path.

## Unknowns
- None blocking. This task **produces evidence for** O09, O10, O11, O19.

## Verify
- V1: source MD5 matches.
- V2: manifest lists every expected export class with non-empty files; sound
  count = 9; sound payload sizes match `docs/01` §3 byte sizes exactly.
- V2: every exported sound passes `afinfo`; every SVG is well-formed XML.
- Command examples (adapt to actual FFDec CLI, confirmed via `-help`):
  `shasum -a 256 artifacts/decompiled/**`, `afinfo <sound>`, `python3 -c "import xml.dom.minidom …"`.

## Evidence
- `evidence/A1-export-manifest.md` (manifest + hashes)
- `evidence/A1-fonts.md`, `evidence/A1-bitmaps.md`, `evidence/A1-stream.md`
- `evidence/logs/A1-*.log`

## Done
- All Verify checks pass; evidence written; O09/O10/O11 evidence targets updated
  in `docs/08-open-items.md` (items stay OPEN until A2/A3 complete their parts,
  note the partial findings).
