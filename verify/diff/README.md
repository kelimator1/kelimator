# verify/diff — PNG pixel-diff tool (task F1)

Deterministic, zero-dependency pixel differ for the visual-regression tasks
(C3, E2, E3, F2). Thresholds, the raw metric and the anti-aliasing-tolerant
pass basis come from `docs/07-verification.md` §4 (Amendment 2026-09-28).

## CLI

```
node verify/diff/diff.mjs <a.png> <b.png> <outdir>
```

- `<a.png>`, `<b.png>` — PNGs of identical pixel dimensions. Any size works; the
  logical stage is 550×400 (`deviceScaleFactor: 1`) and 1100×800
  (`deviceScaleFactor: 2`).
- `<outdir>` — created if missing; receives `report.json` and `heatmap.png`.

Exit-code contract (stable):

| code | meaning |
|---|---|
| 0 | comparison ran to completion — regardless of the mismatch ratio; the verdict is the `pass` boolean inside `report.json` |
| 1 | usage error, missing/unreadable file, undecodable PNG, or size mismatch — exactly one clean line on stderr, no stack trace, no files written |

`node verify/diff/diff.mjs --help` prints usage on stdout and exits 0.
A wrong argument count prints one usage line on stderr and exits 1.

## report.json schema (stable — consumers: C3, E2, E3, F2)

Version 2 (Amendment 2026-09-28) adds the anti-aliasing-tolerant metric; all raw
fields keep their v1 names and values.

| field | type | meaning |
|---|---|---|
| `schemaVersion` | number | report schema version, currently `2` (`1` = raw metric only) |
| `tool` | string | constant `"verify/diff/diff.mjs"` |
| `width`, `height` | number | pixel dimensions (identical for both inputs) |
| `totalPixels` | number | `width * height` |
| `mismatchThreshold` | number | `30` — RGB Euclidean distance above which a pixel counts as raw-mismatched |
| `passRatio` | number | `0.02` — maximum accepted tolerant mismatch ratio |
| `tolerantRadius` | number | `2` — Chebyshev radius of the anti-aliasing neighbourhood |
| `mismatchedPixels` | number | count of raw mismatches (distance `> 30`) |
| `mismatchRatio` | number | `mismatchedPixels / totalPixels` (unrounded) |
| `maxDistance` | number | maximum RGB Euclidean distance observed (`0 .. 441.6729559300637`) |
| `meanDistance` | number | arithmetic mean of the distance over all pixels (unrounded) |
| `mismatchBBox` | object \| null | tight bounding box `{x, y, width, height}` of raw mismatches; `null` when there are none |
| `tolerantMismatchedPixels` | number | raw mismatches with no counterpart within the tolerant neighbourhood (see below) |
| `tolerantMismatchRatio` | number | `tolerantMismatchedPixels / totalPixels` (unrounded) |
| `tolerantMismatchBBox` | object \| null | tight bounding box of tolerant mismatches; `null` when there are none |
| `pass` | boolean | `tolerantMismatchRatio <= passRatio` |

Numbers are full IEEE-754 doubles as serialized by `JSON.stringify`; key order
is fixed. Distance is computed over R, G and B only — alpha is ignored
(`docs/07-verification.md` §4 defines RGB Euclidean distance).

### Tolerant metric (V5 pass basis)

`docs/07-verification.md` §4, Amendment 2026-09-28 ("the static/animation V5
criterion is evaluated on the anti-aliasing-tolerant comparison while the
threshold stays 2.0 %"):

> a pixel counts as mismatched only if `dist(A[p],B[p]) > 30` **and** it has no
> counterpart within the 5×5 (`radius = 2`, Chebyshev, edge-clamped)
> neighbourhood of the other image, checked in both directions
> (`min dist(A[p],B[q]) > 30` for all `q` near `p`, and the same with A/B
> swapped).

Formally a raw-mismatched pixel `p` is tolerated when

```
min over q in N2(p) of dist(A[p], B[q]) <= 30   OR
min over q in N2(p) of dist(B[p], A[q]) <= 30
```

with `N2(p)` the 5×5 Chebyshev neighbourhood (center included), clamped at
image borders. Only pixels already raw-mismatched are re-checked (performance).
The rationale is the fixed rendering gap between the rebuild (Chromium
system-font/vector rendering) and the reference (Ruffle/Flash glyph and shape
rasterization) which leaves 1–2 px coverage wander on edges; measurements:
`evidence/logs/orchestrator-tolerance-probe.log`,
`evidence/E2-layout.md` §4/§6 (raw 4.5–6.9 % → tolerant ≤ 1.363 % across the
measured states, all ≤ 2 %). Structural errors large enough to matter
(≥ ~4 400 px, e.g. misplaced/missing elements, colour regions) still flag; the
raw ratio remains reported and monitored.

### Pass rule and threshold

- raw mismatch: RGB Euclidean distance **strictly greater than 30**; distance
  exactly 30 is a match (`docs/07-verification.md` §4: "distance > 30 (of 441.7
  max)").
- tolerant mismatch: raw mismatch with no ≤ 30-counterpart in `N2(p)` in either
  direction (definition above).
- pass: `tolerantMismatchRatio <= 0.02` (`docs/07-verification.md` §4:
  "pass if mismatched ≤ 2.0 % of stage pixels", now evaluated on the tolerant
  comparison; note `<=`, not `<`).

## heatmap.png encoding

Same dimensions as the inputs, RGBA8:

- raw-matched pixels: gray `round(0.25 * luma(pixel of A))` — dimmed context;
- raw-mismatched pixels: `t = min(1, distance / 441.6729559300637)`, RGB
  `(255, round(255 * (1 - t)), 0)` — yellow→red ramp by severity;
- alpha always 255.

The heatmap visualizes the **raw** metric (unchanged in v2); tolerant
mismatches are a subset reported numerically in `report.json`.

## Determinism

- Nothing that varies between runs enters `report.json`: no timestamps, no file
  paths, no random ordering; key order is fixed by construction.
- PNG output is fixed: signature + IHDR (RGBA8, non-interlaced) + single IDAT
  (zlib level 6, filter type 0 scanlines) + IEND — and nothing else.
- V8 evidence: two runs on the same inputs produce byte-identical
  `report.json` (and `heatmap.png`); see `evidence/logs/F1-v8-tolerant.log`.

## Self-tests

```
npm test -- diff
```

Covered (`verify/diff/diff.test.mjs`, 19 tests): codec round-trip, PNG error
cases, threshold boundary (30 matches, 31 mismatches; tolerant direction),
alpha semantics, identical stage → raw and tolerant ratio 0 / `pass: true`,
known 10×10 +100 block → exact raw bbox/ratio **and** exact tolerant 6×6 core
(36 px) at (+2,+2), structural changes still detected by the tolerant metric
(30×30 recolour → exact 26×26 core; 40×40 square shifted 6 px → survivors
confined to the 2-px remnant band), the radius boundary (a 4 px shift is fully
absorbed), size mismatch / undecodable / missing file / usage error contract
(`exit 1`, one stderr line), `--help`, and byte-identical reruns. Test images
are generated deterministically in a temp directory at test time (no binary
fixtures committed) by `verify/diff/fixtures.mjs`.

Manual fixture materialization:

```
node verify/diff/fixtures.mjs <outdir>   # writes base.png + mutated.png (550x400)
```

`base.png` uses 1-Lipschitz triangle-wave channels with values in [60, 90]
(range width 30); `mutated.png` adds exactly +100 per channel to the 10×10
block at (123, 45). These properties make the tolerant expectations analytic:
any two pixels within Chebyshev distance 2 differ by ≤ 12 per channel (so the
2-px border ring is always tolerated), while a +100 shift gives a ≥ 70
per-channel gap (so the 6×6 core is always counted); no value clips at 255
(90 + 100 = 190).

## Input PNG support

- Signature check plus per-chunk CRC verification.
- Supported: bit depth 8, non-interlaced, color types 0 (gray), 2 (RGB),
  3 (indexed + PLTE), 4 (gray+alpha), 6 (RGBA). Anything else is rejected with
  a clean one-line error (exit 1).
- Output is always RGBA8 PNG.

## Implementation decision — no npm dependency

Chosen: implement PNG read/write with `node:zlib` built-ins instead of adding a
pinned npm dependency (e.g. `pngjs`), because:

- the tool must run offline and deterministically in every later task; a
  built-in implementation removes install/version drift and network access;
- the required surface is small: non-interlaced depth-8 PNG in, RGBA8 PNG out;
- the only version requirement is Node ≥ 22.2.0 for `zlib.crc32`, verified on
  the project's Node `v22.14.0` (`evidence/logs/F1-env.log`, `zlib.crc32`
  probe value for `"123456789"` = `cbf43926`).

Consequence: `verify/diff/` has no `package.json` and no `node_modules`.
