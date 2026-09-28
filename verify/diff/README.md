# verify/diff — PNG pixel-diff tool (task F1)

Deterministic, zero-dependency pixel differ for the visual-regression tasks
(C3, E2, E3, F2). Thresholds and pass rule come from `docs/07-verification.md` §4.

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

| field | type | meaning |
|---|---|---|
| `schemaVersion` | number | report schema version, currently `1` |
| `tool` | string | constant `"verify/diff/diff.mjs"` |
| `width`, `height` | number | pixel dimensions (identical for both inputs) |
| `totalPixels` | number | `width * height` |
| `mismatchThreshold` | number | `30` — RGB Euclidean distance above which a pixel counts as mismatched |
| `passRatio` | number | `0.02` — maximum accepted mismatch ratio |
| `mismatchedPixels` | number | count of pixels with distance `> 30` |
| `mismatchRatio` | number | `mismatchedPixels / totalPixels` (unrounded) |
| `maxDistance` | number | maximum RGB Euclidean distance observed (`0 .. 441.6729559300637`) |
| `meanDistance` | number | arithmetic mean of the distance over all pixels (unrounded) |
| `mismatchBBox` | object \| null | tight bounding box `{x, y, width, height}` of mismatched pixels; `null` when there are none |
| `pass` | boolean | `mismatchedPixels <= totalPixels * passRatio` |

Numbers are full IEEE-754 doubles as serialized by `JSON.stringify`; key order
is fixed. Distance is computed over R, G and B only — alpha is ignored
(`docs/07-verification.md` §4 defines RGB Euclidean distance).

### Pass rule and threshold

- mismatch: RGB Euclidean distance **strictly greater than 30**; distance
  exactly 30 is a match (`docs/07-verification.md` §4: "distance > 30 (of 441.7
  max)").
- pass: `mismatchedPixels <= totalPixels * 0.02` (`docs/07-verification.md` §4:
  "pass if mismatched ≤ 2.0 % of stage pixels"; note `<=`, not `<`).

## heatmap.png encoding

Same dimensions as the inputs, RGBA8:

- matched pixels: gray `round(0.25 * luma(pixel of A))` — dimmed context;
- mismatched pixels: `t = min(1, distance / 441.6729559300637)`, RGB
  `(255, round(255 * (1 - t)), 0)` — yellow→red ramp by severity;
- alpha always 255.

## Determinism

- Nothing that varies between runs enters `report.json`: no timestamps, no file
  paths, no random ordering; key order is fixed by construction.
- PNG output is fixed: signature + IHDR (RGBA8, non-interlaced) + single IDAT
  (zlib level 6, filter type 0 scanlines) + IEND — and nothing else.
- V8 evidence: two runs on the same inputs produce byte-identical
  `report.json` (and `heatmap.png`); see `evidence/logs/F1-v8.log`.

## Self-tests

```
npm test -- diff
```

Covered (`verify/diff/diff.test.mjs`, 16 tests): codec round-trip, PNG error
cases, threshold boundary (30 matches, 31 mismatches), alpha semantics,
identical stage → ratio 0 / `pass: true`, known 10×10 +100 block → exact
bounding box and ratio, size mismatch / undecodable / missing file / usage
error contract (`exit 1`, one stderr line), `--help`, and byte-identical
reruns. Test images are generated deterministically in a temp directory at
test time (no binary fixtures committed) by `verify/diff/fixtures.mjs`.

Manual fixture materialization:

```
node verify/diff/fixtures.mjs <outdir>   # writes base.png + mutated.png (550x400)
```

`base.png` has channel values in [50, 155]; `mutated.png` adds exactly +100 per
channel to the 10×10 block at (123, 45), so no value clips at 255.

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
