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
  'btn_top10',
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
  'credit_line',
  'credit_site',
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
