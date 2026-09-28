// tests/timer.test.ts — task D3: countdown (V4 semantics, V2 expiry exactly
// once per round, V7 source scan).
//
// Evidenced semantics (O01, evidence/A2-timer.md): the round starts at 200 s;
// the remaining integer value decrements at 1000 ms wall-clock boundaries
// (`int(sure - (getTimer() - t)/1000)`); the clip is stopped at round start,
// on all-found completion and at timeout, and only `baslat()` starts it with
// a fresh origin. O14 (evidence/A2-timeout.md): the time bonus uses the last
// displayed integer second and exists only on the all-found completion.
//
// The fake clock below is driven manually: no real time passes and nothing is
// played (silent witness runs, EXECUTION.md §8). The V7 scan covers both D3
// modules, so `npm test -- timer` enforces the full claim.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import constants from '../data/constants.json';
import { scoreTimeBonus } from '../src/game/scoring';
import {
  createTimer,
  type CountdownTimer,
  type TimerClock,
  type TimerOptions,
} from '../src/game/timer';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** The two modules owned by D3 (V7 scan scope). */
const D3_MODULES = ['src/game/scoring.ts', 'src/game/timer.ts'] as const;

/** Game values that must never appear as code literals (from constants.json). */
const GAME_VALUES = [
  constants.timer.initialSeconds,
  constants.timer.tickMs,
  constants.scoring.perLetterSquaredFactor,
  constants.scoring.bonusPoints,
  constants.scoring.timeFactor,
];

// ---------------------------------------------------------------------------
// Fake wall clock (injected; no real timers, no audio)
// ---------------------------------------------------------------------------

interface ScheduledJob {
  readonly handle: number;
  readonly dueMs: number;
  readonly callback: () => void;
}

/** Manual wall clock + scheduler with real-timer firing order. */
class FakeClock implements TimerClock {
  private currentMs: number;
  private jobs: ScheduledJob[] = [];
  private nextHandle = 1;

  constructor(startMs = 0) {
    this.currentMs = startMs;
  }

  now(): number {
    return this.currentMs;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.jobs.push({ handle, dueMs: this.currentMs + delayMs, callback });
    return handle;
  }

  clearTimeout(handle: number): void {
    this.jobs = this.jobs.filter((job) => job.handle !== handle);
  }

  /** Advance time running due callbacks in due order (as real timers fire). */
  advance(ms: number): void {
    const targetMs = this.currentMs + ms;
    for (;;) {
      const due = this.nextDueJob(targetMs);
      if (due === null) break;
      this.jobs = this.jobs.filter((job) => job !== due);
      this.currentMs = due.dueMs;
      due.callback();
    }
    this.currentMs = targetMs;
  }

  /** Move the wall clock without running callbacks (blocked/late callback). */
  jump(ms: number): void {
    this.currentMs += ms;
  }

  /** Run every callback whose due time has passed, at the current wall time. */
  runDue(): void {
    for (;;) {
      const due = this.nextDueJob(this.currentMs);
      if (due === null) break;
      this.jobs = this.jobs.filter((job) => job !== due);
      due.callback();
    }
  }

  private nextDueJob(limitMs: number): ScheduledJob | null {
    let best: ScheduledJob | null = null;
    for (const job of this.jobs) {
      if (job.dueMs > limitMs) continue;
      if (
        best === null ||
        job.dueMs < best.dueMs ||
        (job.dueMs === best.dueMs && job.handle < best.handle)
      ) {
        best = job;
      }
    }
    return best;
  }
}

interface TimerHarness {
  readonly timer: CountdownTimer;
  readonly clock: FakeClock;
  readonly ticks: number[];
  readonly expirations: number[];
}

/** Timer over the fixture constants with a fresh fake clock and call logs. */
function createHarness(overrides: Partial<TimerOptions> = {}): TimerHarness {
  const clock = new FakeClock();
  const ticks: number[] = [];
  const expirations: number[] = [];
  const timer = createTimer({
    constants: constants.timer,
    clock,
    onTick: (remainingSeconds) => ticks.push(remainingSeconds),
    onExpired: () => {
      expirations.push(clock.now());
    },
    ...overrides,
  });
  return { timer, clock, ticks, expirations };
}

// ---------------------------------------------------------------------------
// V7 scanner (shared shape with tests/scoring.test.ts)
// ---------------------------------------------------------------------------

/** Blank out comments but keep line numbers (newlines preserved). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => {
      const commentStart = line.indexOf('//');
      return commentStart === -1 ? line : line.slice(0, commentStart);
    })
    .join('\n');
}

/**
 * Scan one module source: every numeric literal in code must carry an
 * `// evidence:` comment on its line or on the line above, and must not be a
 * game value from data/constants.json; the module must not read the JSON
 * directly (docs/05 §1). Returns human-readable problems.
 */
function scanModuleSource(source: string, label: string, gameValues: readonly number[]): string[] {
  const rawLines = source.split('\n');
  const codeLines = stripComments(source).split('\n');
  const problems: string[] = [];
  codeLines.forEach((code, index) => {
    const literals = code.match(/\d+(?:\.\d+)?/g) ?? [];
    if (literals.length === 0) return;
    const annotated =
      rawLines[index].includes('// evidence:') ||
      (index > 0 && rawLines[index - 1].includes('// evidence:'));
    for (const literal of literals) {
      if (!annotated) {
        problems.push(
          `${label}:${index + 1}: numeric literal ${literal} lacks an // evidence: comment`,
        );
      }
      if (gameValues.includes(Number(literal))) {
        problems.push(
          `${label}:${index + 1}: hardcoded game value ${literal} (must come from data/constants.json)`,
        );
      }
    }
  });
  if (codeLines.join('\n').includes('constants.json')) {
    problems.push(`${label}: module must not read data/constants.json directly (docs/05 §1)`);
  }
  return problems;
}

function scanModule(relativePath: string, gameValues: readonly number[]): string[] {
  return scanModuleSource(
    readFileSync(path.join(repoRoot, relativePath), 'utf8'),
    relativePath,
    gameValues,
  );
}

// ---------------------------------------------------------------------------
// V4 — constants and initial state (O01)
// ---------------------------------------------------------------------------

describe('timer constants and initial state (O01, evidence/A2-timer.md)', () => {
  it('data/constants.json carries the confirmed 200 s / 1000 ms values', () => {
    expect(constants.timer).toEqual({ initialSeconds: 200, tickMs: 1000 });
  });

  it('shows the initial value before the countdown is started (init: timer = sure)', () => {
    const { timer, ticks } = createHarness();
    expect(timer.initialSeconds).toBe(constants.timer.initialSeconds);
    expect(timer.remainingSeconds).toBe(constants.timer.initialSeconds);
    expect(timer.running).toBe(false);
    expect(timer.expired).toBe(false);
    expect(ticks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// V4 — decrement at wall-clock boundaries
// ---------------------------------------------------------------------------

describe('countdown decrements at 1000 ms wall-clock boundaries (O01)', () => {
  it('emits the initial value on start and one tick per second', () => {
    const { timer, clock, ticks } = createHarness();
    timer.start();
    expect(ticks).toEqual([200]);
    expect(timer.running).toBe(true);

    clock.advance(999);
    expect(ticks).toEqual([200]); // no early decrement
    clock.advance(1);
    expect(ticks).toEqual([200, 199]); // exactly at the 1000 ms boundary
    clock.advance(1000);
    expect(ticks).toEqual([200, 199, 198]);
  });

  it('uses the wall clock, not callback counts (late callback jumps, no drift)', () => {
    const { timer, clock, ticks } = createHarness();
    timer.start();
    clock.jump(3500); // callbacks blocked; none ran yet
    clock.runDue(); // the 1000 ms boundary callback runs late at 3500
    expect(ticks).toEqual([200, 197]);
    clock.advance(500); // the boundary grid is preserved: next at 4000
    expect(ticks).toEqual([200, 197, 196]);
  });

  it('emits integer seconds only, all the way down', () => {
    const { timer, clock, ticks } = createHarness();
    timer.start();
    clock.advance(12_345);
    expect(ticks.every((value) => Number.isInteger(value))).toBe(true);
    expect(timer.remainingSeconds).toBe(constants.timer.initialSeconds - 12);
    expect(scoreTimeBonus(timer.remainingSeconds, constants.scoring)).toBe(
      (constants.timer.initialSeconds - 12) * constants.scoring.timeFactor,
    );
  });
});

// ---------------------------------------------------------------------------
// V2/V4 — expiry exactly once per round
// ---------------------------------------------------------------------------

describe('expiry (V2: exactly once per round)', () => {
  it('counts 200 -> 0 and fires expired exactly once', () => {
    const { timer, clock, ticks, expirations } = createHarness();
    timer.start();
    clock.advance(constants.timer.initialSeconds * constants.timer.tickMs);

    const expectedTicks = Array.from(
      { length: constants.timer.initialSeconds + 1 },
      (_, index) => constants.timer.initialSeconds - index,
    );
    expect(ticks).toEqual(expectedTicks);
    expect(expirations).toEqual([
      constants.timer.initialSeconds * constants.timer.tickMs,
    ]);
    expect(timer.remainingSeconds).toBe(0);
    expect(timer.running).toBe(false);
    expect(timer.expired).toBe(true);

    // The clip stopped itself: further wall clock changes nothing.
    clock.advance(60_000);
    expect(ticks).toEqual(expectedTicks);
    expect(expirations).toHaveLength(1);
    expect(timer.remainingSeconds).toBe(0);
  });

  it('expires once again only after a new start() (new round)', () => {
    const { timer, clock, expirations } = createHarness();
    timer.start();
    clock.advance(constants.timer.initialSeconds * constants.timer.tickMs);
    expect(expirations).toHaveLength(1);

    timer.start(); // baslat(): frame 2 re-captures t, fresh countdown
    expect(timer.expired).toBe(false);
    expect(timer.remainingSeconds).toBe(constants.timer.initialSeconds);
    clock.advance(constants.timer.initialSeconds * constants.timer.tickMs);
    expect(expirations).toHaveLength(2);
  });

  it('a very late callback still expires exactly once (never negative)', () => {
    const { timer, clock, ticks, expirations } = createHarness();
    timer.start();
    clock.jump(500_000);
    clock.runDue();
    expect(expirations).toHaveLength(1);
    expect(ticks).toEqual([200, 0]);
    expect(timer.remainingSeconds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// V4 — stop/pause semantics (gotoAndStop(1); no resume)
// ---------------------------------------------------------------------------

describe('stop semantics (clip gotoAndStop(1), O01)', () => {
  it('stop() freezes the last integer value and stops ticking', () => {
    const { timer, clock, ticks } = createHarness();
    timer.start();
    clock.advance(2500);
    expect(timer.remainingSeconds).toBe(198); // 200 - floor(2500 / 1000)
    timer.stop();
    expect(timer.running).toBe(false);

    const atStop = [...ticks];
    clock.advance(10_000);
    expect(ticks).toEqual(atStop);
    expect(timer.remainingSeconds).toBe(198);
    expect(timer.expired).toBe(false);
  });

  it('start() after a stop restarts from the initial value (no resume)', () => {
    const { timer, clock, ticks } = createHarness();
    timer.start();
    clock.advance(5000);
    timer.stop();
    expect(timer.remainingSeconds).toBe(195);

    timer.start();
    expect(timer.remainingSeconds).toBe(constants.timer.initialSeconds);
    expect(ticks[ticks.length - 1]).toBe(constants.timer.initialSeconds);
    clock.advance(1000);
    expect(ticks[ticks.length - 1]).toBe(constants.timer.initialSeconds - 1);
  });

  it('stop() is safe before start, after stop and after expiry', () => {
    const { timer, clock, expirations } = createHarness();
    timer.stop();
    expect(timer.running).toBe(false);
    expect(timer.remainingSeconds).toBe(constants.timer.initialSeconds);

    timer.start();
    clock.advance(constants.timer.initialSeconds * constants.timer.tickMs);
    expect(expirations).toHaveLength(1);
    timer.stop();
    timer.stop();
    expect(timer.expired).toBe(true);
    expect(timer.remainingSeconds).toBe(0);
    expect(expirations).toHaveLength(1);
  });

  it('a listener can stop the timer from within a tick (pending boundary cleared)', () => {
    const clock = new FakeClock();
    const ticks: number[] = [];
    const timerRef: { current: CountdownTimer | null } = { current: null };
    const timer = createTimer({
      constants: constants.timer,
      clock,
      onTick: (remainingSeconds) => {
        ticks.push(remainingSeconds);
        if (remainingSeconds === 199) timerRef.current?.stop();
      },
    });
    timerRef.current = timer;

    timer.start();
    clock.advance(1000);
    expect(ticks).toEqual([200, 199]);
    expect(timer.running).toBe(false);
    clock.advance(10_000);
    expect(ticks).toEqual([200, 199]);
    expect(timer.expired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V4 — time bonus timing (O14) and integration with scoring (docs/07 row 4)
// ---------------------------------------------------------------------------

describe('time bonus uses the last integer second (O14, docs/07 §1)', () => {
  it('remaining 100 s at completion -> +10000', () => {
    const { timer, clock } = createHarness();
    timer.start();
    clock.advance(100_000);
    expect(timer.remainingSeconds).toBe(100);
    // bittimi(): puan += timer * timebonus, then the clip stops.
    const bonus = scoreTimeBonus(timer.remainingSeconds, constants.scoring);
    timer.stop();
    expect(bonus).toBe(10000);
    expect(timer.remainingSeconds).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// V4 — structural constant validation
// ---------------------------------------------------------------------------

describe('constant validation (structural)', () => {
  it('rejects non-positive or non-integer timer constants', () => {
    const clock = new FakeClock();
    expect(() => createTimer({ constants: { initialSeconds: 0, tickMs: 1000 }, clock })).toThrow(
      RangeError,
    );
    expect(() => createTimer({ constants: { initialSeconds: 200, tickMs: 0 }, clock })).toThrow(
      RangeError,
    );
    expect(() => createTimer({ constants: { initialSeconds: 200.5, tickMs: 1000 }, clock })).toThrow(
      RangeError,
    );
    expect(() => createTimer({ constants: { initialSeconds: 200, tickMs: 1000.5 }, clock })).toThrow(
      RangeError,
    );
  });
});

// ---------------------------------------------------------------------------
// V7 — data/constants.json is the value source
// ---------------------------------------------------------------------------

describe('V7 — values come from data/constants.json; no hardcoded game literals', () => {
  it('data/constants.json carries the confirmed timer values', () => {
    expect(constants.timer).toEqual({ initialSeconds: 200, tickMs: 1000 });
  });

  it('scans every D3 module source: no unannotated literal, no hardcoded game value', () => {
    const problems = D3_MODULES.flatMap((module) => scanModule(module, GAME_VALUES));
    expect(problems).toEqual([]);
  });

  it('scanner self-test: detects unannotated and hardcoded literals', () => {
    expect(scanModuleSource('const bad = 7;\n', '<self>', [])).toEqual([
      '<self>:1: numeric literal 7 lacks an // evidence: comment',
    ]);
    expect(scanModuleSource('// evidence: test\nconst bad = 50;\n', '<self>', [50])).toEqual([
      '<self>:2: hardcoded game value 50 (must come from data/constants.json)',
    ]);
    expect(scanModuleSource('// evidence: test\nconst ok = 50;\n', '<self>', [])).toEqual([]);
  });
});
