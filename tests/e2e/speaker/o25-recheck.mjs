// Tests helper (task Y1): O25 re-check (manual run, not part of `npm run e2e`; — speaker-knob region vs the reference with
// the smooth HD knob (bitmap 86 remaster).
// Captures the app ON/OFF states (muted Chromium, dsf1, stage 550x400) and
// diffs the X3 measurement box and the measured knob footprint against the C3
// reference speaker captures; writes artifacts under evidence/visual/Y1/o25/.
// Usage: node tests/e2e/speaker/o25-recheck.mjs <baseUrl>
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeatmap, compareImages, decodePng, encodePng } from '../../../verify/diff/diff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'evidence/visual/Y1/o25');
const REFERENCE_DIR = path.join(ROOT, 'tests/fixtures/reference/speaker');
const URL_BASE = process.argv[2] ?? 'http://127.0.0.1:5177/';
/** X3/C3 measurement box (evidence/C3-speaker-capture.md). */
const C3_BOX = { x: 505, y: 356, width: 45, height: 44 };
/** Y1 measured speaker-knob footprint (probe2, dsf1). */
const KNOB_BOX = { x: 515, y: 367, width: 22, height: 30 };

function cropRegion(image, box) {
  const data = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const source = ((box.y + y) * image.width + box.x) * 4;
    data.set(image.data.subarray(source, source + box.width * 4), y * box.width * 4);
  }
  return { width: box.width, height: box.height, data };
}

async function capture(state) {
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  try {
    const context = await browser.newContext({
      viewport: { width: 550, height: 400 },
      deviceScaleFactor: 1,
    });
    if (state === 'off') {
      await context.addInitScript(() => {
        globalThis.localStorage.setItem('kelimator.volume', '0');
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(URL_BASE);
    await page.waitForFunction(
      () => globalThis.__game !== undefined && globalThis.__game.state === 'playing',
    );
    await page.waitForFunction(
      (expected) =>
        globalThis.document.querySelector('[data-element="btn_speaker"]')?.dataset.speaker ===
        expected,
      state,
    );
    await page.evaluate(async () => {
      await globalThis.document.fonts.ready;
      await new Promise((resolve) =>
        globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
      );
    });
    const png = await page.locator('[data-testid="stage-root"]').screenshot();
    if (errors.length > 0) throw new Error(`page errors: ${errors.join('; ')}`);
    return png;
  } finally {
    await browser.close();
  }
}

mkdirSync(OUT, { recursive: true });
const onPng = await capture('on');
const offPng = await capture('off');
writeFileSync(path.join(OUT, 'app-speaker-on.png'), onPng);
writeFileSync(path.join(OUT, 'app-speaker-off.png'), offPng);

const appOn = decodePng(onPng);
const appOff = decodePng(offPng);
const refs = {
  'speaker-before': decodePng(readFileSync(path.join(REFERENCE_DIR, 'speaker-before.png'))),
  'speaker-on': decodePng(readFileSync(path.join(REFERENCE_DIR, 'speaker-on.png'))),
  'speaker-off': decodePng(readFileSync(path.join(REFERENCE_DIR, 'speaker-off.png'))),
};

const pairs = [
  { name: 'app-on-vs-ref-before', app: appOn, ref: refs['speaker-before'] },
  { name: 'app-on-vs-ref-on', app: appOn, ref: refs['speaker-on'] },
  { name: 'app-off-vs-ref-off', app: appOff, ref: refs['speaker-off'] },
];
const summary = [];
for (const pair of pairs) {
  for (const [label, box] of [
    ['c3-box', C3_BOX],
    ['knob-box', KNOB_BOX],
  ]) {
    const appRegion = cropRegion(pair.app, box);
    const refRegion = cropRegion(pair.ref, box);
    const region = compareImages(appRegion, refRegion);
    writeFileSync(
      path.join(OUT, `${pair.name}-${label}-app.png`),
      encodePng(appRegion),
    );
    writeFileSync(
      path.join(OUT, `${pair.name}-${label}-ref.png`),
      encodePng(refRegion),
    );
    writeFileSync(
      path.join(OUT, `${pair.name}-${label}-heatmap.png`),
      encodePng(buildHeatmap(appRegion, refRegion)),
    );
    summary.push({ pair: pair.name, region: label, box, raw: region.mismatchRatio, tolerant: region.tolerantMismatchRatio, mismatchedPixels: region.mismatchedPixels, tolerantMismatchedPixels: region.tolerantMismatchedPixels, totalPixels: region.totalPixels });
    console.log(
      `${pair.name} ${label} (${box.width}x${box.height}): raw=${(region.mismatchRatio * 100).toFixed(3)}% ` +
        `(${region.mismatchedPixels}px) tolerant=${(region.tolerantMismatchRatio * 100).toFixed(3)}% ` +
        `(${region.tolerantMismatchedPixels}px)`,
    );
  }
}
writeFileSync(path.join(OUT, 'o25-summary.json'), JSON.stringify(summary, null, 2));
console.log('X3 O24 baseline (old pixelated knob, C3 box ON): raw 23.535% / tolerant 8.182%');
