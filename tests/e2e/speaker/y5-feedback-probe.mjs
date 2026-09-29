#!/usr/bin/env node
/**
 * tests/e2e/speaker/y5-feedback-probe.mjs — Y5 speaker immediate-feedback probe
 * (manual run; not part of `npm run e2e`).
 *
 * Task Y5 (owner follow-up): every click toggles the persisted volume reliably,
 * but the sprite icon did not repaint at click time (reference-faithful, C3
 * probe 0 px), so users re-clicked and an even click count flipped straight
 * back. Owner decision: flip the icon immediately on click; no debouncing.
 * This probe measures the fixed behavior click by click at deviceScaleFactor 1
 * and 2 against a running dev server (muted Chromium):
 *
 *   - immediate phase: click → read `data-speaker`, the frame-85 waves display
 *     and the persisted `kelimator.volume` inside the same event (no keyboard
 *     input, no re-render), plus element screenshots before/after;
 *   - grid phase: a 6x6 inset grid (36 points) over the element box, every
 *     point clicked, recording the persisted-volume parity and the icon state;
 *   - rapid phase: 5 quick clicks (100→0→100→0→100), same record.
 *
 * A `MutationObserver` on the board root counts board re-renders
 * (`board.apply` clears and re-creates the board's children); the probe
 * expects 0 across all clicks and also checks the speaker DOM node identity. A
 * one-shot capturing click listener records whether the click target resolved
 * to `btn_speaker` (the owner's 43/43 instrumented-click finding). 43 clicks
 * per dsf: 2 immediate + 36 grid + 5 rapid.
 *
 * Outputs: `evidence/visual/Y5/<label>/dsf<1|2>/` (screenshots + probe.json)
 * and `evidence/visual/Y5/probe-<label>.json` (combined summary). Exit code 0
 * iff every expectation of the fixed behavior holds on both dsf — the pre-fix
 * run is expected to exit 1 (the icon does not flip inside the click there).
 *
 * Usage:
 *   node tests/e2e/speaker/y5-feedback-probe.mjs [url] [prefix|postfix]
 *
 * Silent witness (EXECUTION.md §8): Chromium launches with `--mute-audio`;
 * nothing is played or decoded.
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareImages, decodePng, encodePng } from '../../../verify/diff/diff.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const OUT_ROOT = path.join(REPO, 'evidence', 'visual', 'Y5');
const URL = process.argv[2] ?? 'http://127.0.0.1:5273/';
const LABEL = process.argv[3] ?? 'prefix';
if (LABEL !== 'prefix' && LABEL !== 'postfix') {
  throw new Error(`label must be prefix|postfix, got ${LABEL}`);
}
const OUT = path.join(OUT_ROOT, LABEL);

const SPEAKER_SELECTOR = '[data-element="btn_speaker"]';
const BOARD_SELECTOR = '[data-testid="board"]';
/** Sprite 88 character 85 = the on-frame waves (tags.xml spriteId="88"). */
const WAVES_CHARACTER_ID = '85';
/** 6x6 inset grid = the owner's 36 grid points. */
const GRID = 6;
const GRID_MARGIN = 3; // CSS px inset from the element box edges
const RAPID_CLICKS = 5; // 100→0→100→0→100
const EXPECTED_CLICKS = 2 + GRID * GRID + RAPID_CLICKS; // 2 + 36 + 5 = 43 per dsf (owner instrumentation count)

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Nearest-neighbour zoom of a decoded image (evidence crops; no resampling). */
function zoom(image, factor) {
  const out = {
    width: image.width * factor,
    height: image.height * factor,
    data: new Uint8Array(image.width * factor * image.height * factor * 4),
  };
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor(x / factor));
      const sy = Math.min(image.height - 1, Math.floor(y / factor));
      const source = (sy * image.width + sx) * 4;
      out.data.set(image.data.subarray(source, source + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

/** The expected persisted volume for click `index` (boot default 100, 0/100 parity). */
function expectedVolumeAt(index) {
  return index % 2 === 0 ? '0' : '100';
}

/** Arm the no-render probe: board re-render counter + speaker node reference. */
async function armProbe(page) {
  await page.evaluate(
    ({ boardSelector, speakerSelector }) => {
      const board = globalThis.document.querySelector(boardSelector);
      const state = {
        boardMutations: 0,
        speaker: globalThis.document.querySelector(speakerSelector),
      };
      if (board instanceof globalThis.HTMLElement) {
        new globalThis.MutationObserver((records) => {
          state.boardMutations += records.length;
        }).observe(board, { childList: true });
      }
      globalThis.__y5 = state;
    },
    { boardSelector: BOARD_SELECTOR, speakerSelector: SPEAKER_SELECTOR },
  );
}

/** Arm a one-shot capturing click recorder for the next click (hit attribution). */
async function armHitRecorder(page, index, phase) {
  await page.evaluate(
    ({ speakerSelector, index: clickIndex, phase: clickPhase }) => {
      globalThis.__y5last = null;
      globalThis.document.addEventListener(
        'click',
        (event) => {
          const target = event.target;
          globalThis.__y5last = {
            index: clickIndex,
            phase: clickPhase,
            hitSpeaker:
              target instanceof globalThis.Element &&
              target.closest(speakerSelector) !== null,
          };
        },
        { capture: true, once: true },
      );
    },
    { speakerSelector: SPEAKER_SELECTOR, index, phase },
  );
}

/** One synchronous read of the speaker state + probe counters. */
async function readSpeakerState(page) {
  return page.evaluate(
    ({ speakerSelector, wavesCharacter }) => {
      const node = globalThis.document.querySelector(speakerSelector);
      const waves =
        node === null
          ? undefined
          : Array.from(node.querySelectorAll('use')).find((use) => {
              for (const attribute of Array.from(use.attributes)) {
                if (
                  attribute.name.toLowerCase() === 'ffdec:characterid' &&
                  attribute.value === wavesCharacter
                ) {
                  return true;
                }
              }
              return false;
            });
      const probe = globalThis.__y5;
      return {
        speakerState: node instanceof globalThis.HTMLElement ? (node.dataset.speaker ?? null) : null,
        wavesDisplay: waves === undefined ? null : globalThis.getComputedStyle(waves).display,
        storedVolume: globalThis.localStorage.getItem('kelimator.volume'),
        boardMutations: probe?.boardMutations ?? -1,
        sameSpeakerNode:
          probe !== undefined && probe.speaker !== null && probe.speaker === node,
        lastHit: globalThis.__y5last ?? null,
      };
    },
    { speakerSelector: SPEAKER_SELECTOR, wavesCharacter: WAVES_CHARACTER_ID },
  );
}

/** Click `click()` after arming the hit recorder; push the annotated record. */
async function recordClick(page, records, meta, click) {
  const expectedVolume = expectedVolumeAt(records.length);
  await armHitRecorder(page, records.length, meta.phase);
  await click();
  const read = await readSpeakerState(page);
  const iconExpected = expectedVolume === '0' ? 'off' : 'on';
  const record = {
    index: records.length,
    ...meta,
    expectedVolume,
    iconExpected,
    ...read,
    volumeToggled: read.storedVolume === expectedVolume,
    iconImmediate: read.speakerState === iconExpected,
    wavesConsistent: (read.speakerState === 'off') === (read.wavesDisplay === 'none'),
    noBoardRender: read.boardMutations === 0 && read.sameSpeakerNode === true,
    hitSpeaker: read.lastHit?.hitSpeaker === true,
  };
  records.push(record);
  return record;
}

async function runDsf(browser, dsf) {
  const dir = path.join(OUT, `dsf${dsf}`);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 550, height: 400 },
    deviceScaleFactor: dsf,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  try {
    await page.goto(URL);
    await page.waitForFunction(
      () => globalThis.__game !== undefined && globalThis.__game.state === 'playing',
    );
    await page.waitForFunction(
      (selector) =>
        globalThis.document.querySelector(selector)?.dataset.speaker === 'on',
      SPEAKER_SELECTOR,
    );
    await page.evaluate(async () => {
      await globalThis.document.fonts.ready;
      await new Promise((resolve) =>
        globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
      );
    });

    const speaker = page.locator(SPEAKER_SELECTOR);
    const box = await speaker.boundingBox();
    if (box === null) throw new Error('speaker element has no box');

    const onShot = await speaker.screenshot();
    await armProbe(page);
    const records = [];

    // Immediate phase: click, then read/screenshot before any other input.
    await recordClick(page, records, { phase: 'immediate', target: 'center' }, () =>
      speaker.click(),
    );
    const offShot = await speaker.screenshot();
    await recordClick(page, records, { phase: 'immediate', target: 'center' }, () =>
      speaker.click(),
    );
    const onRestoredShot = await speaker.screenshot();

    // Grid phase: 6x6 inset points across the element box.
    for (let i = 0; i < GRID * GRID; i += 1) {
      const col = i % GRID;
      const row = Math.floor(i / GRID);
      const x = box.x + GRID_MARGIN + ((box.width - 2 * GRID_MARGIN) * (col + 0.5)) / GRID;
      const y = box.y + GRID_MARGIN + ((box.height - 2 * GRID_MARGIN) * (row + 0.5)) / GRID;
      await recordClick(page, records, { phase: 'grid', row, col, x, y }, () =>
        page.mouse.click(x, y),
      );
    }

    // Rapid phase: 5 quick clicks at the element center.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (let i = 0; i < RAPID_CLICKS; i += 1) {
      await recordClick(page, records, { phase: 'rapid', x: cx, y: cy }, () =>
        page.mouse.click(cx, cy),
      );
    }

    const afterShot = await speaker.screenshot();
    const finalRead = await readSpeakerState(page);

    const factor = dsf === 1 ? 8 : 4;
    const files = {
      on: { file: 'on.png', bytes: onShot, sha256: sha256(onShot) },
      off: { file: 'off.png', bytes: offShot, sha256: sha256(offShot) },
      onRestored: {
        file: 'on-restored.png',
        bytes: onRestoredShot,
        sha256: sha256(onRestoredShot),
      },
      after43: { file: 'after-43.png', bytes: afterShot, sha256: sha256(afterShot) },
      onZoom: {
        file: 'on-zoom.png',
        bytes: encodePng(zoom(decodePng(onShot), factor)),
        factor,
      },
      offZoom: {
        file: 'off-zoom.png',
        bytes: encodePng(zoom(decodePng(offShot), factor)),
        factor,
      },
    };
    for (const entry of Object.values(files)) {
      writeFileSync(path.join(dir, entry.file), entry.bytes);
      delete entry.bytes;
    }

    const count = (predicate) => records.filter(predicate).length;
    const summary = {
      dsf,
      url: URL,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      clicks: records.length,
      expectedClicks: EXPECTED_CLICKS,
      volumeToggled: `${count((r) => r.volumeToggled)}/${records.length}`,
      hitSpeaker: `${count((r) => r.hitSpeaker)}/${records.length}`,
      iconImmediate: `${count((r) => r.iconImmediate)}/${records.length}`,
      wavesConsistent: `${count((r) => r.wavesConsistent)}/${records.length}`,
      noBoardRender: `${count((r) => r.noBoardRender)}/${records.length}`,
      boardMutationsMax: Math.max(...records.map((r) => r.boardMutations)),
      immediate: {
        offDiffersFromOn: !offShot.equals(onShot),
        onRestoredEqualsOn: onRestoredShot.equals(onShot),
        offVsOnRegion: compareImages(decodePng(offShot), decodePng(onShot)),
        onRestoredVsOnRegion: compareImages(
          decodePng(onRestoredShot),
          decodePng(onShot),
        ),
      },
      final: finalRead,
      files,
      pageErrors,
    };
    summary.allPassed =
      records.length === EXPECTED_CLICKS &&
      count((r) => r.volumeToggled) === EXPECTED_CLICKS &&
      count((r) => r.hitSpeaker) === EXPECTED_CLICKS &&
      count((r) => r.iconImmediate) === EXPECTED_CLICKS &&
      count((r) => r.wavesConsistent) === EXPECTED_CLICKS &&
      count((r) => r.noBoardRender) === EXPECTED_CLICKS &&
      summary.immediate.offDiffersFromOn &&
      summary.immediate.onRestoredEqualsOn &&
      pageErrors.length === 0;

    writeFileSync(
      path.join(dir, 'probe.json'),
      `${JSON.stringify({ summary, clicks: records }, null, 2)}\n`,
    );
    process.stdout.write(
      `dsf${dsf}: clicks=${records.length} volume=${summary.volumeToggled} ` +
        `hit=${summary.hitSpeaker} iconImmediate=${summary.iconImmediate} ` +
        `waves=${summary.wavesConsistent} noRender=${summary.noBoardRender} ` +
        `offDiffers=${summary.immediate.offDiffersFromOn} ` +
        `onRestored=${summary.immediate.onRestoredEqualsOn} ` +
        `allPassed=${summary.allPassed}\n`,
    );
    return summary;
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  try {
    const summaries = {};
    for (const dsf of [1, 2]) {
      summaries[String(dsf)] = await runDsf(browser, dsf);
    }
    const run = {
      tool: 'tests/e2e/speaker/y5-feedback-probe.mjs',
      label: LABEL,
      url: URL,
      expectedClicksPerDsf: EXPECTED_CLICKS,
      allPassed: Object.values(summaries).every((summary) => summary.allPassed === true),
      dsf: summaries,
    };
    writeFileSync(
      path.join(OUT_ROOT, `probe-${LABEL}.json`),
      `${JSON.stringify(run, null, 2)}\n`,
    );
    process.stdout.write(`probe ${LABEL}: allPassed=${run.allPassed}\n`);
    process.exitCode = run.allPassed ? 0 : 1;
  } finally {
    await browser.close();
  }
}

await main();
