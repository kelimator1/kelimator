// tests/stage.test.ts — C2 unit tests (V4): scale function viewport matrix.
// Expected values are the spec formula from docs/04-architecture.md §2,
// computed independently of the implementation:
//   scale   = min(viewportWidth / 550, viewportHeight / 400)
//   offsetX = (viewportWidth  - 550 * scale) / 2
//   offsetY = (viewportHeight - 400 * scale) / 2
import { describe, expect, it } from 'vitest';
import {
  computeStageMetrics,
  LETTERBOX_FALLBACK,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from '../src/stage';

interface ViewportCase {
  label: string;
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

const VIEWPORT_MATRIX: ViewportCase[] = [
  { label: 'small portrait', width: 320, height: 480, scale: 0.5818181818181818, offsetX: 0, offsetY: 123.63636363636364 },
  { label: 'exact stage', width: 550, height: 400, scale: 1, offsetX: 0, offsetY: 0 },
  { label: 'full HD landscape', width: 1920, height: 1080, scale: 2.7, offsetX: 217.5, offsetY: 0 },
  { label: '4K UHD landscape', width: 3840, height: 2160, scale: 5.4, offsetX: 435, offsetY: 0 },
  { label: 'ultra-wide', width: 3440, height: 1440, scale: 3.6, offsetX: 730, offsetY: 0 },
  { label: '21:9 desktop', width: 2560, height: 1080, scale: 2.7, offsetX: 537.5, offsetY: 0 },
  { label: 'tall portrait', width: 600, height: 1200, scale: 1.0909090909090908, offsetX: 0, offsetY: 381.8181818181818 },
];

describe('stage constants', () => {
  it('uses the documented logical stage size', () => {
    expect(STAGE_WIDTH).toBe(550);
    expect(STAGE_HEIGHT).toBe(400);
  });

  it('uses the documented letterbox fallback color', () => {
    expect(LETTERBOX_FALLBACK).toBe('#9DAF48');
  });
});

describe('computeStageMetrics — viewport matrix', () => {
  for (const viewport of VIEWPORT_MATRIX) {
    it(`${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      const metrics = computeStageMetrics(viewport.width, viewport.height);

      expect(metrics.viewportWidth).toBe(viewport.width);
      expect(metrics.viewportHeight).toBe(viewport.height);
      expect(metrics.stageWidth).toBe(STAGE_WIDTH);
      expect(metrics.stageHeight).toBe(STAGE_HEIGHT);
      expect(metrics.scale).toBeCloseTo(viewport.scale, 9);
      expect(metrics.offsetX).toBeCloseTo(viewport.offsetX, 9);
      expect(metrics.offsetY).toBeCloseTo(viewport.offsetY, 9);

      // The scaled stage fits inside the viewport (never clipped)...
      expect(metrics.stageWidth * metrics.scale).toBeLessThanOrEqual(viewport.width + 1e-9);
      expect(metrics.stageHeight * metrics.scale).toBeLessThanOrEqual(viewport.height + 1e-9);
      // ...touching one axis exactly (uniform fit)...
      const fitsWidth = Math.abs(metrics.stageWidth * metrics.scale - viewport.width) <= 1e-9;
      const fitsHeight = Math.abs(metrics.stageHeight * metrics.scale - viewport.height) <= 1e-9;
      expect(fitsWidth || fitsHeight).toBe(true);
      // ...and is centered on both axes (equal margins).
      expect(metrics.offsetX * 2 + metrics.stageWidth * metrics.scale).toBeCloseTo(viewport.width, 9);
      expect(metrics.offsetY * 2 + metrics.stageHeight * metrics.scale).toBeCloseTo(viewport.height, 9);
      expect(metrics.offsetX).toBeGreaterThanOrEqual(-1e-9);
      expect(metrics.offsetY).toBeGreaterThanOrEqual(-1e-9);
    });
  }

  it('is deterministic for the same viewport dimensions (V2 scale invariance)', () => {
    const first = computeStageMetrics(1280, 720);
    const second = computeStageMetrics(1280, 720);
    expect(second).toEqual(first);
    expect(first.scale).toBeCloseTo(720 / 400, 9);
  });

  it('accepts explicit stage dimensions (letterboxed 16:9 stage in a square viewport)', () => {
    const metrics = computeStageMetrics(500, 500, 320, 180);
    expect(metrics.scale).toBeCloseTo(500 / 320, 9);
    expect(metrics.offsetX).toBeCloseTo(0, 9);
    expect(metrics.offsetY).toBeCloseTo((500 - 180 * (500 / 320)) / 2, 9);
  });
});
