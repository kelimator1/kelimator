// src/ui/message.ts — transient/status messages (docs/04-architecture.md §4;
// docs/05-game-core.md §1/§3; O05: evidence/A2-strings.md).
//
// The reference `status` sprite (DefineSprite 123, stage instance `status` at
// depth 52) shows two live entry-status strings, driven by `kontrol()`:
// - frame 2 `Geçerli` (text id 119) while the entry is a valid, not-yet-found
//   word of `dizi`;
// - frame 3 `Girildi` (text id 122) while the entry is in `bulunanlar` (the
//   found pass runs last, so it wins for an already-found word);
// - frame 1 (blank) otherwise; `ekle()` resets the status after a valid word.
// The round-loading banner text `Kelimeler Yükleniyor\rLütfen Bekleyiniz...`
// (text ids 78/82/83) is shown while the round list loads.
//
// Strings are used verbatim; the component never invents text (O05). Sprite-
// internal typography/layout is not part of the A3 catalog (O08): the message
// is centered in the `status_ball` catalog box, whose placement comes from
// src/data/layout.json (E1/A3) — see evidence/D5-lifecycle.md.

import layoutJson from '../data/layout.json';
import type { EntryStatus } from '../game/lifecycle';

/** O05 strings, verbatim (evidence/A2-strings.md §2, text ids 119/122). */
export const STATUS_VALID_TEXT = 'Geçerli';
export const STATUS_ALREADY_FOUND_TEXT = 'Girildi';
/** Loading banner (text ids 78/82/83; CR 0x0D between the two lines). */
export const LOADING_TEXT = 'Kelimeler Yükleniyor\rLütfen Bekleyiniz...';

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
  root.appendChild(element);

  const show = (text: string | null): void => {
    if (text === null) {
      element.textContent = '';
      element.dataset.visible = 'false';
      return;
    }
    element.textContent = text;
    element.dataset.visible = 'true';
  };

  return {
    element,
    show,
    showStatus(status: EntryStatus): void {
      show(statusText(status));
    },
    showLoading(): void {
      show(LOADING_TEXT);
    },
    destroy(): void {
      element.remove();
    },
  };
}
