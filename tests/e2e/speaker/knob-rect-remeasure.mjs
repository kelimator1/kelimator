#!/usr/bin/env node
// tests/e2e/speaker/knob-rect-remeasure.mjs — Y4 knob-allowance re-measurement
// (manual run; not part of `npm run e2e`). Committed so the decision can be
// reproduced byte-for-byte.
//
// Reads the S2 captures the visual suite just produced
// (`test-results/E2-live/S2/dsf{1,2}/actual.png` with the default E2_RECORD=0;
// run `npm run e2e -- visual` first) plus the C3 reference captures and the
// pre-fix Y1 captures (`evidence/visual/Y1/after-S2-dsf{1,2}-actual.png`), then:
//   1. runs the F1 diff tool (`runComparison`, same call the suites make) for
//      the full allowance, the allowance without the knob rect, and prints the
//      aggregates;
//   2. re-computes the per-pixel mismatch map with the tool's documented
//      definitions (RGB distance > 30; radius-2 symmetric tolerance) to get the
//      tight bbox of the remaining knob deviation (raw and tolerant-unmatched)
//      per deviceScaleFactor, union converted to dsf1 stage pixels;
//   3. writes crops/heatmaps to `evidence/visual/Y4/remeasure/` and a JSON
//      summary used by evidence/Y4-knob-alpha.md.
//
// The allowance rects are read from the derivation mirror
// `evidence/visual/Y1/derivation/final-rects.json` (the last entry is the knob
// rect) and the Y2 credit rect is the wired stage-clipped form; the visual
// suite asserts the tool receives exactly these sets.
//
// Silent witness: no browser is launched here (captures are produced by the
// Playwright suite, which runs muted Chromium); nothing is played.
//
// Usage: node tests/e2e/speaker/knob-rect-remeasure.mjs
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHeatmap,
  compareImages,
  decodePng,
  encodePng,
  MISMATCH_THRESHOLD,
  TOLERANT_RADIUS,
} from '../../../verify/diff/diff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'evidence/visual/Y4/remeasure');
const REFERENCE = {
  1: path.join(ROOT, 'tests/fixtures/reference/S2-idle-board.png'),
  2: path.join(ROOT, 'tests/fixtures/reference/dsf2/S2-idle-board.png'),
};
const ACTUAL = (dsf) => path.join(ROOT, `test-results/E2-live/S2/dsf${dsf}/actual.png`);
const PREFIX = (dsf) => path.join(ROOT, `evidence/visual/Y1/after-S2-dsf${dsf}-actual.png`);
/** C3 measurement box (evidence/C3-speaker-capture.md) — the knob neighbourhood. */
const NEIGHBORHOOD = { x: 505, y: 356, w: 45, h: 44 };
/** Wired (stage-clipped) Y2 credit-omission rect, dsf1 stage pixels. */
const Y2 = [{ x: 0, y: 367, w: 105, h: 33 }];

const mirror = JSON.parse(
  readFileSync(path.join(ROOT, 'evidence/visual/Y1/derivation/final-rects.json'), 'utf8'),
);
const knob = mirror[mirror.length - 1];
if (knob.x !== 515 || knob.y !== 370 || knob.w !== 22 || knob.h !== 20) {
  throw new Error(`unexpected mirror tail: ${JSON.stringify(knob)}`);
}
const y1NoKnob = mirror.slice(0, -1);
const full = [...mirror, ...Y2];
const noKnob = [...y1NoKnob, ...Y2];

const scale = (rects, dsf) =>
  rects.map((r) => ({ x: r.x * dsf, y: r.y * dsf, w: r.w * dsf, h: r.h * dsf }));

/** Tool-identical mismatch map: raw (> threshold) and tolerant-unmatched. */
function mismatchMap(a, b, rects) {
  const { width, height } = a;
  const totalPixels = width * height;
  const ignored = new Uint8Array(totalPixels);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      ignored.fill(1, y * width + rect.x, y * width + rect.x + rect.w);
    }
  }
  const distance = (i, j) =>
    Math.hypot(
      a.data[i] - b.data[j],
      a.data[i + 1] - b.data[j + 1],
      a.data[i + 2] - b.data[j + 2],
    );
  const raw = [];
  for (let n = 0; n < totalPixels; n++) {
    if (ignored[n] === 1) continue;
    if (distance(n * 4, n * 4) > MISMATCH_THRESHOLD) raw.push(n);
  }
  const tolerantUnmatched = [];
  for (const n of raw) {
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
        if (distance(p, q) <= MISMATCH_THRESHOLD || distance(q, p) <= MISMATCH_THRESHOLD) {
          tolerated = true;
          break;
        }
      }
    }
    if (!tolerated) tolerantUnmatched.push(n);
  }
  return { raw, tolerantUnmatched };
}

function bbox(indices, width) {
  if (indices.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of indices) {
    const x = n % width;
    const y = (n - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function inNeighborhood(indices, width, dsf) {
  const box = {
    x: NEIGHBORHOOD.x * dsf,
    y: NEIGHBORHOOD.y * dsf,
    w: NEIGHBORHOOD.w * dsf,
    h: NEIGHBORHOOD.h * dsf,
  };
  return indices.filter((n) => {
    const x = n % width;
    const y = (n - x) / width;
    return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
  });
}

/** Indices inside the current knob allowance rect (dsf1 stage pixels) × dsf. */
function inKnobRect(indices, width, dsf) {
  const box = { x: knob.x * dsf, y: knob.y * dsf, w: knob.w * dsf, h: knob.h * dsf };
  return indices.filter((n) => {
    const x = n % width;
    const y = (n - x) / width;
    return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
  });
}

/** dsf-device bbox → dsf1 stage bbox (half-open: floor / ceil). */
function toDsf1(box, dsf) {
  if (box === null) return null;
  return {
    x: Math.floor(box.x / dsf),
    y: Math.floor(box.y / dsf),
    w: Math.ceil((box.x + box.w) / dsf) - Math.floor(box.x / dsf),
    h: Math.ceil((box.y + box.h) / dsf) - Math.floor(box.y / dsf),
  };
}

function union(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

function crop(image, box) {
  const data = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const source = ((box.y + y) * image.width + box.x) * 4;
    data.set(image.data.subarray(source, source + box.w * 4), y * box.w * 4);
  }
  return { width: box.w, height: box.h, data };
}

mkdirSync(OUT, { recursive: true });
const analysis = { tool: 'tests/e2e/speaker/knob-rect-remeasure.mjs', neighborhood: NEIGHBORHOOD, knobRect: knob, deviceScaleFactors: {} };
let unionRawDsf1 = null;
let unionTolerantDsf1 = null;
let unionRawKnobDsf1 = null;
let unionTolerantKnobDsf1 = null;

for (const dsf of [1, 2]) {
  if (!existsSync(ACTUAL(dsf))) throw new Error(`missing ${ACTUAL(dsf)} — run the visual suite first`);
  const actual = decodePng(readFileSync(ACTUAL(dsf)));
  const reference = decodePng(readFileSync(REFERENCE[dsf]));
  const prefix = decodePng(readFileSync(PREFIX(dsf)));

  const fullReport = compareImages(actual, reference, { ignoreRects: scale(full, dsf) });
  const noKnobReport = compareImages(actual, reference, { ignoreRects: scale(noKnob, dsf) });
  const prefixNoKnobReport = compareImages(prefix, reference, { ignoreRects: scale(noKnob, dsf) });

  const after = mismatchMap(actual, reference, scale(noKnob, dsf));
  const before = mismatchMap(prefix, reference, scale(noKnob, dsf));
  const afterRawNeighborhood = inNeighborhood(after.raw, actual.width, dsf);
  const afterTolerantNeighborhood = inNeighborhood(after.tolerantUnmatched, actual.width, dsf);
  const beforeRawNeighborhood = inNeighborhood(before.raw, actual.width, dsf);
  const beforeTolerantNeighborhood = inNeighborhood(before.tolerantUnmatched, actual.width, dsf);
  const afterRawKnob = inKnobRect(after.raw, actual.width, dsf);
  const afterTolerantKnob = inKnobRect(after.tolerantUnmatched, actual.width, dsf);
  const beforeRawKnob = inKnobRect(before.raw, actual.width, dsf);
  const beforeTolerantKnob = inKnobRect(before.tolerantUnmatched, actual.width, dsf);

  const rawBox = bbox(afterRawNeighborhood, actual.width);
  const tolerantBox = bbox(afterTolerantNeighborhood, actual.width);
  const rawKnobBox = bbox(afterRawKnob, actual.width);
  const tolerantKnobBox = bbox(afterTolerantKnob, actual.width);
  const beforeRawKnobBox = bbox(beforeRawKnob, actual.width);
  unionRawDsf1 = union(unionRawDsf1, toDsf1(rawBox, dsf));
  unionTolerantDsf1 = union(unionTolerantDsf1, toDsf1(tolerantBox, dsf));
  unionRawKnobDsf1 = union(unionRawKnobDsf1, toDsf1(rawKnobBox, dsf));
  unionTolerantKnobDsf1 = union(unionTolerantKnobDsf1, toDsf1(tolerantKnobBox, dsf));

  const neighborhoodDevice = {
    x: NEIGHBORHOOD.x * dsf,
    y: NEIGHBORHOOD.y * dsf,
    w: NEIGHBORHOOD.w * dsf,
    h: NEIGHBORHOOD.h * dsf,
  };
  writeFileSync(
    path.join(OUT, `dsf${dsf}-app.png`),
    encodePng(crop(actual, neighborhoodDevice)),
  );
  writeFileSync(
    path.join(OUT, `dsf${dsf}-reference.png`),
    encodePng(crop(reference, neighborhoodDevice)),
  );
  writeFileSync(
    path.join(OUT, `dsf${dsf}-prefix.png`),
    encodePng(crop(prefix, neighborhoodDevice)),
  );
  writeFileSync(
    path.join(OUT, `dsf${dsf}-heatmap-noknob.png`),
    encodePng(buildHeatmap(actual, reference)),
  );

  analysis.deviceScaleFactors[dsf] = {
    fullAllowance: {
      mismatchedPixels: fullReport.mismatchedPixels,
      tolerantMismatchedPixels: fullReport.tolerantMismatchedPixels,
      tolerantMismatchRatio: fullReport.tolerantMismatchRatio,
      ignoredPixels: fullReport.ignoredPixels,
      pass: fullReport.pass,
    },
    noKnobAllowance: {
      mismatchedPixels: noKnobReport.mismatchedPixels,
      tolerantMismatchedPixels: noKnobReport.tolerantMismatchedPixels,
      tolerantMismatchRatio: noKnobReport.tolerantMismatchRatio,
      ignoredPixels: noKnobReport.ignoredPixels,
      pass: noKnobReport.pass,
    },
    neighborhoodAfterFixNoKnob: {
      raw: afterRawNeighborhood.length,
      tolerantUnmatched: afterTolerantNeighborhood.length,
      rawBBox: rawBox,
      tolerantBBox: tolerantBox,
      rawBBoxDsf1: toDsf1(rawBox, dsf),
      tolerantBBoxDsf1: toDsf1(tolerantBox, dsf),
    },
    knobRectAfterFixNoKnob: {
      raw: afterRawKnob.length,
      tolerantUnmatched: afterTolerantKnob.length,
      rawBBox: rawKnobBox,
      tolerantBBox: tolerantKnobBox,
      rawBBoxDsf1: toDsf1(rawKnobBox, dsf),
      tolerantBBoxDsf1: toDsf1(tolerantKnobBox, dsf),
    },
    knobRectPreFixNoKnob: {
      raw: beforeRawKnob.length,
      tolerantUnmatched: beforeTolerantKnob.length,
      rawBBox: beforeRawKnobBox,
    },
    neighborhoodPreFixNoKnob: {
      raw: beforeRawNeighborhood.length,
      tolerantUnmatched: beforeTolerantNeighborhood.length,
      rawBBox: bbox(beforeRawNeighborhood, prefix.width),
      tolerantBBox: bbox(beforeTolerantNeighborhood, prefix.width),
      prefixNoKnobWholeImageTolerant: prefixNoKnobReport.tolerantMismatchedPixels,
    },
  };
  console.log(
    `dsf${dsf}: full tolerant=${(fullReport.tolerantMismatchRatio * 100).toFixed(3)}% pass=${fullReport.pass} | ` +
      `noKnob tolerant=${(noKnobReport.tolerantMismatchRatio * 100).toFixed(3)}% pass=${noKnobReport.pass} | ` +
      `neighborhood raw=${afterRawNeighborhood.length} tolerant=${afterTolerantNeighborhood.length} | ` +
      `knobRect raw=${afterRawKnob.length} tolerant=${afterTolerantKnob.length} ` +
      `rawBox=${JSON.stringify(rawKnobBox)} tolerantBox=${JSON.stringify(tolerantKnobBox)} | ` +
      `pre-fix knobRect raw=${beforeRawKnob.length} tolerant=${beforeTolerantKnob.length} ` +
      `rawBox=${JSON.stringify(beforeRawKnobBox)}`,
  );
}

analysis.unionDsf1 = {
  neighborhoodRawBBox: unionRawDsf1,
  neighborhoodTolerantBBox: unionTolerantDsf1,
  knobRectRawBBox: unionRawKnobDsf1,
  knobRectTolerantBBox: unionTolerantKnobDsf1,
};
writeFileSync(path.join(OUT, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
console.log(
  `union dsf1 knob-rect-restricted: raw=${JSON.stringify(unionRawKnobDsf1)} tolerant=${JSON.stringify(unionTolerantKnobDsf1)}`,
);
