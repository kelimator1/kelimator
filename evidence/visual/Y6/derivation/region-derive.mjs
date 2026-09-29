#!/usr/bin/env node
// Y6 (owner directive tasks/Y6-top10-omission.md) — region derivation probe.
//
// Measures, for the S2 idle board at deviceScaleFactor 1 and 2:
//   1. the omission change set   — pixels where |post − pre| > 30 (raw
//      threshold of the F1 tool; the post↔pre run is also done through the
//      verify/diff/diff.mjs CLI, see evidence/logs/Y6-prepost-diff.log);
//   2. the attribution mask      — pixels where |post − reference| > 30 AND
//      |pre − reference| <= 30 (mismatch present after the omission but not
//      before it: exactly the deviation the reference comparison would count
//      if the owner-approved region were not wired);
//   3. the union of both deviceScaleFactors in dsf1 stage coordinates
//      (dsf2 pixels folded 2x, the Y1 §5 convention);
//   4. coverage of the declared owner region Y6_TOP10_OMISSION_RECT
//      (419,372,91,23) and the overlap of the wired rect with the Y1/Y2 sets;
//   5. before/after/reference region crops for the evidence.
//
// Reads the F1 decoder (verify/diff/diff.mjs) — one comparison basis, no
// second pixel implementation. Writes: evidence/visual/Y6/derivation/
// region-derivation.json, evidence/visual/Y6/crops/*.png.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from '../../../../verify/diff/diff.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)); // evidence/visual/Y6/derivation
const REPO = join(HERE, '..', '..', '..', '..');
const EVIDENCE = join(REPO, 'evidence', 'visual', 'Y6');
const CROPS = join(EVIDENCE, 'crops');

const PRE = { 1: join(EVIDENCE, 'pre/S2-dsf1-prefix.png'), 2: join(EVIDENCE, 'pre/S2-dsf2-prefix.png') };
const POST = { 1: join(EVIDENCE, 'post/S2-dsf1-postfix.png'), 2: join(EVIDENCE, 'post/S2-dsf2-postfix.png') };
const REF = {
  1: join(REPO, 'tests/fixtures/reference/S2-idle-board.png'),
  2: join(REPO, 'tests/fixtures/reference/dsf2/S2-idle-board.png'),
};

const THRESHOLD = 30; // F1 raw mismatch threshold (docs/07 §4)
const DECLARED = [419, 372, 91, 23]; // Y6_TOP10_OMISSION_RECT
// Measurement window (dsf1 stage px): the declared rect padded 9 px left and
// 1 px right/bottom; excludes the speaker (x>=513.99) and every Y1 rect.
const WINDOW = { x: 410, y: 365, w: 100, h: 35 };

function dist(a, i, b, j) {
  const dr = a.data[i] - b.data[j];
  const dg = a.data[i + 1] - b.data[j + 1];
  const db = a.data[i + 2] - b.data[j + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function load(path) {
  return decodePng(readFileSync(path));
}

/** Bbox of a predicate over the image; null when empty. */
function maskBbox(image, predicate) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  const mask = new Uint8Array(image.width * image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const n = y * image.width + x;
      if (predicate(n, x, y, n * 4)) {
        mask[n] = 1;
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return {
    count,
    mask,
    bbox: maxX < minX ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

function crop(image, rect) {
  const data = new Uint8Array(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const src = ((rect.y + y) * image.width + rect.x + x) * 4;
      const dst = (y * rect.w + x) * 4;
      data[dst] = image.data[src];
      data[dst + 1] = image.data[src + 1];
      data[dst + 2] = image.data[src + 2];
      data[dst + 3] = image.data[src + 3];
    }
  }
  return { width: rect.w, height: rect.h, data };
}

function inside(bbox, rect) {
  return (
    bbox !== null &&
    bbox.x >= rect.x &&
    bbox.y >= rect.y &&
    bbox.x + bbox.w <= rect.x + rect.w &&
    bbox.y + bbox.h <= rect.y + rect.h
  );
}

mkdirSync(CROPS, { recursive: true });

const report = {
  task: 'Y6',
  threshold: THRESHOLD,
  declaredRect: DECLARED,
  window: WINDOW,
  perDsf: {},
};

const unionMask = new Uint8Array(550 * 400); // dsf1 stage pixels
const attributionUnion = new Uint8Array(550 * 400);

for (const dsf of [1, 2]) {
  const pre = load(PRE[dsf]);
  const post = load(POST[dsf]);
  const ref = load(REF[dsf]);
  const [dx, dy, dw, dh] = DECLARED.map((v) => v * dsf);
  const rect = { x: dx, y: dy, w: dw, h: dh };
  const win = { x: WINDOW.x * dsf, y: WINDOW.y * dsf, w: WINDOW.w * dsf, h: WINDOW.h * dsf };

  const changed = maskBbox(post, (n, _x, _y, i) => dist(post, i, pre, i) > THRESHOLD);
  const attributed = maskBbox(
    post,
    (n, _x, _y, i) => dist(post, i, ref, i) > THRESHOLD && dist(pre, i, ref, i) <= THRESHOLD,
  );

  // Raw (distance > 30) counts for the post vs reference comparison inside the
  // declared rect and inside the measurement window (context for the tool run).
  let postRefInRect = 0;
  let postRefInWindow = 0;
  let preRefInWindow = 0;
  for (let y = 0; y < post.height; y++) {
    for (let x = 0; x < post.width; x++) {
      const i = (y * post.width + x) * 4;
      const inWindow = x >= win.x && x < win.x + win.w && y >= win.y && y < win.y + win.h;
      const inRect = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      if (inRect && dist(post, i, ref, i) > THRESHOLD) postRefInRect += 1;
      if (inWindow && dist(post, i, ref, i) > THRESHOLD) postRefInWindow += 1;
      if (inWindow && dist(pre, i, ref, i) > THRESHOLD) preRefInWindow += 1;
    }
  }

  // Attribution pixels outside the declared rect (must be 0).
  let attributedOutside = 0;
  for (let y = 0; y < attributed.mask.length; y++) {
    if (attributed.mask[y] !== 1) continue;
    const x = y % post.width;
    const py = (y - x) / post.width;
    if (x < rect.x || x >= rect.x + rect.w || py < rect.y || py >= rect.y + rect.h) {
      attributedOutside += 1;
    }
  }

  // Union in dsf1 coordinates (dsf2 pixels folded 2x).
  if (dsf === 1) {
    for (let n = 0; n < changed.mask.length; n++) if (changed.mask[n] === 1) unionMask[n] = 1;
    for (let n = 0; n < attributed.mask.length; n++) if (attributed.mask[n] === 1) attributionUnion[n] = 1;
  } else {
    for (let y = 0; y < post.height; y++) {
      for (let x = 0; x < post.width; x++) {
        const n = y * post.width + x;
        if (changed.mask[n] === 1) unionMask[((y >> 1) * 550) + (x >> 1)] = 1;
        if (attributed.mask[n] === 1) attributionUnion[((y >> 1) * 550) + (x >> 1)] = 1;
      }
    }
  }

  report.perDsf[dsf] = {
    changedBbox: changed.bbox,
    changedCount: changed.count,
    attributionBbox: attributed.bbox,
    attributionCount: attributed.count,
    attributedOutsideDeclaredRect: attributedOutside,
    postRefMismatchInDeclaredRect: postRefInRect,
    postRefMismatchInWindow: postRefInWindow,
    preRefMismatchInWindow: preRefInWindow,
  };

  // Crops for evidence: before / after / reference of the button region.
  const cropRect = { x: 415, y: 364, w: 96, h: 36 };
  const scaled = { x: cropRect.x * dsf, y: cropRect.y * dsf, w: cropRect.w * dsf, h: cropRect.h * dsf };
  writeFileSync(join(CROPS, `S2-dsf${dsf}-top10-before.png`), encodePng(crop(pre, scaled)));
  writeFileSync(join(CROPS, `S2-dsf${dsf}-top10-after.png`), encodePng(crop(post, scaled)));
  writeFileSync(join(CROPS, `S2-dsf${dsf}-top10-reference.png`), encodePng(crop(ref, scaled)));
  // F1-CLI crop inputs (measurement window) for the post/pre vs reference runs.
  writeFileSync(join(CROPS, `S2-dsf${dsf}-window-pre.png`), encodePng(crop(pre, win)));
  writeFileSync(join(CROPS, `S2-dsf${dsf}-window-post.png`), encodePng(crop(post, win)));
  writeFileSync(join(CROPS, `S2-dsf${dsf}-window-reference.png`), encodePng(crop(ref, win)));
}

function bboxOfMask(mask, width) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let n = 0; n < mask.length; n++) {
    if (mask[n] !== 1) continue;
    count += 1;
    const x = n % width;
    const y = (n - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { count, bbox: maxX < minX ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

const unionBbox = bboxOfMask(unionMask, 550);
const attributionUnionBbox = bboxOfMask(attributionUnion, 550);
report.unionDsf1Coordinates = {
  changedUnion: unionBbox,
  attributionUnion: attributionUnionBbox,
  changedUnionInsideDeclared: inside(unionBbox.bbox, {
    x: DECLARED[0],
    y: DECLARED[1],
    w: DECLARED[2],
    h: DECLARED[3],
  }),
  attributionUnionOutsideDeclared: (() => {
    const [x, y, w, h] = DECLARED;
    let outside = 0;
    for (let n = 0; n < attributionUnion.length; n++) {
      if (attributionUnion[n] !== 1) continue;
      const px = n % 550;
      const py = (n - px) / 550;
      if (px < x || px >= x + w || py < y || py >= y + h) outside += 1;
    }
    return outside;
  })(),
};

// --- Overlap / union with the Y1 and Y2 allowance sets -----------------------
const statesSource = readFileSync(join(REPO, 'tests/e2e/visual-states.ts'), 'utf8');
const y1Start = statesSource.indexOf('export const Y1_IGNORE_RECTS');
const y1End = statesSource.indexOf('];', y1Start);
const y1Rects = [...statesSource.slice(y1Start, y1End).matchAll(/\[(\d+), (\d+), (\d+), (\d+)\]/g)].map(
  (m) => m.slice(1).map(Number),
);
const Y2_RECT = [0, 367, 105, 33];
const Y6_RECT = DECLARED;

function cellsOf(rects) {
  const cells = new Set();
  for (const [x, y, w, h] of rects) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) cells.add(yy * 10000 + xx);
  }
  return cells;
}

const y1Cells = cellsOf(y1Rects);
const y2Cells = cellsOf([Y2_RECT]);
const y6Cells = cellsOf([Y6_RECT]);
const union123 = new Set([...y1Cells, ...y2Cells, ...y6Cells]);
const y6OverlapY1 = [...y6Cells].filter((c) => y1Cells.has(c));
const y6OverlapY2 = [...y6Cells].filter((c) => y2Cells.has(c));
report.overlap = {
  y1Rects: y1Rects.length,
  y1Union: y1Cells.size,
  y2Union: y2Cells.size,
  y6Union: y6Cells.size,
  y6OverlapY1: y6OverlapY1.length,
  y6OverlapY2: y6OverlapY2.length,
  combinedUnionDsf1: union123.size,
  combinedUnionDsf2: union123.size * 4,
};

writeFileSync(join(HERE, 'region-derivation.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
