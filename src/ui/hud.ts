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
// - the speaker control (`btn_speaker` = `spk_btn`): a delegated listener plus
//   the reference sprite-88 frames "on"/"off" state on E2's board element
//   (DefineButton2_90 `on(release)` toggles `_root.vol` and persists it; the
//   icon follows the persisted volume at boot/render — the reference sprite
//   evaluates `vol` on frame entry only, so a plain click does not repaint);
// - in-place timer updates (see `updateTimer`) so the countdown ticks without
//   re-rendering the board.
//
// Visibility rules follow the reference `baslat()` / `bittimi()` / `tamamla()`
// (evidence/A2-labels.md §2, evidence/A2-timeout.md §2): Ekle/Karıştır/Sil are
// live only while the round is playable; Yeni Oyun is live between rounds and
// in the completion sequences (see evidence/D5-lifecycle.md deviation note: the
// reference's results-screen return path lived in the excluded score form).

import { isMuted, toggleMute } from '../audio/audio';
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

// ---------------------------------------------------------------------------
// Speaker control (reference `spk_btn` / DefineButton2_90, sprite 88)
// ---------------------------------------------------------------------------

/**
 * Layout id of the speaker element E2 renders
 * (src/data/layout.json: SWF depth 33 instance `spk_btn`, button 90).
 */
const SPEAKER_ELEMENT_ID = 'btn_speaker';

/**
 * Sprite 88 character ids (artifacts/decompiled/tags.xml `DefineSpriteTag`
 * spriteId="88"): 85 = the on-frame sound waves, 87 = the bitmap-86 speaker
 * icon shown in both frames.
 */
const SPEAKER_WAVES_CHARACTER_ID = '85';
const SPEAKER_ICON_CHARACTER_ID = '87';

/**
 * Frame "off" color transform (tags.xml sprite 88 frame 2: red/green/blue
 * multTerm 108, addTerm 148, alphaMultTerm 256): the waves are removed
 * (`RemoveObject2 depth="1"`) and the icon is drawn pale. SWF CXFORM terms are
 * 8-bit fixed point (mult/256) with the add term on the 0–255 scale
 * (add/255 in an SVG feComponentTransfer, sRGB).
 */
const SPEAKER_OFF_MULTIPLIER = 108 / 256;
const SPEAKER_OFF_INTERCEPT = 148 / 255;
const SPEAKER_OFF_FILTER_ID = 'speaker-off-filter';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SPEAKER_CLASS = 'game-speaker';

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
.game-speaker { cursor: pointer; }
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

// ---------------------------------------------------------------------------
// Speaker control (reference semantics + visual state)
// ---------------------------------------------------------------------------

/** The board's speaker element, if the board has rendered one. */
function speakerElement(board: HTMLElement | undefined): HTMLElement | null {
  if (board === undefined) return null;
  const node = board.querySelector(`[data-element="${SPEAKER_ELEMENT_ID}"]`);
  return node instanceof HTMLElement ? node : null;
}

/**
 * FFDec namespaces the character id (`ffdec:characterId`). The inline SVG is
 * injected with `innerHTML` (src/ui/board.ts), where the HTML parser stores
 * foreign attributes lowercased (`ffdec:characterid`), so the lookup is
 * case-insensitive.
 */
function characterIdOf(use: SVGUseElement): string | null {
  for (const attribute of Array.from(use.attributes)) {
    if (attribute.name.toLowerCase() === 'ffdec:characterid') return attribute.value;
  }
  return null;
}

/**
 * Install (once per render) the frame-"off" CXFORM as an SVG filter inside the
 * inline speaker SVG and return its `url(#id)` reference.
 */
function ensureSpeakerOffFilter(svg: SVGSVGElement): string {
  if (svg.querySelector(`#${SPEAKER_OFF_FILTER_ID}`) === null) {
    const filter = document.createElementNS(SVG_NAMESPACE, 'filter');
    filter.id = SPEAKER_OFF_FILTER_ID;
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const transfer = document.createElementNS(SVG_NAMESPACE, 'feComponentTransfer');
    for (const channel of ['R', 'G', 'B'] as const) {
      const func = document.createElementNS(SVG_NAMESPACE, `feFunc${channel}`);
      func.setAttribute('type', 'linear');
      func.setAttribute('slope', String(SPEAKER_OFF_MULTIPLIER));
      func.setAttribute('intercept', String(SPEAKER_OFF_INTERCEPT));
      transfer.appendChild(func);
    }
    filter.appendChild(transfer);
    svg.appendChild(filter);
  }
  return `url(#${SPEAKER_OFF_FILTER_ID})`;
}

/**
 * Mirror the reference speaker state on the rendered board element: frame "on"
 * (waves + untransformed icon) while sound is on; frame "off" (waves removed,
 * pale icon) while muted (volume 0). E2 re-creates the element on every
 * `board.apply`, so this runs at mount and after every `update` (boot/render),
 * i.e. the icon follows the persisted volume — never the click itself:
 * sprite 88 evaluates `_root.vol` when its frames are entered and then stops
 * (frame_1/frame_2 end in `stop()`), and the C3 probe measured a plain click as
 * 0 px changed (evidence/C3-speaker-capture.md §1).
 * evidence: DefineSprite_88/frame_1/DoAction.as L1-L5, frame_2 L1-L5;
 * tags.xml spriteId="88" frame labels "on"/"off" and CXFORM.
 */
function syncSpeakerVisual(board: HTMLElement | undefined): void {
  const node = speakerElement(board);
  if (node === null) return;
  const muted = isMuted();
  node.dataset.speaker = muted ? 'off' : 'on';
  node.classList.add(SPEAKER_CLASS);
  const svg = node.querySelector('svg');
  const filter = muted && svg instanceof SVGSVGElement ? ensureSpeakerOffFilter(svg) : '';
  for (const use of Array.from(node.querySelectorAll<SVGUseElement>('use'))) {
    const character = characterIdOf(use);
    if (character === SPEAKER_WAVES_CHARACTER_ID) {
      use.style.display = muted ? 'none' : '';
    } else if (character === SPEAKER_ICON_CHARACTER_ID) {
      use.style.filter = filter;
    }
  }
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

  // Speaker control (`spk_btn`): the rendered element belongs to E2's board,
  // so the listener is delegated from the board root — `board.apply` clears
  // the board's children on every render, and the handler must survive that.
  const onSpeakerClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const node = target.closest(`[data-element="${SPEAKER_ELEMENT_ID}"]`);
    if (node === null || options.board === undefined || !options.board.contains(node)) return;
    // Reference on(release): `vol` toggle (+ stopAllSounds on mute) and the
    // persistence write. No icon repaint here — sprite 88 only evaluates
    // `_root.vol` when its frames are entered (C3 probe: a plain click changes
    // 0 px; evidence/C3-speaker-capture.md §1); the next boot/render applies
    // the persisted volume via syncSpeakerVisual.
    toggleMute();
  };
  options.board?.addEventListener('click', onSpeakerClick);
  syncSpeakerVisual(options.board);

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
      // E2 re-created the board form; re-apply the speaker state.
      syncSpeakerVisual(options.board);
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
      options.board?.removeEventListener('click', onSpeakerClick);
    },
  };
}
