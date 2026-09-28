// src/ui/hud.ts — score, timer, counters, found list and the button hit areas
// (docs/04-architecture.md §4/§6; docs/05-game-core.md §1/§6/§8; O05).
//
// The visible stage is rendered by `src/ui/board.ts` (E2): `score_value`,
// `timer_value`, `count_3..count_8` and the found-word slot boxes all read from
// a `BoardView`. This module owns the DOM contract around that view:
// - the docs/04 §6 `data-testid` hooks (`score`, `timer`, `entry`,
//   `found-list`, counters) as a visually-hidden mirror of the game state, so
//   E2E can read them without depending on the painted SVG text;
// - the four button hit areas (`submit` = Ekle, `scramble` = Karıştır,
//   `delete` = Sil, `new-round` = Yeni Oyun): the sprites themselves come from
//   E2's board, the transparent overlays here provide stable clicks/testids
//   (board re-renders cannot drop a click) at the catalog rectangles from
//   src/data/layout.json;
// - in-place timer updates (see `updateTimer`) so the countdown ticks without
//   re-rendering the board.
//
// Visibility rules follow the reference `baslat()` / `bittimi()` / `tamamla()`
// (evidence/A2-labels.md §2, evidence/A2-timeout.md §2): Ekle/Karıştır/Sil are
// live only while the round is playable; Yeni Oyun is live between rounds and
// in the completion sequences (see evidence/D5-lifecycle.md deviation note: the
// reference's results-screen return path lived in the excluded score form).

import layoutJson from '../data/layout.json';
import type { LifecycleSnapshot, ListedWordView } from '../game/lifecycle';
import type { WordLength } from '../game/round';

/** Which control hit areas are live. */
export interface HudControlsVisibility {
  readonly submit: boolean;
  readonly scramble: boolean;
  readonly delete: boolean;
  readonly newRound: boolean;
}

/** Options for {@link mountHud}; all callbacks are optional. */
export interface HudOptions {
  /**
   * E2 board element: `updateTimer` patches its `timer_value` text and gauge
   * in place. Omit (tests) to update the mirror only.
   */
  readonly board?: HTMLElement;
  readonly onSubmit?: () => void;
  readonly onScramble?: () => void;
  readonly onDelete?: () => void;
  readonly onNewRound?: () => void;
}

/** HUD contract: state mirror + control hit areas. */
export interface HudHandle {
  /** Visually-hidden testid mirror (score/timer/counters/entry/found-list). */
  readonly element: HTMLElement;
  /** Transparent button overlays (submit/scramble/delete/new-round). */
  readonly controls: HTMLElement;
  /** Refresh every mirror element from `snapshot`. */
  update(snapshot: LifecycleSnapshot): void;
  /** Enable/hide the four control hit areas. */
  setControls(visible: HudControlsVisibility): void;
  /** Tick path: update timer text/gauge in place (no board re-render). */
  updateTimer(remainingSeconds: number, initialSeconds: number): void;
  destroy(): void;
}

interface LayoutElementLike {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const LAYOUT_ELEMENTS = (layoutJson as unknown as { elements: LayoutElementLike[] }).elements;

function layoutElement(id: string): LayoutElementLike {
  const element = LAYOUT_ELEMENTS.find((candidate) => candidate.id === id);
  if (element === undefined) {
    throw new Error(`src/data/layout.json is missing the ${id} element`);
  }
  return element;
}

/** Catalog placements of the four button sprites (E2 board renders them). */
const CONTROL_RECTS = {
  submit: layoutElement('btn_ebuton'),
  scramble: layoutElement('btn_sbuton'),
  delete: layoutElement('btn_kbuton'),
  newRound: layoutElement('btn_ybuton'),
} as const;

const WORD_LENGTHS: readonly WordLength[] = [3, 4, 5, 6, 7, 8];

const STYLE_ID = 'game-hud-styles';

function installStyleSheet(doc: Document): void {
  const css = `
.game-hud {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.game-control {
  position: absolute;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  appearance: none;
  cursor: pointer;
  outline: 0;
  z-index: 20000;
}
.game-control[hidden] { display: none; }
`;
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style === null) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = css;
}

function createControl(
  rect: LayoutElementLike,
  testid: string,
  onClick: (() => void) | undefined,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-control';
  button.dataset.testid = testid;
  button.setAttribute('aria-hidden', 'true');
  button.tabIndex = -1;
  button.style.left = `${rect.x}px`;
  button.style.top = `${rect.y}px`;
  button.style.width = `${rect.w}px`;
  button.style.height = `${rect.h}px`;
  button.hidden = true;
  if (onClick !== undefined) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      onClick();
    });
  }
  return button;
}

function listedWordListItem(view: ListedWordView): HTMLLIElement {
  const item = document.createElement('li');
  item.textContent = view.word;
  item.dataset.length = String(view.length);
  item.dataset.index = String(view.index);
  if (view.revealed) item.dataset.revealed = 'true';
  return item;
}

/** Mount the HUD mirror and control overlays into the stage root. */
export function mountHud(root: HTMLElement, options: HudOptions = {}): HudHandle {
  installStyleSheet(document);

  const element = document.createElement('div');
  element.className = 'game-hud';
  element.dataset.testid = 'hud';

  const score = document.createElement('span');
  score.dataset.testid = 'score';
  const timer = document.createElement('span');
  timer.dataset.testid = 'timer';
  const entry = document.createElement('output');
  entry.dataset.testid = 'entry';

  const counters = document.createElement('div');
  counters.dataset.testid = 'counters';
  const counterElements = new Map<WordLength, HTMLElement>();
  for (const length of WORD_LENGTHS) {
    const counter = document.createElement('span');
    counter.dataset.testid = `counter-${length}`;
    counterElements.set(length, counter);
    counters.appendChild(counter);
  }

  const foundList = document.createElement('ul');
  foundList.dataset.testid = 'found-list';

  element.append(score, timer, entry, counters, foundList);
  root.appendChild(element);

  const controls = document.createElement('div');
  controls.className = 'game-controls';
  controls.dataset.testid = 'controls';
  const submit = createControl(CONTROL_RECTS.submit, 'submit', options.onSubmit);
  const scramble = createControl(CONTROL_RECTS.scramble, 'scramble', options.onScramble);
  const deleteControl = createControl(CONTROL_RECTS.delete, 'delete', options.onDelete);
  const newRound = createControl(CONTROL_RECTS.newRound, 'new-round', options.onNewRound);
  controls.append(submit, scramble, deleteControl, newRound);
  root.appendChild(controls);

  return {
    element,
    controls,
    update(snapshot: LifecycleSnapshot): void {
      score.textContent = String(snapshot.score);
      timer.textContent = String(snapshot.remainingSeconds);
      entry.textContent = snapshot.entry;
      for (const length of WORD_LENGTHS) {
        counterElements.get(length)!.textContent = String(snapshot.remainingCounts[length]);
      }
      foundList.textContent = '';
      for (const word of snapshot.listedFound) {
        foundList.appendChild(listedWordListItem(word));
      }
    },
    setControls(visible: HudControlsVisibility): void {
      const entries: readonly (readonly [HTMLButtonElement, boolean])[] = [
        [submit, visible.submit],
        [scramble, visible.scramble],
        [deleteControl, visible.delete],
        [newRound, visible.newRound],
      ];
      for (const [button, enabled] of entries) {
        button.hidden = !enabled;
        button.disabled = !enabled;
      }
    },
    updateTimer(remainingSeconds: number, initialSeconds: number): void {
      timer.textContent = String(remainingSeconds);
      const board = options.board;
      if (board === undefined) return;
      const value = board.querySelector('[data-element="timer_value"]');
      if (value instanceof HTMLElement) {
        value.textContent = String(remainingSeconds);
      }
      const white = board.querySelector('.board-timer-white');
      const red = board.querySelector('.board-timer-red');
      if (!(white instanceof HTMLElement) || !(red instanceof HTMLElement)) {
        return;
      }
      // Geometry is read back from the rendered gauge (E2 sets the inline
      // height/top values from the reference profile): full bar height =
      // red + white, bar top = white top. No layout constant is duplicated.
      const redHeight = Number.parseFloat(red.style.height);
      const whiteHeight = Number.parseFloat(white.style.height);
      const barTop = Number.parseFloat(white.style.top);
      if (!Number.isFinite(redHeight) || !Number.isFinite(whiteHeight)) return;
      const fullHeight = redHeight + whiteHeight;
      const fraction =
        initialSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / initialSeconds)) : 0;
      const nextRedHeight = fullHeight * fraction;
      red.style.height = `${nextRedHeight}px`;
      if (Number.isFinite(barTop)) {
        red.style.top = `${barTop + fullHeight - nextRedHeight}px`;
      }
      white.style.height = `${fullHeight - nextRedHeight}px`;
    },
    destroy(): void {
      element.remove();
      controls.remove();
    },
  };
}
