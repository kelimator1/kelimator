// tests/hud-controls.test.ts — Y3 control hit-area mapping regression (pure node).
//
// Owner defect (wave Y): `src/ui/hud.ts` `CONTROL_RECTS` mapped
// `scramble → btn_sbuton` and `delete → btn_kbuton` (swapped), so the
// transparent overlays laid over the reference "Karıştır"/"Sil" sprites
// dispatched the opposite action (clicking Karıştır deleted, clicking Sil
// shuffled). The reference mapping is decoded from the 2012 build, not guessed:
// - `DefineButton2_63/BUTTONCONDACTION on(release).as` → `karistir();`
//   (sprite 63 = `kbuton`, display bbox x=156.25 — the "Karıştır" label).
// - `DefineButton2_65/BUTTONCONDACTION on(release).as` → `ekle();`
//   (sprite 65 = `ebuton`, x=232.85 — "Ekle").
// - `DefineButton2_105/BUTTONCONDACTION on(release).as` → `sil();`
//   (sprite 105 = `sbuton`, x=308.6 — "Sil").
// evidence: evidence/A3-diffs.md §2 rows 63/65/105 (instance names + display
// bboxes); evidence/Y3-buttons.md (mapping table + pre/post runs + D5
// superseding note).
//
// This suite is DOM-free (vitest node environment): it asserts the pure
// control → element mapping and the pure rectangles exported by hud.ts against
// the layout catalog, including the recorded catalog coordinates as literal
// cross-checks. The click-path regression suite is
// tests/e2e/controls/controls.spec.ts (raw mouse clicks at the CENTER of the
// visible label sprites in scaled stage coordinates).
//
// Silent witness runs (EXECUTION.md §8): this file touches no browser API and
// no audio element.
import { describe, expect, it } from 'vitest';
import layoutJson from '../src/data/layout.json';
import { CONTROL_ELEMENT_IDS, CONTROL_RECTS } from '../src/ui/hud';

interface LayoutElementJson {
  readonly id: string;
  readonly asset: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const ELEMENTS = (layoutJson as unknown as { elements: readonly LayoutElementJson[] }).elements;

function catalogElement(id: string): LayoutElementJson {
  const element = ELEMENTS.find((candidate) => candidate.id === id);
  if (element === undefined) {
    throw new Error(`src/data/layout.json is missing the ${id} element`);
  }
  return element;
}

interface RectBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function boxOf(rect: { x: number; y: number; w: number; h: number }): RectBox {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

type ControlName = 'submit' | 'scramble' | 'delete' | 'newRound';

/**
 * The mapping the owner defect statement and the reference decompilation
 * require. `scramble`/`delete` were the swapped pair; `submit` was correct.
 */
const EXPECTED_ELEMENT: Readonly<Record<ControlName, string>> = {
  submit: 'btn_ebuton',
  scramble: 'btn_kbuton',
  delete: 'btn_sbuton',
  newRound: 'btn_ybuton',
};

/**
 * Reference `on(release)` action per catalog element id, decoded from
 * artifacts/decompiled/scripts/DefineButton2_<id>/BUTTONCONDACTION on(release).as:
 * DefineButton2_63 → `karistir();`, DefineButton2_65 → `ekle();`,
 * DefineButton2_105 → `sil();`. evidence/A3-diffs.md §2 identifies the
 * sprites: 63 = `kbuton` (x=156.25), 65 = `ebuton` (x=232.85),
 * 105 = `sbuton` (x=308.6).
 */
const REFERENCE_ACTION: Readonly<Record<string, string>> = {
  btn_kbuton: 'karistir',
  btn_ebuton: 'ekle',
  btn_sbuton: 'sil',
};

/** Control → the reference action its label performs (Karıştır/Ekle/Sil). */
const EXPECTED_ACTION: Readonly<Partial<Record<ControlName, string>>> = {
  submit: 'ekle',
  scramble: 'karistir',
  delete: 'sil',
};

/**
 * Catalog cross-check bboxes, copied verbatim from evidence/A3-diffs.md §2
 * rows 63/65/105 (they equal src/data/layout.json). The widths differ, so a
 * swapped mapping cannot pass by accident.
 */
const CATALOG_BBOX: Readonly<Record<string, RectBox>> = {
  btn_kbuton: { x: 156.25, y: 367.95, w: 76.1, h: 21.7 },
  btn_ebuton: { x: 232.85, y: 367.95, w: 69.3, h: 21.7 },
  btn_sbuton: { x: 308.6, y: 367.95, w: 69.3, h: 21.7 },
};

/** Sprite asset of each cross-checked element (E1 export names carry the SWF character id). */
const CATALOG_ASSET: Readonly<Record<string, string>> = {
  btn_kbuton: 'src/assets/svg/s63_btn_kbuton.svg',
  btn_ebuton: 'src/assets/svg/s65_btn_ebuton.svg',
  btn_sbuton: 'src/assets/svg/s105_btn_sbuton.svg',
};

const CONTROLS: readonly ControlName[] = ['submit', 'scramble', 'delete', 'newRound'];

describe('Y3 control → element mapping (reference on(release) actions)', () => {
  it('maps scramble to btn_kbuton (Karıştır → karistir), delete to btn_sbuton (Sil → sil), submit to btn_ebuton (Ekle → ekle)', () => {
    // The whole mapping, as one guard: the pre-fix swapped pair fails here.
    expect(CONTROL_ELEMENT_IDS).toEqual(EXPECTED_ELEMENT);

    for (const control of CONTROLS) {
      expect(CONTROL_ELEMENT_IDS[control], `${control} element id`).toBe(EXPECTED_ELEMENT[control]);
    }

    // Each mapped element's decoded reference action matches the control's
    // meaning; a swap of scramble/delete breaks this too.
    for (const control of ['submit', 'scramble', 'delete'] as const) {
      const elementId = CONTROL_ELEMENT_IDS[control];
      expect(REFERENCE_ACTION[elementId], `${control} → ${elementId} reference action`).toBe(
        EXPECTED_ACTION[control],
      );
    }

    // Guard the reference-action table itself: exactly the three decoded
    // buttons, no typo can silently drop an entry.
    expect(Object.keys(REFERENCE_ACTION).sort()).toEqual([
      'btn_ebuton',
      'btn_kbuton',
      'btn_sbuton',
    ]);
  });

  it('places each control rectangle on the catalog bbox of its mapped element', () => {
    for (const control of CONTROLS) {
      const elementId = CONTROL_ELEMENT_IDS[control];
      const catalog = catalogElement(elementId);
      expect(boxOf(CONTROL_RECTS[control]), `${control} rect == ${elementId} bbox`).toEqual({
        x: catalog.x,
        y: catalog.y,
        w: catalog.w,
        h: catalog.h,
      });
    }

    // The swapped pair would put the two overlays on each other's bbox; the
    // catalog widths differ (76.1 vs 69.3), so equality is a real distinction.
    expect(boxOf(CONTROL_RECTS.scramble), 'scramble rect').toEqual(CATALOG_BBOX.btn_kbuton);
    expect(boxOf(CONTROL_RECTS.delete), 'delete rect').toEqual(CATALOG_BBOX.btn_sbuton);
    expect(boxOf(CONTROL_RECTS.submit), 'submit rect').toEqual(CATALOG_BBOX.btn_ebuton);
    expect(CONTROL_RECTS.scramble.w).not.toBe(CONTROL_RECTS.delete.w);
  });

  it('matches the recorded catalog cross-check coordinates of A3 rows 63/65/105', () => {
    const seen: string[] = [];
    for (const [id, bbox] of Object.entries(CATALOG_BBOX)) {
      const catalog = catalogElement(id);
      expect(boxOf(catalog), `${id} layout.json bbox`).toEqual(bbox);
      expect(catalog.asset, `${id} asset`).toBe(CATALOG_ASSET[id]);
      seen.push(JSON.stringify(bbox));
    }
    // Pairwise distinct bboxes (a duplicate would make a swap untestable).
    expect(new Set(seen).size).toBe(3);

    // The exported hud rectangles equal those literal coordinates through the
    // mapping — the regression source for the running app.
    expect(boxOf(CONTROL_RECTS.scramble), 'scramble rect').toEqual(CATALOG_BBOX.btn_kbuton);
    expect(boxOf(CONTROL_RECTS.delete), 'delete rect').toEqual(CATALOG_BBOX.btn_sbuton);
    expect(boxOf(CONTROL_RECTS.submit), 'submit rect').toEqual(CATALOG_BBOX.btn_ebuton);
  });
});
