// tests/e2e/speaker/speaker.spec.ts — X3 speaker-toggle e2e (owner defect 3).
//
// Run with: npm run e2e -- speaker
//
// Drives the real app: clicks the board's `btn_speaker` element (`spk_btn`,
// DefineButton2_90) and asserts the reference semantics decoded from the
// decompiled ActionScript (evidence/X3-speaker.md §1):
// - `if(_root.vol)` → `_root.vol = 0` + `stopAllSounds()`; else `vol = 1`;
//   the value is persisted (rebuild: `kelimator.volume`, 0/100).
// - The sprite-88 frames "on"/"off" are mirrored on the element
//   (`data-speaker` + the waves character 85 / frame-"off" CXFORM icon).
// - `window.__game.lastAudioEvent` is a state hook: the requested event is
//   recorded even while muted (docs/04 §6).
//
// Silent witness runs (EXECUTION.md §8): the "app" Playwright project launches
// Chromium with `--mute-audio` (playwright.config.ts); this suite never
// overrides that and asserts state, never audibility.
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'kelimator.volume';
const SPEAKER_SELECTOR = '[data-element="btn_speaker"]';
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

test.describe('X3 speaker toggle', () => {
  test('click mutes (persisted 0, off visual) and unmutes (persisted 100, on visual)', async ({
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

    // Click → `if(_root.vol)` branch: vol = 0 + stopAllSounds, persisted.
    await speaker.click();
    await expect(speaker).toHaveAttribute('data-speaker', 'off');
    const muted = await readSpeaker(page);
    expect(muted.storedVolume).toBe('0');
    expect(muted.wavesDisplay).toBe('none');

    // The rendered state changes (waves removed + frame-"off" CXFORM icon).
    const offShot = await speaker.screenshot();
    expect(offShot.equals(onShot)).toBe(false);

    // While muted, the manager gates playback but still records the requested
    // event (docs/04 §6: a state hook, never evidence of audibility). BACKSPACE
    // on an empty entry always reports a delete (evidence/A2-edges.md §2(c)).
    await page.keyboard.press('Backspace');
    await expect.poll(async () => (await readSpeaker(page)).lastAudioEvent).toBe('delete');
    expect((await readSpeaker(page)).storedVolume).toBe('0');

    // Click again → `else` branch: vol = 1 (full volume), persisted; SPACE
    // reports `scramble` (a different event name proves the unmuted wiring).
    await speaker.click();
    await expect(speaker).toHaveAttribute('data-speaker', 'on');
    const unmuted = await readSpeaker(page);
    expect(unmuted.storedVolume).toBe('100');
    expect(unmuted.wavesDisplay).not.toBe('none');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await readSpeaker(page)).lastAudioEvent).toBe('scramble');
    expect((await readSpeaker(page)).storedVolume).toBe('100');

    expect(pageErrors).toEqual([]);
  });

  test('muted state persists across a reload and boots with the off visual', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    const speaker = page.locator(SPEAKER_SELECTOR);
    await expect(speaker).toHaveAttribute('data-speaker', 'on');
    await speaker.click();
    await expect(speaker).toHaveAttribute('data-speaker', 'off');
    await expect.poll(async () => (await readSpeaker(page)).storedVolume).toBe('0');

    // Boot restore (frame_2 L1-L9): the persisted 0 is read back, shown as the
    // "off" frame, and a muted round start still records `roundStart`.
    await page.reload();
    await expect(speaker).toHaveAttribute('data-speaker', 'off');
    await expect.poll(async () => (await readSpeaker(page)).lastAudioEvent).toBe('roundStart');
    expect((await readSpeaker(page)).storedVolume).toBe('0');

    // Unmute → 100 persists across another reload.
    await speaker.click();
    await expect(speaker).toHaveAttribute('data-speaker', 'on');
    await expect.poll(async () => (await readSpeaker(page)).storedVolume).toBe('100');
    await page.reload();
    await expect(speaker).toHaveAttribute('data-speaker', 'on');
    expect((await readSpeaker(page)).storedVolume).toBe('100');

    expect(pageErrors).toEqual([]);
  });

  test('clamps a corrupt stored volume into 0–100 on boot', async ({ page }) => {
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

    await speaker.click();
    await expect.poll(async () => (await readSpeaker(page)).storedVolume).toBe('100');
  });
});
