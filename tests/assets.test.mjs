// tests/assets.test.mjs — E1 asset manifest coverage (task E1 Verify V4/V2).
//
// Checks the hand-written runtime contract:
//   1. every `asset` referenced by src/data/layout.json resolves to a committed
//      file under src/assets/ and is listed in src/assets/manifest.json;
//   2. every asset listed in the manifest exists and matches its recorded
//      sha256 (name -> sha256 -> source);
//   3. the src/data copies recorded in the manifest match the files on disk;
//   4. the manifest records the exact-pinned svgo version from package.json;
//   5. every element id used by src/data/animation.json exists in layout.json;
//   6. the letter_tile template carries no baked placeholder glyph (X2 guard).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const sha256 = (p) =>
  createHash('sha256').update(readFileSync(path.join(ROOT, p))).digest('hex');

const manifest = readJson('src/assets/manifest.json');
const layout = readJson('src/data/layout.json');
const animation = readJson('src/data/animation.json');
const pkg = readJson('package.json');

describe('asset manifest coverage (E1)', () => {
  it('lists every asset referenced by src/data/layout.json', () => {
    const missing = [];
    for (const element of layout.elements) {
      expect(element.asset, `${element.id}: asset must be set`).toBeTruthy();
      expect(
        element.asset.startsWith('src/assets/'),
        `${element.id}: ${element.asset} is not a committed src/assets path`,
      ).toBe(true);
      const name = element.asset.slice('src/assets/'.length);
      if (!(name in manifest.assets)) missing.push(`${element.id} -> ${name}`);
    }
    expect(missing).toEqual([]);
  });

  it('resolves every referenced asset to an existing file', () => {
    const missing = layout.elements
      .map((element) => element.asset)
      .filter((asset) => !existsSync(path.join(ROOT, asset)));
    expect(missing).toEqual([]);
  });

  it('reads layout and animation from the runtime data directory', () => {
    expect(layout.schemaVersion).toBe(1);
    expect(layout.stage).toEqual({ width: 550, height: 400, background: '#ffffff' });
    expect(animation.schemaVersion).toBe(1);
    expect(animation.sequences.length).toBe(24);
  });

  it('lists every manifest asset with an existing file and its recorded sha256', () => {
    const names = Object.keys(manifest.assets);
    expect(names.length).toBeGreaterThanOrEqual(73);
    for (const name of names) {
      const rel = `src/assets/${name}`;
      expect(existsSync(path.join(ROOT, rel)), `${name} exists`).toBe(true);
      expect(manifest.assets[name].source, `${name} source`).toBeTruthy();
      expect(sha256(rel), `${name} sha256`).toBe(manifest.assets[name].sha256);
    }
  });

  it('covers the 36 svgs, 2 bitmaps, 26 texts and 9 sounds', () => {
    const kinds = {};
    for (const entry of Object.values(manifest.assets)) {
      kinds[entry.kind] = (kinds[entry.kind] ?? 0) + 1;
    }
    expect(kinds).toEqual({ svg: 36, bitmap: 2, text: 26, sound: 9 });
  });

  it('records the runtime data copies with matching hashes', () => {
    for (const file of ['src/data/layout.json', 'src/data/animation.json']) {
      expect(manifest.data[file], `${file} recorded`).toBeTruthy();
      expect(sha256(file), `${file} sha256`).toBe(manifest.data[file].sha256);
      expect(manifest.data[file].source).toBeTruthy();
    }
    expect(manifest.data['src/data/layout.json'].assetRefsRewritten).toBe(62);
    expect(manifest.data['src/data/animation.json'].assetRefsRewritten).toBe(0);
  });

  it('records the exact-pinned svgo version used for the SVGs', () => {
    expect(manifest.svgo.version).toBe(pkg.devDependencies.svgo);
    expect(manifest.svgo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('uses only element ids that exist in layout.json across animation sequences', () => {
    const ids = new Set(layout.elements.map((element) => element.id));
    const unknown = animation.sequences
      .flatMap((sequence) => sequence.elements)
      .filter((id) => !ids.has(id));
    expect(unknown).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// X2 regression guard (owner defect 2)
//
// The letter_tile export (`artifacts/decompiled/sprites/DefineSprite_58/1.svg`)
// carries the authoring-time placeholder "A" of the FLA text field as FFDec
// geometry: the `font_Verdana_A0` glyph outline plus the `text0`/`text1` text
// instances referenced from the button frames. The reference never displays it
// and the rebuild draws the letter as DOM text, so tools/process-assets.mjs
// removes exactly that subtree set from the source text before SVGO
// (`SVG_SOURCE_CORRECTIONS`). This check fails if the glyph ever reaches
// `src/assets/svg/s58_letter_tile.svg` again; it is proven by a deliberate
// local probe recorded in `evidence/X2-tile-glyph.md` (guard section).
// ---------------------------------------------------------------------------
describe('letter_tile template carries no baked placeholder glyph (X2)', () => {
  it('keeps the tile structure and carries no glyph markers', () => {
    const svg = readFileSync(path.join(ROOT, 'src/assets/svg/s58_letter_tile.svg'), 'utf8');
    // Positive anchors: the check must not pass vacuously on a stub file.
    for (const anchor of ['id="button0"', 'id="shape0"', 'id="shape1"', 'xlink:href="#button0"']) {
      expect(svg, `anchor ${anchor}`).toContain(anchor);
    }
    // `font_Verdana` = FFDec glyph group id and its references; `text0`/`text1`
    // = the placeholder text instances (definitions and frame references); the
    // path data is the "A" outline itself (`convertPathData` is disabled, so it
    // would survive SVGO verbatim).
    expect(svg, 'no FFDec glyph group/reference').not.toMatch(/font_Verdana/);
    expect(svg, 'no placeholder text instance reference').not.toMatch(/#text[01]\b/);
    expect(svg, 'no placeholder text instance definition').not.toMatch(/id="text[01]"/);
    expect(svg, 'no glyph outline path').not.toContain('M24.35 -14.35');
  });
});
