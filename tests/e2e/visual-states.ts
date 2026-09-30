// tests/e2e/visual-states.ts — TEST-ONLY observed static states for task E2.
//
// Every value below is read from the C3 reference captures and the recorded
// interaction sequence (tests/fixtures/reference/*.png for deviceScaleFactor
// 1, tests/fixtures/reference/dsf2/run1/*.png for deviceScaleFactor 2) —
// nothing is invented and no gameplay rule is implemented here. The board
// renderer treats this data as a plain view over src/data/layout.json
// (docs/07-verification.md §5 states S1–S7 and S10; docs/08 amendment
// 2026-09-28). The two capture sets differ in their random deck shuffle, so
// both are carried per deviceScaleFactor.

import type { BoardView, FoundWordView, TileView } from '../../src/ui/board';

/**
 * Board-state element set: `data/animation.json` sequence "board" minus
 * `loading_banner` (stopped at its empty frame 1 after load — the C3 S2
 * capture shows no banner) and `score_feedback` (blank export, plays only on
 * submissions). Duplicated here so the Node-side Playwright runner does not
 * have to execute the Vite-only board module.
 */
export const BOARD_ELEMENTS: readonly string[] = [
  'board_backdrop',
  'btn_ebuton',
  'btn_kbuton',
  'btn_sbuton',
  'btn_speaker',
  'btn_ybuton',
  'clip_backspace',
  'clip_boing',
  'clip_buzz',
  'clip_countdown',
  'clip_enter',
  'clip_fanfare',
  'clip_finishsound',
  'clip_shuffle',
  'clip_timerr',
  'clip_typer',
  'count_3',
  'count_4',
  'count_5',
  'count_6',
  'count_7',
  'count_8',
  'intro_backdrop',
  'intro_glow',
  'intro_logo',
  'label_harf_3',
  'label_harf_4',
  'label_harf_5',
  'label_harf_6',
  'label_harf_7',
  'label_harf_8',
  'label_kelime_black',
  'label_kelime_orange',
  'label_puan_black',
  'label_puan_orange',
  'label_sure_black',
  'label_sure_orange',
  'letter_tile',
  'logo_ornament',
  'result_word_template',
  'score_value',
  'status_ball',
  'tile_socket',
  'timer_bar',
  'timer_value',
  'wordball',
];

/** Intro element set: `data/animation.json` sequence "intro". */
export const INTRO_ELEMENTS: readonly string[] = [
  'clip_backspace',
  'clip_boing',
  'clip_buzz',
  'clip_countdown',
  'clip_enter',
  'clip_fanfare',
  'clip_finishsound',
  'clip_shuffle',
  'clip_timerr',
  'clip_typer',
  'intro_backdrop',
  'intro_glow',
  'intro_ground',
  'intro_layer3',
  'intro_logo',
  'intro_sky',
  'logo_ornament',
  'wordball',
];

export interface VisualStateSpec {
  /** State id of docs/07 §5. */
  id: string;
  /** Reference capture basename (tests/fixtures/reference/<file>.png). */
  file: string;
  /** Observed view per deviceScaleFactor (the shuffle differs between the two capture sets). */
  views: Readonly<Record<1 | 2, BoardView>>;
}

interface BoardContent {
  tiles: string;
  hidden?: readonly number[];
  entry?: string;
  found?: readonly (readonly [number, number, string])[];
  counts?: readonly string[];
  score?: string;
  timer: number;
}

function tiles(letters: string, hidden: readonly number[] = []): TileView[] {
  return Array.from(letters).map((letter, index) => ({
    letter,
    visible: !hidden.includes(index),
  }));
}

function found(...words: readonly (readonly [number, number, string])[]): FoundWordView[] {
  return words.map(([len, index, text]) => ({ len, index, text }));
}

const BOARD_TOTALS = ['28', '41', '17', '4', '0', '1'];
const SLOT_COUNTS = [10, 10, 10, 4, 0, 1];

function boardView(content: BoardContent): BoardView {
  return {
    elements: BOARD_ELEMENTS,
    tiles: tiles(content.tiles, content.hidden ?? []),
    slotCounts: SLOT_COUNTS,
    found: content.found === undefined ? [] : found(...content.found),
    entry: content.entry ?? '',
    counts: content.counts ?? BOARD_TOTALS,
    score: content.score ?? '0',
    timer: { remaining: content.timer, total: 200 },
  };
}

/**
 * S1 — boot/intro frame as captured. The falling logo sits at the same screen
 * bounds in both capture sets ((80, 227, 375.4×104.6), its natural SVG size);
 * the sun differs: dsf1 capture centroid (263.5, 65.5) → top-left
 * (217.1, 18.75); dsf2 capture centroid (263.5, 34.25) → (217.1, -12.5).
 */
function introView(glowY: number): BoardView {
  return {
    elements: INTRO_ELEMENTS,
    overrides: {
      intro_glow: { x: 217.1, y: glowY },
      // Measured best integer offset of the falling logo against the C3 S1
      // capture (mismatch 3433 vs 4667 px at (80,227); E2-layout.md §7).
      intro_logo: { x: 81, y: 228, w: 375.4, h: 104.6 },
    },
  };
}

const S1: VisualStateSpec = {
  id: 'S1',
  file: 'S1-boot',
  views: { 1: introView(18.75), 2: introView(-12.5) },
};

/** S2 — idle board. */
const S2: VisualStateSpec = {
  id: 'S2',
  file: 'S2-idle-board',
  views: {
    1: boardView({ tiles: 'NAZLFİİM', timer: 199 }),
    2: boardView({ tiles: 'İLİZAMNF', timer: 193 }),
  },
};

/** S3 — SPACE scrambles the deck. */
const S3: VisualStateSpec = {
  id: 'S3',
  file: 'S3-scrambled',
  views: {
    1: boardView({ tiles: 'AZLİMİFN', timer: 197 }),
    2: boardView({ tiles: 'İAZFNMİL', timer: 186 }),
  },
};

/** S4 — three tiles clicked (columns 0–2). */
const S4: VisualStateSpec = {
  id: 'S4',
  file: 'S4-partial-entry',
  views: {
    1: boardView({ tiles: 'AZLİMİFN', hidden: [0, 1, 2], entry: 'AZL', timer: 194 }),
    2: boardView({ tiles: 'İAZFNMİL', hidden: [0, 1, 2], entry: 'İAZ', timer: 174 }),
  },
};

/** S5 — first valid 3-letter word submitted (dsf2 run: bonus paid on it). */
const S5: VisualStateSpec = {
  id: 'S5',
  file: 'S5-valid-word',
  views: {
    1: boardView({
      tiles: 'AZLİMİFN',
      found: [[3, 0, 'FAL']],
      counts: ['27', '41', '17', '4', '0', '1'],
      score: '450',
      timer: 190,
    }),
    2: boardView({
      tiles: 'İAZFNMİL',
      found: [[3, 0, 'FAL']],
      counts: ['27', '41', '17', '4', '0', '1'],
      score: '5450',
      timer: 160,
    }),
  },
};

/** S6 — non-list word rejected but still entered. */
const S6: VisualStateSpec = {
  id: 'S6',
  file: 'S6-invalid-word',
  views: {
    1: boardView({
      tiles: 'AZLİMİFN',
      hidden: [1, 4, 5],
      entry: 'MİZ',
      found: [[3, 0, 'FAL']],
      counts: ['27', '41', '17', '4', '0', '1'],
      score: '450',
      timer: 185,
    }),
    2: boardView({
      tiles: 'İAZFNMİL',
      hidden: [0, 2, 5],
      entry: 'MİZ',
      found: [[3, 0, 'FAL']],
      counts: ['27', '41', '17', '4', '0', '1'],
      score: '5450',
      timer: 150,
    }),
  },
};

/** S7 — bonus word submitted. */
const S7: VisualStateSpec = {
  id: 'S7',
  file: 'S7-bonus-word',
  views: {
    1: boardView({
      tiles: 'AZLİMİFN',
      found: [
        [3, 0, 'FAL'],
        [4, 0, 'FANİ'],
      ],
      counts: ['27', '40', '17', '4', '0', '1'],
      score: '6250',
      timer: 183,
    }),
    2: boardView({
      tiles: 'İAZFNMİL',
      found: [
        [3, 0, 'FAL'],
        [4, 0, 'FANİ'],
      ],
      counts: ['27', '40', '17', '4', '0', '1'],
      score: '11250',
      timer: 143,
    }),
  },
};

/** S10 — next round after completion (fresh deck). */
const S10: VisualStateSpec = {
  id: 'S10',
  file: 'S10-next-round',
  views: {
    1: boardView({ tiles: 'ZAİNİFLM', timer: 198 }),
    2: boardView({ tiles: 'NZİAMFLİ', timer: 190 }),
  },
};

export const VISUAL_STATES: readonly VisualStateSpec[] = [S1, S2, S3, S4, S5, S6, S7, S10];

export function viewFor(spec: VisualStateSpec, dsf: 1 | 2): BoardView {
  return spec.views[dsf];
}

// ---------------------------------------------------------------------------
// Task Y1 — owner-approved V5 allowance (docs/07 §4, owner final wave)
//
// The HD-remastered board backdrop (bitmap 47) and speaker knob (bitmap 86)
// intentionally deviate from the 2012 reference texture (owner-approved);
// every visual comparison of a board state passes these stage-pixel rects to
// the F1 diff tool's `--ignore-rect`, so the deviation does not consume the
// verification budget. Derivation (evidence/Y1-remaster.md §5):
//   - deviation mask = pixels where the remaster changed the render
//     (`|after − before| > 0`), the backdrop is visible (hiding the backdrop
//     changes them) and the comparison now mismatches (> 30) while it did not
//     before, at S2 dsf 1/2; the union of both deviceScaleFactors in dsf1
//     stage coordinates is covered exactly with 10-px cells (cells carrying
//     ≥ 3 deviation pixels; greedy maximal rectangles) → 137 rects,
//     97.7 % / 98.6 % of the deviation at dsf 1/2; the residual stays counted;
//   - the final rect is the measured speaker-knob deviation bbox. Y1 measured
//     the knob footprint (515,367,22,30) while the embedded WebP was RGB and
//     its transparent corners rendered opaque black; task Y4 restored the
//     RGBA payload and re-measured (evidence/Y4-knob-alpha.md §4): the
//     remaining deviation (raw > 30, union of dsf 1/2 in dsf1 coords) is
//     (515,370,22,20), so the rect shrank to exactly that — it still covers
//     the owner-approved knob texture but no longer includes the corner rows
//     where the alpha defect lived (the Y1 allowance masked that defect).
// The set spans 28.4 % of the stage and leaves the pre-existing
// font/shape/bitmap rasterization mismatch outside the deviation network
// counted (measured post-allowance S2 tolerant ratios ≈ the pre-Y1 baseline:
// 0.710 % vs 0.980 % at dsf1, 0.254 % vs 0.281 % at dsf2). Rect coordinates
// are dsf1 stage pixels; scale by the deviceScaleFactor. States without the
// backdrop element (S1 intro) get no allowance.
// ---------------------------------------------------------------------------
export const Y1_IGNORE_RECTS: readonly (readonly [number, number, number, number])[] = [
  [90, 230, 420, 10],
  [20, 40, 350, 10],
  [10, 60, 20, 150],
  [280, 70, 20, 150],
  [20, 220, 270, 10],
  [540, 10, 10, 270],
  [270, 360, 270, 10],
  [140, 390, 250, 10],
  [20, 360, 240, 10],
  [430, 10, 10, 220],
  [90, 280, 220, 10],
  [0, 240, 110, 10],
  [440, 10, 100, 10],
  [300, 220, 100, 10],
  [440, 220, 100, 10],
  [130, 260, 50, 20],
  [420, 240, 20, 50],
  [450, 270, 90, 10],
  [300, 70, 80, 10],
  [20, 290, 40, 20],
  [200, 290, 20, 40],
  [210, 190, 70, 10],
  [460, 300, 70, 10],
  [90, 250, 20, 30],
  [90, 300, 60, 10],
  [430, 290, 50, 10],
  [20, 310, 10, 50],
  [510, 310, 10, 50],
  [360, 50, 20, 20],
  [500, 190, 40, 10],
  [220, 200, 20, 20],
  [240, 240, 20, 20],
  [480, 240, 20, 20],
  [320, 280, 40, 10],
  [160, 300, 40, 10],
  [140, 370, 20, 20],
  [370, 370, 20, 20],
  [510, 80, 30, 10],
  [440, 80, 10, 30],
  [450, 110, 30, 10],
  [190, 240, 30, 10],
  [440, 240, 10, 30],
  [390, 280, 30, 10],
  [490, 290, 30, 10],
  [260, 300, 30, 10],
  [370, 300, 30, 10],
  [510, 390, 30, 10],
  [460, 0, 20, 10],
  [500, 0, 20, 10],
  [140, 20, 20, 10],
  [450, 130, 20, 10],
  [530, 120, 10, 20],
  [260, 150, 10, 20],
  [470, 160, 20, 10],
  [450, 170, 20, 10],
  [440, 180, 20, 10],
  [530, 170, 10, 20],
  [520, 230, 20, 10],
  [330, 240, 20, 10],
  [140, 250, 20, 10],
  [390, 240, 10, 20],
  [230, 250, 10, 20],
  [210, 260, 10, 20],
  [70, 290, 20, 10],
  [60, 300, 20, 10],
  [330, 300, 20, 10],
  [50, 350, 20, 10],
  [380, 350, 20, 10],
  [300, 370, 10, 20],
  [170, 0, 10, 10],
  [20, 10, 10, 10],
  [440, 20, 10, 10],
  [520, 20, 10, 10],
  [460, 30, 10, 10],
  [490, 30, 10, 10],
  [450, 40, 10, 10],
  [20, 50, 10, 10],
  [440, 60, 10, 10],
  [520, 60, 10, 10],
  [450, 80, 10, 10],
  [0, 90, 10, 10],
  [460, 90, 10, 10],
  [450, 100, 10, 10],
  [470, 100, 10, 10],
  [530, 100, 10, 10],
  [170, 120, 10, 10],
  [440, 120, 10, 10],
  [230, 130, 10, 10],
  [30, 140, 10, 10],
  [500, 140, 10, 10],
  [170, 150, 10, 10],
  [530, 150, 10, 10],
  [0, 160, 10, 10],
  [270, 160, 10, 10],
  [440, 160, 10, 10],
  [230, 180, 10, 10],
  [480, 180, 10, 10],
  [90, 190, 10, 10],
  [190, 200, 10, 10],
  [240, 200, 10, 10],
  [260, 200, 10, 10],
  [440, 200, 10, 10],
  [20, 210, 10, 10],
  [70, 210, 10, 10],
  [170, 210, 10, 10],
  [260, 250, 10, 10],
  [340, 250, 10, 10],
  [380, 250, 10, 10],
  [250, 260, 10, 10],
  [350, 260, 10, 10],
  [450, 260, 10, 10],
  [480, 260, 10, 10],
  [120, 270, 10, 10],
  [180, 270, 10, 10],
  [440, 280, 10, 10],
  [460, 280, 10, 10],
  [160, 290, 10, 10],
  [180, 290, 10, 10],
  [240, 300, 10, 10],
  [420, 300, 10, 10],
  [260, 310, 10, 10],
  [390, 310, 10, 10],
  [520, 310, 10, 10],
  [500, 330, 10, 10],
  [30, 350, 10, 10],
  [80, 350, 10, 10],
  [200, 350, 10, 10],
  [250, 350, 10, 10],
  [300, 350, 10, 10],
  [330, 350, 10, 10],
  [500, 350, 10, 10],
  [520, 350, 10, 10],
  [510, 370, 10, 10],
  [530, 370, 10, 10],
  [220, 380, 10, 10],
  [360, 380, 10, 10],
  [390, 380, 10, 10],
  [515, 370, 22, 20], // speaker-knob deviation bbox (Y4 re-measure, dsf1)
];

/** The parsed allowance rects for one deviceScaleFactor. */
export function y1IgnoreRects(dsf: number): { x: number; y: number; w: number; h: number }[] {
  return Y1_IGNORE_RECTS.map(([x, y, w, h]) => ({ x: x * dsf, y: y * dsf, w: w * dsf, h: h * dsf }));
}

/** Ready-to-use `--ignore-rect x,y,w,h` CLI arguments for the F1 diff tool. */
export function y1IgnoreRectArgs(dsf: number): string[] {
  return y1IgnoreRects(dsf).flatMap((rect) => [
    '--ignore-rect',
    `${rect.x},${rect.y},${rect.w},${rect.h}`,
  ]);
}

// ---------------------------------------------------------------------------
// Task Y2 — owner-approved credit-omission region (docs/07 §4, owner final wave)
//
// The rebuild intentionally omits the two site credit sprites (`credit_line` /
// `credit_site`; owner directive `tasks/Y2-credit-omission.md`; renderer:
// `src/ui/board.ts` OMITTED_ELEMENTS — skipped before any DOM node is created).
// The reference captures show the credits, so every board comparison passes
// the owner-approved omission region as `--ignore-rect`.
//
// Owner region: `0,367,105,36` (visible sprite bbox union, task input). The F1
// tool requires every rect to lie fully inside the image, and the 550x400 stage
// clips the sprites at y=400 (their un-clipped bbox reaches y=403), so the
// wired rect is the stage-clipped `0,367,105,33`; the three off-stage rows can
// never appear in either image. Like the Y1 set, coordinates are dsf1 stage
// pixels and scale by the deviceScaleFactor.
//
// Overlap with Y1_IGNORE_RECTS (checked; overlaps are harmless — the tool
// counts each pixel once and `ignoredPixels` is the union): the wired rect
// intersects `[20,360,240,10]` in the 367–370 band (85x3 = 255 px); combined
// union numbers are measured in evidence/Y2-credits.md §3.
// ---------------------------------------------------------------------------
export const Y2_CREDIT_OMISSION_RECT: readonly [number, number, number, number] = [0, 367, 105, 36];
/** The wired (stage-clipped) form of `Y2_CREDIT_OMISSION_RECT` passed to the tool. */
export const Y2_CREDIT_IGNORE_RECT: readonly [number, number, number, number] = [0, 367, 105, 33];

/** The parsed credit-omission rect for one deviceScaleFactor. */
export function y2CreditIgnoreRects(dsf: number): { x: number; y: number; w: number; h: number }[] {
  const [x, y, w, h] = Y2_CREDIT_IGNORE_RECT;
  return [{ x: x * dsf, y: y * dsf, w: w * dsf, h: h * dsf }];
}

/** Ready-to-use `--ignore-rect x,y,w,h` CLI arguments for the Y2 omission region. */
export function y2CreditIgnoreRectArgs(dsf: number): string[] {
  return y2CreditIgnoreRects(dsf).flatMap((rect) => [
    '--ignore-rect',
    `${rect.x},${rect.y},${rect.w},${rect.h}`,
  ]);
}

// ---------------------------------------------------------------------------
// Task Y6 — owner-approved Top10-button omission region (docs/07 §4, owner
// final wave)
//
// The rebuild intentionally omits the Top10 button (`btn_top10`; owner
// directive `tasks/Y6-top10-omission.md`; renderer: `src/ui/board.ts`
// OMITTED_ELEMENTS — skipped before any DOM node is created; reference action
// `javascript:openWin('top10.php?…')`, README §2.2). The reference captures
// show the button, so every board comparison passes the owner-approved
// omission region as `--ignore-rect`.
//
// Owner region: `419,372,91,23` = the integer pixel coverage of the button's
// stage bbox (419.8,372.95)–(509.25,394.65) (floor origin, ceil corner). The
// F1 tool requires rects inside the image; here the region lies fully inside
// the 550x400 stage (x+w=510 <= 550, y+h=395 <= 400), so the wired
// stage-clipped form equals the declared rect — the clip is a no-op at dsf 1
// and 2 (unlike the Y2 credit region, whose sprites the stage clips at y=400).
//
// Measured derivation (evidence/Y6-top10.md §3; F1 tool, post↔pre and
// app-after vs the S2 reference): omission change bbox (raw > 30)
// `420,373,87,20` at dsf1 and `840,746,174,40` at dsf2; union in dsf1 stage
// coordinates `420,373,87,20`, fully inside the declared rect (attribution
// mask `post>30 ∧ pre<=30` outside the rect: 0 px). The region intersects
// neither the Y1 set nor the Y2 credit rect (0 px); the combined allowance is
// 68023 px at dsf1 / 272092 px at dsf2 = 62720+3465−255+2093 scaled — exactly
// the `ignoredPixels` the suites report.
// ---------------------------------------------------------------------------
export const Y6_TOP10_OMISSION_RECT: readonly [number, number, number, number] = [419, 372, 91, 23];
/** The wired (stage-clipped) form of `Y6_TOP10_OMISSION_RECT` passed to the tool. */
export const Y6_TOP10_IGNORE_RECT: readonly [number, number, number, number] = [419, 372, 91, 23];

/** The parsed Top10-omission rect for one deviceScaleFactor. */
export function y6Top10IgnoreRects(dsf: number): { x: number; y: number; w: number; h: number }[] {
  const [x, y, w, h] = Y6_TOP10_IGNORE_RECT;
  return [{ x: x * dsf, y: y * dsf, w: w * dsf, h: h * dsf }];
}

/** Ready-to-use `--ignore-rect x,y,w,h` CLI arguments for the Y6 omission region. */
export function y6Top10IgnoreRectArgs(dsf: number): string[] {
  return y6Top10IgnoreRects(dsf).flatMap((rect) => [
    '--ignore-rect',
    `${rect.x},${rect.y},${rect.w},${rect.h}`,
  ]);
}

/**
 * Combined allowance of one board comparison: the Y1 HD backdrop/knob set, the
 * Y2 credit-omission region and the Y6 Top10-omission region (the tool reports
 * the rects in the given order).
 */
export function boardIgnoreRects(dsf: number): { x: number; y: number; w: number; h: number }[] {
  return [...y1IgnoreRects(dsf), ...y2CreditIgnoreRects(dsf), ...y6Top10IgnoreRects(dsf)];
}

/** Ready-to-use `--ignore-rect` arguments for the combined board allowance. */
export function boardIgnoreRectArgs(dsf: number): string[] {
  return [...y1IgnoreRectArgs(dsf), ...y2CreditIgnoreRectArgs(dsf), ...y6Top10IgnoreRectArgs(dsf)];
}

// ---------------------------------------------------------------------------
// Task Y10 — win celebration (owner decision Option A)
//
// The restored end screen compares against fresh reference captures of the
// win timeline (evidence/visual/Y10/reference-dsf{1,2}/frame-*.png,
// tests/e2e/celebration/capture-celebration-reference.mjs). Four of the five
// catalogued keyframes (SWF frames 132/159/186/214) are compared with **no
// allowance**: the day/night layers, the sun path and the wordmark motion are
// deterministic.
//
// Frame 241 (the results card, fully risen) needs the recorded allowances
// below — nothing else is excluded:
//
//   1. `Y10_CARD_OWNER_EDIT_RECTS` — the owner's card edits (tasks/Y10):
//      the `E-posta` field is removed entirely (label + input box; the
//      reference capture still shows the row) and the `Ad Soyad` label is
//      renamed to `İsim` (different glyph run at the same label box). The
//      rects cover exactly the modified rows' areas: the label run
//      (144,257,78,17) and the removed e-mail row (146,278,268,22); the name
//      field box, the labels and the values below are NOT covered.
//   2. `Y10_SESSION_VALUE_RECTS` — the `Puanınız` and `Süre` value columns.
//      Their contents are session-dependent in both implementations (the
//      reference capture shows the values of its own scripted run: score
//      including the time bonus, elapsed whole seconds — e.g. 69400/60);
//      the rebuild's values are asserted at the state level (score oracle of
//      the F2 script + elapsed = totalSeconds - remainingSeconds) and their
//      live text is exercised by tests/e2e/celebration. `Kelime Sayısı` (35)
//      is deterministic and stays compared, as do the labels and the card
//      shape/button.
//
// Coordinates are dsf1 stage pixels (the card's settled frame-241 box
// (114.9, 214.85, 311.9, 169) plus the SWF field offsets; derivation in
// evidence/Y10-celebration.md §card); scale by the deviceScaleFactor like the
// Y1/Y2/Y6 sets.
// ---------------------------------------------------------------------------
export const Y10_CARD_OWNER_EDIT_RECTS: readonly (readonly [number, number, number, number])[] = [
  [144, 257, 74, 17], // `İsim` label glyph area (was `Ad Soyad`; stops at the name field box)
  [146, 278, 268, 22], // removed `E-posta` row (label + input box)
];
export const Y10_SESSION_VALUE_RECTS: readonly (readonly [number, number, number, number])[] = [
  [219, 301, 195, 18], // `Puanınız` value field
  [219, 344, 195, 18], // `Süre` value field
];

/** The parsed frame-241 allowance for one deviceScaleFactor. */
export function y10ResultsAllowanceRects(
  dsf: number,
): { x: number; y: number; w: number; h: number }[] {
  return [...Y10_CARD_OWNER_EDIT_RECTS, ...Y10_SESSION_VALUE_RECTS].map(([x, y, w, h]) => ({
    x: x * dsf,
    y: y * dsf,
    w: w * dsf,
    h: h * dsf,
  }));
}

/** Ready-to-use `--ignore-rect` arguments for the frame-241 allowance. */
export function y10ResultsAllowanceArgs(dsf: number): string[] {
  return y10ResultsAllowanceRects(dsf).flatMap((rect) => [
    '--ignore-rect',
    `${rect.x},${rect.y},${rect.w},${rect.h}`,
  ]);
}

// ---------------------------------------------------------------------------
// Task Y10 — owner-kept Yeni Oyun affordance on the win screen
//
// The reference hides every board button at SWF frame 132 (`frame_132`
// `ybuton._visible = false`), leaving the excluded score form's submit as the
// only return path. The owner decision keeps `Yeni Oyun` (btn_ybuton) visible
// on the rebuild's win screen as the return path (D5 evidence §9.3), so every
// win keyframe comparison passes this recorded deviation rect: the button's
// catalog display bbox `(445.8, 196.45, 98.3, 21.7)` (data/layout.json).
// ---------------------------------------------------------------------------
export const Y10_RETURN_BUTTON_RECT: readonly [number, number, number, number] = [
  445, 196, 100, 23,
];

/** The parsed Yeni Oyun deviation rect for one deviceScaleFactor. */
export function y10ReturnButtonRects(dsf: number): { x: number; y: number; w: number; h: number }[] {
  const [x, y, w, h] = Y10_RETURN_BUTTON_RECT;
  return [{ x: x * dsf, y: y * dsf, w: w * dsf, h: h * dsf }];
}

/** Ready-to-use `--ignore-rect` arguments for the Yeni Oyun deviation. */
export function y10ReturnButtonArgs(dsf: number): string[] {
  return y10ReturnButtonRects(dsf).flatMap((rect) => [
    '--ignore-rect',
    `${rect.x},${rect.y},${rect.w},${rect.h}`,
  ]);
}
