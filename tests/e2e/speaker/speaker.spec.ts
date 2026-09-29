// tests/e2e/speaker/speaker.spec.ts — X3 speaker-toggle e2e (owner defect 3,
// O24) + Y5 immediate visual feedback.
//
// Run with: npm run e2e -- speaker
//
// Drives the real app: clicks the board's `btn_speaker` element (`spk_btn`,
// DefineButton2_90) and asserts the reference semantics decoded from the
// decompiled ActionScript (evidence/X3-speaker.md §1) and the C3 speaker
// capture (evidence/C3-speaker-capture.md):
// - `if(_root.vol)` → `_root.vol = 0` + `stopAllSounds()`; else `vol = 1`;
//   the value is persisted (rebuild: `kelimator.volume`, 0/100).
// - The sprite-88 frames "on"/"off" are mirrored on the element
//   (`data-speaker` + the waves character 85 / frame-"off" CXFORM icon).
// - The icon follows the persisted volume at boot/render (E2 re-creates the
//   element on every `board.apply`, `syncSpeakerVisual` runs at mount/update).
// - Y5 (owner decision; evidence/Y5-speaker-feedback.md §6): the click itself
//   also repaints the icon immediately — a deliberate deviation from the
//   measured reference timing (C3 probe: a plain click changed 0 px), chosen
//   for usable feedback; no debouncing. The assertions below read the state
//   right after the click, with a MutationObserver + node-identity guard
//   proving no board re-render intervened; the reload/persistence coverage is
//   kept.
// - `window.__game.lastAudioEvent` is a state hook: the requested event is
//   recorded even while muted (docs/04 §6).
//
// Silent witness runs (EXECUTION.md §8): the "app" Playwright project launches
// Chromium with `--mute-audio` (playwright.config.ts); this suite never
// overrides that and asserts state, never audibility.
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'kelimator.volume';
const SPEAKER_SELECTOR = '[data-element="btn_speaker"]';
const BOARD_SELECTOR = '[data-testid="board"]';
/** Sprite 88 character 85 = the on-frame waves (tags.xml spriteId="88"). */
const WAVES_CHARACTER_ID = '85';

interface SpeakerRead {
  /** `data-speaker` state mirrored from the sprite 88 frames "on"/"off". */
  readonly speakerState: string | null;
  /** `window.__game.state` (docs/04 §6). */
  readonly gameState: string | null;
  /** Computed display of the waves `use` element (`none` on frame "off"). */
  readonly wavesDisplay: string | null;
  /** Stored volume (`kelimator.volume`); null before the first toggle write. */
  readonly storedVolume: string | null;
  /** `window.__game.lastAudioEvent` (docs/04 §6). */
  readonly lastAudioEvent: string | null;
}

async function readSpeaker(page: Page): Promise<SpeakerRead> {
  return page.evaluate(
    ({ selector, character }) => {
      const node = document.querySelector(selector);
      const waves =
        node === null
          ? undefined
          : Array.from(node.querySelectorAll('use')).find((use) => {
              for (const attribute of Array.from(use.attributes)) {
                if (
                  attribute.name.toLowerCase() === 'ffdec:characterid' &&
                  attribute.value === character
                ) {
                  return true;
                }
              }
              return false;
            });
      const game = (
        window as unknown as { __game?: { state?: string; lastAudioEvent?: string | null } }
      ).__game;
      return {
        speakerState: node instanceof HTMLElement ? (node.dataset.speaker ?? null) : null,
        gameState: game?.state ?? null,
        wavesDisplay: waves === undefined ? null : getComputedStyle(waves).display,
        storedVolume: localStorage.getItem('kelimator.volume'),
        lastAudioEvent: game?.lastAudioEvent ?? null,
      };
    },
    { selector: SPEAKER_SELECTOR, character: WAVES_CHARACTER_ID },
  );
}

interface FeedbackProbeRead {
  /** Board childList records since `armFeedbackProbe` (> 0 means a re-render). */
  readonly boardMutations: number;
  /** True while the probed speaker DOM node survived (a render replaces it). */
  readonly sameSpeakerNode: boolean;
}

/**
 * Arm the no-render guard before a click: `board.apply` clears and re-creates
 * the board's direct children, so a `childList` observation on the board root
 * records every board re-render, and the speaker node reference detects the
 * replacement even if a mutation were missed. Y5 requires the icon flip to
 * happen inside the click event itself, with no render in between.
 */
async function armFeedbackProbe(page: Page): Promise<void> {
  await page.evaluate(
    ({ boardSelector, speakerSelector }) => {
      const board = document.querySelector(boardSelector);
      const state = {
        boardMutations: 0,
        speaker: document.querySelector(speakerSelector),
      };
      if (board instanceof HTMLElement) {
        new MutationObserver((records) => {
          state.boardMutations += records.length;
        }).observe(board, { childList: true });
      }
      (
        window as unknown as {
          __y5?: { boardMutations: number; speaker: Element | null };
        }
      ).__y5 = state;
    },
    { boardSelector: BOARD_SELECTOR, speakerSelector: SPEAKER_SELECTOR },
  );
}

async function readFeedbackProbe(page: Page): Promise<FeedbackProbeRead> {
  return page.evaluate(
    ({ speakerSelector }) => {
      const probe = (
        window as unknown as {
          __y5?: { boardMutations: number; speaker: Element | null };
        }
      ).__y5;
      return {
        boardMutations: probe?.boardMutations ?? -1,
        sameSpeakerNode:
          probe !== undefined &&
          probe.speaker !== null &&
          probe.speaker === document.querySelector(speakerSelector),
      };
    },
    { speakerSelector: SPEAKER_SELECTOR },
  );
}

test.describe('X3 speaker toggle', () => {
  test('click toggles the audio state + persistence and repaints the icon immediately (no render)', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    const speaker = page.locator(SPEAKER_SELECTOR);
    await expect(speaker).toBeVisible();
    await expect.poll(async () => (await readSpeaker(page)).gameState).toBe('playing');
    await expect(speaker).toHaveAttribute('data-speaker', 'on');

    // Reference boot: no stored value → `vol = 1` (frame_2 L6-L9); the boot
    // read never writes (evidence/D4-audio.md §4).
    const boot = await readSpeaker(page);
    expect(boot.storedVolume).toBeNull();
    expect(boot.wavesDisplay).not.toBe('none');
    await expect.poll(async () => (await readSpeaker(page)).lastAudioEvent).toBe('roundStart');
    const onShot = await speaker.screenshot();

    await armFeedbackProbe(page);

    // Click → `if(_root.vol)` branch: vol = 0 + stopAllSounds, persisted, and
    // the icon shows the off frame inside the same click event (Y5).
    await speaker.click();
    const muted = await readSpeaker(page);
    expect(muted.storedVolume).toBe('0');
    expect(muted.speakerState).toBe('off');
    expect(muted.wavesDisplay).toBe('none');
    const muteProbe = await readFeedbackProbe(page);
    expect(muteProbe.boardMutations).toBe(0);
    expect(muteProbe.sameSpeakerNode).toBe(true);
    const offShot = await speaker.screenshot();
    expect(offShot.equals(onShot)).toBe(false);

    // Click again → `else` branch: vol = 1 (full volume), persisted, icon flips
    // back inside the same click event; the ON frame is restored pixel-exactly
    // (C3: restored ON == initial ON, 0 px).
    await speaker.click();
    const unmuted = await readSpeaker(page);
    expect(unmuted.storedVolume).toBe('100');
    expect(unmuted.speakerState).toBe('on');
    expect(unmuted.wavesDisplay).not.toBe('none');
    const unmuteProbe = await readFeedbackProbe(page);
    expect(unmuteProbe.boardMutations).toBe(0);
    expect(unmuteProbe.sameSpeakerNode).toBe(true);
    expect((await speaker.screenshot()).equals(onShot)).toBe(true);

    // A render (SPACE → scramble) applies the same persisted frame; the
    // request is recorded (`lastAudioEvent` hook, docs/04 §6).
    await page.keyboard.press('Space');
    await expect.poll(async () => (await readSpeaker(page)).lastAudioEvent).toBe('scramble');
    expect((await readSpeaker(page)).storedVolume).toBe('100');
    await expect(speaker).toHaveAttribute('data-speaker', 'on');

    // Mute again; a later render keeps the immediately-shown frame (no
    // desync in either direction).
    await speaker.click();
    expect((await readSpeaker(page)).speakerState).toBe('off');
    await page.keyboard.press('Backspace'); // delete event; entry is empty
    await expect.poll(async () => (await readSpeaker(page)).lastAudioEvent).toBe('delete');
    expect((await readSpeaker(page)).storedVolume).toBe('0');
    await expect(speaker).toHaveAttribute('data-speaker', 'off');
    expect((await readSpeaker(page)).wavesDisplay).toBe('none');

    expect(pageErrors).toEqual([]);
  });

  test('immediate flip per click; boot restore from persistence', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    const speaker = page.locator(SPEAKER_SELECTOR);
    await expect(speaker).toHaveAttribute('data-speaker', 'on');

    await armFeedbackProbe(page);
    await speaker.click();
    const muted = await readSpeaker(page);
    expect(muted.storedVolume).toBe('0');
    expect(muted.speakerState).toBe('off'); // inside the click, no render
    const muteProbe = await readFeedbackProbe(page);
    expect(muteProbe.boardMutations).toBe(0);
    expect(muteProbe.sameSpeakerNode).toBe(true);

    // Boot restore (frame_2 L1-L9): the persisted 0 is read back, shown as the
    // "off" frame, and a muted round start still records `roundStart`.
    await page.reload();
    await expect(speaker).toHaveAttribute('data-speaker', 'off');
    await expect.poll(async () => (await readSpeaker(page)).lastAudioEvent).toBe('roundStart');
    expect((await readSpeaker(page)).storedVolume).toBe('0');

    // Unmute → 100 persists and the icon flips back before any reload/render.
    await armFeedbackProbe(page);
    await speaker.click();
    const unmuted = await readSpeaker(page);
    expect(unmuted.storedVolume).toBe('100');
    expect(unmuted.speakerState).toBe('on');
    const unmuteProbe = await readFeedbackProbe(page);
    expect(unmuteProbe.boardMutations).toBe(0);
    expect(unmuteProbe.sameSpeakerNode).toBe(true);

    // The next boot shows "on" from the persisted 100.
    await page.reload();
    await expect(speaker).toHaveAttribute('data-speaker', 'on');
    expect((await readSpeaker(page)).storedVolume).toBe('100');

    expect(pageErrors).toEqual([]);
  });

  test('clamps a corrupt stored volume into 0–100 at boot', async ({ page }) => {
    await page.goto('/');
    const speaker = page.locator(SPEAKER_SELECTOR);

    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: STORAGE_KEY,
      value: '999',
    });
    await page.reload();
    await expect(speaker).toHaveAttribute('data-speaker', 'on'); // 999 → 100

    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: STORAGE_KEY,
      value: '-5',
    });
    await page.reload();
    await expect(speaker).toHaveAttribute('data-speaker', 'off'); // -5 → 0

    // Click (muted → full): 100 persists and the icon flips immediately (Y5).
    await armFeedbackProbe(page);
    await speaker.click();
    expect((await readSpeaker(page)).storedVolume).toBe('100');
    expect((await readSpeaker(page)).speakerState).toBe('on');
    const probe = await readFeedbackProbe(page);
    expect(probe.boardMutations).toBe(0);
    expect(probe.sameSpeakerNode).toBe(true);

    await page.reload();
    await expect(speaker).toHaveAttribute('data-speaker', 'on');
  });
});

// Y5: the immediate-feedback assertions also hold at deviceScaleFactor 2 (the
// first test block runs at the project default dsf 1).
for (const dsf of [1, 2] as const) {
  test.describe(`Y5 immediate feedback (deviceScaleFactor ${dsf})`, () => {
    test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: dsf });

    test('the icon flips off and back on inside the click, with no board re-render', async ({
      page,
    }) => {
      const pageErrors: Error[] = [];
      page.on('pageerror', (error) => pageErrors.push(error));

      await page.goto('/');
      const speaker = page.locator(SPEAKER_SELECTOR);
      await expect.poll(async () => (await readSpeaker(page)).gameState).toBe('playing');
      await expect(speaker).toHaveAttribute('data-speaker', 'on');
      const onShot = await speaker.screenshot();

      await armFeedbackProbe(page);
      await speaker.click();
      const muted = await readSpeaker(page);
      expect(muted.storedVolume).toBe('0');
      expect(muted.speakerState).toBe('off');
      expect(muted.wavesDisplay).toBe('none');
      const muteProbe = await readFeedbackProbe(page);
      expect(muteProbe.boardMutations).toBe(0);
      expect(muteProbe.sameSpeakerNode).toBe(true);
      expect((await speaker.screenshot()).equals(onShot)).toBe(false);

      await speaker.click();
      const unmuted = await readSpeaker(page);
      expect(unmuted.storedVolume).toBe('100');
      expect(unmuted.speakerState).toBe('on');
      expect(unmuted.wavesDisplay).not.toBe('none');
      const unmuteProbe = await readFeedbackProbe(page);
      expect(unmuteProbe.boardMutations).toBe(0);
      expect(unmuteProbe.sameSpeakerNode).toBe(true);
      expect((await speaker.screenshot()).equals(onShot)).toBe(true);

      expect(pageErrors).toEqual([]);
    });
  });
}
