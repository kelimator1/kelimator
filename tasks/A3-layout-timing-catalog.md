# TASK A3 — Layout and Timing Catalog

- Workstream: A (reverse engineering)
- Parallel group: 2
- Depends on: A1
- Owned paths: `data/layout.json`, `data/animation.json`, `evidence/A3-*`, `docs/08-open-items.md` (status updates only)

## Inputs
- `artifacts/decompiled/fla/**`, `artifacts/decompiled/svg/**`,
  `artifacts/decompiled/img/**`, `artifacts/decompiled/header.txt`
- Reference capture material produced by C3 if available; otherwise raw Ruffle
  screenshots produced locally per `docs/03` §4.

## Steps
1. Read stage placement data (PlaceObject2 records / FLA timeline) for every
   element visible in the game:
   - id, kind (svg | bitmap | text), asset reference, x, y, width, height
   - colors (fills, strokes) and the stage background color
   - text elements: font family/size/bold/align, static string if any
2. Record every element in `data/layout.json` per the canonical shape in
   `docs/03` §6. Elements without an extractable coordinate source are FORBIDDEN;
   if a coordinate cannot be extracted, open a BLOCKER entry (no eyeballing).
3. Read header FPS; build the animation catalog in `data/animation.json`:
   sequence name, elements, frame span, duration = frames ÷ FPS, keyframe
   offsets for capture (per `docs/07` §4).
4. Compare 2007 vs 2012 geometry for shared elements; record differences
   (closes O18). The 2012 build wins in all conflicts.
5. Cross-check a sample of positions/colors against a reference screenshot
   (coordinate checks only; visual diff is E2's job).

## Unknowns
- O05 (strings part), O07, O08, O18 are resolved by this task. Unresolvable
  entries → BLOCKER; do not approximate.

## Verify
- V3: `data/layout.json` validates against the layout schema (created by C1
  from `docs/03` §6; if missing, STOP — dependency violation).
- V2: element count equals the count of stage-placed symbols in the FLA/tag
  inventory (± 0); every referenced asset file exists.
- V2: `data/animation.json` — every animation has numeric frame span and FPS
  derived duration; no empty fields.

## Evidence
- `evidence/A3-layout.md` (source of each coordinate group)
- `evidence/A3-timing.md` (FPS, frame spans)
- `evidence/A3-diffs.md` (2007 vs 2012)
- `evidence/logs/A3-*.log`

## Done
- Verify passes; O05/O07/O08/O18 RESOLVED or split with recorded partials.
