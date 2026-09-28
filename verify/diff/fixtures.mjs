#!/usr/bin/env node
/**
 * verify/diff/fixtures.mjs — deterministic synthetic fixtures for the F1
 * self-tests and manual/evidence runs.
 *
 * Base-image channel values stay in [50, 155] so that adding MUTATION_DELTA
 * (100) per channel never exceeds 255: the mutated block differs by exactly
 * +100 per channel, with no clipping and no wraps.
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
export const BASE_MIN = 50;
export const BASE_RANGE = 106; // 50..155 inclusive

/** Deterministic RGBA8 test image (same inputs -> same bytes). */
export function makeStageImage(width = STAGE.width, height = STAGE.height, seed = 1) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = ((x * 3 + y * 7 + seed * 13) % BASE_RANGE) + BASE_MIN;
      data[i + 1] = (((x ^ y) * 5 + seed * 29) % BASE_RANGE) + BASE_MIN;
      data[i + 2] = (((x + y * 2) * 9 + seed * 47) % BASE_RANGE) + BASE_MIN;
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
