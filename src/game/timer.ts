// src/game/timer.ts — countdown (docs/04-architecture.md §4;
// docs/05-game-core.md §5; O01: evidence/A2-timer.md).
//
// Evidenced semantics (O01, evidence/A2-timer.md §2–§3):
// - every round starts at `initialSeconds` (`init()`: `sure = 200;
//   timex = sure; timer = sure;`);
// - the remaining value is read from the wall clock:
//   `int(sure - (getTimer() - t)/1000)` — it decrements at exact 1000 ms
//   wall-clock boundaries, not per animation frame;
// - stop semantics: the timer clip is stopped (`gotoAndStop(1)`) at round
//   start, on all-found completion and at timeout; it is started only by
//   `baslat()`, which re-captures `t`, so a (hypothetical) resume restarts the
//   countdown from the initial value — the original flow starts it exactly
//   once per round;
// - at `timer == 0` the clip stops itself after the timeout sequence runs
//   (O14: in-progress entry discarded, no time bonus).
//
// Values arrive from data/constants.json via the caller (docs/05 §1: modules
// never read the JSON directly). The module is DOM-free and clock-injectable:
// tests drive a fake wall clock, no real time passes and nothing is audible
// (silent witness runs, EXECUTION.md §8).

/** The `timer` block of data/constants.json, supplied by the caller. */
export interface TimerConstants {
  /** `timer.initialSeconds` — fresh countdown value at every round start. */
  readonly initialSeconds: number;
  /** `timer.tickMs` — wall-clock interval between decrements. */
  readonly tickMs: number;
}

/**
 * Wall clock + scheduler used by the countdown; injectable so tests control
 * time. The default uses the monotonic browser clock (`performance.now()`,
 * the analogue of Flash `getTimer()`) and `setTimeout`.
 */
export interface TimerClock {
  /** Monotonic milliseconds (reference: `getTimer()`). */
  now(): number;
  /** Schedule `callback` after `delayMs`; returns a handle for clearTimeout. */
  setTimeout(callback: () => void, delayMs: number): number;
  /** Cancel a handle returned by `setTimeout`. */
  clearTimeout(handle: number): void;
}

/** Options for {@link createTimer}; the clock is injectable for tests. */
export interface TimerOptions {
  /** Values from data/constants.json `timer` (passed by the app bootstrap). */
  readonly constants: TimerConstants;
  /** Called with the new integer remaining value at start and each boundary. */
  readonly onTick?: (remainingSeconds: number) => void;
  /** Called exactly once per round when the countdown reaches zero. */
  readonly onExpired?: () => void;
  /** Defaults to `performance.now()` + `setTimeout`; tests inject a fake. */
  readonly clock?: TimerClock;
}

/**
 * One countdown per round (O01). `start()` is `baslat()` (fresh start from the
 * initial value); `stop()` is the clip's `gotoAndStop(1)` — it freezes the
 * last integer remaining value and there is no resume.
 */
export interface CountdownTimer {
  /** `timer.initialSeconds` as passed in. */
  readonly initialSeconds: number;
  /**
   * Last integer second shown: `initialSeconds` before the first start and
   * whenever the timer has not been started; the last computed value after a
   * stop; zero after expiry. Never negative.
   */
  readonly remainingSeconds: number;
  /** True while the countdown is scheduled (between start and stop/expiry). */
  readonly running: boolean;
  /** True from the expiry until the next `start()` (new round). */
  readonly expired: boolean;
  /** `baslat()`: fresh countdown from `initialSeconds`; re-captures the origin. */
  start(): void;
  /** Clip stop: cancel the pending boundary, keep the last integer value. */
  stop(): void;
}

/**
 * Structural integer zero: lower bound of the validated constants and the
 * clamped countdown floor. Not a game value.
 */
// evidence: structural literal — no mechanics meaning; game values are passed in.
const ZERO = 0;

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= ZERO) {
    throw new RangeError(`${label} must be a positive integer, got ${value}`);
  }
}

const defaultClock: TimerClock = {
  now: () => performance.now(),
  setTimeout: (callback, delayMs) =>
    globalThis.setTimeout(callback, delayMs) as unknown as number,
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle);
  },
};

/**
 * Create the countdown for one round. `onTick` receives `initialSeconds` on
 * `start()` and the new integer value at each `tickMs` wall-clock boundary;
 * at zero it receives the final zero before `onExpired` fires once.
 */
export function createTimer(options: TimerOptions): CountdownTimer {
  const { initialSeconds, tickMs } = options.constants;
  assertPositiveInteger(initialSeconds, 'initialSeconds');
  assertPositiveInteger(tickMs, 'tickMs');
  const clock = options.clock ?? defaultClock;

  let remaining = initialSeconds;
  let running = false;
  let expired = false;
  let originMs = ZERO;
  let handle: number | null = null;

  function clearScheduled(): void {
    if (handle !== null) {
      clock.clearTimeout(handle);
      handle = null;
    }
  }

  /** Reference: `int(sure - (getTimer() - t)/1000)`, clamped at zero. */
  function computeRemaining(): number {
    const elapsedMs = clock.now() - originMs;
    const elapsedTicks = Math.floor(elapsedMs / tickMs);
    const value = initialSeconds - elapsedTicks;
    return value > ZERO ? value : ZERO;
  }

  /** Delay to the next multiple of `tickMs` after the captured origin. */
  function scheduleNextBoundary(): void {
    const elapsedMs = clock.now() - originMs;
    handle = clock.setTimeout(onBoundary, tickMs - (elapsedMs % tickMs));
  }

  function onBoundary(): void {
    handle = null;
    if (!running) return;
    const value = computeRemaining();
    remaining = value;
    if (value <= ZERO) {
      // Reference frame 3: display set to zero, then the terminal branch
      // stops the clip (`gotoAndStop(1)`) — expiry fires exactly once.
      running = false;
      expired = true;
      options.onTick?.(ZERO);
      options.onExpired?.();
      return;
    }
    scheduleNextBoundary();
    options.onTick?.(value);
  }

  return {
    get initialSeconds(): number {
      return initialSeconds;
    },
    get remainingSeconds(): number {
      return remaining;
    },
    get running(): boolean {
      return running;
    },
    get expired(): boolean {
      return expired;
    },
    start(): void {
      // `baslat()` → `gotoAndPlay(2)` re-captures `t`: a new round (or a
      // hypothetical resume) always restarts from the initial value (O01).
      clearScheduled();
      originMs = clock.now();
      remaining = initialSeconds;
      expired = false;
      running = true;
      scheduleNextBoundary();
      options.onTick?.(remaining);
    },
    stop(): void {
      clearScheduled();
      running = false;
    },
  };
}
