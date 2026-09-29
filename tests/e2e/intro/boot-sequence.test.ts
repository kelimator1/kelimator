// tests/e2e/intro/boot-sequence.test.ts — Y8/O23 boot sequencing (unit level).
//
// The D5 boot chain — preloader(SWF frames 1–4) → intro(frames 5–130) → first
// settled board — is driven with an injected manual scheduler and a recording
// audio sink: no DOM, no real time, no sound (silent witness runs, EXECUTION.md
// §8). The browser-facing behavior (painted intro, input lock e2e, keyframe
// comparisons) is covered by tests/e2e/intro/intro.spec.ts.
//
// evidence: data/animation.json sequences `preloader` (4 frames) / `intro`
// (126 frames) at 36 fps (evidence/A3-timing.md §1); reference flow
// artifacts/decompiled/scripts/frame_4/DoAction.as (`gotoAndStop("main");
// play();`), frame_131/DoAction.as (`init()` loads the list, `baslat()` starts
// the round); input gating evidence/A2-input.md §3 / evidence/A2-edges.md §3.
import { describe, expect, test } from 'vitest';
import constants from '../../../data/constants.json';
import { createRoundLifecycle, type RoundLifecycle } from '../../../src/game/lifecycle';
import type { Round, RoundLetters } from '../../../src/game/round';

/** One queued boot callback. */
interface QueuedTimer {
  ms: number;
  run: () => void;
  cancelled: boolean;
  ran: boolean;
}

/** Manual `schedule` implementation: the test decides when time advances. */
function makeScheduler(queue: QueuedTimer[]): (ms: number, run: () => void) => () => void {
  return (ms, run) => {
    const entry: QueuedTimer = { ms, run, cancelled: false, ran: false };
    queue.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
}

/** Fire the next pending (non-cancelled, not-yet-run) boot callback. */
function step(queue: QueuedTimer[]): void {
  const next = queue.find((timer) => !timer.cancelled && !timer.ran);
  if (next === undefined) return;
  next.ran = true;
  next.run();
}

function round(main: string): Round {
  return {
    id: main.toLowerCase(),
    main,
    letters: [...main] as unknown as RoundLetters,
    bonusLetter: null,
    words: { 3: [main.slice(0, 3)], 4: [], 5: [], 6: [], 7: [], 8: [main] },
  };
}

/** Production-like boot timings: 4/36 s preloader, 126/36 s intro. */
const BOOT = { preloaderMs: (4 * 1000) / 36, introMs: (126 * 1000) / 36 };

interface Harness {
  readonly lifecycle: RoundLifecycle;
  readonly queue: QueuedTimer[];
  readonly audio: string[];
  readonly states: string[];
}

function makeHarness(withBoot: boolean): Harness {
  const queue: QueuedTimer[] = [];
  const audio: string[] = [];
  const states: string[] = [];
  const lifecycle = createRoundLifecycle({
    constants: {
      timer: constants.timer,
      scoring: constants.scoring,
      bonusLetterSeed: constants.bonusLetter.seed,
    },
    rounds: [round('ABCDEFGH')],
    ...(withBoot ? { boot: BOOT } : {}),
    schedule: makeScheduler(queue),
    playAudio: (event) => {
      audio.push(event);
    },
    onStateChanged: (change) => {
      states.push(`${change.previous}->${change.state}`);
    },
  });
  return { lifecycle, queue, audio, states };
}

describe('Y8 boot sequence (O23)', () => {
  test('preloader → intro → first round with the catalog-derived spans', () => {
    const harness = makeHarness(true);
    const { lifecycle, queue } = harness;

    lifecycle.start();
    expect(lifecycle.state).toBe('preloader');
    expect(lifecycle.snapshot().deck).toBeNull();
    expect(harness.states).toEqual(['boot->preloader']);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.ms).toBe(BOOT.preloaderMs);

    // Preloader frames 1–4: input is locked, no round exists yet.
    expect(lifecycle.snapshot().inputLocked).toBe(true);
    expect(lifecycle.handleKey({ keyCode: 65 })).toEqual({ type: 'rejected', reason: 'locked' });
    expect(lifecycle.submitCurrent()).toEqual({ type: 'rejected', reason: 'locked' });

    // Frame 5 (`main`): the intro runs; the first round starts only after it.
    step(queue);
    expect(lifecycle.state).toBe('main');
    expect(lifecycle.snapshot().inputLocked).toBe(true);
    expect(lifecycle.snapshot().deck).toBeNull();
    expect(harness.states).toEqual(['boot->preloader', 'preloader->main']);
    expect(queue).toHaveLength(2);
    expect(queue[1]!.ms).toBe(BOOT.introMs);

    // Intro end (frame 130 → 131): the round starts, input unlocks, timer live.
    step(queue);
    expect(lifecycle.state).toBe('playing');
    expect(lifecycle.snapshot().inputLocked).toBe(false);
    expect(lifecycle.snapshot().deck).not.toBeNull();
    expect(harness.states).toEqual([
      'boot->preloader',
      'preloader->main',
      'main->playing',
    ]);
    expect(harness.audio).toContain('roundStart');
    expect(lifecycle.remainingMs).toBe(constants.timer.initialSeconds * 1000);
  });

  test('an explicit round start cancels the pending boot chain', () => {
    const harness = makeHarness(true);
    const { lifecycle, queue } = harness;

    lifecycle.start();
    step(queue); // preloader → main (intro pending)
    expect(lifecycle.state).toBe('main');

    const selected = lifecycle.selectRound('ABCDEFGH');
    expect(selected.main).toBe('ABCDEFGH');
    expect(lifecycle.state).toBe('playing');

    // The cancelled intro callback must not start a second round.
    const before = harness.audio.filter((event) => event === 'roundStart').length;
    step(queue);
    expect(lifecycle.state).toBe('playing');
    expect(harness.audio.filter((event) => event === 'roundStart')).toHaveLength(before);
  });

  test('without boot timings start() keeps the pre-Y8 synchronous path', () => {
    const harness = makeHarness(false);
    const { lifecycle, queue } = harness;

    lifecycle.start();
    expect(lifecycle.state).toBe('main');
    expect(queue).toHaveLength(0);
    expect(lifecycle.snapshot().deck).toBeNull();
    lifecycle.newRound();
    expect(lifecycle.state).toBe('playing');
  });
});
