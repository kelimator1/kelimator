// src/ui/message.ts — transient/status messages (docs/04-architecture.md §4;
// docs/05-game-core.md §1/§3; O05: evidence/A2-strings.md).
//
// The reference `status` sprite (DefineSprite 123, stage instance `status` at
// depth 52) shows two live entry-status strings, driven by `kontrol()`:
// - frame 2 `Geçerli` (text id 119) while the entry is a valid, not-yet-found
//   word of `dizi`;
// - frame 3 `Girildi` (text id 122) while the entry is in `bulunanlar` (the
//   found pass runs last, so it wins for an already-found word);
// - frame 1 (blank/dark ball) otherwise; `ekle()` resets the status after a
//   valid word.
// The round-loading banner text `Kelimeler Yükleniyor\rLütfen Bekleyiniz...`
// (text ids 78/82/83) is shown while the round list loads.
//
// Strings are used verbatim; the component never invents text (O05).
//
// Task Y9 (owner-reported defect, evidence/Y9-status-lamp.md): the three
// sprite frames are reproduced exactly as the reference draws them —
//   frame 1 (idle): the dark ball, no text (rendered by the board from the
//     catalog asset `s123_status_ball.svg`, unchanged);
//   frame 2 (valid): green ball (`s123_status_ball_f2.svg`, the frame with its
//     baked static text stripped deterministically by tools/process-assets.mjs)
//     + the live `Geçerli` text in the frame's colour #336600;
//   frame 3 (already-found): red ball (`s123_status_ball_f3.svg`) + live
//     `Girildi` in the frame's colour #ff0000.
// The live-text mechanism is kept: measured against the rendered reference
// frames through the F1 tool on the project's anti-aliasing-tolerant V5 basis
// (docs/07 §4 amendment) it stays pixel-faithful (worst capsule tolerant
// mismatch 0.144 % — found/dsf1; valid/dsf1 is 0.000 %; limit 2.000 %; the ball
// regions are raw-exact, 0 mismatched pixels). Residual differences are glyph
// rasterisation/hinting only. The text slot and colour are read from the
// frames: text records 119/122 carry height 14 px / yOffset 14 px, the sprite
// places the text run at (40, 7), and the fills are #336600 / #ff0000
// (DefineText records + exported SVG). The message element keeps the verbatim
// string as its text content (O05), so the e2e status assertions read the real
// user-visible text.
//
// While a coloured state is active the board's frame-1 ball is hidden: the
// component marks the shared stage root with `data-status-lamp` and the board
// stylesheet (src/ui/board.ts, status-ball rule) reacts. The reference frame 2/3
// ball fully replaces frame 1, so overlaying it would double-blend the ball's
// antialiased edge.

import layoutJson from '../data/layout.json';
import type { EntryStatus } from '../game/lifecycle';

/** O05 strings, verbatim (evidence/A2-strings.md §2, text ids 119/122). */
export const STATUS_VALID_TEXT = 'Geçerli';
export const STATUS_ALREADY_FOUND_TEXT = 'Girildi';
/** Loading banner (text ids 78/82/83; CR 0x0D between the two lines). */
export const LOADING_TEXT = 'Kelimeler Yükleniyor\rLütfen Bekleyiniz...';

/** Frame fills, sampled from the exported reference frames (Y9 §2). */
export const STATUS_VALID_COLOR = '#336600';
export const STATUS_ALREADY_FOUND_COLOR = '#ff0000';

interface LayoutElementLike {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const STATUS_BOX: LayoutElementLike = (() => {
  const catalog = layoutJson as unknown as { elements: LayoutElementLike[] };
  const element = catalog.elements.find((candidate) => candidate.id === 'status_ball');
  if (element === undefined) {
    throw new Error('src/data/layout.json is missing the status_ball element');
  }
  return element;
})();

/**
 * Ball assets for the coloured states (task Y9): the processed frames 2/3 of
 * DefineSprite 123 with the baked static text stripped (see
 * tools/process-assets.mjs `STATUS_BALL_FRAMES`). Frame 1 (idle) stays the
 * catalog asset rendered by the board.
 */
const BALL_URLS = import.meta.glob('../assets/svg/s123_status_ball_f*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const VALID_BALL_KEY = '../assets/svg/s123_status_ball_f2.svg';
const FOUND_BALL_KEY = '../assets/svg/s123_status_ball_f3.svg';

/** Map an entry status to its evidenced string (null = blank state). */
export function statusText(status: EntryStatus): string | null {
  if (status === 'valid') return STATUS_VALID_TEXT;
  if (status === 'already-found') return STATUS_ALREADY_FOUND_TEXT;
  return null;
}

/** Status/loading message element contract. */
export interface MessageHandle {
  readonly element: HTMLElement;
  /** Show `text`, or clear the element when null. */
  show(text: string | null): void;
  /** Show the O05 string for the current entry status (null clears). */
  showStatus(status: EntryStatus): void;
  /** Show the O05 round-loading banner text. */
  showLoading(): void;
  destroy(): void;
}

const STYLE_ID = 'game-message-styles';

function installStyleSheet(doc: Document): void {
  // Status text metrics from the reference frames (Y9 §2/§3): the sprite's
  // text instance sits at (40, 7) with the glyph baseline at y=21 (text record
  // yOffset 14); `line-height: 0` + `top: 15px` reproduce the baseline at the
  // measured best fit of the frame's Verdana Bold outline run (size sweep in
  // evidence/Y9-status-lamp.md §3; size 14.2 px / top 15 px minimises the
  // tolerant mismatch across both strings and both deviceScaleFactors).
  const css = `
.game-message {
  position: absolute;
  display: none;
  align-items: center;
  justify-content: center;
  left: ${STATUS_BOX.x}px;
  top: ${STATUS_BOX.y}px;
  width: ${STATUS_BOX.w}px;
  height: ${STATUS_BOX.h}px;
  font-family: Verdana, "DejaVu Sans", sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: #000;
  text-align: center;
  white-space: pre-line;
  line-height: 1.2;
  pointer-events: none;
  z-index: 24000;
}
.game-message[data-visible="true"] { display: flex; }
.game-message .game-message-ball {
  display: none;
  position: absolute;
  left: 0;
  top: 0;
  width: ${STATUS_BOX.w}px;
  height: ${(STATUS_BOX.w * 34.8) / 107}px;
}
.game-message[data-lamp] .game-message-ball { display: block; }
.game-message[data-lamp] .game-message-text {
  position: absolute;
  left: 40px;
  top: 15px;
  line-height: 0;
  white-space: pre;
  font-size: 14.2px;
  font-weight: 700;
}
.game-message[data-lamp="valid"] .game-message-text { color: ${STATUS_VALID_COLOR}; }
.game-message[data-lamp="already-found"] .game-message-text { color: ${STATUS_ALREADY_FOUND_COLOR}; }
`;
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style === null) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = css;
}

/** Mount the status/loading message component into the stage root. */
export function mountMessage(root: HTMLElement): MessageHandle {
  installStyleSheet(document);

  const element = document.createElement('div');
  element.className = 'game-message';
  element.dataset.testid = 'message';
  element.setAttribute('role', 'status');

  const ball = document.createElement('img');
  ball.className = 'game-message-ball';
  ball.alt = '';
  ball.draggable = false;
  element.appendChild(ball);

  const text = document.createElement('span');
  text.className = 'game-message-text';
  element.appendChild(text);

  root.appendChild(element);

  const clearLamp = (): void => {
    delete element.dataset.lamp;
    delete root.dataset.statusLamp;
  };

  const show = (content: string | null): void => {
    clearLamp();
    if (content === null) {
      text.textContent = '';
      element.dataset.visible = 'false';
      return;
    }
    text.textContent = content;
    element.dataset.visible = 'true';
  };

  const showStatus = (status: EntryStatus): void => {
    const content = status === null ? null : statusText(status);
    if (content === null || status === null) {
      show(null);
      return;
    }
    const url = BALL_URLS[status === 'valid' ? VALID_BALL_KEY : FOUND_BALL_KEY];
    if (url === undefined) {
      throw new Error('status ball frame asset is missing from src/assets/svg/');
    }
    ball.src = url;
    text.textContent = content;
    element.dataset.lamp = status;
    element.dataset.visible = 'true';
    root.dataset.statusLamp = status;
  };

  return {
    element,
    show,
    showStatus,
    showLoading(): void {
      show(LOADING_TEXT);
    },
    destroy(): void {
      clearLamp();
      element.remove();
    },
  };
}
