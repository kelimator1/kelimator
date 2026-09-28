# 03 — Assets and Visual Fidelity

Goal: every visual and audio element of the rebuilt game matches the 2012
reference build 1:1. All values here are produced by extraction (A1/A3) and
verified empirically (E2/E3, F1–F3).

---

## 1. Asset classes and handling

| Class | Source (A1 export) | Processing | Destination |
|---|---|---|---|
| Vector shapes/sprites | `artifacts/decompiled/svg/` | SVGO optimization (pinned version, recorded); no geometry edits | `src/assets/svg/` |
| Bitmaps | `artifacts/decompiled/img/` | One export per bitmap; see §2 decision procedure | `src/assets/img/` |
| Sounds | `artifacts/decompiled/sfx/` | Keep original payload; no re-encoding unless proven necessary and recorded | `src/assets/sfx/` |
| Fonts | Read-only metadata (DefineFont2 names) | None; rendered with system font stack (§3) | — |
| Static text | Read from decompiled text/timeline | Recreated as DOM text with matching metrics | in components |

Naming convention:
- SVG: `s<symbolId>_<slug>.svg` (slug from stage role, e.g., `tile`, `button`).
- Sounds: `sfx_<soundId>_<slug>.mp3`.
- Images: `img_<id>_<w>x<h>.png`.
Slugs are assigned in A3's layout catalog, not guessed ad hoc.

## 2. Bitmap handling (decision procedure, evidence-based)

Two bitmap definitions exist (**[CONFIRMED-OBSERVED]** on 2007/EN builds:
768×550 and 768×21; 2012 dimensions **[TBC → O10]**).

Decision procedure (executed in E1; outcome recorded in evidence):
1. Determine where each bitmap is placed and at what size (A3 catalog).
2. If displayed size ≤ source size at 2× device pixel ratio: use as-is.
3. If displayed size requires upscaling beyond source at 2×: apply exactly one
   deterministic upscale pass at build time; record tool, version, and output
   hash. No creative edits.
4. If the bitmap is a flat color/gradient with no photographic detail, replacing
   it with an SVG/CSS equivalent is allowed **only** if pixel-diff thresholds
   (§4) pass — otherwise keep the upscaled bitmap.

## 3. Typography

- Original uses the Verdana family (embedded variants carry Turkish glyph
  subsets). **[CONFIRMED: font names in decompiled output of reference builds]**
- Rule: `font-family: Verdana, "DejaVu Sans", sans-serif;` with exact
  size/weight/alignment per element from the A3 catalog.
- Letter-spacing/leading tuned until pixel thresholds pass; tuning changes are
  recorded as numeric style values in the layout catalog.
- Accepted deviation: rasterization may differ marginally on systems without
  Verdana (rendering is verified on the build host).

## 4. Visual fidelity method

- **Stage**: 550 × 400 logical pixels (from SWF header **[CONFIRMED]**).
- **Placement**: all element coordinates come from A3's `data/layout.json`
  (extracted from FLA/SVG geometry and stage placement). No eyeballing.
- **Colors**: exact values from A3 (`data/layout.json`); the stage background
  color is read from the SWF's SetBackgroundColor tag. The page letterbox color
  uses `#9DAF48` (archived site background) unless A1 proves the reference
  stage color differs; the extracted value wins.
- **Animations**: catalog produced by A3 (`data/animation.json`): sequence
  name, element(s), frame span, derived duration = frames ÷ FPS (FPS from
  header). Implemented with Web Animations API; keyframe screenshots compared
  against the reference (F2).
- **Sounds**: event → sound-ID map produced by A2 (`data/sound-map.json`);
  consumed by D4; compared to the reference behavior in F2.

## 5. sound-map.json (canonical shape; created by C1)

```json
{
  "schemaVersion": 1,
  "sounds": {
    "<soundId>": { "file": "sfx_<id>_<slug>.mp3", "durationSec": 0.0 }
  },
  "events": {
    "<eventName>": { "soundId": 0, "evidence": "" }
  }
}
```

Event names are defined by A2 from observed call sites; consumers (D4) must not
invent events — the map is the contract, V7 checks it.

## 6. layout.json (canonical shape; created by A1/A3)

```json
{
  "schemaVersion": 1,
  "stage": { "width": 550, "height": 400, "background": "#000000" },
  "elements": [
    { "id": "", "kind": "svg|bitmap|text", "asset": "", "x": 0, "y": 0,
      "w": 0, "h": 0, "text": "", "font": { "family": "Verdana", "size": 0,
      "bold": false, "align": "left" }, "evidence": "" }
  ]
}
```

Values come from extraction; TBC cells are forbidden — every element listed
must be resolvable from exports or reference screenshots with recorded evidence.

## 7. Verification hooks

- E2/F1 produce `evidence/visual/<state>/diff-*.png` and a numeric report.
- Thresholds and state matrix: `docs/07-verification.md` §3–§4.
- Any mismatch above threshold blocks E2/E3 completion (stop-the-line).

## 8. Open questions

See `docs/08-open-items.md` — items O05–O11, O13, O18.
