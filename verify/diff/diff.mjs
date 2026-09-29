#!/usr/bin/env node
/**
 * verify/diff/diff.mjs — deterministic PNG pixel-diff tool (task F1).
 *
 * CLI:
 *   node verify/diff/diff.mjs <a.png> <b.png> <outdir> [--ignore-rect x,y,w,h]...
 *
 * Reads two PNGs of identical pixel dimensions, compares every pixel by RGB
 * Euclidean distance, and writes into <outdir>:
 *   report.json  — numeric metrics (schema documented in verify/diff/README.md)
 *   heatmap.png  — visual diff (encoding documented in verify/diff/README.md)
 *
 * Schema v2 reports the raw metric plus the anti-aliasing-tolerant metric that
 * is the V5 pass basis (docs/07-verification.md §4, Amendment 2026-09-28).
 * Schema v3 adds opt-in region exclusions (`--ignore-rect`): pixels inside the
 * given rects are excluded from the raw/tolerant mismatch counting and reported
 * as `ignoredRects`/`ignoredPixels`; every other field keeps its definition
 * (maxDistance/meanDistance stay full-image statistics). The task Y1 allowance
 * (owner-approved HD asset remaster) uses this mechanism; without
 * `--ignore-rect` the report is v3 with `ignoredRects: []`, `ignoredPixels: 0`.
 *
 * Exit codes:
 *   0 — comparison ran to completion; pass/fail is the "pass" field of report.json
 *   1 — usage error, missing file, undecodable PNG, or size mismatch;
 *       exactly one clean line on stderr, never a stack trace
 *
 * Zero runtime dependencies: PNG decode/encode uses node:zlib only.
 * Decision + evidence: verify/diff/README.md ("Implementation decision").
 * Requires Node >= 22.2.0 (zlib.crc32); verified on v22.14.0.
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

// evidence: docs/07-verification.md §4 — "a pixel is 'mismatched' if distance > 30"
export const MISMATCH_THRESHOLD = 30;
// evidence: docs/07-verification.md §4 — "pass if mismatched ≤ 2.0 % of stage
// pixels"; since the Amendment 2026-09-28 the pass basis is the
// anti-aliasing-tolerant ratio (the raw ratio is still reported).
export const PASS_RATIO = 0.02;
// evidence: docs/07-verification.md §4, Amendment 2026-09-28 — symmetric 5×5
// (Chebyshev radius 2, edge-clamped) anti-aliasing tolerance: a raw mismatch p
// is tolerated when some q in N2(p) has dist(A[p], B[q]) <= 30 or
// dist(B[p], A[q]) <= 30. Measurements: evidence/logs/orchestrator-tolerance-probe.log.
export const TOLERANT_RADIUS = 2;
// evidence: docs/07-verification.md §4 — "of 441.7 max" = sqrt(3) * 255
export const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);
// v1 = raw metric only; v2 adds tolerantRadius/tolerantMismatchedPixels/
// tolerantMismatchRatio/tolerantMismatchBBox and moves `pass` to the tolerant
// ratio; all raw fields are unchanged in name and value. v3 adds
// ignoredRects/ignoredPixels (opt-in `--ignore-rect`, task Y1): the excluded
// pixels no longer contribute to the raw/tolerant mismatch counts, ratios,
// bboxes or `pass`; all other field definitions are unchanged.
export const SCHEMA_VERSION = 3;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * Decode a PNG buffer into `{ width, height, data }` where `data` is RGBA8
 * (4 bytes per pixel, row-major). Supported inputs: bit depth 8, non-interlaced,
 * color types 0/2/3/4/6. Any other variant throws an Error with a clean message.
 */
export function decodePng(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('invalid PNG signature');
  }
  let header = null;
  let palette = null;
  let sawIend = false;
  const idat = [];
  let offset = 8;
  while (offset < buf.length) {
    if (offset + 12 > buf.length) throw new Error('truncated PNG chunk header');
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) throw new Error(`truncated PNG chunk ${type}`);
    const data = buf.subarray(dataStart, dataEnd);
    if (crc32(buf.subarray(offset + 4, dataEnd)) !== buf.readUInt32BE(dataEnd)) {
      throw new Error(`PNG chunk CRC mismatch (${type})`);
    }
    if (type === 'IHDR') {
      if (header !== null) throw new Error('duplicate IHDR chunk');
      if (length !== 13) throw new Error('invalid IHDR length');
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      sawIend = true;
      break;
    }
    offset = dataEnd + 4;
  }
  if (!sawIend) throw new Error('missing IEND chunk');
  if (header === null) throw new Error('missing IHDR chunk');
  if (header.compression !== 0 || header.filter !== 0) {
    throw new Error('unsupported PNG compression/filter method');
  }
  if (header.interlace !== 0) throw new Error('unsupported interlaced PNG (Adam7)');
  if (header.bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${header.bitDepth}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colorType];
  if (channels === undefined) throw new Error(`unsupported PNG color type ${header.colorType}`);
  if (header.width === 0 || header.height === 0) throw new Error('invalid PNG dimensions');
  if (idat.length === 0) throw new Error('missing IDAT chunk');

  const { width, height, colorType } = header;
  const bpp = channels; // bit depth is 8, so bytes per pixel === channel count
  const stride = width * channels;
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch (err) {
    throw new Error(`zlib inflate failed (${err.message})`, { cause: err });
  }
  if (raw.length < height * (stride + 1)) throw new Error('truncated PNG image data');

  const data = new Uint8Array(width * height * 4);
  const previous = new Uint8Array(stride);
  const current = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const rawByte = raw[rowStart + i];
      const left = i >= bpp ? current[i - bpp] : 0;
      const up = previous[i];
      const upLeft = i >= bpp ? previous[i - bpp] : 0;
      let value;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + left;
          break;
        case 2:
          value = rawByte + up;
          break;
        case 3:
          value = rawByte + ((left + up) >> 1);
          break;
        case 4:
          value = rawByte + paethPredictor(left, up, upLeft);
          break;
        default:
          throw new Error(`unknown PNG filter type ${filterType}`);
      }
      current[i] = value & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;
      const source = x * channels;
      if (colorType === 2) {
        data[target] = current[source];
        data[target + 1] = current[source + 1];
        data[target + 2] = current[source + 2];
        data[target + 3] = 255;
      } else if (colorType === 6) {
        data[target] = current[source];
        data[target + 1] = current[source + 1];
        data[target + 2] = current[source + 2];
        data[target + 3] = current[source + 3];
      } else if (colorType === 0) {
        const v = current[source];
        data[target] = v;
        data[target + 1] = v;
        data[target + 2] = v;
        data[target + 3] = 255;
      } else if (colorType === 4) {
        const v = current[source];
        data[target] = v;
        data[target + 1] = v;
        data[target + 2] = v;
        data[target + 3] = current[source + 1];
      } else {
        // colorType === 3 (indexed)
        if (palette === null) throw new Error('missing PLTE chunk for indexed PNG');
        const index = current[source] * 3;
        if (index + 2 >= palette.length) throw new Error('PLTE index out of range');
        data[target] = palette[index];
        data[target + 1] = palette[index + 1];
        data[target + 2] = palette[index + 2];
        data[target + 3] = 255;
      }
    }
    previous.set(current);
  }
  return { width, height, data };
}

/**
 * Encode `{ width, height, data }` (RGBA8) into a deterministic PNG buffer:
 * color type 6, bit depth 8, non-interlaced, filter type 0 scanlines,
 * zlib level 6, no metadata chunks.
 */
export function encodePng({ width, height, data }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('invalid image dimensions');
  }
  if (!data || data.length !== width * height * 4) {
    throw new Error('RGBA buffer length does not match dimensions');
  }
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    for (let i = 0; i < stride; i++) raw[row + 1 + i] = data[y * stride + i];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** RGB Euclidean distance between byte-address `i` of `dataA` and `j` of `dataB`. */
function pixelDistance(dataA, i, dataB, j) {
  const dr = dataA[i] - dataB[j];
  const dg = dataA[i + 1] - dataB[j + 1];
  const db = dataA[i + 2] - dataB[j + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Validate the opt-in ignore rects against the image dimensions.
 * Rects are `{x, y, w, h}` integer device-pixel boxes; they must lie fully
 * inside the image (`x >= 0`, `y >= 0`, `w >= 1`, `h >= 1`, `x + w <= width`,
 * `y + h <= height`). Throws a clean Error otherwise (CLI exit 1).
 */
export function normalizeIgnoreRects(rects, width, height) {
  return rects.map((rect) => {
    const { x, y, w, h } = rect;
    if (![x, y, w, h].every((value) => Number.isInteger(value))) {
      throw new Error(`ignore-rect values must be integers: ${x},${y},${w},${h}`);
    }
    if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > width || y + h > height) {
      throw new Error(
        `ignore-rect ${x},${y},${w},${h} outside ${width}x${height} (w,h >= 1)`,
      );
    }
    return { x, y, w, h };
  });
}

/**
 * Compare two RGBA8 images of identical dimensions.
 * Returns the report object (see verify/diff/README.md for the schema).
 * Alpha is not part of the distance (RGB only, docs/07-verification.md §4).
 *
 * `options.ignoreRects` (task Y1, schema v3): pixels inside the validated
 * rects are excluded from the mismatch counting — raw mismatches, tolerant
 * mismatches, ratios, bboxes and `pass` all ignore them. `maxDistance` and
 * `meanDistance` stay full-image statistics (unchanged definitions); the
 * tolerant neighbourhood check still sees all image pixels.
 */
export function compareImages(a, b, options = {}) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const { width, height } = a;
  const totalPixels = width * height;
  const ignoredRects = normalizeIgnoreRects(options.ignoreRects ?? [], width, height);
  let ignoredPixels = 0;
  let ignored = null;
  if (ignoredRects.length > 0) {
    ignored = new Uint8Array(totalPixels);
    for (const rect of ignoredRects) {
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        const row = y * width;
        ignored.fill(1, row + rect.x, row + rect.x + rect.w);
      }
    }
    for (let n = 0; n < totalPixels; n++) ignoredPixels += ignored[n];
  }
  let mismatchedPixels = 0;
  let maxDistance = 0;
  let sumDistance = 0;
  let minX = 0;
  let minY = 0;
  let maxX = -1;
  let maxY = 0;
  // Raw pass: full statistics + row-major addresses of the raw mismatches, so
  // the tolerant pass only ever re-checks pixels already mismatched. Ignored
  // pixels contribute to maxDistance/meanDistance but never to the mismatch
  // counts.
  const rawMismatchPixelIndices = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = y * width + x;
      const i = n * 4;
      const distance = pixelDistance(a.data, i, b.data, i);
      sumDistance += distance;
      if (distance > maxDistance) maxDistance = distance;
      if (ignored !== null && ignored[n] === 1) continue;
      if (distance > MISMATCH_THRESHOLD) {
        rawMismatchPixelIndices.push(n);
        if (maxX < minX) {
          minX = x;
          minY = y;
          maxX = x;
          maxY = y;
        } else {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        mismatchedPixels += 1;
      }
    }
  }

  // Anti-aliasing-tolerant pass (docs/07-verification.md §4, Amendment
  // 2026-09-28): symmetric radius-2 Chebyshev neighbourhood, borders clamped.
  let tolerantMismatchedPixels = 0;
  let tolerantMinX = 0;
  let tolerantMinY = 0;
  let tolerantMaxX = -1;
  let tolerantMaxY = 0;
  for (const n of rawMismatchPixelIndices) {
    const px = n % width;
    const py = (n - px) / width;
    const x0 = Math.max(0, px - TOLERANT_RADIUS);
    const x1 = Math.min(width - 1, px + TOLERANT_RADIUS);
    const y0 = Math.max(0, py - TOLERANT_RADIUS);
    const y1 = Math.min(height - 1, py + TOLERANT_RADIUS);
    const p = n * 4;
    let tolerated = false;
    for (let qy = y0; qy <= y1 && !tolerated; qy++) {
      for (let qx = x0; qx <= x1; qx++) {
        const q = (qy * width + qx) * 4;
        if (
          pixelDistance(a.data, p, b.data, q) <= MISMATCH_THRESHOLD ||
          pixelDistance(b.data, p, a.data, q) <= MISMATCH_THRESHOLD
        ) {
          tolerated = true;
          break;
        }
      }
    }
    if (!tolerated) {
      if (tolerantMaxX < tolerantMinX) {
        tolerantMinX = px;
        tolerantMinY = py;
        tolerantMaxX = px;
        tolerantMaxY = py;
      } else {
        if (px < tolerantMinX) tolerantMinX = px;
        if (px > tolerantMaxX) tolerantMaxX = px;
        if (py < tolerantMinY) tolerantMinY = py;
        if (py > tolerantMaxY) tolerantMaxY = py;
      }
      tolerantMismatchedPixels += 1;
    }
  }
  const tolerantMismatchRatio = tolerantMismatchedPixels / totalPixels;
  return {
    schemaVersion: SCHEMA_VERSION,
    tool: 'verify/diff/diff.mjs',
    width,
    height,
    totalPixels,
    mismatchThreshold: MISMATCH_THRESHOLD,
    passRatio: PASS_RATIO,
    tolerantRadius: TOLERANT_RADIUS,
    mismatchedPixels,
    mismatchRatio: mismatchedPixels / totalPixels,
    maxDistance,
    meanDistance: sumDistance / totalPixels,
    mismatchBBox:
      maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    tolerantMismatchedPixels,
    tolerantMismatchRatio,
    tolerantMismatchBBox:
      tolerantMaxX < tolerantMinX
        ? null
        : {
            x: tolerantMinX,
            y: tolerantMinY,
            width: tolerantMaxX - tolerantMinX + 1,
            height: tolerantMaxY - tolerantMinY + 1,
          },
    ignoredRects,
    ignoredPixels,
    pass: tolerantMismatchRatio <= PASS_RATIO,
  };
}

/**
 * Build a heatmap RGBA8 image (same dimensions as the inputs):
 *   matched pixels    — gray = round(0.25 * luma(a)), context for the diff
 *   mismatched pixels — yellow→red ramp: t = min(1, d / 441.67),
 *                       RGB = (255, round(255 * (1 - t)), 0)
 *   alpha always 255.
 */
export function buildHeatmap(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const { width, height } = a;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dr = a.data[i] - b.data[i];
      const dg = a.data[i + 1] - b.data[i + 1];
      const db = a.data[i + 2] - b.data[i + 2];
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      if (distance > MISMATCH_THRESHOLD) {
        const t = Math.min(1, distance / MAX_RGB_DISTANCE);
        data[i] = 255;
        data[i + 1] = Math.round(255 * (1 - t));
        data[i + 2] = 0;
      } else {
        const luma = 0.2126 * a.data[i] + 0.7152 * a.data[i + 1] + 0.0722 * a.data[i + 2];
        const gray = Math.round(luma * 0.25);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function decodePngFile(path) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (err) {
    throw new Error(`cannot read ${basename(path)}: ${String(err.message).split('\n')[0]}`, {
      cause: err,
    });
  }
  try {
    return decodePng(bytes);
  } catch (err) {
    throw new Error(`cannot decode ${basename(path)}: ${String(err.message).split('\n')[0]}`, {
      cause: err,
    });
  }
}

/**
 * Full run: decode both files, compare, write `<outDir>/report.json` and
 * `<outDir>/heatmap.png`, return the report object. Nothing that varies
 * between runs (timestamps, output paths) enters the report.
 *
 * `options.ignoreRects` — validated against the decoded dimensions and passed
 * to compareImages (see there). The heatmap stays the raw full-image view.
 */
export function runComparison(aPath, bPath, outDir, options = {}) {
  const a = decodePngFile(aPath);
  const b = decodePngFile(bPath);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `size mismatch: ${basename(aPath)} is ${a.width}x${a.height}, ${basename(bPath)} is ${b.width}x${b.height}`,
    );
  }
  const report = compareImages(a, b, options);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'heatmap.png'), encodePng(buildHeatmap(a, b)));
  return report;
}

/**
 * Parse CLI arguments: exactly three positional paths plus the repeatable
 * `--ignore-rect x,y,w,h` option (task Y1). Values are syntax-checked here
 * (non-negative integers, w/h >= 1); the image-bounds check runs once the
 * dimensions are known (compareImages). Throws a clean Error on any problem.
 */
export function parseCliArgs(args) {
  const positional = [];
  const ignoreRects = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--ignore-rect') {
      const value = args[++i];
      const parts = typeof value === 'string' ? value.split(',') : [];
      if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) {
        throw new Error(`invalid --ignore-rect ${value ?? ''} (expected x,y,w,h)`);
      }
      const [x, y, w, h] = parts.map(Number);
      if (w < 1 || h < 1) {
        throw new Error(`invalid --ignore-rect ${value} (w and h must be >= 1)`);
      }
      ignoreRects.push({ x, y, w, h });
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { positional, ignoreRects };
}

const USAGE_LINE =
  'usage: node verify/diff/diff.mjs <a.png> <b.png> <outdir> [--ignore-rect x,y,w,h]...';
const HELP_TEXT = `verify/diff/diff.mjs — deterministic PNG pixel-diff (Kelimatör 2012, task F1)

${USAGE_LINE}

Compares two PNGs of identical dimensions pixel by pixel over the RGB
channels. A pixel is mismatched when its Euclidean distance is > ${MISMATCH_THRESHOLD};
the report passes when the mismatch ratio is <= ${PASS_RATIO} (2.0 % of pixels)
per docs/07-verification.md §4. Writes <outdir>/report.json and
<outdir>/heatmap.png.

--ignore-rect x,y,w,h (repeatable, task Y1): pixels inside the given
device-pixel rects are excluded from the mismatch counting and reported as
"ignoredRects"/"ignoredPixels". The rect must lie inside the image.

Exit codes:
  0  comparison completed; pass/fail is the "pass" field of report.json
  1  usage error, size mismatch, missing file, undecodable PNG, or invalid
     --ignore-rect
`;

/**
 * CLI entry point. Returns the process exit code (does not call process.exit).
 */
export function main(argv = process.argv) {
  const args = argv.slice(2);
  if (args.length === 1 && (args[0] === '-h' || args[0] === '--help' || args[0] === 'help')) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  try {
    const { positional, ignoreRects } = parseCliArgs(args);
    if (positional.length !== 3) {
      process.stderr.write(`diff: ${USAGE_LINE} (try --help)\n`);
      return 1;
    }
    const report = runComparison(positional[0], positional[1], positional[2], { ignoreRects });
    const ignored =
      ignoreRects.length === 0 ? '' : ` ignoredPixels=${report.ignoredPixels}`;
    process.stdout.write(
      `diff: mismatchedPixels=${report.mismatchedPixels} totalPixels=${report.totalPixels} ` +
        `mismatchRatio=${report.mismatchRatio}${ignored} pass=${report.pass} -> ${join(positional[2], 'report.json')}\n`,
    );
    return 0;
  } catch (err) {
    const message = String(err && err.message ? err.message : err).split('\n')[0];
    process.stderr.write(`diff: ${message}\n`);
    return 1;
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = main(process.argv);
}
