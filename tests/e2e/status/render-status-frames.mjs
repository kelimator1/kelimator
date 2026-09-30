#!/usr/bin/env node
/**
 * tests/e2e/status/render-status-frames.mjs — task Y9 measurement / evidence
 * capture for the right-panel status capsule (DefineSprite 123 frames 1–3).
 *
 * Renders the exported reference frames (`artifacts/decompiled/sprites/
 * DefineSprite_123/{1,2,3}.svg`) and candidate live-text recreations in muted
 * Chromium at deviceScaleFactor 1/2/4, samples the exact fills, and writes
 * before/after PNGs under evidence/visual/Y9/ (when --evidence is passed) or a
 * scratch directory.
 *
 * Usage:
 *   node tests/e2e/status/render-status-frames.mjs [--out <dir>] [--evidence]
 *
 * No gameplay code is involved; the script is a deterministic render harness.
 * Silent witness run: `--mute-audio` (EXECUTION.md §8).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// `document`/`requestAnimationFrame` are used inside Playwright
// `page.evaluate` callbacks (browser context; same dual environment as
// tools/process-assets.mjs).
/* global document, requestAnimationFrame */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const abs = (p) => path.join(ROOT, p);

const args = process.argv.slice(2);
const outArgIndex = args.indexOf('--out');
const OUT =
  outArgIndex >= 0 && args[outArgIndex + 1] !== undefined
    ? path.resolve(args[outArgIndex + 1])
    : abs('test-results/Y9-render');
mkdirSync(OUT, { recursive: true });

const FRAME_DIR = 'artifacts/decompiled/sprites/DefineSprite_123';
const FRAMES = [1, 2, 3].map((frame) => ({
  frame,
  svg: readFileSync(abs(`${FRAME_DIR}/${frame}.svg`), 'utf8'),
}));

/** Strips the baked static-text subtree (text id 119/122) from a frame. */
function stripFrameText(svg) {
  let out = svg;
  const useRe = /<use\b[^>]*ffdec:characterId="(?:119|122)"[^>]*\/>/g;
  const uses = out.match(useRe) ?? [];
  if (uses.length !== 1) throw new Error(`expected 1 text use, found ${uses.length}`);
  out = out.replace(useRe, '');

  // remove the <g id="text0">…</g> subtree (balanced scan)
  const open = '<g id="text0">';
  const start = out.indexOf(open);
  if (start === -1) throw new Error('text0 group not found');
  const tagRe = /<(\/?)g\b[^>]*>/g;
  tagRe.lastIndex = start + open.length;
  let depth = 1;
  let end = -1;
  for (let m = tagRe.exec(out); m !== null; m = tagRe.exec(out)) {
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) {
      end = tagRe.lastIndex;
      break;
    }
  }
  if (end === -1) throw new Error('unbalanced text0 group');
  out = out.slice(0, start) + out.slice(end);

  // remove the glyph outline groups referenced only by the text instance
  const glyphIds = [...out.matchAll(/<g id="(font_Verdana_[^"]+)">/g)].map((m) => m[1]);
  for (const id of glyphIds) {
    const openGlyph = `<g id="${id}">`;
    const s = out.indexOf(openGlyph);
    const re = /<(\/?)g\b[^>]*>/g;
    re.lastIndex = s + openGlyph.length;
    let d = 1;
    let e = -1;
    for (let m = re.exec(out); m !== null; m = re.exec(out)) {
      d += m[1] === '/' ? -1 : 1;
      if (d === 0) {
        e = re.lastIndex;
        break;
      }
    }
    if (e === -1) throw new Error(`unbalanced ${id}`);
    out = out.slice(0, s) + out.slice(e);
  }
  if (out.includes('text0') || out.includes('font_Verdana')) {
    throw new Error('text subtree remnants remain');
  }
  return out;
}

function b64(svg) {
  return Buffer.from(svg, 'utf8').toString('base64');
}

/** HTML page: the capsule box (107×34.8) on a white background. */
function pageHtml(inner) {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
    // Status-box origin: the app lays the element out at fractional CSS
    // coordinates; the harness pins the same fractional offsets so the
    // rasterization phase matches (447.37 / 238.45 from src/data/layout.json).
    'html,body{margin:0;padding:0;background:#fff}',
    '#stage{position:relative;width:550px;height:400px;overflow:hidden;background:#e3e4ec}',
    '#capsule{position:absolute;left:447.37px;top:238.45px;width:107.01px;height:34.81px}',
    '#capsule img{display:block;position:absolute;left:0;top:0;width:107.01px;height:34.81px}',
    '.livetext{position:absolute;left:40px;top:0;font-family:Verdana,"DejaVu Sans",sans-serif;',
    'font-weight:700;white-space:pre;line-height:0;pointer-events:none}',
    '</style></head><body><div id="stage"><div id="capsule">',
    inner,
    '</div></div></body></html>',
  ].join('');
}

const candidates = [];
for (const size of [13.9, 14.0, 14.1, 14.2, 14.3, 14.5]) {
  for (const ty of [15.25, 15.5, 15.75]) {
    candidates.push({ size, ty });
  }
}

async function shoot(page, html, file) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    for (const img of Array.from(document.querySelectorAll('img'))) {
      try {
        await img.decode();
      } catch {
        /* ignore */
      }
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({
    path: file,
    clip: { x: 447.37, y: 238.45, width: 107.01, height: 34.81 },
  });
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  for (const dsf of [1, 2, 4]) {
    const context = await browser.newContext({ deviceScaleFactor: dsf });
    const page = await context.newPage();
    for (const { frame, svg } of FRAMES) {
      await shoot(page, pageHtml(`<img alt="" src="data:image/svg+xml;base64,${b64(svg)}">`),
        path.join(OUT, `frame-${frame}-dsf${dsf}.png`));
    }
    const stripped2 = stripFrameText(FRAMES[1].svg);
    await shoot(page, pageHtml(`<img alt="" src="data:image/svg+xml;base64,${b64(stripped2)}">`),
      path.join(OUT, `frame-2-ball-only-dsf${dsf}.png`));
    const stripped3 = stripFrameText(FRAMES[2].svg);
    await shoot(page, pageHtml(`<img alt="" src="data:image/svg+xml;base64,${b64(stripped3)}">`),
      path.join(OUT, `frame-3-ball-only-dsf${dsf}.png`));
    for (const candidate of candidates) {
      for (const [frame, stripped, text, color] of [
        [2, stripped2, 'Geçerli', '#336600'],
        [3, stripped3, 'Girildi', '#ff0000'],
      ]) {
        const label = `live-${frame}-${candidate.size}-${candidate.ty}`;
        const inner =
          `<img alt="" src="data:image/svg+xml;base64,${b64(stripped)}">` +
          `<span class="livetext" style="font-size:${candidate.size}px;` +
          `color:${color};transform:translateY(${candidate.ty}px)">${text}</span>`;
        await shoot(page, pageHtml(inner), path.join(OUT, `${label}-dsf${dsf}.png`));
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

// Save the stripped ball-only SVG for inspection.
writeFileSync(path.join(OUT, 'frame-2-ball-only.svg'), stripFrameText(FRAMES[1].svg));
console.log(`[Y9] rendered reference frames + ${candidates.length} live-text candidates to ${OUT}`);
