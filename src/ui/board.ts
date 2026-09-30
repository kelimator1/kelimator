// src/ui/board.ts — stage layout rendering from src/data/layout.json
// (docs/04-architecture.md §4, docs/03-assets-and-visuals.md §4/§6).
//
// Static elements are rendered at the exact catalog coordinates; runtime
// duplicates (letter tiles, tile sockets, entry balls, found-word boxes) follow
// the frame_131 action script of the reference build
// (artifacts/decompiled/scripts/frame_131/DoAction.as) and the placements
// measured in the C3 reference captures (tests/fixtures/reference/).
//
// The gameplay core (D1–D5) does not exist yet. Visual states that show
// gameplay content are applied through the clearly-marked TEST-ONLY
// `apply-rendered-view` mechanism below; `src/main.ts` installs its hook only
// on the dev server (import.meta.env.DEV) and it carries no gameplay logic.
//
// evidence: docs/03 §3 (Verdana stack, numeric text tuning), §4 (550×400 stage,
// catalog placement); docs/07 §3–§5 (state matrix); evidence/A3-layout.md §3–§6;
// evidence/A1-fonts.md §3 (bold-italic label usage); E1 hand-off
// (evidence/E1-assets.md §7, §13).

import layoutCatalog from '../data/layout.json';
import animationCatalog from '../data/animation.json';

// ---------------------------------------------------------------------------
// Catalog types
// ---------------------------------------------------------------------------

export interface LayoutFont {
  family: string;
  size: number;
  bold: boolean;
  align: string;
}

export interface LayoutElement {
  id: string;
  kind: string;
  asset: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  font: LayoutFont;
  evidence: string;
}

interface LayoutCatalog {
  schemaVersion: number;
  stage: { width: number; height: number; background: string };
  elements: LayoutElement[];
}

interface AnimationSequence {
  id: string;
  elements: string[];
}

const CATALOG = layoutCatalog as unknown as LayoutCatalog;
const ELEMENTS_BY_ID = new Map<string, LayoutElement>(
  CATALOG.elements.map((element) => [element.id, element]),
);

// ---------------------------------------------------------------------------
// Reference-observed geometry constants (frame_131/DoAction.as)
// ---------------------------------------------------------------------------

/** Letter-tile / socket runtime grid: `_X = 60 + j*60`, `_Y = 330` (DoAction.as 99–104). */
const GRID_X0 = 60;
const GRID_PITCH = 60;
const GRID_Y = 330;

/**
 * Reference-observed sub-pixel corrections (numeric layout values; recorded in
 * evidence/E2-layout.md). Measured by minimizing the >60 RGB-distance
 * mismatch against tests/fixtures/reference/S2-idle-board.png: the runtime
 * grid sits ~0.25 px higher and the letter glyph run ~0.25 px right of the
 * nominal positions; the bottom button row sits 0.5 px higher.
 *
 * The former per-element table (`ELEMENT_DELTA`) carried entries only for the
 * two credit sprites (credit_line/credit_site, +0.25/−0.25 px; E2-layout.md
 * §7). Task Y2 omits those sprites from the render (OMITTED_ELEMENTS below),
 * so the table and its two lookups were removed with the now-dead entries.
 */
const GRID_DY = 0;
const LETTER_DX = 0;

/** Wordball entry row: `_X = i*40 + (550 - t*40)/2 + 10`, `_Y = 263` (DoAction.as 379–396). */
const ENTRY_PITCH = 40;
const ENTRY_Y = 263;

/** Found-word box row origin: `fx = 10`, `dx = 2`, `sx = 10`, `dy = 53`, `sy = 16` (DoAction.as 232–243). */
const BOX_DY = 53;
const BOX_SY = 16;
const BOX_HEIGHT = 14;

/**
 * Timeout-reveal text colour. Reference `tamamla()`
 * (artifacts/decompiled/scripts/frame_131/DoAction.as L568–570) writes every
 * listed-but-unfound word into the row and sets `d.textColor = 16737792`
 * (#ff6600) on it; words already found by the player keep the default field
 * colour (black — measured on both sides at F2's `38-valid` control step,
 * evidence/F2-playthrough.md §6). evidence: evidence/X4-reveal-colour.md §2.
 */
const REVEALED_SLOT_COLOR = '#ff6600';

/**
 * Found-word field geometry from the `tablociz()` accumulation in
 * frame_131/DoAction.as (fx starts at 10, dx = 2, sx = 10): rows 3..8 at
 * x = 36/70/112/162/220/286 with widths 32/40/48/56/64/72 (rounded to 0.01 px
 * by the catalog convention). Runtime-observed reference adds the 1 px border
 * frame measured in the C3 captures (box ink 36..68 / 53..67 for row 3).
 */
export const BOX_ROWS: readonly { len: number; x: number; w: number }[] = (() => {
  const rows: { len: number; x: number; w: number }[] = [];
  let fx = 10;
  const dx = 2;
  const sx = 10;
  for (let i = 3; i <= 8; i++) {
    fx += (i - 1) * sx + dx - (i - 5) * dx;
    rows.push({ len: i, x: fx, w: i * sx - (i - 4) * dx });
  }
  return rows;
})();

// ---------------------------------------------------------------------------
// Board view model (TEST-ONLY observed states are supplied by tests/e2e)
// ---------------------------------------------------------------------------

export interface RectOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface TileView {
  visible: boolean;
  letter: string;
}

export interface FoundWordView {
  /** Word length 3..8 = box row. */
  len: number;
  /** Zero-based slot in the row. */
  index: number;
  text: string;
  /** True when filled by the timeout reveal (`tamamla()`), not by the player. */
  revealed?: boolean;
}

export interface BoardView {
  /** Layout element ids rendered as-is (reference-observed visible set). */
  elements: readonly string[];
  /** Observed position/size overrides (intro motion frame S1). */
  overrides?: Readonly<Record<string, RectOverride>>;
  /** Eight letter-tile slots; `false` leaves the socket visible. */
  tiles?: readonly TileView[];
  /** Number of found-word boxes per row (length 3..8), max 10 (DoAction.as 81–86). */
  slotCounts?: readonly number[];
  /** Found words placed in the box grid. */
  found?: readonly FoundWordView[];
  /** Letters currently entered on the wordball row (in order). */
  entry?: string;
  /** Remaining-word counters (b3..b8). */
  counts?: readonly string[];
  /** Score field (var 'puan'). */
  score?: string;
  /** Timer: seconds remaining of total (gauge fraction remaining/total). */
  timer?: { remaining: number; total: number };
}

// ---------------------------------------------------------------------------
// Style tables
// ---------------------------------------------------------------------------

const FONT_STACK = 'Verdana, "DejaVu Sans", sans-serif';

/**
 * Text elements rendered in the build's bold-italic face (font 126):
 * DefineEditText ids 127, 128, 129, 130, 143, 144.
 * evidence: evidence/A1-fonts.md §3 (usage map).
 */
const BOLD_ITALIC_TEXT_IDS = new Set([
  'label_puan_black',
  'label_puan_orange',
  'label_sure_black',
  'label_sure_orange',
  'label_kelime_black',
  'label_kelime_orange',
]);

/**
 * Glyph colors for static text elements. The catalog schema carries no color
 * field; values are read from the C3 reference captures (dominant glyph color
 * in tests/fixtures/reference/S2-idle-board.png) and the build's own text
 * records (`textColor`, evidence/A1-fonts.md §3 / A2-strings).
 */
const TEXT_COLOR: Readonly<Record<string, string>> = {
  label_puan_orange: '#ff6600',
  label_sure_orange: '#ff6600',
  label_kelime_orange: '#ff6600',
};

/**
 * Numeric text-style tuning (allowed by task E2 step 2: font-size, line-height,
 * letter-spacing only). Values are calibrated against the C3 reference
 * captures; every change and its before/after diff ratio is recorded in
 * evidence/E2-layout.md.
 */
interface TextStyle {
  size?: number;
  lineHeight?: number;
  letterSpacing?: number;
  /** Left inset of the glyph run inside the catalog field (Flash text margins are not in the catalog). */
  indent?: number;
  /** Right inset for right-aligned fields. */
  insetRight?: number;
}

const TEXT_STYLE: Readonly<Record<string, TextStyle>> = {
  label_harf_3: { size: 8.6, letterSpacing: -0.1, lineHeight: 17, indent: 2 },
  label_harf_4: { size: 8.6, letterSpacing: -0.1, lineHeight: 17, indent: 2 },
  label_harf_5: { size: 8.6, letterSpacing: -0.1, lineHeight: 17, indent: 2 },
  label_harf_6: { size: 8.6, letterSpacing: -0.1, lineHeight: 17, indent: 2 },
  label_harf_7: { size: 8.6, letterSpacing: -0.1, lineHeight: 17, indent: 2 },
  label_harf_8: { size: 8.6, letterSpacing: -0.1, lineHeight: 17, indent: 2 },
  count_3: { size: 7.5, letterSpacing: -0.4, lineHeight: 16, insetRight: 3 },
  count_4: { size: 7.5, letterSpacing: -0.4, lineHeight: 16, insetRight: 3 },
  count_5: { size: 7.5, letterSpacing: -0.4, lineHeight: 16, insetRight: 3 },
  count_6: { size: 7.5, letterSpacing: -0.4, lineHeight: 16, insetRight: 3 },
  count_7: { size: 7.5, letterSpacing: -0.4, lineHeight: 16, insetRight: 3 },
  count_8: { size: 7.5, letterSpacing: -0.4, lineHeight: 16, insetRight: 3 },
  label_puan_black: { size: 14, letterSpacing: 0, lineHeight: 21 },
  label_puan_orange: { size: 14, letterSpacing: 0, lineHeight: 21 },
  label_sure_black: { size: 15, letterSpacing: 0, lineHeight: 20 },
  label_sure_orange: { size: 15, letterSpacing: 0, lineHeight: 20 },
  label_kelime_black: { size: 14.5, letterSpacing: 0, lineHeight: 20 },
  label_kelime_orange: { size: 14.5, letterSpacing: 0, lineHeight: 20 },
  score_value: { size: 14, letterSpacing: 0, lineHeight: 21, insetRight: 2 },
  timer_value: { size: 8, letterSpacing: 0, lineHeight: 14 },
};

/**
 * Ball art (wordball runtime duplicate): the FFDec export of sprite 45 carries
 * zero-opacity gradient stops (evidence/E1-assets.md §11.2 lists s46 as blank),
 * so the reference-observed glossy red ball is recreated with sampled colors
 * from the C3 captures (tests/fixtures/reference/S4-partial-entry.png).
 */
const BALL_DIAMETER = 36;
const BALL_CENTER_OFFSET_X = -2.5;
const BALL_CENTER_OFFSET_Y = -0.5;

/**
 * Intro glow ("sun"): the FFDec export of shape 20 loses the SWF's focal
 * gradient — the browser render is a pale disc (247,239,148 at r≈31) while the
 * reference capture shows the saturated core (242,202,31) → (248,213,118) at
 * r≈31 with a soft falloff. The glow is therefore recreated from the C3
 * reference profile (tests/fixtures/reference/S1-boot.png, row y=66), radius =
 * sprite half-width 46.75. Sampled stops are recorded in evidence/E2-layout.md.
 */
const GLOW_GRADIENT =
  'radial-gradient(circle closest-side, #f2ca1f 0%, #f4cc33 16%, #f5cf49 33%, #f6d260 50%, #f8d576 67%, rgba(248,213,118,0.97) 72%, rgba(248,213,118,0.8) 82%, rgba(248,213,118,0.45) 89%, rgba(248,213,118,0) 100%)';

/** Timer gauge geometry: red face 18×107 at (514.3, 83.85) with the frame svg below (s76). */
const TIMER_BAR = { x: 514.3, y: 83.85, w: 24.05, h: 108 };
const TIMER_RED = { x: 514.8, y: 84.35, w: 18, h: 107 };

// ---------------------------------------------------------------------------
// Asset resolution (Vite dev + build)
// ---------------------------------------------------------------------------

declare global {
  interface ImportMeta {
    glob: (
      pattern: string,
      options?: { eager?: boolean; query?: string; import?: string },
    ) => Record<string, string | Record<string, string>>;
  }
}

const ASSET_URLS = import.meta.glob('../assets/**/*.{svg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const ASSET_RAW_SVGS = import.meta.glob('../assets/svg/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

/** Maps the catalog `asset` path (`src/assets/...`) to an emitted asset URL. */
function assetUrl(repoRelativePath: string): string {
  const key = `../${repoRelativePath.replace(/^src\//, '')}`;
  const value = ASSET_URLS[key];
  return typeof value === 'string' ? value : repoRelativePath;
}

function assetRawSvg(repoRelativePath: string): string | undefined {
  const key = `../${repoRelativePath.replace(/^src\//, '')}`;
  const value = ASSET_RAW_SVGS[key];
  return typeof value === 'string' ? value : undefined;
}

// ---------------------------------------------------------------------------
// Catalog evidence parsing (registration points for runtime duplicates)
// ---------------------------------------------------------------------------

function parseDepth(evidence: string): number {
  const match = /depth=(\d+)/.exec(evidence);
  return match ? Number(match[1]) : 0;
}

function parseRegistration(evidence: string): { tx: number; ty: number } {
  const match = /tx=(-?[\d.]+)\s+ty=(-?[\d.]+)/.exec(evidence);
  if (match === null) {
    return { tx: 0, ty: 0 };
  }
  return { tx: Number(match[1]), ty: Number(match[2]) };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const STYLE_ID = 'board-styles';

function installStyleSheet(doc: Document): void {
  const css = `
[data-testid="board"] { position: absolute; left: 0; top: 0; width: ${CATALOG.stage.width}px; height: ${CATALOG.stage.height}px; overflow: hidden; background: ${CATALOG.stage.background}; }
[data-testid="board"] * { margin: 0; padding: 0; box-sizing: border-box; }
.board-layer { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.board-svg { position: absolute; overflow: visible; }
.board-svg-inline { position: absolute; left: 0; top: 0; }
.board-svg-asset { display: block; position: absolute; left: 0; top: 0; }
.board-glow { position: absolute; border-radius: 50%; background: ${GLOW_GRADIENT}; }
.board-text { position: absolute; display: block; white-space: pre; overflow: visible; }
.board-slot { position: absolute; border: none; background: #fff; font-family: ${FONT_STACK}; font-size: 10px; font-weight: 700; color: #000; overflow: hidden; white-space: pre; }
.board-ball { position: absolute; border-radius: 50%; z-index: 21000; display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 50% 98%, rgba(255,205,205,0.95) 0%, rgba(255,170,170,0.65) 20%, rgba(255,140,140,0) 45%),
    radial-gradient(circle at 50% 10%, rgba(255,250,250,0.98) 0%, rgba(246,208,208,0.8) 10%, rgba(225,120,120,0.4) 26%, rgba(200,40,40,0) 46%),
    radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(70,0,0,0.55) 100%),
    radial-gradient(circle at 50% 50%, #c22c2c 0%, #b01a1a 50%, #8f0d0d 100%); }
.board-ball-letter { font-family: ${FONT_STACK}; font-size: 24px; font-weight: 700; color: #fff; line-height: 1; text-shadow: 0 1px 1px rgba(80,0,0,0.55); position: relative; top: -1px; }
.board-ball-shadow { position: absolute; border-radius: 50%; z-index: 20500; background: radial-gradient(circle, rgba(60,40,40,0.55) 0%, rgba(60,40,40,0.25) 60%, rgba(60,40,40,0) 100%); }
.board-timer-white { position: absolute; z-index: 50; background: #fff; }
.board-timer-red { position: absolute; z-index: 50; background: #f00; }
/* Task Y9: while the status message component shows a coloured state
   (frames 2/3), the frame-1 ball of this layer is replaced — hide it so the
   message's ball composites directly over the backdrop (the reference frame 2/3
   ball replaces frame 1; overlaying would double-blend the antialiased edge).
   The message owns the state and marks the shared stage root; this stylesheet
   owns hiding its own element. evidence: evidence/Y9-status-lamp.md §5. */
[data-testid="stage-root"][data-status-lamp="valid"] [data-element="status_ball"],
[data-testid="stage-root"][data-status-lamp="already-found"] [data-element="status_ball"] { visibility: hidden; }
`;
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style === null) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = css;
}

function resolvedRect(element: LayoutElement, override?: RectOverride): { x: number; y: number; w: number; h: number } {
  return {
    x: override?.x ?? element.x,
    y: override?.y ?? element.y,
    w: override?.w ?? element.w,
    h: override?.h ?? element.h,
  };
}

function applyRect(node: HTMLElement, rect: { x: number; y: number; w: number; h: number }): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  node.style.width = `${rect.w}px`;
  node.style.height = `${rect.h}px`;
}

function renderSvgElement(element: LayoutElement, rect: { x: number; y: number; w: number; h: number }): HTMLElement {
  // Placement box per the catalog (evidence/A3-layout.md §3: display bbox).
  const box = document.createElement('div');
  box.className = 'board-svg';
  applyRect(box, rect);
  box.style.zIndex = String(parseDepth(element.evidence));
  box.dataset.element = element.id;

  const raw = assetRawSvg(element.asset);
  if (raw !== undefined && raw.includes('<image')) {
    // Assets that embed a raster (s48 board backdrop with bitmap 47; s90
    // speaker with bitmap 86). Rendered inline so the raster's sampling can be
    // pinned. Owner final presentation wave (task Y1): both assets carry the
    // owner-approved HD remaster payloads (8x WebP), so the E2-era `pixelated`
    // pin — which reproduced the reference's nearest-neighbor bitmap upscale
    // at integer device pixel ratios ≥ 2 (E2-layout.md §6.4) — is switched to
    // `smooth`: the HD payloads downscale with the browser's high-quality
    // filter. This is an owner-approved deviation from the reference texture;
    // derivation and measurements: evidence/Y1-remaster.md §3/§6.
    // evidence: evidence/Y1-remaster.md (owner-approved HD remaster allowance)
    const holder = document.createElement('div');
    holder.className = 'board-svg-inline';
    holder.innerHTML = raw;
    const svg = holder.querySelector('svg');
    if (svg !== null) {
      const naturalWidth = Number.parseFloat(svg.getAttribute('width') ?? '0');
      const naturalHeight = Number.parseFloat(svg.getAttribute('height') ?? '0');
      svg.setAttribute('width', `${rect.w}px`);
      if (naturalWidth > 0 && naturalHeight > 0) {
        svg.setAttribute('height', `${(rect.w * naturalHeight) / naturalWidth}px`);
      } else {
        svg.setAttribute('height', `${rect.h}px`);
      }
      svg.style.display = 'block';
      svg.style.position = 'absolute';
      svg.style.left = '0';
      svg.style.top = '0';
      const dpr = window.devicePixelRatio;
      if (Number.isInteger(dpr) && dpr >= 2) {
        svg.style.imageRendering = 'smooth';
        for (const image of Array.from(svg.querySelectorAll('image'))) {
          (image as SVGImageElement).style.imageRendering = 'smooth';
        }
      }
    }
    box.appendChild(holder);
    return box;
  }

  const img = document.createElement('img');
  img.className = 'board-svg-asset';
  img.src = assetUrl(element.asset);
  img.alt = '';
  img.draggable = false;
  box.appendChild(img);

  // FFDec SVG viewports carry the asset's natural aspect; the credit sprites
  // (omitted from the render by task Y2) were the catalog's worst case, up to
  // 0.61 px taller than the computed boxes (evidence/A3-layout.md §7.2) which
  // would letterbox their content inside an <img> of the catalog box. Anchor
  // the asset at the box top-left and scale it uniformly to the box width so
  // the sprite renders at its own aspect, as the reference does. Applied on
  // load and for cached assets.
  const applyNaturalAspect = (): void => {
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    if (naturalWidth <= 0 || naturalHeight <= 0) {
      return;
    }
    img.style.width = `${rect.w}px`;
    img.style.height = `${(rect.w * naturalHeight) / naturalWidth}px`;
  };
  img.addEventListener('load', applyNaturalAspect);
  applyNaturalAspect();
  if (img.complete) {
    applyNaturalAspect();
  }
  return box;
}

function renderTextElement(
  element: LayoutElement,
  rect: { x: number; y: number; w: number; h: number },
  text: string,
): HTMLElement {
  const span = document.createElement('span');
  span.className = 'board-text';
  span.textContent = text;
  applyRect(span, rect);
  const style = span.style;
  style.fontFamily = FONT_STACK;
  style.color = TEXT_COLOR[element.id] ?? '#000';
  const tuning = TEXT_STYLE[element.id];
  const size = tuning?.size ?? element.font.size;
  if (size > 0) {
    style.fontSize = `${size}px`;
  }
  if (tuning?.size !== undefined && tuning.size !== element.font.size) {
    // Task E2 step 2: numeric font-size tuning is recorded per element.
    span.dataset.fontSizeTuned = String(tuning.size);
  }
  style.fontWeight = element.font.bold ? '700' : '400';
  style.fontStyle = BOLD_ITALIC_TEXT_IDS.has(element.id) ? 'italic' : 'normal';
  const align = element.font.align === '' ? 'left' : element.font.align;
  style.textAlign = align === 'right' ? 'right' : align === 'center' ? 'center' : 'left';
  style.lineHeight = `${size}px`;
  if (tuning !== undefined) {
    if (tuning.lineHeight !== undefined) {
      style.lineHeight = `${tuning.lineHeight}px`;
    }
    if (tuning.letterSpacing !== undefined) {
      style.letterSpacing = `${tuning.letterSpacing}px`;
    }
    if (tuning.indent !== undefined) {
      style.textIndent = `${tuning.indent}px`;
    }
    if (tuning.insetRight !== undefined) {
      style.paddingRight = `${tuning.insetRight}px`;
    }
  }
  style.zIndex = String(parseDepth(element.evidence));
  span.dataset.element = element.id;
  return span;
}

function textValue(element: LayoutElement, view: BoardView): string {
  switch (element.id) {
    case 'score_value':
      return view.score ?? '';
    case 'timer_value':
      return view.timer === undefined ? '' : String(view.timer.remaining);
    case 'count_3':
    case 'count_4':
    case 'count_5':
    case 'count_6':
    case 'count_7':
    case 'count_8': {
      const index = Number(element.id.slice('count_'.length)) - 3;
      return view.counts?.[index] ?? '';
    }
    default:
      return element.text;
  }
}

/** Runtime rect of a duplicated template: template rect shifted so its placement registration lands at (x, y). */
function duplicatedRect(templateId: string, x: number, y: number): { x: number; y: number; w: number; h: number } {
  const template = ELEMENTS_BY_ID.get(templateId);
  if (template === undefined) {
    throw new Error(`layout catalog is missing template "${templateId}"`);
  }
  const { tx, ty } = parseRegistration(template.evidence);
  return { x: x + (template.x - tx), y: y + (template.y - ty), w: template.w, h: template.h };
}

function createLayer(className: string): HTMLElement {
  const layer = document.createElement('div');
  layer.className = className;
  return layer;
}

/**
 * Owner-approved element omission (owner final presentation wave, task Y2,
 * 2026-09-29): the two site credit sprites — `credit_line` (DefineSprite_97,
 * "Diğer oyunlar") and `credit_site` (DefineSprite_103, "kelimator.com") —
 * are not rendered by the rebuild. The element loop below skips these ids
 * before any DOM node is created, so they leave no trace in the DOM. The
 * catalog entries (src/data/layout.json) and the processed SVG assets
 * (s97/s103) stay untouched as provenance.
 * evidence: owner directive `tasks/Y2-credit-omission.md` (owner-approved
 * omission region 0,367,105,36); docs/08-open-items.md "Owner final
 * presentation wave Y1–Y2"; reference provenance: evidence/A3-layout.md §6
 * (ink "Diğer oyunlar" 2–95/370–381, "kelimator.com" 3–100/386–397) and
 * evidence/E1-assets.md §7 (sprites DefineSprite_97/103 → s97/s103); absence
 * assertions: tests/e2e/visual.spec.ts "Y2 credit omission".
 */
/**
 * Owner-approved element omission (owner final presentation wave, task Y6,
 * 2026-09-29): the Top10 button — `btn_top10` (DefineButton2_108) — is not
 * rendered by the rebuild. The reference action opens the network high-score
 * page (`getURL("javascript:openWin('top10.php?r=822741','top10',400,360)")`,
 * artifacts/decompiled/scripts/DefineButton2_108/"BUTTONCONDACTION
 * on(release).as") and README §2.2 (fixed decision 2: no network features —
 * Top10 out of scope) excludes it, so the owner directive
 * `tasks/Y6-top10-omission.md` removes the button from the build mirroring the
 * Y2 credit omission: the element loop below skips the id before any DOM node
 * is created, so it leaves no trace in the DOM. The catalog entry
 * (src/data/layout.json) and the processed SVG asset (s108) stay untouched as
 * provenance.
 * evidence: owner directive `tasks/Y6-top10-omission.md` (owner-approved
 * omission region 419,372,91,23); docs/08-open-items.md "Wave follow-up Y6";
 * reference provenance: evidence/A3-layout.md §6 (button `btn_top10` ch=108
 * depth=44, display bbox (419.8,372.95)–(509.25,394.65), reference ink
 * (421,374)–(505,390) at dsf1) and evidence/E1-assets.md §7 (runtime mapping
 * `btn_top10` → `src/assets/svg/s108_btn_top10.svg`); absence assertions:
 * tests/e2e/visual.spec.ts (owner-omission test — the Y6 assertions share the
 * Y2 test so the visual suite stays at 18 tests, task Y6 VERIFY).
 */
const OMITTED_ELEMENTS: ReadonlySet<string> = new Set([
  'credit_line',
  'credit_site',
  'btn_top10',
]);

function renderStaticLayer(view: BoardView): HTMLElement {
  const layer = createLayer('board-layer board-static');
  for (const id of view.elements) {
    if (OMITTED_ELEMENTS.has(id)) {
      // Task Y2: skipped before any DOM node is created (no trace in the DOM).
      continue;
    }
    const element = ELEMENTS_BY_ID.get(id);
    if (element === undefined) {
      continue;
    }
    const rect = resolvedRect(element, view.overrides?.[id]);
    if (element.id === 'intro_glow') {
      // See GLOW_GRADIENT: the asset's exported gradient does not match the
      // reference; the glow is drawn from the sampled reference profile.
      const glow = document.createElement('div');
      glow.className = 'board-glow';
      applyRect(glow, rect);
      glow.style.zIndex = String(parseDepth(element.evidence));
      glow.dataset.element = element.id;
      layer.appendChild(glow);
    } else if (element.kind === 'text') {
      layer.appendChild(renderTextElement(element, rect, textValue(element, view)));
    } else {
      layer.appendChild(renderSvgElement(element, rect));
    }
  }
  return layer;
}

function renderSlots(view: BoardView): HTMLElement {
  const layer = createLayer('board-layer board-slots');
  const rows = BOX_ROWS;
  const hairline = 1 / (window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const count = view.slotCounts?.[rowIndex] ?? 0;
    for (let j = 0; j < count; j++) {
      const box = document.createElement('div');
      box.className = 'board-slot';
      box.style.left = `${row.x}px`;
      box.style.top = `${BOX_DY + j * BOX_SY}px`;
      // Reference capture: the text-field frame is a 1-device-pixel hairline
      // drawn on the field boundary (dsf1: 1 px at 36/68; dsf2: 1 device px =
      // 0.5 CSS px at 36/68.5). CSS borders and inset shadows are clamped /
      // snapped at fractional widths, so the frame is painted as four
      // background bands anchored at integer offsets from the top-left.
      box.style.width = `${row.w + hairline}px`;
      box.style.height = `${BOX_HEIGHT + hairline}px`;
      box.style.background = [
        `linear-gradient(#000, #000) 0 0 / ${hairline}px 100% no-repeat`,
        `linear-gradient(#000, #000) ${row.w}px 0 / ${hairline}px 100% no-repeat`,
        `linear-gradient(#000, #000) 0 0 / 100% ${hairline}px no-repeat`,
        `linear-gradient(#000, #000) 0 ${BOX_HEIGHT}px / 100% ${hairline}px no-repeat`,
        '#fff',
      ].join(', ');
      box.style.zIndex = String(20 + rowIndex * 10 + j);
      box.dataset.element = `slot_${row.len}_${j}`;
      const found = view.found?.find((word) => word.len === row.len && word.index === j);
      if (found !== undefined) {
        box.textContent = found.text;
        if (found.revealed === true) {
          // Timeout reveal (`tamamla()` L568–570): unfound listed words render
          // #ff6600; player-found words keep the field's default black.
          box.style.color = REVEALED_SLOT_COLOR;
        }
      }
      layer.appendChild(box);
    }
  }
  return layer;
}

function renderSockets(): HTMLElement {
  const layer = createLayer('board-layer board-sockets');
  for (let j = 0; j < 8; j++) {
    const template = ELEMENTS_BY_ID.get('tile_socket');
    if (template === undefined) {
      break;
    }
    const rect = duplicatedRect('tile_socket', GRID_X0 + j * GRID_PITCH, GRID_Y + GRID_DY);
    const node = renderSvgElement(template, rect);
    node.dataset.element = `bosbuton${j}`;
    node.style.zIndex = String(16384 + 108 + j);
    layer.appendChild(node);
  }
  return layer;
}

function renderTiles(view: BoardView): HTMLElement {
  const layer = createLayer('board-layer board-tiles');
  const tiles = view.tiles ?? [];
  for (let j = 0; j < tiles.length; j++) {
    const tile = tiles[j]!;
    if (!tile.visible) {
      continue;
    }
    const template = ELEMENTS_BY_ID.get('letter_tile');
    if (template === undefined) {
      break;
    }
    const rect = duplicatedRect('letter_tile', GRID_X0 + j * GRID_PITCH, GRID_Y + GRID_DY);
    const node = renderSvgElement(template, rect);
    node.dataset.element = `button${j}`;
    node.style.zIndex = String(16384 + 208 + j);
    layer.appendChild(node);

    // Letter field (DefineEditText 52: Verdana bold 22 px, centered; tags.xml).
    const letter = document.createElement('span');
    letter.className = 'board-text';
    letter.dataset.element = `letter${j}`;
    letter.textContent = tile.letter;
    // X1 (owner defect 1): the letter field sits directly over the tile's
    // clickable center (60×19 px box centered on the slot registration point)
    // and the delegation in src/main.ts routes only `buttonN` targets, so a
    // hit on this label was dropped. Chosen mechanism (single delegation
    // path): the label is transparent to pointer events, so every click
    // reaches the `buttonN` node naturally — no `letterN → buttonN` mapping
    // in the handler. evidence: evidence/X1-tile-click.md §2.
    letter.style.pointerEvents = 'none';
    letter.style.zIndex = String(16384 + 300 + j);
    letter.style.fontFamily = FONT_STACK;
    letter.style.fontSize = '24px';
    letter.style.fontWeight = '700';
    letter.style.textAlign = 'center';
    letter.style.lineHeight = '19px';
    letter.style.width = '60px';
    letter.style.left = `${GRID_X0 + j * GRID_PITCH - 30 + LETTER_DX}px`;
    letter.style.top = `${GRID_Y - 11 + GRID_DY}px`;
    layer.appendChild(letter);
  }
  return layer;
}

function renderEntry(view: BoardView): HTMLElement {
  const layer = createLayer('board-layer board-entry');
  const letters = view.entry ?? '';
  if (letters.length === 0) {
    return layer;
  }
  const x0 = (CATALOG.stage.width - letters.length * ENTRY_PITCH) / 2 + 10;
  for (let i = 0; i < letters.length; i++) {
    const centerX = i * ENTRY_PITCH + x0 + BALL_CENTER_OFFSET_X;
    const centerY = ENTRY_Y + BALL_CENTER_OFFSET_Y;

    const shadow = document.createElement('div');
    shadow.className = 'board-ball-shadow';
    const shadowSize = BALL_DIAMETER + 10;
    shadow.style.left = `${centerX - shadowSize / 2}px`;
    shadow.style.top = `${centerY - shadowSize / 2}px`;
    shadow.style.width = `${shadowSize}px`;
    shadow.style.height = `${shadowSize}px`;
    shadow.dataset.element = `wordball${i}-shadow`;
    layer.appendChild(shadow);

    const ball = document.createElement('div');
    ball.className = 'board-ball';
    ball.style.left = `${centerX - BALL_DIAMETER / 2}px`;
    ball.style.top = `${centerY - BALL_DIAMETER / 2}px`;
    ball.style.width = `${BALL_DIAMETER}px`;
    ball.style.height = `${BALL_DIAMETER}px`;
    ball.dataset.element = `wordball${i}`;

    const letter = document.createElement('span');
    letter.className = 'board-ball-letter';
    letter.textContent = letters[i]!;
    ball.appendChild(letter);
    layer.appendChild(ball);
  }
  return layer;
}

function renderTimerGauge(view: BoardView): HTMLElement {
  const layer = createLayer('board-layer board-gauge');
  if (view.timer === undefined) {
    return layer;
  }
  const fraction = Math.max(0, Math.min(1, view.timer.remaining / view.timer.total));
  const redHeight = TIMER_RED.h * fraction;
  const redTop = TIMER_RED.y + TIMER_RED.h - redHeight;

  const white = document.createElement('div');
  white.className = 'board-timer-white';
  white.style.left = `${TIMER_RED.x}px`;
  white.style.top = `${TIMER_RED.y}px`;
  white.style.width = `${TIMER_RED.w}px`;
  white.style.height = `${TIMER_RED.h - redHeight}px`;
  white.dataset.element = 'timer-bar-white';
  layer.appendChild(white);

  const red = document.createElement('div');
  red.className = 'board-timer-red';
  red.style.left = `${TIMER_RED.x}px`;
  red.style.top = `${redTop}px`;
  red.style.width = `${TIMER_RED.w}px`;
  red.style.height = `${redHeight}px`;
  red.dataset.element = 'timer-bar-red';
  layer.appendChild(red);

  void TIMER_BAR;
  return layer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BoardHandle {
  readonly element: HTMLElement;
  /** Re-render the board for the given view (TEST-ONLY observed states included). */
  apply(view: BoardView): void;
  destroy(): void;
}

function sequenceElements(id: string): string[] {
  const sequences = (animationCatalog as unknown as { sequences: AnimationSequence[] }).sequences;
  const sequence = sequences.find((item) => item.id === id);
  return sequence === undefined ? [] : [...sequence.elements];
}

/**
 * Production default: the board-state element set of data/animation.json
 * (sequence "board") minus the two sprites whose first exported frame is not
 * what the reference shows at rest: `loading_banner` is stopped at its empty
 * frame 1 after loading (C3 S2 capture shows no banner) and `score_feedback`
 * only plays on a submission (its export is blank; E1 §11.2). Runtime
 * duplicates (tiles, sockets, balls, found-word boxes) arrive with gameplay.
 */
export function defaultBoardView(): BoardView {
  const hidden = new Set(['loading_banner', 'score_feedback']);
  return {
    elements: sequenceElements('board').filter((id) => !hidden.has(id)),
  };
}

/** Intro element set for the boot state (sequence "intro"). */
export function introSequenceElements(): readonly string[] {
  return sequenceElements('intro');
}

export function mountBoard(root: HTMLElement, initial?: BoardView): BoardHandle {
  installStyleSheet(document);

  const board = document.createElement('div');
  board.dataset.testid = 'board';
  root.appendChild(board);

  const apply = (view: BoardView): void => {
    board.textContent = '';
    board.appendChild(renderStaticLayer(view));
    board.appendChild(renderTimerGauge(view));
    board.appendChild(renderSlots(view));
    if (view.tiles !== undefined) {
      // Sockets and tiles are runtime duplicates created by frame_131 init();
      // they exist only once a round board is on stage.
      board.appendChild(renderSockets());
      board.appendChild(renderTiles(view));
    }
    board.appendChild(renderEntry(view));
  };

  apply(initial ?? defaultBoardView());

  return {
    element: board,
    apply,
    destroy(): void {
      board.remove();
    },
  };
}

export { GRID_PITCH, GRID_X0, GRID_Y, BOX_DY, BOX_SY, BOX_HEIGHT };
