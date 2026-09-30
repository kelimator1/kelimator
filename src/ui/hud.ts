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
//   icon follows the persisted volume at boot/render and, as an owner-approved
//   Y5 deviation from the reference's frame-entry timing, repaints immediately
//   on the click itself);
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
import { HISCORE_FORM_FIELDS } from './board';

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

/**
 * Control → catalog element id of the reference button sprite (E2 renders it).
 * The ids and their `on(release)` actions are decoded from the 2012 build:
 * - `btn_kbuton` (sprite 63, display bbox x=156.25) → `karistir();` — the
 *   "Karıştır" label, so `scramble`.
 *   // evidence: artifacts/decompiled/scripts/DefineButton2_63/BUTTONCONDACTION on(release).as (`karistir();`); evidence/A3-diffs.md §2 row 63 (`63 | name 'kbuton' | (156.25, 367.95, 232.35, 389.65)`).
 * - `btn_ebuton` (sprite 65, x=232.85) → `ekle();` — "Ekle", so `submit`.
 *   // evidence: artifacts/decompiled/scripts/DefineButton2_65/BUTTONCONDACTION on(release).as (`ekle();`); evidence/A3-diffs.md §2 row 65 (`65 | name 'ebuton' | (232.85, 367.95, 302.15, 389.65)`).
 * - `btn_sbuton` (sprite 105, x=308.6) → `sil();` — "Sil", so `delete`.
 *   // evidence: artifacts/decompiled/scripts/DefineButton2_105/BUTTONCONDACTION on(release).as (`sil();`); evidence/A3-diffs.md "2012-only stage-placed symbols" row 105 (`105 | DefineButton2Tag | sbuton | (308.60, 367.95, 377.90, 389.65)`).
 *
 * Owner defect (wave Y): `scramble`/`delete` were swapped here, so the overlay
 * at the Karıştır label dispatched `sil()` and the overlay at the Sil label
 * dispatched `karistir()`. Mapping table + pre/post runs + the superseding note
 * for evidence/D5-lifecycle.md §6: evidence/Y3-buttons.md.
 */
export const CONTROL_ELEMENT_IDS = {
  submit: 'btn_ebuton',
  scramble: 'btn_kbuton',
  delete: 'btn_sbuton',
  newRound: 'btn_ybuton',
} as const;

/** Catalog placements of the four button sprites (E2 board renders them). */
export const CONTROL_RECTS = {
  submit: layoutElement(CONTROL_ELEMENT_IDS.submit),
  scramble: layoutElement(CONTROL_ELEMENT_IDS.scramble),
  delete: layoutElement(CONTROL_ELEMENT_IDS.delete),
  newRound: layoutElement(CONTROL_ELEMENT_IDS.newRound),
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

// ---------------------------------------------------------------------------
// Y10 results form (owner decision Option A; tasks/Y10)
//
// The reference results card (DefineSprite_166) carries a `name` input (text
// id 154), the `Gönder` submit button (button 153) and the `hata` error line
// (162). The owner decision removes the `E-posta` field and renames the label
// to `İsim`; the submit flow is **placebo/local only — zero network, nothing
// stored** (the reference posts to the excluded `hiscore.php` and stores the
// name/e-mail in a SharedObject; docs/02 §7). The original button's tail action
// is a local navigation (`_root.gotoAndPlay("main")`,
// artifacts/decompiled/scripts/DefineButton2_153/BUTTONCONDACTION on(release).as
// L32; evidence/A2-labels.md §3) which reloads the word list and starts the
// next round: the rebuild's celebration → playing `newRound()` path (D5
// transition table; the intro replay difference is recorded in
// evidence/Y10-celebration.md). The empty-name gate keeps the reference's
// error string verbatim (`hata = "Lütfen adınızı yazınız"`).
// ---------------------------------------------------------------------------

/** Card box (src/data/layout.json `hiscore_form` = frame-222 placement). */
const HISCORE_CARD = layoutElement('hiscore_form');

/** The original empty-name error (DefineButton2_153 L3-L6, verbatim). */
export const RESULTS_NAME_ERROR = 'Lütfen adınızı yazınız';

/** The reference `name` input field max (`maxCharacters="50"`, text id 154). */
const RESULTS_NAME_MAX_LENGTH = 50;

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
/* Task Y10: results-form overlays (positioned at the card's frame-222 box +
   the SWF field offsets; the card's slide-in animation is applied to these
   nodes by src/ui/animations.ts, class e3-win-form-follow). */
.game-results-input {
  position: absolute;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  appearance: none;
  outline: 0;
  font-family: Verdana, "DejaVu Sans", sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #000;
  z-index: 20100;
}
.game-results-submit {
  position: absolute;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  appearance: none;
  cursor: pointer;
  outline: 0;
  z-index: 20100;
}
.game-results-error {
  position: absolute;
  font-family: Verdana, "DejaVu Sans", sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #ff0000;
  text-align: center;
  line-height: 18.55px;
  z-index: 20100;
}
.game-results-hidden { display: none; }
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
 * and — owner-approved Y5 deviation from the sprite's frame-entry timing — it
 * also runs in the click handler itself so the icon flips immediately
 * (evidence/Y5-speaker-feedback.md §2/§6). The reference behaviour it deviates
 * from: sprite 88 evaluates `_root.vol` when its frames are entered and then
 * stops (frame_1/frame_2 end in `stop()`), and the C3 probe measured a plain
 * click as 0 px changed (evidence/C3-speaker-capture.md §1).
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

  // --- Y10 results form (see the section header) ---------------------------
  const cardFieldRect = (
    field: keyof typeof HISCORE_FORM_FIELDS,
  ): { left: number; top: number; width: number; height: number } => {
    const rect = HISCORE_FORM_FIELDS[field];
    return {
      left: HISCORE_CARD.x + rect.x,
      top: HISCORE_CARD.y + rect.y,
      width: rect.w,
      height: rect.h,
    };
  };
  const placeFormNode = (node: HTMLElement, field: keyof typeof HISCORE_FORM_FIELDS): void => {
    const rect = cardFieldRect(field);
    node.style.left = `${rect.left}px`;
    node.style.top = `${rect.top}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
  };
  const resultsInput = document.createElement('input');
  resultsInput.type = 'text';
  resultsInput.className = 'game-results-input game-results-hidden';
  resultsInput.dataset.testid = 'results-name';
  resultsInput.dataset.element = 'hiscore_form-input';
  resultsInput.maxLength = RESULTS_NAME_MAX_LENGTH;
  resultsInput.setAttribute('aria-label', 'İsim');
  resultsInput.autocomplete = 'off';
  placeFormNode(resultsInput, 'name');
  const resultsError = document.createElement('span');
  resultsError.className = 'game-results-error game-results-hidden';
  resultsError.dataset.testid = 'results-error';
  resultsError.dataset.element = 'hiscore_form-error';
  placeFormNode(resultsError, 'error');
  const resultsSubmit = document.createElement('button');
  resultsSubmit.type = 'button';
  resultsSubmit.className = 'game-results-submit game-results-hidden';
  resultsSubmit.dataset.testid = 'results-submit';
  resultsSubmit.dataset.element = 'hiscore_form-submit';
  resultsSubmit.setAttribute('aria-label', 'Gönder');
  placeFormNode(resultsSubmit, 'submit');
  root.append(resultsInput, resultsError, resultsSubmit);
  let resultsFormVisible = false;
  /**
   * Reference `DefineButton2_153` on(release): empty name -> the error line;
   * otherwise the local navigation (the rebuild's celebration -> next-round
   * path; no request, nothing stored — owner decision).
   */
  resultsSubmit.addEventListener('click', (event) => {
    event.preventDefault();
    if (resultsInput.value === '') {
      resultsError.textContent = RESULTS_NAME_ERROR;
      resultsError.classList.remove('game-results-hidden');
      return;
    }
    resultsError.textContent = '';
    resultsError.classList.add('game-results-hidden');
    options.onNewRound?.();
  });

  // Speaker control (`spk_btn`): the rendered element belongs to E2's board,
  // so the listener is delegated from the board root — `board.apply` clears
  // the board's children on every render, and the handler must survive that.
  const onSpeakerClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const node = target.closest(`[data-element="${SPEAKER_ELEMENT_ID}"]`);
    if (node === null || options.board === undefined || !options.board.contains(node)) return;
    // Reference on(release): `vol` toggle (+ stopAllSounds on mute) and the
    // persistence write. The reference icon follows `_root.vol` only when its
    // frames are entered (C3 probe: a plain click changes 0 px;
    // evidence/C3-speaker-capture.md §1); the rebuild deliberately repaints the
    // icon inside this click instead (owner decision, task Y5: immediate
    // feedback; the measured reference timing is superseded —
    // evidence/Y5-speaker-feedback.md §6 — no debouncing).
    // evidence: evidence/Y5-speaker-feedback.md §2 (owner-approval note).
    toggleMute();
    syncSpeakerVisual(options.board);
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
      // Task Y10: the results form is live only on the win screen
      // (`celebration`); entering the state starts from an empty `İsim` field
      // (the rebuild stores nothing — owner decision; the reference restored a
      // SharedObject value).
      const showForm = snapshot.state === 'celebration';
      if (showForm && !resultsFormVisible) {
        resultsInput.value = '';
        resultsError.textContent = '';
        resultsError.classList.add('game-results-hidden');
      }
      resultsFormVisible = showForm;
      for (const node of [resultsInput, resultsError, resultsSubmit]) {
        node.classList.toggle('game-results-hidden', !showForm);
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
      resultsInput.remove();
      resultsError.remove();
      resultsSubmit.remove();
      options.board?.removeEventListener('click', onSpeakerClick);
    },
  };
}
