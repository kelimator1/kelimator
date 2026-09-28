// src/stage.ts — stage scaler, fullscreen and viewport handling.
// Spec: docs/04-architecture.md §2 (stage scaling) and §6 (test hooks).

/**
 * Logical stage size in stage pixels.
 * evidence: docs/04-architecture.md §2 ("Logical stage: 550 × 400 px");
 * docs/03-assets-and-visuals.md §4 ("Stage: 550 × 400 logical pixels (from SWF
 * header [CONFIRMED])"). Placeholder source data/constants.json stage.width /
 * stage.height (docs/02-mechanics-spec.md §8) carries the same values once A2
 * writes it; until then these documented values are used for layout only.
 */
export const STAGE_WIDTH = 550;
export const STAGE_HEIGHT = 400;

/**
 * Letterbox fill used until an extracted background color is available.
 * evidence: docs/04-architecture.md §2 ("site fallback `#9DAF48`");
 * docs/03-assets-and-visuals.md §4 ("The page letterbox color uses `#9DAF48`
 * (archived site background) unless A1 proves the reference stage color
 * differs; the extracted value wins"). An extracted value is supplied through
 * `StageOptions.letterbox`; never guessed here.
 */
export const LETTERBOX_FALLBACK = '#9DAF48';

export interface StageMetrics {
  viewportWidth: number;
  viewportHeight: number;
  stageWidth: number;
  stageHeight: number;
  /** Uniform scale: min(viewportWidth / stageWidth, viewportHeight / stageHeight). */
  scale: number;
  /** Horizontal letterbox margin in CSS px (centered both axes). */
  offsetX: number;
  /** Vertical letterbox margin in CSS px. */
  offsetY: number;
}

/**
 * Pure scaling math (docs/04-architecture.md §2): uniform scale that fits the
 * stage into the viewport, stage centered both axes.
 */
export function computeStageMetrics(
  viewportWidth: number,
  viewportHeight: number,
  stageWidth: number = STAGE_WIDTH,
  stageHeight: number = STAGE_HEIGHT,
): StageMetrics {
  const scale = Math.min(viewportWidth / stageWidth, viewportHeight / stageHeight);
  return {
    viewportWidth,
    viewportHeight,
    stageWidth,
    stageHeight,
    scale,
    offsetX: (viewportWidth - stageWidth * scale) / 2,
    offsetY: (viewportHeight - stageHeight * scale) / 2,
  };
}

export interface StageOptions {
  /** Logical stage width; defaults to STAGE_WIDTH (docs/04 §2). */
  width?: number;
  /** Logical stage height; defaults to STAGE_HEIGHT (docs/04 §2). */
  height?: number;
  /** Letterbox fill; defaults to LETTERBOX_FALLBACK (docs/04 §2). */
  letterbox?: string;
}

export interface StageHandle {
  readonly shell: HTMLElement;
  readonly root: HTMLElement;
  readonly fullscreenButton: HTMLButtonElement;
  /** Recompute + apply the current viewport metrics; returns them. */
  update(): StageMetrics;
  /** Enter fullscreen on the shell, or exit when already fullscreen. */
  toggleFullscreen(): Promise<void>;
  /** Detach listeners and remove the mounted DOM. */
  destroy(): void;
}

const STYLE_ID = 'stage-shell-styles';

function installStyleSheet(
  doc: Document,
  width: number,
  height: number,
  letterbox: string,
): void {
  const css = [
    'html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;' +
      ` background: ${letterbox}; }`,
    '[data-testid="stage-shell"] { position: fixed; inset: 0; overflow: hidden;' +
      ` background: ${letterbox}; }`,
    `[data-testid="stage-root"] { position: absolute; left: 0; top: 0; width: ${width}px;` +
      ` height: ${height}px; transform-origin: 0 0; }`,
    '[data-testid="fullscreen-button"] { position: absolute; top: 8px; right: 8px; z-index: 10; }',
  ].join('\n');

  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style === null) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = css;
}

/**
 * Mounts the stage shell (docs/04 §2, §6):
 * - `stage-shell`: viewport wrapper / letterbox (fixed, fills the viewport);
 * - `stage-root`: 550 × 400 logical root, scaled via `transform: scale(s)` and
 *   centered through the computed offsets;
 * - `fullscreen-button`: user-gesture element for `requestFullscreen()`.
 * Recomputes on `resize`, `orientationchange`, `fullscreenchange`; inside
 * fullscreen the shell's own dimensions feed the same formula (docs/04 §2).
 */
export function mountStage(options: StageOptions = {}): StageHandle {
  const width = options.width ?? STAGE_WIDTH;
  const height = options.height ?? STAGE_HEIGHT;
  const letterbox = options.letterbox ?? LETTERBOX_FALLBACK;

  installStyleSheet(document, width, height, letterbox);

  const shell = document.createElement('div');
  shell.dataset.testid = 'stage-shell';

  const root = document.createElement('div');
  root.dataset.testid = 'stage-root';

  const fullscreenButton = document.createElement('button');
  fullscreenButton.type = 'button';
  fullscreenButton.dataset.testid = 'fullscreen-button';
  fullscreenButton.textContent = 'Fullscreen';
  fullscreenButton.setAttribute('aria-label', 'Toggle fullscreen');

  document.body.appendChild(shell);
  shell.appendChild(root);
  shell.appendChild(fullscreenButton);

  const update = (): StageMetrics => {
    const viewportWidth = shell.clientWidth > 0 ? shell.clientWidth : window.innerWidth;
    const viewportHeight = shell.clientHeight > 0 ? shell.clientHeight : window.innerHeight;
    const metrics = computeStageMetrics(viewportWidth, viewportHeight, width, height);
    root.style.left = `${metrics.offsetX}px`;
    root.style.top = `${metrics.offsetY}px`;
    root.style.transform = `scale(${metrics.scale})`;
    return metrics;
  };

  const toggleFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
    } else {
      await shell.requestFullscreen();
    }
  };

  const onViewportChange = (): void => {
    update();
  };

  const onFullscreenClick = (): void => {
    toggleFullscreen().catch((error: unknown) => {
      console.warn('[stage] fullscreen request failed:', error);
    });
  };

  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  document.addEventListener('fullscreenchange', onViewportChange);
  fullscreenButton.addEventListener('click', onFullscreenClick);

  update();

  return {
    shell,
    root,
    fullscreenButton,
    update,
    toggleFullscreen,
    destroy(): void {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      document.removeEventListener('fullscreenchange', onViewportChange);
      fullscreenButton.removeEventListener('click', onFullscreenClick);
      shell.remove();
    },
  };
}
