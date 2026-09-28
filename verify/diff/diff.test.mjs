/**
 * F1 self-tests — run with `npm test -- diff` (Vitest, from the repo root).
 *
 * Covers the task F1 checklist plus the anti-aliasing-tolerant metric added by
 * the Amendment 2026-09-28 in docs/07-verification.md §4:
 *   - identical images -> raw and tolerant ratio 0, pass: true
 *   - known mutation (10x10 block, +100/channel) -> exact raw bbox/ratio and
 *     exact tolerant 6x6 core (36 px) at (x0+2, y0+2)
 *   - structural changes (30x30 recolour, 40x40 square shifted 6 px) still
 *     detected by the tolerant metric, confined to the expected band
 *   - radius boundary: a 4 px shift is fully absorbed by the 5x5 tolerance
 *   - size mismatch -> clean error, non-zero exit
 *   - undecodable input / usage / --help exit-code contract
 *   - threshold boundary and alpha semantics (docs/07-verification.md §4)
 *   - determinism: two runs -> byte-identical report.json (and heatmap.png)
 *
 * Test images are generated deterministically in a temp directory at test
 * time (no binary fixtures committed); see verify/diff/fixtures.mjs, whose
 * triangle-wave pattern makes the tolerant expectations analytically exact.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  MISMATCH_THRESHOLD,
  PASS_RATIO,
  TOLERANT_RADIUS,
  compareImages,
  decodePng,
  encodePng,
  runComparison,
} from './diff.mjs';
import { MUTATED_BLOCK, STAGE, makeSolidSquareImage, makeStageImage, mutateBlock } from './fixtures.mjs';

const DIFF_MJS = fileURLToPath(new URL('./diff.mjs', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'kelimator-f1-'));
const TIMEOUT = 30_000;

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function writePng(name, image) {
  const path = join(scratch, name);
  writeFileSync(path, encodePng(image));
  return path;
}

function runCli(args) {
  return spawnSync(process.execPath, [DIFF_MJS, ...args], { encoding: 'utf8' });
}

function readReport(outDir) {
  return JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8'));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

describe('PNG codec (node:zlib built-ins)', () => {
  it('encodes and decodes RGBA pixels losslessly', () => {
    const image = makeStageImage(9, 7, 5);
    const decoded = decodePng(encodePng(image));
    expect(decoded.width).toBe(9);
    expect(decoded.height).toBe(7);
    expect(Array.from(decoded.data)).toEqual(Array.from(image.data));
  });

  it('rejects non-PNG data with a clean error', () => {
    expect(() => decodePng(Buffer.from('definitely not a png'))).toThrow(/PNG signature/);
  });

  it('rejects a truncated PNG', () => {
    const png = encodePng(makeStageImage(4, 4, 2));
    expect(() => decodePng(png.subarray(0, 40))).toThrow(/truncated PNG chunk/);
  });

  it('rejects a PNG with a corrupted chunk CRC', () => {
    const png = encodePng(makeStageImage(4, 4, 2));
    const corrupted = Buffer.from(png);
    corrupted[45] ^= 0xff; // inside the IDAT chunk data
    expect(() => decodePng(corrupted)).toThrow(/CRC mismatch/);
  });
});

describe('threshold semantics (docs/07-verification.md §4)', () => {
  it('uses the documented constants', () => {
    expect(MISMATCH_THRESHOLD).toBe(30);
    expect(PASS_RATIO).toBe(0.02);
    expect(TOLERANT_RADIUS).toBe(2);
  });

  it('distance exactly 30 is a match; anything greater is a mismatch', () => {
    const a = {
      width: 3,
      height: 1,
      data: Uint8Array.from([10, 10, 10, 255, 10, 10, 10, 255, 10, 10, 10, 255]),
    };
    const b = {
      width: 3,
      height: 1,
      data: Uint8Array.from([40, 10, 10, 255, 41, 10, 10, 255, 10, 10, 10, 255]),
    };
    const report = compareImages(a, b);
    // Raw: pixel 0 at exactly 30 matches, pixel 1 at 31 is the only mismatch.
    expect(report.mismatchedPixels).toBe(1);
    expect(report.mismatchBBox).toEqual({ x: 1, y: 0, width: 1, height: 1 });
    expect(report.maxDistance).toBe(31);
    expect(report.mismatchRatio).toBe(1 / 3);
    // Tolerant: pixel 1 is tolerated because B[0] is at distance 30 from A[1]
    // (symmetric neighbourhood check, direction A[p] vs B[q]).
    expect(report.tolerantMismatchedPixels).toBe(0);
    expect(report.tolerantMismatchBBox).toBeNull();
  });

  it('ignores alpha-only differences (RGB distance only)', () => {
    const a = {
      width: 2,
      height: 1,
      data: Uint8Array.from([10, 20, 30, 255, 40, 50, 60, 255]),
    };
    const b = {
      width: 2,
      height: 1,
      data: Uint8Array.from([10, 20, 30, 0, 40, 50, 60, 128]),
    };
    const report = compareImages(a, b);
    expect(report.mismatchedPixels).toBe(0);
    expect(report.mismatchRatio).toBe(0);
    expect(report.tolerantMismatchedPixels).toBe(0);
    expect(report.pass).toBe(true);
  });
});

describe('identical images', () => {
  it(
    'produces raw ratio 0, tolerant ratio 0 and pass: true (CLI, 550x400)',
    { timeout: TIMEOUT },
    () => {
      const base = makeStageImage();
      const a = writePng('identical-a.png', base);
      const b = writePng('identical-b.png', base);
      const out = join(scratch, 'identical-out');
      const res = runCli([a, b, out]);
      expect(res.status).toBe(0);
      expect(res.stderr).toBe('');
      const report = readReport(out);
      expect(report.schemaVersion).toBe(2);
      expect(report.tolerantRadius).toBe(2);
      expect(report.mismatchedPixels).toBe(0);
      expect(report.mismatchRatio).toBe(0);
      expect(report.maxDistance).toBe(0);
      expect(report.meanDistance).toBe(0);
      expect(report.mismatchBBox).toBeNull();
      expect(report.tolerantMismatchedPixels).toBe(0);
      expect(report.tolerantMismatchRatio).toBe(0);
      expect(report.tolerantMismatchBBox).toBeNull();
      expect(report.pass).toBe(true);
      expect(existsSync(join(out, 'heatmap.png'))).toBe(true);
    },
  );
});

describe('known mutation (10x10 block, +100 per channel)', () => {
  it(
    'raw bbox stays exact; tolerant is the 6x6 core at (+2,+2), exact ratio (CLI)',
    { timeout: TIMEOUT },
    () => {
      const base = makeStageImage();
      const mutated = mutateBlock(base);
      const a = writePng('mutated-base.png', base);
      const b = writePng('mutated-delta.png', mutated);
      const out = join(scratch, 'mutated-out');
      const res = runCli([a, b, out]);
      expect(res.status).toBe(0);

      const report = readReport(out);
      expect(report.schemaVersion).toBe(2);
      expect(report.width).toBe(STAGE.width);
      expect(report.height).toBe(STAGE.height);
      expect(report.totalPixels).toBe(STAGE.width * STAGE.height);
      // Raw metric: unchanged, exactly the mutated block.
      expect(report.mismatchedPixels).toBe(MUTATED_BLOCK.width * MUTATED_BLOCK.height);
      expect(report.mismatchBBox).toEqual(MUTATED_BLOCK);
      expect(report.mismatchRatio).toBe(
        (MUTATED_BLOCK.width * MUTATED_BLOCK.height) / (STAGE.width * STAGE.height),
      );
      expect(report.maxDistance).toBe(Math.sqrt(3 * 100 * 100)); // sqrt(30000) = 100*sqrt(3)
      expect(report.meanDistance).toBeCloseTo(
        (100 * Math.sqrt(3 * 100 * 100)) / (STAGE.width * STAGE.height),
        9,
      );
      // Tolerant metric: 2-px border ring tolerated, 6x6 core counted.
      expect(report.tolerantRadius).toBe(2);
      expect(report.tolerantMismatchedPixels).toBe(36);
      expect(report.tolerantMismatchRatio).toBe(36 / (STAGE.width * STAGE.height));
      expect(report.tolerantMismatchBBox).toEqual({
        x: MUTATED_BLOCK.x + 2,
        y: MUTATED_BLOCK.y + 2,
        width: 6,
        height: 6,
      });
      expect(report.pass).toBe(true); // tolerant ratio << 2 %

      const heatmap = decodePng(readFileSync(join(out, 'heatmap.png')));
      expect(heatmap.width).toBe(STAGE.width);
      expect(heatmap.height).toBe(STAGE.height);
      const inside = ((MUTATED_BLOCK.y + 1) * STAGE.width + MUTATED_BLOCK.x + 1) * 4;
      expect(heatmap.data[inside]).toBe(255); // red ramp for raw mismatches
      expect(heatmap.data[inside + 2]).toBe(0);
      expect(heatmap.data[inside + 3]).toBe(255);
      expect(heatmap.data[0]).toBe(heatmap.data[1]); // gray context outside the block
      expect(heatmap.data[1]).toBe(heatmap.data[2]);
      expect(heatmap.data[3]).toBe(255);
    },
  );

  it(
    'runComparison() agrees with the CLI report',
    { timeout: TIMEOUT },
    () => {
      const base = makeStageImage();
      const mutated = mutateBlock(base);
      const a = writePng('agreement-base.png', base);
      const b = writePng('agreement-mutated.png', mutated);
      const out = join(scratch, 'agreement-out');
      const report = runComparison(a, b, out);
      expect(report.mismatchBBox).toEqual(MUTATED_BLOCK);
      expect(report.mismatchedPixels).toBe(100);
      expect(report.tolerantMismatchedPixels).toBe(36);
      expect(report.tolerantMismatchBBox).toEqual({
        x: MUTATED_BLOCK.x + 2,
        y: MUTATED_BLOCK.y + 2,
        width: 6,
        height: 6,
      });
    },
  );
});

describe('structural changes still detected by the tolerant metric', () => {
  it(
    '30x30 colour change -> exactly the 26x26 core (676 px), bbox exact',
    { timeout: TIMEOUT },
    () => {
      const base = makeStageImage();
      const block = { x: 200, y: 150, width: 30, height: 30 };
      const report = compareImages(base, mutateBlock(base, block));
      expect(report.mismatchedPixels).toBe(900);
      expect(report.mismatchBBox).toEqual(block);
      expect(report.tolerantMismatchedPixels).toBe(26 * 26);
      expect(report.tolerantMismatchRatio).toBe((26 * 26) / (STAGE.width * STAGE.height));
      expect(report.tolerantMismatchBBox).toEqual({
        x: block.x + 2,
        y: block.y + 2,
        width: 26,
        height: 26,
      });
      expect(report.pass).toBe(true); // small region on a 550x400 stage
    },
  );

  it('40x40 solid square shifted by 6 px -> survivors confined to the 2-px remnant band', () => {
    // A: square [100,139]x[40,79]; B: same square shifted +6 px. Raw mismatch
    // strips are 6 px wide; with radius 2 tolerance the outermost 2 px of each
    // strip survive (no counterpart within 2 px), for rows 2..37 (vertical
    // background neighbours tolerate the top/bottom 2 rows).
    const W = 220;
    const H = 120;
    const background = [210, 210, 210];
    const squareColor = [40, 40, 40];
    const square = { x: 100, y: 40, width: 40, height: 40 };
    const a = makeSolidSquareImage(W, H, background, square, squareColor);
    const b = makeSolidSquareImage(
      W,
      H,
      background,
      { ...square, x: square.x + 6 },
      squareColor,
    );
    const report = compareImages(a, b);
    expect(report.mismatchedPixels).toBe(480); // 2 strips of 6x40
    expect(report.mismatchBBox).toEqual({ x: 100, y: 40, width: 46, height: 40 });
    expect(report.tolerantMismatchedPixels).toBe(144); // (2+2) px wide x 36 rows
    expect(report.tolerantMismatchRatio).toBe(144 / (W * H));
    expect(report.tolerantMismatchBBox).toEqual({ x: 102, y: 42, width: 42, height: 36 });
    expect(report.tolerantMismatchedPixels).toBeGreaterThan(0);
  });

  it('radius boundary: a 4 px shift is fully absorbed (tolerant 0)', () => {
    const W = 220;
    const H = 120;
    const background = [210, 210, 210];
    const squareColor = [40, 40, 40];
    const square = { x: 100, y: 40, width: 40, height: 40 };
    const a = makeSolidSquareImage(W, H, background, square, squareColor);
    const b = makeSolidSquareImage(
      W,
      H,
      background,
      { ...square, x: square.x + 4 },
      squareColor,
    );
    const report = compareImages(a, b);
    expect(report.mismatchedPixels).toBe(320); // 2 strips of 4x40
    expect(report.tolerantMismatchedPixels).toBe(0);
    expect(report.tolerantMismatchBBox).toBeNull();
  });
});

describe('error contract', () => {
  it(
    'size mismatch: exit 1, one clean line on stderr, no report written',
    { timeout: TIMEOUT },
    () => {
      const a = writePng('size-a.png', makeStageImage(64, 48));
      const b = writePng('size-b.png', makeStageImage(64, 49));
      const out = join(scratch, 'size-mismatch-out');
      const res = runCli([a, b, out]);
      expect(res.status).toBe(1);
      expect(res.stderr.trim().split('\n')).toHaveLength(1);
      expect(res.stderr).toMatch(/size mismatch/);
      expect(existsSync(join(out, 'report.json'))).toBe(false);
    },
  );

  it(
    'undecodable input: exit 1, one clean line on stderr',
    { timeout: TIMEOUT },
    () => {
      const a = writePng('garbage-base.png', makeStageImage(8, 8));
      const garbage = join(scratch, 'garbage.png');
      writeFileSync(garbage, Buffer.from('this is not a png file'));
      const res = runCli([a, garbage, join(scratch, 'garbage-out')]);
      expect(res.status).toBe(1);
      expect(res.stderr.trim().split('\n')).toHaveLength(1);
      expect(res.stderr).toMatch(/cannot decode garbage\.png/);
    },
  );

  it('missing file: exit 1, one clean line on stderr', { timeout: TIMEOUT }, () => {
    const a = writePng('missing-base.png', makeStageImage(8, 8));
    const res = runCli([a, join(scratch, 'does-not-exist.png'), join(scratch, 'missing-out')]);
    expect(res.status).toBe(1);
    expect(res.stderr.trim().split('\n')).toHaveLength(1);
    expect(res.stderr).toMatch(/cannot read does-not-exist\.png/);
  });

  it('wrong argument count: exit 1 with one usage line on stderr', () => {
    const res = runCli([]);
    expect(res.status).toBe(1);
    expect(res.stderr.trim().split('\n')).toHaveLength(1);
    expect(res.stderr).toMatch(/usage/);
  });

  it('--help: exit 0 with usage on stdout', () => {
    const res = runCli(['--help']);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/usage: node verify\/diff\/diff\.mjs <a\.png> <b\.png> <outdir>/);
  });
});

describe('determinism (V8)', () => {
  it(
    'two runs on the same inputs produce byte-identical report.json and heatmap.png',
    { timeout: TIMEOUT },
    () => {
      const base = makeStageImage();
      const mutated = mutateBlock(base);
      const a = writePng('v8-base.png', base);
      const b = writePng('v8-mutated.png', mutated);
      const out1 = join(scratch, 'v8-run-1');
      const out2 = join(scratch, 'v8-run-2');
      expect(runCli([a, b, out1]).status).toBe(0);
      expect(runCli([a, b, out2]).status).toBe(0);
      const report1 = readFileSync(join(out1, 'report.json'));
      const report2 = readFileSync(join(out2, 'report.json'));
      expect(report2.equals(report1)).toBe(true);
      expect(sha256(report2)).toBe(sha256(report1));
      const heat1 = readFileSync(join(out1, 'heatmap.png'));
      const heat2 = readFileSync(join(out2, 'heatmap.png'));
      expect(heat2.equals(heat1)).toBe(true);
    },
  );
});
