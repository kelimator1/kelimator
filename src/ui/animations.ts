// src/ui/animations.ts — E3 animation timing registry, trigger bindings and the
// presentation-only DOM animation controller.
//
// Contract and sources:
// - `data/animation.json` (A3) is the timing authority: 24 sequences with SWF
//   frame spans at 36 fps and keyframe offsets (evidence/A3-timing.md §1–§3).
//   This module derives every duration as `frames / ANIMATION_FPS` and every
//   keyframe offset as `(frame - frameStart) / ANIMATION_FPS`; the e2e suite
//   cross-checks the derived values against the catalog (V2).
// - Triggers come from the D5 lifecycle outputs only (`stateChanged`,
//   `roundStarted`, `roundCompleted`, `changed`, `tick` — the
//   `RoundLifecycleOptions` callbacks of src/game/lifecycle.ts,
//   evidence/D5-lifecycle.md §2) plus the D4 sound hand-off for the
//   sound-carrying clip sprites (event names of `data/sound-map.json`,
//   evidence/A2-sounds.md §2 / evidence/D4-audio.md). No new events exist.
//   V7 checks name inclusion in `tests/e2e/animations/animations.spec.ts`.
// - Visual implementation: the rebuild only paints the board state, so the
//   only catalogued sequence with a startable visual is the wordball entry
//   slide (`sprite_wordball_timeline`, DefineSprite_46). Its per-frame offsets
//   are in src/styles/animations.css with the sprite-dump source recorded.
//   All other sequences are registered for timing/trigger consistency; their
//   reference states are not painted by the rebuild (instant preloader/intro —
//   evidence/D5-lifecycle.md §2; excluded end screen — docs/02 §7; zero-size
//   action/sound-only clips — src/data/layout.json geometry `—`).
//
// Animations never mutate game state: the controller only adds/removes CSS
// classes and transient ghost nodes on E2's board element.

import animationCatalogJson from '../data/animation.json';
import type { BoardView } from './board';
import type { GameState } from '../game/state';
import type { CompletionReason } from '../game/lifecycle';

/**
 * Reference frame rate. evidence: evidence/A3-timing.md §1 (SWF header
 * frameRate=36; one frame = 1/36 s = 0.02778 s).
 */
export const ANIMATION_FPS = 36;

/** One catalogued sequence with derived timings (the V2-asserted surface). */
export interface AnimationSequenceTiming {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly elements: readonly string[];
  readonly frameStart: number;
  readonly frameEnd: number;
  readonly frames: number;
  /** `frames / ANIMATION_FPS` (exact; catalog stores the rounded value). */
  readonly durationSec: number;
  /** `frames * 1000 / ANIMATION_FPS`. */
  readonly durationMs: number;
  readonly keyframeFrames: readonly number[];
  /** `(frame - frameStart) / ANIMATION_FPS` for every keyframe frame. */
  readonly keyframeOffsetsSec: readonly number[];
}

interface RawAnimationSequence {
  id: string;
  kind: string;
  state: string;
  elements: string[];
  frameStart: number;
  frameEnd: number;
  frames: number;
  durationSec: number;
  keyframeFrames: number[];
  keyframeOffsetsSec: number[];
  evidence: string;
}

interface RawAnimationCatalog {
  schemaVersion: number;
  fps: number;
  totalFrames: number;
  sequences: RawAnimationSequence[];
}

const CATALOG = animationCatalogJson as unknown as RawAnimationCatalog;

/** Every catalogued sequence with code-derived durations and offsets. */
export const ANIMATION_SEQUENCES: readonly AnimationSequenceTiming[] = Object.freeze(
  CATALOG.sequences.map((sequence) =>
    Object.freeze({
      id: sequence.id,
      kind: sequence.kind,
      state: sequence.state,
      elements: Object.freeze([...sequence.elements]),
      frameStart: sequence.frameStart,
      frameEnd: sequence.frameEnd,
      frames: sequence.frames,
      durationSec: sequence.frames / ANIMATION_FPS,
      durationMs: (sequence.frames * 1000) / ANIMATION_FPS,
      keyframeFrames: Object.freeze([...sequence.keyframeFrames]),
      keyframeOffsetsSec: Object.freeze(
        sequence.keyframeFrames.map((frame) => (frame - sequence.frameStart) / ANIMATION_FPS),
      ),
    }),
  ),
);

/**
 * D5 lifecycle event names an animation trigger may bind to (the
 * `RoundLifecycleOptions` callback set). evidence: evidence/D5-lifecycle.md §2
 * (`onStateChanged` / `onRoundStarted` / `onRoundCompleted` / `onChanged` /
 * `onTick`); `on<Name>` in src/game/lifecycle.ts.
 */
export const LIFECYCLE_EVENT_NAMES = [
  'stateChanged',
  'roundStarted',
  'roundCompleted',
  'changed',
  'tick',
] as const;

/** One D5 lifecycle event name (see {@link LIFECYCLE_EVENT_NAMES}). */
export type LifecycleEventName = (typeof LIFECYCLE_EVENT_NAMES)[number];

/**
 * Animation trigger: a D5 lifecycle event (`source` = the callback name) or
 * the D4 audio hand-off (`source: 'audio'`, event names of
 * `data/sound-map.json`; `evidence/A2-sounds.md` §2 lists each call site).
 */
export type AnimationTrigger =
  | { readonly source: 'stateChanged'; readonly state: GameState }
  | { readonly source: 'roundStarted' }
  | { readonly source: 'roundCompleted'; readonly reason: CompletionReason }
  | { readonly source: 'changed' }
  | { readonly source: 'tick'; readonly maxRemainingSeconds?: number }
  | { readonly source: 'audio'; readonly events: readonly string[] };

/**
 * Trigger binding for every catalogued sequence.
 *
 * State/element/win sequences follow the reference main-timeline labels
 * (evidence/A2-labels.md §2–§3): `preloader` frames 1–4, `main` frame 5,
 * `hepsiburda` frame 131, `bravo` frame 132 — mapped onto D5's states
 * (`preloader`, `main`, `playing`, `celebration`).
 *
 * The sound-carrying clip sprites are action/sound-only (zero geometry,
 * `DefineSpriteTag geometry=—` in src/data/layout.json): their StartSound
 * payloads are table-stakes for the V7 audio check and are driven in the
 * rebuild by the D4 events named below (evidence/A2-sounds.md §2 maps each
 * clip to its sprite frame StartSound; D5 calls `play(event)` from the same
 * lifecycle moments, evidence/D5-lifecycle.md §7).
 */
export const SEQUENCE_TRIGGERS: Readonly<Record<string, AnimationTrigger>> = Object.freeze({
  // Main-timeline states (evidence/A2-labels.md §2: frame 5 `main`, frame 131
  // `hepsiburda`, frame 132 `bravo`; frames 1–4 preloader).
  preloader: { source: 'stateChanged', state: 'preloader' },
  intro: { source: 'stateChanged', state: 'main' },
  board: { source: 'stateChanged', state: 'playing' },
  win: { source: 'stateChanged', state: 'celebration' },
  // Element motions of the main timeline (evidence/A3-timing.md §3.2).
  intro_glow_motion: { source: 'stateChanged', state: 'main' },
  intro_logo_motion: { source: 'stateChanged', state: 'main' },
  hiscore_form_motion: { source: 'stateChanged', state: 'celebration' },
  // Sprite-internal timelines (evidence/A3-timing.md §3.3).
  sprite_preloader_progress_timeline: { source: 'stateChanged', state: 'preloader' },
  // `timerr` (DefineSprite_21) runs the 1000 ms timer tick logic
  // (evidence/A2-timer.md §2); D5 exposes it as `onTick`.
  sprite_clip_timerr_timeline: { source: 'tick' },
  // Sound clips: sprite frame 2 StartSound; driven by the D4 event of the same
  // name (data/sound-map.json `events`).
  sprite_clip_enter_timeline: { source: 'audio', events: ['submitValid'] },
  sprite_clip_shuffle_timeline: { source: 'audio', events: ['scramble'] },
  sprite_clip_countdown_timeline: { source: 'audio', events: ['countdown'] },
  sprite_clip_boing_timeline: { source: 'audio', events: ['submitAlreadyFound'] },
  sprite_clip_fanfare_timeline: { source: 'audio', events: ['roundStart'] },
  sprite_clip_finishsound_timeline: { source: 'audio', events: ['timeout'] },
  sprite_clip_typer_timeline: { source: 'audio', events: ['letterKey', 'tileClick'] },
  sprite_clip_backspace_timeline: { source: 'audio', events: ['delete'] },
  sprite_clip_buzz_timeline: { source: 'audio', events: ['submitInvalid'] },
  // Wordball template: the add/remove slides run from the entry-change path
  // (`duzenle(...)` calls on `onChanged`, evidence/D5-lifecycle.md §7).
  sprite_wordball_timeline: { source: 'changed' },
  // Timer bar: `bar.play()` while the clock is at or below 10 s
  // (evidence/A2-timer.md §2, DefineSprite_76/frame_1).
  sprite_timer_bar_timeline: { source: 'tick', maxRemainingSeconds: 10 },
  sprite_loading_banner_timeline: { source: 'stateChanged', state: 'preloader' },
  // Score feedback movie: `puanmovie.gotoAndPlay(2)` on a valid submit
  // (evidence/A2-labels.md §3, frame_131/DoAction.as L492).
  sprite_score_feedback_timeline: { source: 'audio', events: ['submitValid'] },
  // Status ball: `kontrol()` picks its state on every entry change
  // (evidence/A2-strings.md §2); D5 renders `snapshot().entryStatus`.
  sprite_status_ball_timeline: { source: 'changed' },
  // Bottom marquee: placed on the win timeline at frame 241
  // (evidence/A3-timing.md §3.3).
  sprite_bottom_marquee_timeline: { source: 'stateChanged', state: 'celebration' },
});

/**
 * Catalogued sequence ids without a trigger binding. Asserted empty by the
 * e2e suite (a silent skip would surface here).
 */
export const UNTRIGGERED_SEQUENCE_IDS: readonly string[] = ANIMATION_SEQUENCES.filter(
  (sequence) => SEQUENCE_TRIGGERS[sequence.id] === undefined,
).map((sequence) => sequence.id);

/** The wordball sequence id (visual slide animation). */
export const WORDBALL_SEQUENCE_ID = 'sprite_wordball_timeline';

// ---------------------------------------------------------------------------
// Boot intro timeline (task Y8, closes O23)
//
// The reference `main` span (SWF frames 5–130) is painted by five step-held
// CSS animations over the existing vector layers; every value comes from the
// main-timeline tracks of artifacts/decompiled/tags.xml (extracted into
// evidence/logs/Y8-intro-series.json, derivation in evidence/Y8-intro.md):
// - `intro_sky` (ch5) / `intro_layer3` (ch8): alpha crossfade of the day sky
//   over the static night backdrop (ch1, stars) + moon (ch3) and of the golden
//   ground surface over the black ground (ch6) — this IS the night→day
//   mechanism (no CXFORM colour shift of the night elements; they are covered
//   by the sky as its alpha ramps 36/256 (frame 5) → 256/256 (frame 41));
// - `intro_glow` (ch20): the sun rises from behind the ground (translateY
//   0 → −362.9 px over frames 5–129, −2.9 px/frame) while its SWF colour
//   transform — a linear blend r' = m·r + a with m = redMultTerm/256 and
//   a = (1−m)·(255,152,51) — is reproduced by an orange overlay layer whose
//   opacity ramps 1−m from 0.8203 (frame 5) to 0 (frame 129) on top of the
//   existing GLOW_GRADIENT (src/ui/board.ts);
// - `intro_logo` (ch29): the falling "kelimatör" wordmark (frames 41–130: fall
//   from above the stage, settle at the centre, then shrink to the top-left
//   board position), as translate+scale with transform-origin 0 0.
//
// Cadence: 126 frames at 36 fps (data/animation.json `intro`, A3-timing §1);
// the CSS duration is `calc(126s / 36)` and the keyframes are step-held
// (`steps(1, end)`) so the app shows exactly the SWF frame's value during its
// 1/36 s slot, like the reference's per-frame Move tags.
// ---------------------------------------------------------------------------

/** Root class added to each animated intro element for the boot timeline. */
export const INTRO_RUN_CLASS = 'e3-intro-run';
/** The sun's colour-transform overlay (child of the `intro_glow` element). */
export const INTRO_GLOW_TINT_CLASS = 'e3-intro-glow-tint';

/** Boot-sequence timings in ms (derived from the A3 catalog, Y8/O23). */
export function bootTimingsMs(): { preloaderMs: number; introMs: number } {
  const preloader = ANIMATION_SEQUENCES.find((sequence) => sequence.id === 'preloader');
  const intro = ANIMATION_SEQUENCES.find((sequence) => sequence.id === 'intro');
  if (preloader === undefined || intro === undefined) {
    throw new Error('data/animation.json is missing the preloader/intro sequences');
  }
  return {
    preloaderMs: preloader.durationMs,
    introMs: intro.durationMs,
  };
}

function sequenceElementsById(id: string): readonly string[] {
  return ANIMATION_SEQUENCES.find((sequence) => sequence.id === id)?.elements ?? [];
}

/**
 * Boot presentation layer (task Y8). During `preloader`/`main` the board
 * layout stays mounted underneath (so the board DOM/geometry is available from
 * the first paint — the E2 V7 layout check samples it) and the boot layer is
 * raised above it with {@link BOOT_LAYER_CLASS}; the intro's night backdrop and
 * ground are opaque and cover the board completely.
 *
 * Board view of the `main` boot state (intro animation start, frames 5–130):
 * the board elements first, then the intro elements (their `data-element` ids
 * repeat for `intro_backdrop`/`intro_glow`/`intro_logo`/`logo_ornament`; the
 * controller animates the *last* node per id, i.e. the boot layer, while the
 * first node keeps the A3 catalog rect for the layout check).
 */
export function introBoardView(): BoardView {
  return { elements: [...sequenceElementsById('board'), ...sequenceElementsById('intro')] };
}

/** Board view of the `preloader` boot state (frames 1–4: night sky + loader). */
export function preloaderBoardView(): BoardView {
  return { elements: [...sequenceElementsById('board'), ...sequenceElementsById('preloader')] };
}

/**
 * Static alpha values of the preloader frames (frames 2–4), applied while the
 * FSM is in `preloader` so the boot starts on the same night-sky state the
 * intro's frame 5 continues from (the intro animation then animates `opacity`).
 * evidence: tags.xml PlaceObject2 placements — intro_sky depth 5 alpha 36/256,
 * intro_layer3 depth 9 alpha 51/256, logo_ornament depth 3 alpha 125/256.
 */
const PRELOADER_ALPHAS: Readonly<Record<string, number>> = Object.freeze({
  intro_sky: 36 / 256,
  intro_layer3: 51 / 256,
  logo_ornament: 125 / 256,
});

/** Marker class on each boot layer node (stacking via the wrapper below). */
export const BOOT_LAYER_CLASS = 'e3-boot-layer';
/** Class of the wrapper that raises the boot layer above the board layout. */
export const BOOT_LAYER_ROOT_CLASS = 'e3-boot-layer-root';

/**
 * Natural SVG box of the falling-wordmark overlay (intro_logo, ch29):
 * the element is laid out at its natural size and animated with a
 * translate+scale transform (frames 41–130) so the vector art stays crisp
 * (a transform-only track; no rasterization).
 * evidence: tags.xml DefineSpriteTag 29 geometry 375.4×104.6;
 * evidence/Y8-intro-series.json `logo` track (frame 41: tx 5356, ty −900,
 * scale 0.78867 → box translate 119.77, −86.25).
 */
const INTRO_LOGO_OVERLAY = { w: 375.4, h: 104.6 };

/** Elements carrying an intro timeline animation (see the section header). */
const INTRO_ANIMATED_ELEMENTS: readonly string[] = [
  'intro_sky',
  'intro_layer3',
  'intro_glow',
  'intro_logo',
];

const WORDBALL_GETIR_CLASS = 'e3-wordball-getir';
const WORDBALL_GOTUR_CLASS = 'e3-wordball-gotur';
/** Remove-time fallback when `animationend` never fires (hidden page). */
const GOTUR_FALLBACK_MS = 1000;

/** Ball element id pattern (`wordball0`, `wordball0-shadow` excluded). */
const WORDBALL_ELEMENT = /^wordball(\d+)$/;

/**
 * E3 stylesheet, injected at controller creation (same pattern as E2's board
 * stylesheet; keeps `tsc` free of CSS-module ambient declarations).
 */
const ANIMATION_CSS_MODULES = (
  import.meta as unknown as {
    glob: (
      pattern: string,
      options: { eager: boolean; query: string; import: string },
    ) => Record<string, string>;
  }
).glob('../styles/animations.css', { eager: true, query: '?raw', import: 'default' });

const ANIMATION_CSS = Object.values(ANIMATION_CSS_MODULES)[0] ?? '';

const ANIMATION_STYLE_ID = 'e3-animation-styles';

function installAnimationStylesheet(doc: Document): void {
  if (doc.getElementById(ANIMATION_STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = ANIMATION_STYLE_ID;
  style.textContent = ANIMATION_CSS;
  doc.head.appendChild(style);
}

/** Options for {@link createAnimationController}. */
export interface AnimationControllerOptions {
  /** E2's board element (carries the `data-element` nodes). */
  readonly board: HTMLElement;
}

/** One pre-render wordball snapshot (for the remove slide-out ghost). */
interface StashedBall {
  readonly index: number;
  readonly node: HTMLElement;
  readonly left: string;
  readonly top: string;
}

/**
 * Presentation-only animation controller. Every method is an observer of a D5
 * lifecycle output (or the D4 audio hand-off); none of them read or write game
 * state. `plays`/`lastSequence` record which catalogued sequences were
 * triggered (test hooks; the visual effect is per-sequence).
 */
export interface AnimationController {
  /** Per-sequence trigger count. */
  readonly plays: Readonly<Record<string, number>>;
  /** Last triggered catalogued sequence id. */
  readonly lastSequence: string | null;
  /** Snapshot the pre-repaint wordball DOM (call before `board.apply`). */
  beforeRender(): void;
  /**
   * Diff the entry against the previous render, start the wordball slides and
   * (task Y8) arm the boot-frame visuals: static preloader alphas while the FSM
   * is in `preloader`, the step-held intro timeline when it enters `main`.
   */
  afterRender(snapshot: { readonly entry: string; readonly state: GameState }): void;
  /** D5 `onStateChanged`. */
  stateChanged(change: { readonly previous: GameState; readonly state: GameState }): void;
  /** D5 `onRoundStarted`. */
  roundStarted(): void;
  /** D5 `onRoundCompleted`. */
  roundCompleted(reason: CompletionReason): void;
  /** D5 `onTick`. */
  tick(remainingSeconds: number): void;
  /** D4 sound event (via the D5 `playAudio` hand-off). */
  audio(event: string): void;
}

/** Create the app-wide animation controller and install the E3 stylesheet. */
export function createAnimationController(
  options: AnimationControllerOptions,
): AnimationController {
  installAnimationStylesheet(document);

  const board = options.board;
  const plays: Record<string, number> = {};
  let lastSequence: string | null = null;
  let previousEntry: string | null = null;
  let stashedBalls: StashedBall[] = [];

  function record(sequenceId: string): void {
    plays[sequenceId] = (plays[sequenceId] ?? 0) + 1;
    lastSequence = sequenceId;
  }

  function recordLifecycle(
    source: LifecycleEventName | 'audio',
    matches: (trigger: AnimationTrigger) => boolean,
  ): void {
    for (const [sequenceId, trigger] of Object.entries(SEQUENCE_TRIGGERS)) {
      if (trigger.source === source && matches(trigger)) record(sequenceId);
    }
  }

  function startGetir(ball: HTMLElement): void {
    ball.dataset.anim = 'getir';
    ball.classList.add(WORDBALL_GETIR_CLASS);
    ball.addEventListener('animationend', () => ball.classList.remove(WORDBALL_GETIR_CLASS), {
      once: true,
    });
  }

  function startGotur(stashed: StashedBall): void {
    const ghost = stashed.node;
    ghost.dataset.element = `wordball${stashed.index}-ghost`;
    ghost.dataset.anim = 'gotur';
    ghost.style.left = stashed.left;
    ghost.style.top = stashed.top;
    ghost.classList.add(WORDBALL_GOTUR_CLASS);
    const remove = (): void => ghost.remove();
    ghost.addEventListener('animationend', remove, { once: true });
    window.setTimeout(remove, GOTUR_FALLBACK_MS);
    board.appendChild(ghost);
  }

  // --- Y8 boot intro visuals (see the section header) ----------------------

  /**
   * The boot-layer node of an element id. During boot the board view renders
   * the id first (catalog rect) and the boot view appends its own node; the
   * controller always drives the last node, leaving the first untouched for
   * the layout cross-check.
   */
  function introElement(id: string): HTMLElement | null {
    const nodes = board.querySelectorAll(`[data-element="${id}"]`);
    const node = nodes[nodes.length - 1];
    return node instanceof HTMLElement ? node : null;
  }

  /**
   * Board controls are placed at SWF frame 131 only (the intro frames have no
   * board elements), so their state markers are cleared while the boot layer is
   * up: the mounted board layout is not painted and the speaker sprite has not
   * been placed yet.
   */
  function clearBoardStateMarkers(): void {
    const speaker = board.querySelector<HTMLElement>('[data-element="btn_speaker"]');
    if (speaker !== null) speaker.removeAttribute('data-speaker');
  }

  /** Every boot-layer node id of the `preloader` and `intro` sequences. */
  function bootLayerIds(state: GameState): readonly string[] {
    if (state === 'preloader') return sequenceElementsById('preloader');
    return sequenceElementsById('intro');
  }

  /**
   * Raise the boot layer above the mounted board layout: move the boot nodes
   * into a full-stage wrapper that is a single stacking context above the
   * board (their inline z-index values keep the reference depth order inside).
   * The board's own copies of shared ids stay where the renderer put them, so
   * the E2 V7 layout check still samples the catalog geometry first.
   */
  function markBootLayer(state: GameState): void {
    let wrapper = board.querySelector<HTMLElement>(`.${BOOT_LAYER_ROOT_CLASS}`);
    if (wrapper === null) {
      wrapper = document.createElement('div');
      wrapper.className = BOOT_LAYER_ROOT_CLASS;
      board.appendChild(wrapper);
    }
    for (const id of bootLayerIds(state)) {
      const node = introElement(id);
      if (node !== null) {
        node.classList.add(BOOT_LAYER_CLASS);
        if (node.parentElement !== wrapper) wrapper.appendChild(node);
      }
    }
  }

  /**
   * Preloader frames (2–4): the night-sky layers carry their SWF placement
   * alphas before the `main` animation takes over (`opacity` is animated from
   * these same values at frame 5, so the transition is seamless).
   */
  function applyPreloaderAlphas(): void {
    for (const [id, alpha] of Object.entries(PRELOADER_ALPHAS)) {
      const node = introElement(id);
      if (node !== null) node.style.opacity = String(alpha);
    }
  }

  /**
   * Arm the step-held CSS tracks on the rendered intro layers and attach the
   * sun's colour-transform overlay (idempotent: a board re-render creates new
   * nodes and the next `afterRender` re-arms them).
   */
  function startIntroVisuals(): void {
    // Static alphas first: the moon (logo_ornament) keeps its frame-2
    // placement alpha for the whole intro; the sky/layer3 inline values are
    // overridden by their animations (whose first keyframes carry the same
    // frame-5 values, so nothing flickers).
    applyPreloaderAlphas();
    for (const id of INTRO_ANIMATED_ELEMENTS) {
      const node = introElement(id);
      if (node !== null) {
        if (id === 'intro_logo') {
          // The overlay wordmark is laid out at its natural SVG size (the
          // transform track scales it); the board's catalog node above stays
          // untouched for the E2 V7 layout check.
          node.style.transformOrigin = '0 0';
          node.style.left = '0px';
          node.style.top = '0px';
          node.style.width = `${INTRO_LOGO_OVERLAY.w}px`;
          node.style.height = `${INTRO_LOGO_OVERLAY.h}px`;
          const image = node.querySelector('img');
          if (image instanceof HTMLImageElement) {
            image.style.width = `${INTRO_LOGO_OVERLAY.w}px`;
            image.style.height = `${INTRO_LOGO_OVERLAY.h}px`;
          }
        }
        node.classList.add(INTRO_RUN_CLASS);
      }
    }
    const glow = introElement('intro_glow');
    if (glow !== null && glow.querySelector(`.${INTRO_GLOW_TINT_CLASS}`) === null) {
      const tint = document.createElement('div');
      tint.className = INTRO_GLOW_TINT_CLASS;
      tint.dataset.element = 'intro_glow-tint';
      glow.appendChild(tint);
    }
  }

  /** The boot state transitioned into the boot visuals (`preloader`/`main`). */
  function applyBootVisuals(state: GameState): void {
    if (state === 'preloader') {
      markBootLayer(state);
      applyPreloaderAlphas();
      clearBoardStateMarkers();
      return;
    }
    if (state === 'main') {
      markBootLayer(state);
      startIntroVisuals();
      clearBoardStateMarkers();
      return;
    }
    // Left the boot states (first round live): the next board repaint already
    // dropped the intro nodes.
  }

  return {
    get plays(): Readonly<Record<string, number>> {
      return { ...plays };
    },
    get lastSequence(): string | null {
      return lastSequence;
    },

    beforeRender(): void {
      stashedBalls = [];
      for (const node of board.querySelectorAll<HTMLElement>('[data-element^="wordball"]')) {
        const match = WORDBALL_ELEMENT.exec(node.dataset.element ?? '');
        if (match === null) continue;
        stashedBalls.push({
          index: Number(match[1]),
          node: node.cloneNode(true) as HTMLElement,
          left: node.style.left,
          top: node.style.top,
        });
      }
    },

    afterRender(snapshot: { readonly entry: string; readonly state: GameState }): void {
      // Y8 boot-frame visuals first: the entry diff below may return early.
      applyBootVisuals(snapshot.state);
      const nextEntry = snapshot.entry;
      const previous = previousEntry;
      previousEntry = nextEntry;
      if (previous === null || previous === nextEntry) return;

      if (nextEntry.length > previous.length) {
        // Reference `duzenle("ekle")`: the new ball slides in ("getir").
        for (let index = previous.length; index < nextEntry.length; index += 1) {
          const ball = board.querySelector<HTMLElement>(`[data-element="wordball${index}"]`);
          if (ball !== null) startGetir(ball);
        }
      } else {
        // Reference `duzenle("sil"|"temizle")`: removed balls slide out
        // ("gotur") and are gone afterwards; the ghost reproduces the slide
        // because the board repaint has already removed their nodes.
        for (let index = nextEntry.length; index < previous.length; index += 1) {
          const stashed = stashedBalls.find((ball) => ball.index === index);
          if (stashed !== undefined) startGotur(stashed);
        }
      }
      record(WORDBALL_SEQUENCE_ID);
    },

    stateChanged(change): void {
      recordLifecycle('stateChanged', (trigger) => trigger.source === 'stateChanged' && trigger.state === change.state);
    },

    roundStarted(): void {
      recordLifecycle('roundStarted', () => true);
    },

    roundCompleted(reason): void {
      recordLifecycle(
        'roundCompleted',
        (trigger) => trigger.source === 'roundCompleted' && trigger.reason === reason,
      );
    },

    tick(remainingSeconds): void {
      recordLifecycle('tick', (trigger) => {
        if (trigger.source !== 'tick') return false;
        return (
          trigger.maxRemainingSeconds === undefined ||
          remainingSeconds <= trigger.maxRemainingSeconds
        );
      });
    },

    audio(event): void {
      recordLifecycle(
        'audio',
        (trigger) => trigger.source === 'audio' && trigger.events.includes(event),
      );
    },
  };
}

/** JSON-serializable catalog + trigger view for the e2e cross-checks (V2/V7). */
export interface AnimationCatalogEntry extends AnimationSequenceTiming {
  readonly trigger: AnimationTrigger | undefined;
}

/** Catalog snapshot consumed by `window.__animations` in the dev server. */
export function animationCatalog(): readonly AnimationCatalogEntry[] {
  return ANIMATION_SEQUENCES.map((sequence) => ({
    ...sequence,
    trigger: SEQUENCE_TRIGGERS[sequence.id],
  }));
}
