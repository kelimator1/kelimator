#!/usr/bin/env node
/**
 * tests/e2e/speaker/capture-states.mjs — X3 O24 app-side speaker pixel
 * verification (manual run; not part of `npm run e2e`).
 *
 * Captures the rebuild's speaker ON state (default vol = 100) and OFF state
 * (persisted `kelimator.volume = 0` restored at boot — the reference's own path,
 * evidence/C3-speaker-capture.md §1) at deviceScaleFactor 1, stage 550×400, from
 * a running dev server, then diffs both against the C3 reference captures
 * (`tests/fixtures/reference/speaker/`):
 *   - whole stage with F1's tool (`node verify/diff/diff.mjs` → report.json),
 *   - region-restricted: the C3 measurement box (x 505..549, y 356..399,
 *     45×44 = 1980 px; evidence/logs/C3-speaker-measure.log L2) cropped from
 *     both captures and compared with the tool's own `compareImages` (same
 *     threshold 30 / tolerant radius 2), with a crop heatmap.
 * It also records the attribution analysis for any region residual:
 *   - bitmap match of the rendered ON icon vs the sprite-86 bitmap (embedded
 *     in the committed `s90_btn_speaker.svg`): best integer placement and best
 *     fractional (phase) placement with bilinear sampling;
 *   - CXFORM mapping check: for opaque icon pixels, does the app's ON→OFF
 *     transition equal `round(c*108/256 + 148)` (same check C3 ran on the
 *     reference)?
 *   - a sampling-mode diagnostic (`image-rendering: pixelated`, no code
 *     change) to separate a resampling artifact from a colour mapping issue.
 *
 * Outputs are written under `evidence/X3-o24/` (X3-owned paths only).
 * Silent witness: Chromium launches with `--mute-audio`; nothing is played.
 *
 * Usage: node tests/e2e/speaker/capture-states.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeatmap, compareImages, decodePng, encodePng } from '../../../verify/diff/diff.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(REPO, 'evidence', 'X3-o24');
const REFERENCE_DIR = path.join(REPO, 'tests', 'fixtures', 'reference', 'speaker');
const DIFF_TOOL = path.join(REPO, 'verify', 'diff', 'diff.mjs');
const URL = process.argv[2] ?? 'http://127.0.0.1:5199/';
/** C3 measurement box (evidence/logs/C3-speaker-measure.log L2). */
const SPEAKER_BOX = { x: 505, y: 356, width: 45, height: 44 };
/** Plain backdrop behind the speaker (C3 residuals: "...becomes the plain background (249,229,177)"). */
const BACKDROP = [249, 229, 177];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** The sprite-86 bitmap embedded in the committed speaker asset (byte source: images/86.png). */
function loadSpeakerBitmap() {
  const svg = readFileSync(path.join(REPO, 'src', 'assets', 'svg', 's90_btn_speaker.svg'), 'utf8');
  const match = /base64,([A-Za-z0-9+/=]+)"/.exec(svg);
  if (match === null) throw new Error('s90_btn_speaker.svg carries no embedded bitmap');
  const bytes = Buffer.from(match[1], 'base64');
  return { bytes, image: decodePng(bytes) };
}

async function capture(state, options = {}) {
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  try {
    const context = await browser.newContext({
      viewport: { width: 550, height: 400 },
      deviceScaleFactor: 1,
    });
    if (state === 'off') {
      // The reference OFF path: persist vol = 0 and boot (C3 §1).
      await context.addInitScript(() => {
        globalThis.localStorage.setItem('kelimator.volume', '0');
      });
    }
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await page.goto(URL);
    await page.waitForFunction(
      () => globalThis.__game !== undefined && globalThis.__game.state === 'playing',
    );
    await page.waitForFunction(
      (expected) =>
        globalThis.document.querySelector('[data-element="btn_speaker"]')?.dataset.speaker ===
        expected,
      state === 'off' ? 'off' : 'on',
    );
    await page.evaluate(() => globalThis.document.fonts.ready);
    const settle = () =>
      page.evaluate(
        () =>
          new Promise((resolve) =>
            globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
          ),
      );
    await settle();
    const read = await page.evaluate(() => {
      const node = globalThis.document.querySelector('[data-element="btn_speaker"]');
      const waves =
        node === null
          ? undefined
          : Array.from(node.querySelectorAll('use')).find((use) => {
              for (const attribute of Array.from(use.attributes)) {
                if (
                  attribute.name.toLowerCase() === 'ffdec:characterid' &&
                  attribute.value === '85'
                ) {
                  return true;
                }
              }
              return false;
            });
      return {
        state: node instanceof globalThis.HTMLElement ? node.dataset.speaker : null,
        wavesDisplay: waves === undefined ? null : globalThis.getComputedStyle(waves).display,
        storedVolume: globalThis.localStorage.getItem('kelimator.volume'),
        gameState: globalThis.__game.state,
        lastAudioEvent: globalThis.__game.lastAudioEvent,
      };
    });
    const png = await page.locator('[data-testid="stage-root"]').screenshot();
    let diagnosticPng = null;
    if (options.pixelated === true) {
      // Diagnostic only (no code change): would a nearest-neighbour sampling
      // mode close the gap? Applies to the rendered element in this session.
      await page.evaluate(() => {
        const node = globalThis.document.querySelector('[data-element="btn_speaker"]');
        for (const image of Array.from(node.querySelectorAll('image'))) {
          image.style.imageRendering = 'pixelated';
        }
        const svg = node.querySelector('svg');
        if (svg !== null) svg.style.imageRendering = 'pixelated';
      });
      await settle();
      diagnosticPng = await page.locator('[data-testid="stage-root"]').screenshot();
    }
    if (pageErrors.length > 0) throw new Error(`page errors: ${pageErrors.join('; ')}`);
    return { png, diagnosticPng, read };
  } finally {
    await browser.close();
  }
}

/** RGBA8 crop of `image` at `box` (top-left origin). */
function cropRegion(image, box) {
  const data = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    const source = ((box.y + y) * image.width + box.x) * 4;
    data.set(image.data.subarray(source, source + box.width * 4), y * box.width * 4);
  }
  return { width: box.width, height: box.height, data };
}

/** Bitmap pixel `i` composited over `background` (the bitmap is RGBA with alpha). */
function compositeOver(bitmap, i, background) {
  const alpha = bitmap.data[i + 3] / 255;
  return [0, 1, 2].map((c) => bitmap.data[i + c] * alpha + background[c] * (1 - alpha));
}

/** Bilinear sample of the composited bitmap at fractional (x, y), edge-clamped. */
function sampleBitmap(bitmap, background, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (xx, yy) => {
    const cx = Math.max(0, Math.min(bitmap.width - 1, xx));
    const cy = Math.max(0, Math.min(bitmap.height - 1, yy));
    return compositeOver(bitmap, (cy * bitmap.width + cx) * 4, background);
  };
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return [0, 1, 2].map(
    (k) => a[k] * (1 - fx) * (1 - fy) + b[k] * fx * (1 - fy) + c[k] * (1 - fx) * fy + d[k] * fx * fy,
  );
}

function pixelDistance(img, x, y, color) {
  const i = (y * img.width + x) * 4;
  return Math.hypot(img.data[i] - color[0], img.data[i + 1] - color[1], img.data[i + 2] - color[2]);
}

/** Best 1:1 placement of the bitmap in the crop (nearest-neighbour comparison). */
function bestIntegerBitmapMatch(img, bitmap, background, tolerance) {
  let best = null;
  for (let oy = 6; oy <= 18; oy += 1) {
    for (let ox = 6; ox <= 18; ox += 1) {
      let ok = 0;
      let total = 0;
      let worst = 0;
      for (let y = 0; y < bitmap.height; y += 1) {
        const cy = oy + y;
        if (cy < 0 || cy >= img.height) continue;
        for (let x = 0; x < bitmap.width; x += 1) {
          const cx = ox + x;
          if (cx < 0 || cx >= img.width) continue;
          const expected = compositeOver(bitmap, (y * bitmap.width + x) * 4, background);
          const distance = pixelDistance(img, cx, cy, expected);
          total += 1;
          if (distance <= tolerance) ok += 1;
          if (distance > worst) worst = distance;
        }
      }
      if (best === null || ok > best.ok) best = { ox, oy, ok, total, ratio: ok / total, worst };
    }
  }
  return best;
}

/** Best fractional (phase) placement with bilinear sampling, margin pixels around the bitmap. */
function bestPhaseBitmapMatch(img, bitmap, background, tolerance, margin) {
  let best = null;
  const steps = 8;
  for (let oy = 8; oy <= 14; oy += 1) {
    for (let ox = 8; ox <= 14; ox += 1) {
      for (let sx = 0; sx < steps; sx += 1) {
        for (let sy = 0; sy < steps; sy += 1) {
          const dx = sx / steps;
          const dy = sy / steps;
          let ok = 0;
          let total = 0;
          for (let y = -margin; y < bitmap.height + margin; y += 1) {
            const cy = oy + y;
            if (cy < 0 || cy >= img.height) continue;
            for (let x = -margin; x < bitmap.width + margin; x += 1) {
              const cx = ox + x;
              if (cx < 0 || cx >= img.width) continue;
              const expected = sampleBitmap(bitmap, background, x + dx, y + dy);
              total += 1;
              if (pixelDistance(img, cx, cy, expected) <= tolerance) ok += 1;
            }
          }
          if (best === null || ok > best.ok) best = { ox, oy, dx, dy, ok, total, ratio: ok / total };
        }
      }
    }
  }
  return best;
}

/**
 * CXFORM mapping check on changed opaque icon pixels: `off == round(on*108/256 + 148)`
 * within 2 per channel (the same formula C3 validated against the reference).
 * Only pixels that changed (>30) inside `iconRect` and whose ON colour matches
 * an opaque bitmap-86 palette colour (±6) are counted — icon ink, not waves or
 * neighbouring UI.
 */
function cxformMappingCheck(on, off, bitmap, iconRect) {
  const palette = [];
  for (let i = 0; i < bitmap.data.length; i += 4) {
    if (bitmap.data[i + 3] < 250) continue;
    const color = [bitmap.data[i], bitmap.data[i + 1], bitmap.data[i + 2]];
    if (!palette.some((p) => p.every((v, k) => Math.abs(v - color[k]) <= 1))) palette.push(color);
  }
  let changed = 0;
  let iconChanged = 0;
  let opaqueChanged = 0;
  let mappedWithin1 = 0;
  let mappedWithin2 = 0;
  const samplesOver2 = [];
  for (let y = 0; y < on.height; y += 1) {
    for (let x = 0; x < on.width; x += 1) {
      const i = (y * on.width + x) * 4;
      const onPixel = [on.data[i], on.data[i + 1], on.data[i + 2]];
      const offPixel = [off.data[i], off.data[i + 1], off.data[i + 2]];
      const distance = Math.hypot(
        onPixel[0] - offPixel[0],
        onPixel[1] - offPixel[1],
        onPixel[2] - offPixel[2],
      );
      const inIcon =
        x >= iconRect.x &&
        x < iconRect.x + bitmap.width &&
        y >= iconRect.y &&
        y < iconRect.y + bitmap.height;
      if (distance > 30) {
        changed += 1;
        if (inIcon) iconChanged += 1;
      }
      if (distance <= 30 || !inIcon) continue;
      if (!palette.some((p) => Math.hypot(...[0, 1, 2].map((k) => p[k] - onPixel[k])) <= 6)) continue;
      opaqueChanged += 1;
      const predicted = onPixel.map((c) => Math.round((c * 108) / 256 + 148));
      const deviation = Math.max(...[0, 1, 2].map((k) => Math.abs(predicted[k] - offPixel[k])));
      if (deviation <= 2) mappedWithin2 += 1;
      if (deviation <= 1) mappedWithin1 += 1;
      if (deviation > 2 && samplesOver2.length < 5) {
        samplesOver2.push({ x, y, on: onPixel, off: offPixel, predicted, deviation });
      }
    }
  }
  return {
    paletteSize: palette.length,
    changed,
    iconChanged,
    opaqueChanged,
    mappedWithin1,
    mappedWithin2,
    samplesOver2,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const bitmap = loadSpeakerBitmap();

  // ON capture + the pixelated sampling diagnostic from the same session.
  const on = await capture('on', { pixelated: true });
  const off = await capture('off');
  writeFileSync(path.join(OUT, 'app-speaker-on.png'), on.png);
  writeFileSync(path.join(OUT, 'app-speaker-off.png'), off.png);
  writeFileSync(path.join(OUT, 'diag-app-speaker-on-pixelated.png'), on.diagnosticPng);
  const captureSummary = {
    tool: 'tests/e2e/speaker/capture-states.mjs',
    url: URL,
    viewport: { width: 550, height: 400 },
    deviceScaleFactor: 1,
    speakerBox: SPEAKER_BOX,
    bitmap: { source: 'src/assets/svg/s90_btn_speaker.svg (embedded)', sha256: sha256(bitmap.bytes) },
    on: { file: 'app-speaker-on.png', sha256: sha256(on.png), ...on.read },
    off: { file: 'app-speaker-off.png', sha256: sha256(off.png), ...off.read },
    pixelatedDiagnostic: { file: 'diag-app-speaker-on-pixelated.png', sha256: sha256(on.diagnosticPng) },
  };
  writeFileSync(
    path.join(OUT, 'capture-summary.json'),
    `${JSON.stringify(captureSummary, null, 2)}\n`,
  );
  process.stdout.write(
    `capture on:  ${JSON.stringify(captureSummary.on)}\n` +
      `capture off: ${JSON.stringify(captureSummary.off)}\n` +
      `bitmap:      sha256=${captureSummary.bitmap.sha256} (A1 images/86.png source)\n`,
  );

  const pairs = [
    { name: 'app-on-vs-ref-before', app: 'app-speaker-on.png', ref: 'speaker-before.png' },
    { name: 'app-on-vs-ref-on', app: 'app-speaker-on.png', ref: 'speaker-on.png' },
    { name: 'app-off-vs-ref-off', app: 'app-speaker-off.png', ref: 'speaker-off.png' },
  ];
  const summary = [];
  for (const pair of pairs) {
    const appPath = path.join(OUT, pair.app);
    const refPath = path.join(REFERENCE_DIR, pair.ref);
    const diffDir = path.join(OUT, `diff-${pair.name}`);
    const cliOutput = execFileSync(process.execPath, [DIFF_TOOL, appPath, refPath, diffDir], {
      encoding: 'utf8',
    });
    const wholeStage = JSON.parse(readFileSync(path.join(diffDir, 'report.json'), 'utf8'));
    const appRegion = cropRegion(decodePng(readFileSync(appPath)), SPEAKER_BOX);
    const refRegion = cropRegion(decodePng(readFileSync(refPath)), SPEAKER_BOX);
    const region = compareImages(appRegion, refRegion);
    writeFileSync(path.join(OUT, `region-${pair.name}-app.png`), encodePng(appRegion));
    writeFileSync(path.join(OUT, `region-${pair.name}-ref.png`), encodePng(refRegion));
    writeFileSync(
      path.join(OUT, `region-${pair.name}-heatmap.png`),
      encodePng(buildHeatmap(appRegion, refRegion)),
    );
    writeFileSync(
      path.join(OUT, `region-${pair.name}.json`),
      `${JSON.stringify({ box: SPEAKER_BOX, region, wholeStage }, null, 2)}\n`,
    );
    summary.push({ pair: pair.name, app: pair.app, reference: pair.ref, wholeStage, region });
    process.stdout.write(
      `${cliOutput.trim()}\n` +
        `region ${pair.name}: box=${SPEAKER_BOX.width}x${SPEAKER_BOX.height} ` +
        `mismatched=${region.mismatchedPixels}/${region.totalPixels} ` +
        `raw=${region.mismatchRatio} tolerant=${region.tolerantMismatchRatio} ` +
        `bbox=${JSON.stringify(region.mismatchBBox)}\n`,
    );
  }

  // Attribution analysis (region residual): where does the app differ from the reference?
  const appOn = cropRegion(decodePng(readFileSync(path.join(OUT, 'app-speaker-on.png'))), SPEAKER_BOX);
  const appOff = cropRegion(decodePng(readFileSync(path.join(OUT, 'app-speaker-off.png'))), SPEAKER_BOX);
  const refOn = cropRegion(decodePng(readFileSync(path.join(REFERENCE_DIR, 'speaker-before.png'))), SPEAKER_BOX);
  const refOff = cropRegion(decodePng(readFileSync(path.join(REFERENCE_DIR, 'speaker-off.png'))), SPEAKER_BOX);
  const diag = cropRegion(decodePng(readFileSync(path.join(OUT, 'diag-app-speaker-on-pixelated.png'))), SPEAKER_BOX);
  const bitmapOn = bestIntegerBitmapMatch(appOn, bitmap.image, BACKDROP, 8);
  const bitmapRef = bestIntegerBitmapMatch(refOn, bitmap.image, BACKDROP, 8);
  const phaseOn = bestPhaseBitmapMatch(appOn, bitmap.image, BACKDROP, 8, 2);
  const phaseRef = bestPhaseBitmapMatch(refOn, bitmap.image, BACKDROP, 8, 2);
  const iconRect = { x: 11, y: 11 }; // reference 1:1 placement (authoritative: 96.2 % match)
  const mappingApp = cxformMappingCheck(appOn, appOff, bitmap.image, iconRect);
  const mappingRef = cxformMappingCheck(refOn, refOff, bitmap.image, iconRect);
  const diagRegion = compareImages(diag, refOn);
  const analysis = {
    bitmap: { width: bitmap.image.width, height: bitmap.image.height, sha256: sha256(bitmap.bytes) },
    backdrop: BACKDROP,
    integerBitmapMatch: { appOn: bitmapOn, refOn: bitmapRef },
    phaseBitmapMatch: { appOn: phaseOn, refOn: phaseRef },
    cxformMapping: { app: mappingApp, reference: mappingRef },
    pixelatedDiagnostic: { region: diagRegion, note: 'image-rendering: pixelated applied at runtime only; no code change' },
  };
  writeFileSync(path.join(OUT, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
  process.stdout.write(
    `bitmap match 1:1   app=${JSON.stringify(bitmapOn)} ref=${JSON.stringify(bitmapRef)}\n` +
      `bitmap match phase app=${JSON.stringify(phaseOn)} ref=${JSON.stringify(phaseRef)}\n` +
      `cxform app=${JSON.stringify(mappingApp)} ref=${JSON.stringify(mappingRef)}\n` +
      `pixelated diag: raw=${diagRegion.mismatchRatio} tolerant=${diagRegion.tolerantMismatchRatio}\n`,
  );
  writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify({ pairs: summary, analysis }, null, 2)}\n`);
}

await main();
