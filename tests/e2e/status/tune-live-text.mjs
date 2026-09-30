#!/usr/bin/env node
/**
 * tests/e2e/status/tune-live-text.mjs — task Y9 measurement harness.
 *
 * Measures the live status text (`src/ui/message.ts`) against the rendered
 * reference frames (DefineSprite_123 frames 2/3 from artifacts/) at
 * deviceScaleFactor 1 and 2, and sweeps candidate font-size/top values to pick
 * the best fit. The reference composite is built inside the running app page:
 * the message and the board's frame-1 ball are hidden and the reference frame
 * SVG is injected at the exact `status_ball` catalog box over the real board
 * backdrop, so both sides rasterise at the same coordinates.
 *
 * Usage: node tests/e2e/status/tune-live-text.mjs [--base http://127.0.0.1:5199]
 * Requires the dev server; renders muted Chromium (EXECUTION.md §8).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodePng } from '../../../verify/diff/diff.mjs';

// `document`/`window`/`HTMLElement`/`requestAnimationFrame` are used inside
// Playwright `page.evaluate` callbacks (browser context).
/* global document, window, HTMLElement */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const abs = (p) => path.join(ROOT, p);
const OUT = abs('test-results/Y9-tune');
mkdirSync(OUT, { recursive: true });

const baseArg = process.argv.indexOf('--base');
const BASE = baseArg >= 0 ? process.argv[baseArg + 1] : 'http://127.0.0.1:5199';

const STATUS_BOX = { x: 447.37, y: 238.45, w: 107.01, h: 34.81 };
const CLIP = { x: STATUS_BOX.x, y: STATUS_BOX.y, width: STATUS_BOX.w, height: STATUS_BOX.h };

const FRAME_SVG = {
  1: readFileSync(abs('artifacts/decompiled/sprites/DefineSprite_123/1.svg'), 'utf8'),
  2: readFileSync(abs('artifacts/decompiled/sprites/DefineSprite_123/2.svg'), 'utf8'),
  3: readFileSync(abs('artifacts/decompiled/sprites/DefineSprite_123/3.svg'), 'utf8'),
};

const CANDIDATES = [];
for (const size of [13.9, 14.0, 14.1, 14.2]) {
  for (const top of [15.0, 15.25]) {
    CANDIDATES.push({ size, top, kerning: 'normal' });
  }
}

async function prepareRound(page) {
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__game !== 'undefined');
  await page.evaluate(() => {
    const b = document.querySelector('[data-testid="fullscreen-button"]');
    if (b instanceof HTMLElement) b.style.display = 'none';
  });
  await page.evaluate(() => window.__game.selectRound('FİNALİZM'));
  await page.waitForFunction(() => document.querySelector('[data-element="letter0"]') !== null);
  await page.waitForTimeout(150);
}

async function clickLetter(page, letter, expected) {
  const slot = await page.evaluate((wanted) => {
    for (let i = 0; i < 8; i++) {
      const node = document.querySelector(`[data-element="letter${i}"]`);
      if (node?.textContent === wanted) return i;
    }
    return -1;
  }, letter);
  if (slot < 0) throw new Error(`no tile with ${letter}`);
  const box = await page.locator(`[data-element="bosbuton${slot}"]`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(
    (expectedEntry) => document.querySelector('[data-testid="entry"]')?.textContent === expectedEntry,
    expected,
  );
  await page.waitForFunction(() => document.querySelectorAll('.e3-wordball-getir').length === 0);
}

/** Inject the reference frame over the app backdrop; screenshot the capsule. */
async function captureReference(page, frame, file) {
  const svgB64 = Buffer.from(FRAME_SVG[frame], 'utf8').toString('base64');
  await page.evaluate(
    ({ box, b64 }) => {
      const message = document.querySelector('[data-testid="message"]');
      if (message instanceof HTMLElement) message.style.display = 'none';
      const ball = document.querySelector('[data-element="status_ball"]');
      if (ball instanceof HTMLElement) ball.style.visibility = 'hidden';
      const img = document.createElement('img');
      img.id = 'y9-ref';
      img.style.cssText = `position:absolute;left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${(box.w * 34.8) / 107}px;z-index:26000`;
      img.src = `data:image/svg+xml;base64,${b64}`;
      const root = document.querySelector('[data-testid="stage-root"]');
      if (!(root instanceof HTMLElement)) throw new Error('stage-root missing');
      root.appendChild(img);
      return img.decode();
    },
    { box: STATUS_BOX, b64: svgB64 },
  );
  await page.waitForTimeout(50);
  await page.screenshot({ path: file, clip: CLIP });
  await page.evaluate(() => {
    document.getElementById('y9-ref')?.remove();
    const message = document.querySelector('[data-testid="message"]');
    if (message instanceof HTMLElement) message.style.display = '';
    const ball = document.querySelector('[data-element="status_ball"]');
    if (ball instanceof HTMLElement) ball.style.visibility = '';
  });
}

async function captureActual(page, file) {
  await page.screenshot({ path: file, clip: CLIP });
}

function diff(actual, reference, outDir, dsf) {
  const img = decodePng(readFileSync(actual));
  const textLeft = Math.min(Math.round(38 * dsf), img.width - 1);
  execFileSync(
    process.execPath,
    [
      'verify/diff/diff.mjs',
      actual,
      reference,
      outDir,
      '--ignore-rect',
      `${textLeft},0,${img.width - textLeft},${img.height}`,
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const ball = JSON.parse(readFileSync(path.join(outDir, 'report.json'), 'utf8'));
  execFileSync(
    process.execPath,
    [
      'verify/diff/diff.mjs',
      actual,
      reference,
      outDir,
      '--ignore-rect',
      `0,0,${textLeft},${img.height}`,
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const text = JSON.parse(readFileSync(path.join(outDir, 'report.json'), 'utf8'));
  return { ball, text };
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  for (const dsf of [1, 2]) {
    const context = await browser.newContext({
      deviceScaleFactor: dsf,
      viewport: { width: 550, height: 400 },
    });
    const page = await context.newPage();
    await prepareRound(page);

    // Idle: the board's frame-1 ball (message hidden).
    await captureActual(page, path.join(OUT, `idle-actual-dsf${dsf}.png`));
    await captureReference(page, 1, path.join(OUT, `idle-ref-dsf${dsf}.png`));
    const idle = diff(
      path.join(OUT, `idle-actual-dsf${dsf}.png`),
      path.join(OUT, `idle-ref-dsf${dsf}.png`),
      path.join(OUT, `idle-diff-dsf${dsf}`),
      dsf,
    );
    console.log(
      `dsf${dsf} idle: ball raw=${idle.ball.mismatchedPixels} tolerant=${idle.ball.tolerantMismatchedPixels} | text raw=${idle.text.mismatchedPixels} tolerant=${idle.text.tolerantMismatchedPixels}`,
    );

    // Valid state.
    // ---- valid state sweep ------------------------------------------------
    await clickLetter(page, 'A', 'A');
    await clickLetter(page, 'F', 'AF');
    await clickLetter(page, 'İ', 'AFİ');
    await captureReference(page, 2, path.join(OUT, `valid-ref-dsf${dsf}.png`));
    const validRows = [];
    for (const c of CANDIDATES) {
      await page.addStyleTag({
        content: `.game-message[data-lamp] .game-message-text { font-size:${c.size}px; top:${c.top}px; font-kerning:${c.kerning}; }`,
      });
      const file = path.join(OUT, `valid-live-dsf${dsf}-${c.size}-${c.top}-${c.kerning}.png`);
      await captureActual(page, file);
      const r = diff(
        file,
        path.join(OUT, `valid-ref-dsf${dsf}.png`),
        path.join(OUT, `valid-diff-dsf${dsf}`),
        dsf,
      );
      validRows.push({ c, ball: r.ball, text: r.text });
    }

    // ---- found state sweep ------------------------------------------------
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game.foundWords.length === 1);
    await clickLetter(page, 'A', 'A');
    await clickLetter(page, 'F', 'AF');
    await clickLetter(page, 'İ', 'AFİ');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="message"]')?.textContent === 'Girildi',
    );
    await captureReference(page, 3, path.join(OUT, `found-ref-dsf${dsf}.png`));
    const foundRows = [];
    for (const c of CANDIDATES) {
      await page.addStyleTag({
        content: `.game-message[data-lamp] .game-message-text { font-size:${c.size}px; top:${c.top}px; font-kerning:${c.kerning}; }`,
      });
      const file = path.join(OUT, `found-live-dsf${dsf}-${c.size}-${c.top}-${c.kerning}.png`);
      await captureActual(page, file);
      const r = diff(
        file,
        path.join(OUT, `found-ref-dsf${dsf}.png`),
        path.join(OUT, `found-diff-dsf${dsf}`),
        dsf,
      );
      foundRows.push({ c, ball: r.ball, text: r.text });
    }

    const sortRows = (rows) =>
      rows.sort(
        (a, b) =>
          a.text.tolerantMismatchedPixels +
          a.ball.tolerantMismatchedPixels -
          (b.text.tolerantMismatchedPixels + b.ball.tolerantMismatchedPixels) ||
          a.text.mismatchedPixels +
            a.ball.mismatchedPixels -
            (b.text.mismatchedPixels + b.ball.mismatchedPixels),
      );
    sortRows(validRows);
    sortRows(foundRows);
    for (const [state, rows] of [
      ['valid', validRows],
      ['found', foundRows],
    ]) {
      for (const row of rows) {
        console.log(
          `dsf${dsf} ${state} size=${row.c.size} top=${row.c.top}: ` +
            `ball raw=${row.ball.mismatchedPixels} tol=${row.ball.tolerantMismatchedPixels} | ` +
            `text raw=${row.text.mismatchedPixels} tol=${row.text.tolerantMismatchedPixels}`,
        );
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
