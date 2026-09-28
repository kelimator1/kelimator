#!/usr/bin/env node
/**
 * verify/diff/fixtures.mjs — deterministic synthetic fixtures for the F1
 * self-tests and manual/evidence runs.
 *
 * Pattern design (must hold for the tolerant-metric tests): every channel is a
 * triangle wave with per-index slope TRI_SLOPE = 3 and range
 * [BASE_MIN, BASE_MIN + BASE_AMPLITUDE] = [60, 90], so:
 *   - any two pixels at Chebyshev distance <= 2 differ by <= 12 per channel
 *     (3 * 2 index steps * TRI_SLOPE; Euclidean distance <= ~20.8 <= 30) —
 *     the 2-px border ring of a mutated 10x10 block always finds a matching
 *     neighbour outside the block and is tolerated;
 *   - the total channel range is 30 wide, so no pixel can match a pixel
 *     shifted by MUTATION_DELTA = +100 per channel (per-channel gap >= 70,
 *     Euclidean >= 70 > 30) — the 6x6 core of the block is always counted.
 * Therefore the tolerant rule (docs/07-verification.md §4, Amendment
 * 2026-09-28) yields exactly 36 tolerant pixels at (x0+2, y0+2) for the
 * 10x10 +100 block. Adding +100 never exceeds 255 (90 + 100 = 190).
 *
 * CLI:
 *   node verify/diff/fixtures.mjs <outdir>
 * writes 550x400 `base.png` and `mutated.png` (10x10 block at (123, 45),
 * +100 per channel) and prints their paths.
 */
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './diff.mjs';

export const STAGE = { width: 550, height: 400 };
export const MUTATED_BLOCK = { x: 123, y: 45, width: 10, height: 10 };
export const MUTATION_DELTA = 100;
export const BASE_MIN = 60;
export const BASE_AMPLITUDE = 30;
export const TRI_SLOPE = 3;
const TRI_PERIOD = 20; // 10 up + 10 down
const TRI_HALF = TRI_PERIOD / 2;

/** Triangle wave: period TRI_PERIOD, values 0..TRI_HALF (1-Lipschitz). */
function triangle(index) {
  const t = ((index % TRI_PERIOD) + TRI_PERIOD) % TRI_PERIOD;
  return t < TRI_HALF ? t : TRI_PERIOD - t;
}

/** Deterministic RGBA8 test image (same inputs -> same bytes). */
export function makeStageImage(width = STAGE.width, height = STAGE.height, seed = 1) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = BASE_MIN + TRI_SLOPE * triangle(x + y + seed * 3);
      data[i + 1] = BASE_MIN + TRI_SLOPE * triangle(x + seed * 5);
      data[i + 2] = BASE_MIN + TRI_SLOPE * triangle(x - y + seed * 7);
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Copy of `image` with `delta` added to R, G and B inside `block`. */
export function mutateBlock(image, block = MUTATED_BLOCK, delta = MUTATION_DELTA) {
  const data = Uint8Array.from(image.data);
  for (let y = block.y; y < block.y + block.height; y++) {
    for (let x = block.x; x < block.x + block.width; x++) {
      const i = (y * image.width + x) * 4;
      data[i] += delta;
      data[i + 1] += delta;
      data[i + 2] += delta;
    }
  }
  return { width: image.width, height: image.height, data };
}

/**
 * Flat-background image with one solid square (used by the structural
 * tolerant-metric test; colours far apart so raw distances exceed 30).
 */
export function makeSolidSquareImage(width, height, background, square, squareColor) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inSquare =
        x >= square.x &&
        x < square.x + square.width &&
        y >= square.y &&
        y < square.y + square.height;
      const [r, g, b] = inSquare ? squareColor : background;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const outDir = process.argv[2];
  if (!outDir) {
    process.stderr.write('fixtures: usage: node verify/diff/fixtures.mjs <outdir>\n');
    process.exitCode = 1;
  } else {
    const base = makeStageImage();
    const mutated = mutateBlock(base);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'base.png'), encodePng(base));
    writeFileSync(join(outDir, 'mutated.png'), encodePng(mutated));
    process.stdout.write(
      `fixtures: wrote ${join(outDir, 'base.png')} and ${join(outDir, 'mutated.png')} (${base.width}x${base.height})\n`,
    );
  }
}
