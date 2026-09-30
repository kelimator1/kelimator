#!/usr/bin/env node
/**
 * tests/e2e/status/capture-status-evidence.mjs — task Y9 evidence capture.
 *
 * Produces the Y9 evidence artifacts from the running app and the committed
 * reference frames (tests/e2e/status/fixtures/DefineSprite_123/{1,2,3}.svg,
 * byte copies of the FFDec exports):
 *
 *   1. exact colour samples of the reference frames (renders the frames at
 *      deviceScaleFactor 4 and prints the dominant exact RGB values of the
 *      ball and text regions, plus the fills declared in the frame files);
 *   2. per deviceScaleFactor 1/2 status crops for idle / valid (`Geçerli`) /
 *      already-found (`Girildi`):
 *        - before: the pre-fix appearance reproduced by style override
 *          (frame-1 dark ball + live text in the old #000 10 px layout);
 *        - after: the current app rendering (coloured ball asset + coloured
 *          live text);
 *        - reference: the raw reference frame injected at the exact catalog
 *          box over the live board backdrop;
 *   3. a labelled comparison sheet `evidence/visual/Y9/comparison-sheet-
 *      dsf<N>.png` with the three columns.
 *
 * Usage: node tests/e2e/status/capture-status-evidence.mjs [--base <url>]
 * Requires the dev server; renders muted Chromium (EXECUTION.md §8).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodePng } from '../../../verify/diff/diff.mjs';

// `document`/`window`/`HTMLElement`/`requestAnimationFrame` are used inside
// Playwright `page.evaluate` callbacks (browser context; same dual-environment
// pattern as tools/process-assets.mjs and the C3 harness scripts).
/* global document, window, HTMLElement, requestAnimationFrame */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const abs = (p) => path.join(ROOT, p);
const OUT = abs('evidence/visual/Y9');
const WORK = abs('test-results/Y9-capture');
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });

const baseArg = process.argv.indexOf('--base');
const BASE = baseArg >= 0 ? process.argv[baseArg + 1] : 'http://127.0.0.1:5199';

const STATUS_BOX = { x: 447.37, y: 238.45, w: 107.01, h: 34.81 };
const CLIP = { x: STATUS_BOX.x, y: STATUS_BOX.y, width: STATUS_BOX.w, height: STATUS_BOX.h };
const FRAME_DIR = abs('tests/e2e/status/fixtures/DefineSprite_123');
const FRAMES = {
  1: readFileSync(path.join(FRAME_DIR, '1.svg'), 'utf8'),
  2: readFileSync(path.join(FRAME_DIR, '2.svg'), 'utf8'),
  3: readFileSync(path.join(FRAME_DIR, '3.svg'), 'utf8'),
};

/** Pre-fix appearance reproduction (owner-reported defect, evidence §1). */
const BEFORE_CSS = `
[data-testid="stage-root"][data-status-lamp] [data-element="status_ball"] { visibility: visible !important; }
.game-message[data-lamp] .game-message-ball { display: none !important; }
.game-message[data-lamp] .game-message-text {
  position: static; left: auto; top: auto; font-size: 10px; line-height: 1.2; color: #000;
}
`;

// ---------------------------------------------------------------------------
// 1. reference-frame colour samples
// ---------------------------------------------------------------------------

async function sampleFrameColours(browser) {
  const context = await browser.newContext({ deviceScaleFactor: 4 });
  const page = await context.newPage();
  const samples = {};
  for (const frame of [1, 2, 3]) {
    const b64 = Buffer.from(FRAMES[frame], 'utf8').toString('base64');
    await page.setContent(
      `<body style="margin:0;background:#fff"><img id="a" style="display:block;width:428px;height:139.2px" src="data:image/svg+xml;base64,${b64}"></body>`,
    );
    await page.evaluate(async () => {
      await document.getElementById('a').decode();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const file = path.join(WORK, `frame-${frame}-dsf4.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 428, height: 139 } });
    const img = decodePng(readFileSync(file)); // 1712 x 556 device px (4x)
    const at = (x, y) => {
      const i = (y * img.width + x) * 4;
      return `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`;
    };
    // Exact matches of each fill the frame SVG declares, over the whole render.
    const declared = declaredFills(frame);
    const exact = new Map(declared.map((colour) => [colour, 0]));
    const toHex = (r, g, b) =>
      `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    const declaredHex = new Set(declared.map((c) => c.toLowerCase()));
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        const i = (y * img.width + x) * 4;
        const hex = toHex(img.data[i], img.data[i + 1], img.data[i + 2]);
        if (declaredHex.has(hex)) exact.set(hex, (exact.get(hex) ?? 0) + 1);
      }
    }
    // Probe points (frame-local -> 16x device: the 107 px frame is displayed at
    // 428 CSS px and captured at deviceScaleFactor 4). Ball centre (18.45,
    // 17.4), ball top highlight (13.0, 10.0), first glyph stem (41.6, 16.0).
    samples[frame] = {
      ballCentre: at(295, 278),
      ballHighlight: at(208, 160),
      textStem: frame === 1 ? null : at(666, 256),
      exact: [...exact.entries()].sort((a, b) => b[1] - a[1]),
    };
  }
  await context.close();
  return samples;
}

/** Fills declared in the exported frame SVG (authoritative reference values). */
function declaredFills(frame) {
  const svg = FRAMES[frame];
  const values = new Set();
  for (const match of svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)) values.add(match[1]);
  for (const match of svg.matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g)) values.add(match[1]);
  return [...values].sort();
}

// ---------------------------------------------------------------------------
// 2. app captures
// ---------------------------------------------------------------------------

async function prepareRound(page) {
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__game !== 'undefined');
  await page.evaluate(() => {
    const b = document.querySelector('[data-testid="fullscreen-button"]');
    if (b instanceof HTMLElement) b.style.display = 'none';
  });
  await page.evaluate(() => window.__game.selectRound('FİNALİZM'));
  await page.waitForFunction(() => document.querySelector('[data-element="letter0"]') !== null);
}

async function clickLetter(page, letter, expected) {
  const slot = await page.evaluate((wanted) => {
    for (let i = 0; i < 8; i += 1) {
      const node = document.querySelector(`[data-element="letter${i}"]`);
      if (node?.textContent === wanted) return i;
    }
    return -1;
  }, letter);
  if (slot < 0) throw new Error(`no tile carries ${letter}`);
  const box = await page.locator(`[data-element="bosbuton${slot}"]`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(
    (expectedEntry) => document.querySelector('[data-testid="entry"]')?.textContent === expectedEntry,
    expected,
  );
  await page.waitForFunction(() => document.querySelectorAll('.e3-wordball-getir').length === 0);
}

async function shoot(page, file) {
  await page.screenshot({ path: file, clip: CLIP });
  return file;
}

async function injectReference(page, frame) {
  const b64 = Buffer.from(FRAMES[frame], 'utf8').toString('base64');
  await page.evaluate(
    ({ box, frameB64 }) => {
      const message = document.querySelector('[data-testid="message"]');
      if (message instanceof HTMLElement) message.style.display = 'none';
      const ball = document.querySelector('[data-element="status_ball"]');
      if (ball instanceof HTMLElement) ball.style.visibility = 'hidden';
      const img = document.createElement('img');
      img.id = 'y9-capture-reference';
      img.style.cssText =
        `position:absolute;left:${box.x}px;top:${box.y}px;width:${box.w}px;` +
        `height:${(box.w * 34.8) / 107}px;z-index:26000`;
      img.src = `data:image/svg+xml;base64,${frameB64}`;
      const root = document.querySelector('[data-testid="stage-root"]');
      if (!(root instanceof HTMLElement)) throw new Error('stage-root missing');
      root.appendChild(img);
      return img.decode();
    },
    { box: STATUS_BOX, frameB64: b64 },
  );
}

async function removeReference(page) {
  await page.evaluate(() => {
    document.getElementById('y9-capture-reference')?.remove();
    const message = document.querySelector('[data-testid="message"]');
    if (message instanceof HTMLElement) message.style.display = '';
    const ball = document.querySelector('[data-element="status_ball"]');
    if (ball instanceof HTMLElement) ball.style.visibility = '';
  });
}

async function captureStates(browser, dsf) {
  const context = await browser.newContext({
    deviceScaleFactor: dsf,
    viewport: { width: 550, height: 400 },
  });
  const page = await context.newPage();
  await prepareRound(page);

  const files = {};
  // idle
  files.idleAfter = await shoot(page, abs(`evidence/visual/Y9/actual-idle-dsf${dsf}.png`));
  await injectReference(page, 1);
  files.idleReference = await shoot(page, abs(`evidence/visual/Y9/reference-idle-dsf${dsf}.png`));
  await removeReference(page);

  // valid: type the first listed 3-letter word of the fixture round
  await clickLetter(page, 'A', 'A');
  await clickLetter(page, 'F', 'AF');
  await clickLetter(page, 'İ', 'AFİ');

  // before (pre-fix appearance reproduced), then after, then the reference
  const beforeValidHandle = await page.addStyleTag({ content: BEFORE_CSS });
  files.validBefore = await shoot(page, abs(`evidence/visual/Y9/before-valid-dsf${dsf}.png`));
  await beforeValidHandle.evaluate((node) => node.remove());
  files.validAfter = await shoot(page, abs(`evidence/visual/Y9/actual-valid-dsf${dsf}.png`));
  await injectReference(page, 2);
  files.validReference = await shoot(page, abs(`evidence/visual/Y9/reference-valid-dsf${dsf}.png`));
  await removeReference(page);

  // found: submit, re-enter the same word
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.foundWords.length === 1);
  await clickLetter(page, 'A', 'A');
  await clickLetter(page, 'F', 'AF');
  await clickLetter(page, 'İ', 'AFİ');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="message"]')?.textContent === 'Girildi',
  );
  const beforeFoundHandle = await page.addStyleTag({ content: BEFORE_CSS });
  files.foundBefore = await shoot(page, abs(`evidence/visual/Y9/before-found-dsf${dsf}.png`));
  await beforeFoundHandle.evaluate((node) => node.remove());
  files.foundAfter = await shoot(page, abs(`evidence/visual/Y9/actual-found-dsf${dsf}.png`));
  await injectReference(page, 3);
  files.foundReference = await shoot(page, abs(`evidence/visual/Y9/reference-found-dsf${dsf}.png`));
  await removeReference(page);

  await context.close();
  return files;
}

// ---------------------------------------------------------------------------
// 3. comparison sheet (before | after | reference), labelled
// ---------------------------------------------------------------------------

async function composeSheet(browser, dsf, files) {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  const src = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  const scale = dsf === 1 ? 3 : 2;
  const rows = [
    ['idle', files.idleBefore ?? files.idleAfter, files.idleAfter, files.idleReference],
    ['valid (Geçerli)', files.validBefore, files.validAfter, files.validReference],
    ['already found (Girildi)', files.foundBefore, files.foundAfter, files.foundReference],
  ];
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font:12px/1.4 Verdana,sans-serif;color:#000}
    h1{font-size:14px;margin:8px 12px}
    table{border-collapse:collapse;margin:0 12px 12px}
    th{font-size:11px;padding:2px 6px;text-align:left}
    td{padding:2px 6px;vertical-align:top}
    td img{display:block;width:${Math.round(102.63 * scale)}px;image-rendering:pixelated}
  </style></head><body>
  <h1>Y9 status capsule — deviceScaleFactor ${dsf} — before (pre-fix appearance) | after (app) | reference frame</h1>
  <table>
    <tr><th>state</th><th>before</th><th>after</th><th>reference</th></tr>
    ${rows
      .map(
        ([label, before, after, reference]) =>
          `<tr><td>${label}</td><td><img src="${src(before)}"></td><td><img src="${src(after)}"></td><td><img src="${src(reference)}"></td></tr>`,
      )
      .join('\n')}
  </table></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    for (const img of Array.from(document.querySelectorAll('img'))) {
      try {
        await img.decode();
      } catch {
        /* ignore */
      }
    }
  });
  const file = abs(`evidence/visual/Y9/comparison-sheet-dsf${dsf}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await context.close();
  return file;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  const samples = await sampleFrameColours(browser);
  console.log('[Y9] reference frame colour samples (frames rendered at dsf4, exact RGB):');
  for (const frame of [1, 2, 3]) {
    const s = samples[frame];
    console.log(
      `  frame ${frame}: ball centre ${s.ballCentre} | ball highlight ${s.ballHighlight}` +
        (s.textStem === null ? '' : ` | first-glyph stem ${s.textStem}`),
    );
    console.log(
      `  frame ${frame}: exact pixels per declared fill ` +
        s.exact.map(([c, n]) => `${c} x${n}`).join(' | '),
    );
  }
  for (const dsf of [1, 2]) {
    const files = await captureStates(browser, dsf);
    const sheet = await composeSheet(browser, dsf, files);
    console.log(`[Y9] dsf${dsf}: crops + ${path.relative(ROOT, sheet)} written`);
  }
} finally {
  await browser.close();
}
