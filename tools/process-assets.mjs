#!/usr/bin/env node
/**
 * tools/process-assets.mjs — task E1 (asset integration) pipeline.
 *
 * Commands:
 *   svg      Optimize (pinned SVGO) and render-verify every SVG referenced by
 *            `data/layout.json`; output goes to `src/assets/svg/` with the
 *            docs/03 §1 name `s<symbolId>_<slug>.svg` (slug = A3 element id).
 *            Before/after screenshots are rendered in muted Chromium
 *            (`--mute-audio`, EXECUTION.md §8) and pixel-diffed with F1's
 *            `verify/diff/diff.mjs`; the pass rule is 0 mismatched pixels.
 *            Screenshots + reports are copied to `evidence/visual/E1-svgo/`.
 *   img      docs/03 §2 decision procedure for the two bitmaps; as-is copies
 *            to `src/assets/img/` named `img_<id>_<w>x<h>.png`.
 *   sfx      Verify the 9 sounds against the A1 hashes (file hash, SHA256SUMS
 *            row, raw SoundData chain) and copy to `src/assets/sfx/` under the
 *            D4/docs/03 §1 names. Sounds are hashed only — never played.
 *   text     Copy the 26 text-catalog files referenced by `data/layout.json`
 *            to `src/assets/text/` (committed, so runtime refs resolve inside
 *            the repo; source basenames kept).
 *   layout   Write `src/data/layout.json` (only the `asset` values rewritten,
 *            textually, so all other bytes stay A3-identical) and
 *            `src/data/animation.json` (byte copy). `data/*` stays untouched.
 *   manifest Write `src/assets/manifest.json` (name → sha256 → source, data
 *            copy records, element source→runtime mapping).
 *   all      svg + img + sfx + text + layout + manifest.
 *
 * Exit code 0 on success; 1 on any failed check (no partial silent pass).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { optimize, VERSION as SVGO_VERSION } from 'svgo';
import { decodePng } from '../verify/diff/diff.mjs';

// `document`/`requestAnimationFrame` below are used inside Playwright
// `page.evaluate` callbacks, which execute in the Chromium page context, not in
// Node (same dual environment as C3's harness scripts).
/* global document, requestAnimationFrame */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abs = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(readFileSync(abs(p), 'utf8'));
const sha256File = (p) => createHash('sha256').update(readFileSync(abs(p))).digest('hex');
const OK = (line) => console.log(`[process-assets] ${line}`);

const LAYOUT_SOURCE = 'data/layout.json';
const ANIMATION_SOURCE = 'data/animation.json';
const LAYOUT_SOURCE_SHA256 =
  'eb8a098cab21df360cf24dea2f38c2b6b2e56cd16c248b4d6447ce51d3cb292d';
const ANIMATION_SOURCE_SHA256 =
  'c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e';

// A1-export-manifest §6 — sha256 of the raw SWF SoundData (2-byte MP3 prefix
// + the exported payload). Used to prove the export chain, not to re-encode.
const A1_SOUNDDATA_SHA256 = {
  22: 'ec752a2a6bd9c7c858df7aa0f2517e6187eedd06c68ddf68f6cd4665bbe99281',
  24: '0c78e1799f31d4965a1b0ad78043f09013ba733ac8ff843b6ecc2ecc3903e2cf',
  26: '0653e7acb08cdb95fdae5c5526b2d2dd014130abf0507b0a63ab75f9d6956935',
  30: '8820253d5cbc0f638e9bb5686cf92c5db46bd379477a7ac9c4165e928068394a',
  32: '02adf288eefb614c89b402b05a27eb68d52219bc1fdf582db5618356033051ce',
  34: 'd7d45d198b21e4632f1a90c43157462bbce49a449112c34fff890f1be140dac0',
  36: '24ad82f5fc0cf4a81652d6f8b9ee418769dd9f30828724fe3befc7627df072f6',
  38: '4c4ece8cdb665845cc4eab94e446c37c6e3ab94fe38a067b915f3ecdcff5a128',
  40: '9fa55a397002b5eb1720655b2d21ac495219e4244d9b2497c3013253101d89c5',
};

// docs/03 §2 inputs — placements/facts recorded from A1/A3 evidence (see
// evidence/E1-assets.md). Both bitmaps stay as-is (copy, no re-encoding).
const BITMAPS = [
  {
    id: 47,
    source: 'artifacts/decompiled/images/47.png',
    name: 'img_47_550x400.png',
    width: 550,
    height: 400,
    placement:
      'clipped bitmap fill inside shape 48 = element board_backdrop (SWF frame 131, ' +
      'stage box (0.45,0) 550x400); never placed directly (A1 §3; A3 §1 / O10)',
    decision:
      'displayed 550x400 = source 550x400 => as-is copy (docs/03 §2 step 2); ' +
      'no upscale, no re-encode, no creative edit (step 3/4 not triggered)',
  },
  {
    id: 86,
    source: 'artifacts/decompiled/images/86.png',
    name: 'img_86_21x29.png',
    width: 21,
    height: 29,
    placement:
      'clipped bitmap fill inside shape 87 inside DefineSprite 88 (frame label "on"), ' +
      'inlined into DefineButton2_90 (btn_speaker) up-state; never placed directly ' +
      '(A1 §3; A3 §1 / O10)',
    decision: 'displayed 21x29 = source 21x29 => as-is copy (docs/03 §2 step 2)',
  },
];

// SVGO 4.1.0 preset-default overrides. Disabled plugins are the ones that can
// move geometry, rewrite references or drop attributes: docs/03 §1 says
// "no geometry edits", and the E1 pass rule is 0 mismatched pixels.
const SVGO_DISABLED_OVERRIDES = [
  'cleanupIds',
  'cleanupNumericValues',
  'convertShapeToPath',
  'convertEllipseToCircle',
  'moveElemsAttrsToGroup',
  'moveGroupAttrsToElems',
  'collapseGroups',
  'convertPathData',
  'convertTransform',
  'mergePaths',
  'removeUselessStrokeAndFill',
];

export const SVGO_OPTIONS = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: Object.fromEntries(SVGO_DISABLED_OVERRIDES.map((n) => [n, false])),
      },
    },
  ],
};

/**
 * Character id + source kind from an A3 asset path
 * (shapes/<id>.svg | sprites/DefineSprite_<id>/<frame>.svg | DefineButton2_<id>/1_up.svg).
 */
function symbolFromAsset(asset) {
  let m = asset.match(/\/shapes\/(\d+)\.svg$/);
  if (m) return { kind: 'shape', id: Number(m[1]) };
  m = asset.match(/\/sprites\/DefineSprite_(\d+)\/(\d+)\.svg$/);
  if (m) return { kind: 'sprite', id: Number(m[1]), frame: Number(m[2]) };
  m = asset.match(/DefineButton2_(\d+)\/1_up\.svg$/);
  if (m) return { kind: 'button', id: Number(m[1]) };
  throw new Error(`unrecognised SVG asset path: ${asset}`);
}

/** Unique kind:svg entries of data/layout.json, in catalog order. */
function svgEntries() {
  const layout = readJson(LAYOUT_SOURCE);
  const seen = new Set();
  const entries = [];
  for (const el of layout.elements) {
    if (el.kind !== 'svg') continue;
    if (seen.has(el.asset)) throw new Error(`shared SVG asset (slug ambiguous): ${el.asset}`);
    seen.add(el.asset);
    const symbol = symbolFromAsset(el.asset);
    entries.push({
      element: el.id,
      source: el.asset,
      name: `s${symbol.id}_${el.id}.svg`,
      symbol,
    });
  }
  return entries;
}

function textEntries() {
  const layout = readJson(LAYOUT_SOURCE);
  return layout.elements
    .filter((el) => el.kind === 'text')
    .map((el) => ({ element: el.id, source: el.asset, name: path.basename(el.asset) }));
}

/** Intrinsic size from the SVG root width/height attributes (FFDec writes px). */
function svgIntrinsicSize(content) {
  const root = content.match(/<svg\b[^>]*>/);
  if (!root) throw new Error('no <svg> root element');
  const width = root[0].match(/\bwidth="([0-9.]+)(?:px)?"/);
  const height = root[0].match(/\bheight="([0-9.]+)(?:px)?"/);
  if (!width || !height) throw new Error('svg root has no numeric width/height');
  return { width: Number(width[1]), height: Number(height[1]) };
}

/**
 * Render an SVG string in isolation through an <img> data URI (no external
 * resources, no CSS inheritance) and screenshot the pinned box. The browser is
 * launched with --mute-audio (EXECUTION.md §8) — no sound is ever emitted.
 * Returns the image's natural size, proving the data URI actually parsed and
 * loaded (a failed load would render a blank page and make the diff vacuous).
 */
async function renderSvgSnapshot(page, content, size, outPath) {
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const html = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><style>',
    'html,body{margin:0;padding:0;background:#ffffff;overflow:hidden}',
    `#a{display:block;width:${size.width}px;height:${size.height}px}`,
    '</style></head><body>',
    `<img id="a" alt="" src="data:image/svg+xml;base64,${b64}">`,
    '</body></html>',
  ].join('');
  await page.setContent(html, { waitUntil: 'load' });
  const natural = await page.evaluate(async () => {
    const img = document.getElementById('a');
    try {
      await img.decode();
    } catch {
      /* zero-sized images can reject decode; the screenshot is still taken */
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
  });
  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: 0, width: size.viewportWidth, height: size.viewportHeight },
  });
  return natural;
}

/** Count pixels that differ from the white page background (alpha ignored). */
function pngInk(p) {
  const img = decodePng(readFileSync(p));
  let ink = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] !== 255 || img.data[i + 1] !== 255 || img.data[i + 2] !== 255) ink++;
  }
  return ink;
}

async function cmdSvg() {
  const entries = svgEntries();
  const outDir = abs('src/assets/svg');
  const evRoot = abs('evidence/visual/E1-svgo');
  const work = path.join(tmpdir(), 'kelimator-e1-svgo');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(evRoot, { recursive: true });
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  const browser = await chromium.launch({ args: ['--mute-audio'] });
  const results = [];
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const entry of entries) {
      const source = readFileSync(abs(entry.source), 'utf8');
      const { data: optimized } = optimize(source, { path: entry.source, ...SVGO_OPTIONS });
      const outPath = path.join(outDir, entry.name);
      writeFileSync(outPath, optimized);

      const intrinsic = svgIntrinsicSize(source);
      const size = {
        width: intrinsic.width,
        height: intrinsic.height,
        viewportWidth: Math.max(16, Math.ceil(intrinsic.width)),
        viewportHeight: Math.max(16, Math.ceil(intrinsic.height)),
      };
      const before = path.join(work, `${entry.name}.before.png`);
      const after = path.join(work, `${entry.name}.after.png`);
      const diffDir = path.join(work, `${entry.name}.diff`);
      const beforeInfo = await renderSvgSnapshot(page, source, size, before);
      const afterInfo = await renderSvgSnapshot(page, optimized, size, after);
      if (
        intrinsic.width > 0 &&
        (beforeInfo.naturalWidth <= 0 || afterInfo.naturalWidth <= 0)
      ) {
        throw new Error(
          `${entry.name}: SVG image did not load (natural size ` +
            `${beforeInfo.naturalWidth}x${beforeInfo.naturalHeight} / ` +
            `${afterInfo.naturalWidth}x${afterInfo.naturalHeight})`,
        );
      }
      const inkPixels = pngInk(before);
      if (pngInk(after) !== inkPixels) {
        throw new Error(`${entry.name}: before/after ink pixel count differs`);
      }

      execFileSync(process.execPath, ['verify/diff/diff.mjs', before, after, diffDir], {
        cwd: ROOT,
        stdio: 'pipe',
      });
      const report = JSON.parse(readFileSync(path.join(diffDir, 'report.json'), 'utf8'));
      if (report.mismatchedPixels !== 0) {
        throw new Error(
          `${entry.name}: ${report.mismatchedPixels} mismatched pixels ` +
            `(pass=${String(report.pass)}) — SVGO output not geometrically identical`,
        );
      }

      const evDir = path.join(evRoot, entry.name.replace(/\.svg$/, ''));
      mkdirSync(evDir, { recursive: true });
      copyFileSync(before, path.join(evDir, 'before.png'));
      copyFileSync(after, path.join(evDir, 'after.png'));
      copyFileSync(path.join(diffDir, 'report.json'), path.join(evDir, 'report.json'));

      results.push({
        name: entry.name,
        element: entry.element,
        source: entry.source,
        symbol: entry.symbol,
        sourceBytes: Buffer.byteLength(source),
        outputBytes: Buffer.byteLength(optimized),
        width: intrinsic.width,
        height: intrinsic.height,
        naturalWidth: beforeInfo.naturalWidth,
        naturalHeight: beforeInfo.naturalHeight,
        inkPixels,
        mismatchedPixels: report.mismatchedPixels,
        maxDistance: report.maxDistance,
        meanDistance: report.meanDistance,
        pass: true,
      });
      OK(
        `svg ${entry.name}: ${Buffer.byteLength(source)} -> ${Buffer.byteLength(optimized)} bytes, ` +
          `ink=${inkPixels}, mismatchedPixels=${report.mismatchedPixels}`,
      );
    }
  } finally {
    await browser.close();
  }

  const summary = {
    schemaVersion: 1,
    svgo: { version: SVGO_VERSION, preset: 'preset-default', disabledOverrides: SVGO_DISABLED_OVERRIDES },
    assets: results,
    totals: {
      assets: results.length,
      mismatchedPixels: results.reduce((n, r) => n + r.mismatchedPixels, 0),
      sourceBytes: results.reduce((n, r) => n + r.sourceBytes, 0),
      outputBytes: results.reduce((n, r) => n + r.outputBytes, 0),
      inkPixels: results.reduce((n, r) => n + r.inkPixels, 0),
      nonBlankRenders: results.filter((r) => r.inkPixels > 0).length,
    },
  };
  if (summary.totals.assets !== 36 || summary.totals.mismatchedPixels !== 0) {
    throw new Error(
      `expected 36 SVGs and 0 mismatched pixels, got ${summary.totals.assets} / ` +
        `${summary.totals.mismatchedPixels}`,
    );
  }
  writeFileSync(path.join(evRoot, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  OK(
    `svg done: ${results.length} assets, 0 mismatched pixels, ` +
      `${summary.totals.sourceBytes} -> ${summary.totals.outputBytes} bytes, ` +
      `${summary.totals.nonBlankRenders} non-blank renders`,
  );
}

function pngSize(p) {
  const b = readFileSync(abs(p));
  if (b.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`${p}: not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function cmdImg() {
  const outDir = abs('src/assets/img');
  mkdirSync(outDir, { recursive: true });
  for (const bmp of BITMAPS) {
    const { width, height } = pngSize(bmp.source);
    if (width !== bmp.width || height !== bmp.height) {
      throw new Error(
        `${bmp.source}: PNG ${width}x${height} != catalog ${bmp.width}x${bmp.height} (tolerance ±0)`,
      );
    }
    const dest = path.join(outDir, bmp.name);
    copyFileSync(abs(bmp.source), dest);
    const sourceSha = sha256File(bmp.source);
    const destSha = sha256File(path.relative(ROOT, dest));
    if (sourceSha !== destSha) throw new Error(`${bmp.name}: copy hash mismatch`);
    OK(
      `img ${bmp.name}: ${width}x${height} (IHDR = catalog ±0), as-is, sha256=${destSha}`,
    );
    OK(`img ${bmp.name}: placement ${bmp.placement}`);
    OK(`img ${bmp.name}: decision ${bmp.decision}`);
  }
}

function a1ExportHashes() {
  const rows = new Map();
  for (const line of readFileSync(abs('artifacts/decompiled/SHA256SUMS.txt'), 'utf8').split('\n')) {
    const m = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    if (m) rows.set(m[2], m[1]);
  }
  return rows;
}

function cmdSfx() {
  const soundMap = readJson('data/sound-map.json');
  const a1 = a1ExportHashes();
  const outDir = abs('src/assets/sfx');
  mkdirSync(outDir, { recursive: true });
  const ids = Object.keys(soundMap.sounds).map(Number);
  for (const id of ids) {
    const entry = soundMap.sounds[id];
    const source = `artifacts/decompiled/sounds/${id}.mp3`;
    const raw = `artifacts/decompiled/sfx-raw/${id}.mp3.rawdata`;
    const dest = `src/assets/sfx/${entry.file}`;
    if (!existsSync(abs(source))) throw new Error(`${source}: missing A1 export`);
    if (!existsSync(abs(raw))) throw new Error(`${raw}: missing raw payload dump`);

    const sourceSha = sha256File(source);
    const rawSha = sha256File(raw);
    const a1Sha = a1.get(source);
    if (a1Sha === undefined) throw new Error(`${source}: no A1 SHA256SUMS row`);
    if (sourceSha !== a1Sha) throw new Error(`${source}: sha256 != A1 SHA256SUMS row`);
    if (rawSha !== A1_SOUNDDATA_SHA256[id]) {
      throw new Error(`${raw}: sha256 != A1 export-manifest §6 SoundData hash`);
    }
    const rawBytes = readFileSync(abs(raw));
    const payload = readFileSync(abs(source));
    if (!payload.equals(rawBytes.subarray(2))) {
      throw new Error(`${source}: payload != SoundData[2:] (A1 export chain broken)`);
    }
    if (!existsSync(abs(dest)) || sha256File(dest) !== sourceSha) {
      copyFileSync(abs(source), abs(dest));
    }
    if (sha256File(dest) !== sourceSha) throw new Error(`${dest}: copy hash mismatch`);
    OK(`sfx ${dest}: sha256=${sourceSha} == A1 export == SoundData[2:]; bytes=${payload.length}`);
  }
  if (ids.length !== 9) throw new Error(`expected 9 sounds, found ${ids.length}`);
}

function cmdText() {
  const outDir = abs('src/assets/text');
  mkdirSync(outDir, { recursive: true });
  const entries = textEntries();
  for (const entry of entries) {
    const dest = path.join(outDir, entry.name);
    copyFileSync(abs(entry.source), dest);
    OK(`text ${entry.name}: bytes=${readFileSync(dest).length} (element ${entry.element})`);
  }
  OK(`text done: ${entries.length} files`);
}

/**
 * Rewrite only the `asset` string values of the A3 layout textually, so every
 * other byte of the runtime copy stays identical to `data/layout.json`.
 */
function layoutMapping() {
  const layout = readJson(LAYOUT_SOURCE);
  const mapping = [];
  for (const el of layout.elements) {
    let runtime;
    if (el.kind === 'svg') {
      const symbol = symbolFromAsset(el.asset);
      runtime = `src/assets/svg/s${symbol.id}_${el.id}.svg`;
    } else if (el.kind === 'text') {
      runtime = `src/assets/text/${path.basename(el.asset)}`;
    } else if (el.kind === 'bitmap') {
      const bmp = BITMAPS.find((b) => el.asset.endsWith(`/${b.id}.png`));
      if (!bmp) throw new Error(`${el.id}: unknown bitmap asset ${el.asset}`);
      runtime = `src/assets/img/${bmp.name}`;
    } else {
      throw new Error(`${el.id}: unknown kind ${el.kind}`);
    }
    mapping.push({ element: el.id, source: el.asset, runtime });
  }
  if (mapping.length !== 62) throw new Error(`expected 62 element refs, found ${mapping.length}`);
  return mapping;
}

function cmdLayout() {
  const layoutSha = sha256File(LAYOUT_SOURCE);
  const animationSha = sha256File(ANIMATION_SOURCE);
  if (layoutSha !== LAYOUT_SOURCE_SHA256) {
    throw new Error(`${LAYOUT_SOURCE}: sha256 ${layoutSha} != A3-recorded value`);
  }
  if (animationSha !== ANIMATION_SOURCE_SHA256) {
    throw new Error(`${ANIMATION_SOURCE}: sha256 ${animationSha} != A3-recorded value`);
  }

  const raw = readFileSync(abs(LAYOUT_SOURCE), 'utf8');
  const mapping = layoutMapping();
  let runtime = raw;
  for (const ref of mapping) {
    const needle = `"asset": ${JSON.stringify(ref.source)}`;
    const replacement = `"asset": ${JSON.stringify(ref.runtime)}`;
    const count = runtime.split(needle).length - 1;
    if (count !== 1) throw new Error(`${ref.element}: ${count} occurrences of ${needle}`);
    runtime = runtime.replace(needle, replacement);
  }

  const before = JSON.parse(raw);
  const after = JSON.parse(runtime);
  if (JSON.stringify(before.stage) !== JSON.stringify(after.stage)) {
    throw new Error('stage section changed');
  }
  const expected = JSON.parse(raw);
  for (const ref of mapping) {
    const el = expected.elements.find((e) => e.id === ref.element);
    el.asset = ref.runtime;
    if (!existsSync(abs(ref.runtime))) throw new Error(`${ref.element}: ${ref.runtime} missing`);
  }
  if (JSON.stringify(expected) !== JSON.stringify(after)) {
    throw new Error('runtime layout differs beyond the asset rewrites');
  }

  mkdirSync(abs('src/data'), { recursive: true });
  writeFileSync(abs('src/data/layout.json'), runtime);
  copyFileSync(abs(ANIMATION_SOURCE), abs('src/data/animation.json'));
  OK(`layout ${mapping.length} asset refs rewritten -> src/data/layout.json`);
  OK(`layout src/data/animation.json: byte copy, sha256=${animationSha}`);
}

function manifestAssets(mapping) {
  const assets = {};
  const add = (name, source, extra) => {
    const rel = `src/assets/${name}`;
    if (!existsSync(abs(rel))) throw new Error(`${name}: missing for the manifest`);
    assets[name] = { sha256: sha256File(rel), source, ...extra };
  };

  const svgEntriesList = svgEntries();
  for (const entry of svgEntriesList) {
    add(`svg/${entry.name}`, entry.source, {
      kind: 'svg',
      element: entry.element,
      symbol: entry.symbol.id,
    });
  }
  for (const bmp of BITMAPS) {
    add(`img/${bmp.name}`, bmp.source, { kind: 'bitmap', bitmapId: bmp.id });
  }
  const soundMap = readJson('data/sound-map.json');
  for (const [id, entry] of Object.entries(soundMap.sounds)) {
    add(`sfx/${entry.file}`, `artifacts/decompiled/sounds/${id}.mp3`, {
      kind: 'sound',
      soundId: Number(id),
    });
  }
  for (const entry of textEntries()) {
    add(`text/${entry.name}`, entry.source, { kind: 'text', element: entry.element });
  }
  for (const ref of mapping) {
    const name = ref.runtime.slice('src/assets/'.length);
    if (!assets[name]) throw new Error(`manifest missing runtime ref ${ref.runtime}`);
  }
  return assets;
}

function cmdManifest() {
  const mapping = layoutMapping();
  if (!existsSync(abs('src/data/layout.json'))) {
    throw new Error('src/data/layout.json missing — run the layout command first');
  }
  const assets = manifestAssets(mapping);
  const manifest = {
    schemaVersion: 1,
    generator: 'tools/process-assets.mjs',
    svgo: { version: SVGO_VERSION, preset: 'preset-default', disabledOverrides: SVGO_DISABLED_OVERRIDES },
    assets,
    data: {
      'src/data/layout.json': {
        source: LAYOUT_SOURCE,
        sourceSha256: LAYOUT_SOURCE_SHA256,
        sha256: sha256File('src/data/layout.json'),
        assetRefsRewritten: mapping.length,
      },
      'src/data/animation.json': {
        source: ANIMATION_SOURCE,
        sourceSha256: ANIMATION_SOURCE_SHA256,
        sha256: sha256File('src/data/animation.json'),
        assetRefsRewritten: 0,
      },
    },
    references: Object.fromEntries(mapping.map((r) => [r.element, { source: r.source, runtime: r.runtime }])),
  };
  writeFileSync(abs('src/assets/manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  const assetCount = Object.keys(assets).length;
  OK(`manifest src/assets/manifest.json: ${assetCount} assets, ${mapping.length} runtime refs`);
}

const COMMANDS = {
  svg: cmdSvg,
  img: cmdImg,
  sfx: cmdSfx,
  text: cmdText,
  layout: cmdLayout,
  manifest: cmdManifest,
  all: async () => {
    await cmdSvg();
    cmdImg();
    cmdSfx();
    cmdText();
    cmdLayout();
    cmdManifest();
  },
};

async function main() {
  const command = process.argv[2] ?? 'help';
  if (command === 'help' || !(command in COMMANDS)) {
    console.log('usage: node tools/process-assets.mjs <svg|img|sfx|text|layout|manifest|all>');
    process.exitCode = command === 'help' ? 0 : 1;
    return;
  }
  await COMMANDS[command]();
}

main().catch((error) => {
  console.error(`[process-assets] FAIL: ${error.message}`);
  process.exitCode = 1;
});
