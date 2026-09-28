// tests/e2e/visual.spec.ts — E2 static layout match (V5 + V2 + V7).
//
// V5: for every static state of docs/07-verification.md §5 (S1–S7, S10) the
// 550×400 stage is screenshot at deviceScaleFactor 1 and 2 and compared with
// the C3 reference captures (tests/fixtures/reference/) through the F1 diff
// tool (verify/diff/diff.mjs). Since the 2026-09-28 amendment (docs/07 §4) the
// pass basis is the tool's anti-aliasing-tolerant metric
// (tolerantMismatchRatio ≤ 0.02, tolerantRadius 2); the raw metric is kept in
// the report for monitoring (V2 asserts the raw fields are present/numeric).
// Per-state report.json + heatmap.png are written under
// evidence/visual/E2/<state>/dsf<dsf>/ (V2).
//
// V7: rendered element boxes and text styles are compared with the values of
// src/data/layout.json.
//
// The observed static states live in tests/e2e/visual-states.ts (TEST-ONLY;
// see the module header). Reference fixtures at deviceScaleFactor 2 are
// produced by task C3 under tests/fixtures/reference/dsf2/; when a dsf2
// fixture is not present yet the test is skipped and reports "dsf2 pending"
// (task E2 fixture-availability note), never substituted.

import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { viewFor, VISUAL_STATES, type VisualStateSpec } from './visual-states';
import type { BoardView } from '../../src/ui/board';

const REPO_ROOT = process.cwd();
const REFERENCE_DIR = path.join(REPO_ROOT, 'tests/fixtures/reference');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'evidence/visual/E2');
const DIFF_TOOL = path.join(REPO_ROOT, 'verify/diff/diff.mjs');
const LAYOUT_PATH = path.join(REPO_ROOT, 'src/data/layout.json');

interface LayoutFontJson {
  family: string;
  size: number;
  bold: boolean;
  align: string;
}

interface LayoutElementJson {
  id: string;
  kind: string;
  asset: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  font: LayoutFontJson;
  evidence: string;
}

interface DiffReport {
  schemaVersion: number;
  // Raw metric (unchanged; kept numeric for V2 and monitoring).
  mismatchRatio: number;
  mismatchedPixels: number;
  totalPixels: number;
  mismatchThreshold: number;
  mismatchBBox: { x: number; y: number; width: number; height: number } | null;
  // Anti-aliasing-tolerant metric: the V5 pass basis since the 2026-09-28
  // amendment (docs/07-verification.md §4). `pass` reflects this ratio.
  tolerantRadius: number;
  tolerantMismatchedPixels: number;
  tolerantMismatchRatio: number;
  tolerantMismatchBBox: { x: number; y: number; width: number; height: number } | null;
  passRatio: number;
  pass: boolean;
}

/** Finds the C3 reference capture for a state; recursive for the dsf2 set. */
function findReference(spec: VisualStateSpec, dsf: number): string | null {
  if (dsf === 1) {
    const file = path.join(REFERENCE_DIR, `${spec.file}.png`);
    return fs.existsSync(file) ? file : null;
  }
  const root = path.join(REFERENCE_DIR, `dsf${dsf}`);
  if (!fs.existsSync(root)) {
    return null;
  }
  const matches: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (
        entry.isFile() &&
        entry.name.startsWith(spec.file) &&
        entry.name.endsWith('.png')
      ) {
        matches.push(full);
      }
    }
  }
  matches.sort();
  return matches[0] ?? null;
}

async function waitForBoard(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const board = document.querySelector('[data-testid="board"]');
    if (!(board instanceof HTMLElement)) {
      return false;
    }
    const images = Array.from(board.querySelectorAll('img'));
    return (
      images.length > 0 &&
      images.every(
        (image) =>
          image.complete &&
          // Zero-size assets (action/sound-only sprites, E1 §11.2) never
          // report a naturalWidth; they only need to have finished decoding.
          (image.naturalWidth > 0 || image.clientWidth === 0 || image.clientHeight === 0),
      )
    );
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function applyVisualState(page: Page, view: BoardView): Promise<void> {
  const applied = await page.evaluate((state) => {
    const hook = (window as unknown as { __visualTest?: { apply(view: unknown): void } })
      .__visualTest;
    if (hook === undefined) {
      return false;
    }
    hook.apply(state);
    return true;
  }, view);
  expect(applied, '__visualTest hook must be installed by the dev server').toBe(true);
  await waitForBoard(page);
}

async function preparePage(page: Page): Promise<void> {
  await page.goto('/');
  await waitForBoard(page);
  // The C2 fullscreen control is harness chrome (no counterpart in the
  // reference capture); hide it for the comparison only.
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="fullscreen-button"]');
    if (button instanceof HTMLElement) {
      button.style.display = 'none';
    }
  });
}

function runDiff(actual: string, reference: string, outDir: string): DiffReport {
  execFileSync(process.execPath, [DIFF_TOOL, actual, reference, outDir], { stdio: 'pipe' });
  const reportPath = path.join(outDir, 'report.json');
  expect(fs.existsSync(reportPath), `diff report written: ${reportPath}`).toBe(true);
  expect(fs.existsSync(path.join(outDir, 'heatmap.png')), 'heatmap artifact').toBe(true);
  return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as DiffReport;
}

for (const dsf of [1, 2] as const) {
  test.describe(`E2 visual states — deviceScaleFactor ${dsf}`, () => {
    test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: dsf });

    for (const spec of VISUAL_STATES) {
      test(`${spec.id} ${spec.file} matches the C3 reference`, async ({ page }) => {
        const reference = findReference(spec, dsf);
        if (reference === null) {
          test.skip(true, `dsf${dsf} reference pending (C3 produces tests/fixtures/reference/dsf${dsf}/)`);
          return;
        }

        await preparePage(page);
        await applyVisualState(page, viewFor(spec, dsf));

        const outDir = path.join(EVIDENCE_DIR, spec.id, `dsf${dsf}`);
        fs.mkdirSync(outDir, { recursive: true });
        const actual = path.join(outDir, 'actual.png');
        await page.locator('[data-testid="stage-root"]').screenshot({ path: actual });

        const report = runDiff(actual, reference, outDir);
        const rawPercent = report.mismatchRatio * 100;
        const tolerantPercent = report.tolerantMismatchRatio * 100;
        // V2: the raw metric stays present and numeric (monitoring only).
        expect(report.schemaVersion).toBeGreaterThanOrEqual(2);
        expect(typeof report.mismatchRatio).toBe('number');
        expect(Number.isFinite(report.mismatchRatio)).toBe(true);
        expect(typeof report.mismatchedPixels).toBe('number');
        expect(Number.isInteger(report.mismatchedPixels)).toBe(true);
        expect(typeof report.mismatchBBox === 'object').toBe(true);
        // V5 (Amendment 2026-09-28, docs/07 §4): the tolerant ratio is the pass
        // basis; it is computed by the F1 tool (tolerantRadius = 2) — never by
        // this suite.
        expect(report.tolerantRadius).toBe(2);
        console.log(
          `E2 ${spec.id} dsf${dsf}: raw=${report.mismatchRatio} (${rawPercent.toFixed(3)}%), ` +
            `tolerant=${report.tolerantMismatchRatio} (${tolerantPercent.toFixed(3)}%), ` +
            `mismatchedPixels=${report.mismatchedPixels}/${report.totalPixels}, ` +
            `tolerantMismatchedPixels=${report.tolerantMismatchedPixels}, pass=${report.pass}`,
        );
        expect(
          report.tolerantMismatchRatio,
          `${spec.id} dsf${dsf} tolerant mismatch ratio ${tolerantPercent.toFixed(3)}% (limit 2.000%)`,
        ).toBeLessThanOrEqual(report.passRatio);
        expect(report.pass).toBe(true);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// V7 — cross-consistency: rendered values equal src/data/layout.json
// ---------------------------------------------------------------------------

const V7_SAMPLE: readonly string[] = [
  'board_backdrop',
  'intro_logo',
  'timer_bar',
  'btn_ybuton',
  'credit_line',
  'status_ball',
  'letter_tile',
  'tile_socket',
  'label_puan_orange',
  'label_kelime_orange',
  'label_sure_black',
  'label_harf_3',
  'count_3',
  'timer_value',
  'score_value',
  'label_puan_black',
];

interface RenderedSample {
  x: number;
  y: number;
  w: number;
  h: number;
  fontFamily: string;
  fontSize: string;
  fontSizeTuned: string | null;
  fontWeight: string;
  fontStyle: string;
  textAlign: string;
}

test.describe('E2 V7 layout cross-consistency', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('rendered boxes and text styles equal src/data/layout.json', async ({ page }) => {
    await preparePage(page);

    const catalog = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf8')) as {
      stage: { width: number; height: number };
      elements: LayoutElementJson[];
    };
    const byId = new Map(catalog.elements.map((element) => [element.id, element]));

    const samples = await page.evaluate((ids: string[]) => {
      const result: Record<string, RenderedSample | null> = {};
      for (const id of ids) {
        const element = document.querySelector(`[data-element="${id}"]`);
        if (!(element instanceof HTMLElement)) {
          result[id] = null;
          continue;
        }
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        result[id] = {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontSizeTuned: element.dataset.fontSizeTuned ?? null,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textAlign: style.textAlign,
        };
      }
      return result;
    }, V7_SAMPLE as string[]);

    for (const id of V7_SAMPLE) {
      const expected = byId.get(id);
      expect(expected, `${id} exists in src/data/layout.json`).toBeDefined();
      const rendered = samples[id];
      expect(rendered, `${id} is rendered`).not.toBeNull();
      if (expected === undefined || rendered === null) {
        continue;
      }
      expect(rendered.x, `${id} x`).toBeCloseTo(expected.x, 1);
      expect(rendered.y, `${id} y`).toBeCloseTo(expected.y, 1);
      expect(rendered.w, `${id} w`).toBeCloseTo(expected.w, 1);
      expect(rendered.h, `${id} h`).toBeCloseTo(expected.h, 1);
      if (expected.kind === 'text') {
        expect(rendered.fontFamily, `${id} font family`).toContain('Verdana');
        // Numeric size tuning is allowed by task E2 step 2 and recorded per
        // element (data-font-size-tuned); otherwise the catalog size applies.
        if (rendered.fontSizeTuned !== null) {
          expect(rendered.fontSize, `${id} tuned font size`).toBe(
            `${Number(rendered.fontSizeTuned)}px`,
          );
        } else {
          expect(rendered.fontSize, `${id} font size`).toBe(`${expected.font.size}px`);
        }
        expect(rendered.fontWeight, `${id} font weight`).toBe(expected.font.bold ? '700' : '400');
        const expectedAlign = expected.font.align === '' ? 'left' : expected.font.align;
        expect(rendered.textAlign, `${id} text align`).toBe(expectedAlign);
      }
    }
  });
});
