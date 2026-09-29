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
//   6. the letter_tile template carries no baked placeholder glyph (X2 guard);
//   7. the two raster-bearing SVGs embed the pinned HD WebP remaster payloads
//      and the manifest records the artifacts (Y1 guard).
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
// Y1 regression guard (owner final presentation wave); extended by Y4
//
// `s48_board_backdrop.svg` (bitmap 47) and `s90_btn_speaker.svg` (bitmap 86)
// carry the owner-approved HD remaster payloads instead of the 2012 PNG
// payloads: the process pipeline (`tools/process-assets.mjs` `HD_REMASTERS`)
// swaps the embedded data URI for the hash-pinned 8x WebP artifact, and the
// manifest entry records the artifact as `source` + its sha256. This check
// fails if the payload regresses to the 2012 PNG or the manifest record drifts.
// Derivation/measurements: evidence/Y1-remaster.md.
//
// Task Y4 (owner defect from Y1): the s90 pin is the RGBA encode
// (`ai86-8x-alpha.webp`) — the Y1 encode was RGB, which rendered bitmap 86's
// transparent corners as opaque black. The guard below asserts the s90 payload
// declares an alpha channel (bitmap 47 is opaque by design: its source PNG is
// RGB and the backdrop fill covers the full 550x400 box — audit in
// evidence/Y4-knob-alpha.md §2).
// ---------------------------------------------------------------------------
const Y1_REMASTERS = {
  'svg/s48_board_backdrop.svg': {
    artifact: 'artifacts/hd-assets/ai47-x4plus-8x.webp',
    sha256: '58ac94a053dc3133bde957c15f4b23d03e6b1a0cdc4de0d8ba89e65c63cb958e',
    width: 4400,
    height: 3200,
    alpha: false, // bitmap 47 is fully opaque (source color type RGB, no alpha)
    templateSource: 'artifacts/decompiled/shapes/48.svg',
    // Positive anchors: the backdrop structure must stay intact (no vacuous pass).
    anchors: [
      '<image ',
      'PatternID_48_1',
      'ffdec:fill-bitmapId="47"',
      'width="550" height="400"',
    ],
  },
  'svg/s90_btn_speaker.svg': {
    artifact: 'artifacts/hd-assets/ai86-8x-alpha.webp',
    sha256: 'a5a840abdca472e96d07325b7b6281ad1b0ee22e13700dc64a377bc13da29c45',
    width: 168,
    height: 232,
    alpha: true, // Y4: RGBA encode (VP8X/ALPH); RGB would render black corners
    templateSource: 'artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_90/1_up.svg',
    anchors: [
      '<image ',
      'id="shape0"',
      'id="shape1"',
      'ffdec:fill-bitmapId="86"',
      'xlink:href="#sprite0"',
    ],
  },
};

/** Minimal WebP size reader (VP8 and VP8X containers; same subset as tools/process-assets.mjs). */
function webpSize(bytes) {
  if (bytes.subarray(0, 4).toString('latin1') !== 'RIFF') return null;
  if (bytes.subarray(8, 12).toString('latin1') !== 'WEBP') return null;
  const fourcc = bytes.subarray(12, 16).toString('latin1');
  if (fourcc === 'VP8X') {
    if (bytes.length < 30) return null;
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  if (fourcc !== 'VP8 ') return null;
  if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
  return {
    width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
    height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
  };
}

/**
 * `true` when the WebP declares an alpha channel: extended `VP8X` container with
 * the alpha flag (bit 4 of the VP8X data byte, file offset 20) and an `ALPH`
 * chunk present. The Y1 s90 encode was RGB (`VP8 `) — a regression to it must
 * fail the guard (task Y4).
 */
function webpHasAlpha(bytes) {
  if (bytes.subarray(0, 4).toString('latin1') !== 'RIFF') return false;
  if (bytes.subarray(8, 12).toString('latin1') !== 'WEBP') return false;
  if (bytes.subarray(12, 16).toString('latin1') !== 'VP8X') return false;
  if ((bytes[20] & 0x10) === 0) return false;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = bytes.subarray(offset, offset + 4).toString('latin1');
    const size = bytes.readUInt32LE(offset + 4);
    if (id === 'ALPH') return true;
    offset += 8 + size + (size % 2);
  }
  return false;
}

describe('HD remaster payloads (Y1)', () => {
  for (const [name, expected] of Object.entries(Y1_REMASTERS)) {
    it(`${name} embeds the pinned WebP remaster and the manifest records it`, () => {
      const rel = `src/assets/${name}`;
      const svg = readFileSync(path.join(ROOT, rel), 'utf8');
      // Positive anchors: the SVG structure behind the payload must be intact.
      for (const anchor of expected.anchors) {
        expect(svg, `${name} anchor ${anchor}`).toContain(anchor);
      }
      // Exactly one payload, WebP, no leftover 2012 PNG data URI.
      const payloads = svg.match(/xlink:href="data:image\/webp;base64,[A-Za-z0-9+/=]+"/g) ?? [];
      expect(payloads, `${name} embedded WebP payloads`).toHaveLength(1);
      expect(svg, `${name} carries no embedded PNG payload`).not.toMatch(
        /xlink:href="data:image\/PNG;base64,/,
      );
      const bytes = Buffer.from(
        payloads[0].replace('xlink:href="data:image/webp;base64,', '').replace(/"$/, ''),
        'base64',
      );
      const size = webpSize(bytes);
      expect(size, `${name} payload decodes as a VP8/VP8X WebP`).not.toBeNull();
      expect(size, `${name} natural size`).toEqual({
        width: expected.width,
        height: expected.height,
      });
      // Y4: the s90 payload must carry alpha (RGB regressed to black corners);
      // s48 is opaque by design and must stay a plain VP8/RGB payload.
      expect(webpHasAlpha(bytes), `${name} alpha channel`).toBe(expected.alpha === true);
      // Manifest record: artifact as source + pinned sha256 + template provenance.
      const entry = manifest.assets[name];
      expect(entry, `${name} in the manifest`).toBeDefined();
      expect(entry.source).toBe(expected.artifact);
      expect(entry.sourceSha256).toBe(expected.sha256);
      expect(entry.templateSource).toBe(expected.templateSource);
      expect(entry.remaster).toEqual({
        format: 'image/webp',
        naturalWidth: expected.width,
        naturalHeight: expected.height,
      });
      expect(sha256(rel), `${name} sha256`).toBe(entry.sha256);
    });
  }
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
