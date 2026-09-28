// tests/lifecycle.test.ts — D5 round lifecycle + state machine tests (V4),
// the V2 ad-identifier source scan (O19) and the V7 constant-source checks.
//
// Everything runs programmatically with a fake wall clock and a recording
// audio sink: no DOM, no real time, no sound, no network (silent witness runs,
// EXECUTION.md §8).
import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import constants from '../data/constants.json';
import { LETTER_KEY_CODES } from '../src/game/input';
import {
  createRoundLifecycle,
  LISTING_CAP,
  SHUFFLE_SEED_BASE,
  type LifecycleSnapshot,
  type RoundLifecycle,
} from '../src/game/lifecycle';
import { ROUNDS, type RandomSource, type Round, type RoundLetters, type WordLength } from '../src/game/round';
import { scoreWord } from '../src/game/scoring';
import {
  createStateMachine,
  IllegalTransitionError,
  isCompletionSequence,
  isInputLocked,
  type GameState,
  type StateChange,
} from '../src/game/state';
import { shuffleOrder } from '../src/game/tiles';
import type { TimerClock } from '../src/game/timer';

// ---------------------------------------------------------------------------
// Fake wall clock (same contract as D3's TimerClock; no real time passes)
// ---------------------------------------------------------------------------

class FakeClock implements TimerClock {
  nowMs = 0;
  private nextHandle = 1;
  private readonly timers = new Map<number, { at: number; run: () => void }>();

  now(): number {
    return this.nowMs;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.timers.set(handle, { at: this.nowMs + delayMs, run: callback });
    return handle;
  }

  clearTimeout(handle: number): void {
    this.timers.delete(handle);
  }

  /** Advance the clock, firing every due callback in order. */
  advance(deltaMs: number): void {
    const target = this.nowMs + deltaMs;
    for (;;) {
      let nextHandle: number | null = null;
      let nextAt = Number.POSITIVE_INFINITY;
      for (const [handle, timer] of this.timers) {
        if (timer.at <= target && timer.at < nextAt) {
          nextAt = timer.at;
          nextHandle = handle;
        }
      }
      if (nextHandle === null) break;
      const timer = this.timers.get(nextHandle);
      this.timers.delete(nextHandle);
      this.nowMs = nextAt;
      timer?.run();
    }
    this.nowMs = target;
  }
}

// ---------------------------------------------------------------------------
// Fixture rounds (test material only — no game value is invented: real game
// values come from data/constants.json via the lifecycle options)
// ---------------------------------------------------------------------------

const DETAILED_WORDS: readonly string[] = [
  'ABC',
  'BCD',
  'ABCD',
  'EFGH',
  'ABCDE',
  'ABCDEF',
  'ABCDEFG',
  'ABCDEFGH',
];

function wordsRecord(words: readonly string[]): Record<WordLength, string[]> {
  // The frozen schema's "8" list holds only the main word (docs/02 §1).
  const record: Record<WordLength, string[]> = { 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
  for (const word of words) {
    record[[...word].length as WordLength].push(word);
  }
  return record;
}

function detailedRound(id = 'abcdefgh'): Round {
  return {
    id,
    main: 'ABCDEFGH',
    letters: [...'ABCDEFGH'] as unknown as RoundLetters,
    bonusLetter: null,
    words: wordsRecord(DETAILED_WORDS),
  };
}

function simpleRound(id: string, main: string): Round {
  return {
    id,
    main,
    letters: [...main] as unknown as RoundLetters,
    bonusLetter: null,
    words: { 3: [main.slice(0, 3)], 4: [], 5: [], 6: [], 7: [], 8: [main] },
  };
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface HarnessOptions {
  readonly rounds?: readonly Round[];
  readonly bonusRandom?: RandomSource;
}

interface Harness {
  readonly lifecycle: RoundLifecycle;
  readonly clock: FakeClock;
  readonly audio: string[];
  readonly snapshots: LifecycleSnapshot[];
  readonly stateChanges: StateChange[];
  readonly started: string[];
  readonly completed: string[];
}

const NEVER_LUCKY: RandomSource = { randomInt: () => 999 };
const ALWAYS_LUCKY: RandomSource = { randomInt: () => 0 };

function makeHarness(options: HarnessOptions = {}): Harness {
  const clock = new FakeClock();
  const audio: string[] = [];
  const snapshots: LifecycleSnapshot[] = [];
  const stateChanges: StateChange[] = [];
  const started: string[] = [];
  const completed: string[] = [];
  const lifecycle = createRoundLifecycle({
    constants: {
      timer: constants.timer,
      scoring: constants.scoring,
      bonusLetterSeed: constants.bonusLetter.seed,
    },
    rounds: options.rounds ?? [detailedRound()],
    clock,
    bonusRandom: options.bonusRandom ?? NEVER_LUCKY,
    playAudio: (event) => {
      audio.push(event);
    },
    onChanged: (snapshot) => {
      snapshots.push(snapshot);
    },
    onStateChanged: (change) => {
      stateChanges.push(change);
    },
    onRoundStarted: (round) => {
      started.push(round.id);
    },
    onRoundCompleted: (reason) => {
      completed.push(reason);
    },
  });
  return { lifecycle, clock, audio, snapshots, stateChanges, started, completed };
}

const LETTER_KEY_CODE = new Map(LETTER_KEY_CODES.map(([code, letter]) => [letter, code]));

function typeWord(lifecycle: RoundLifecycle, word: string): void {
  for (const letter of word) {
    const keyCode = LETTER_KEY_CODE.get(letter);
    expect(keyCode, `no O04 key code for ${letter}`).toBeDefined();
    lifecycle.handleKey({ keyCode });
  }
}

function pressEnter(lifecycle: RoundLifecycle): string {
  const event = lifecycle.handleKey({ keyCode: 13 });
  expect(event.type).toBe('submit');
  return event.type === 'submit' ? event.entry : '';
}

// ---------------------------------------------------------------------------
// State machine (O13 flow)
// ---------------------------------------------------------------------------

describe('state machine (O13 flow)', () => {
  test('follows boot → preloader → main → playing → celebration → new round', () => {
    const changes: StateChange[] = [];
    const fsm = createStateMachine({ onChange: (change) => changes.push(change) });
    expect(fsm.state).toBe('boot');
    expect(fsm.inputLocked).toBe(true);
    fsm.transition('preloader');
    fsm.transition('main');
    fsm.transition('playing');
    expect(fsm.inputLocked).toBe(false);
    expect(fsm.completionSequence).toBe(false);
    fsm.transition('celebration');
    expect(fsm.completionSequence).toBe(true);
    expect(fsm.inputLocked).toBe(true);
    fsm.transition('playing');
    expect(fsm.state).toBe('playing');
    expect(changes.map((change) => `${change.previous}->${change.state}`)).toEqual([
      'boot->preloader',
      'preloader->main',
      'main->playing',
      'playing->celebration',
      'celebration->playing',
    ]);
  });

  test('timeout is a completion sequence and restarts through Yeni Oyun', () => {
    const fsm = createStateMachine({ initialState: 'playing' });
    fsm.transition('timeout');
    expect(isCompletionSequence('timeout')).toBe(true);
    expect(isInputLocked('timeout')).toBe(true);
    expect(fsm.can('preloader')).toBe(false);
    fsm.transition('playing');
    expect(fsm.state).toBe('playing');
  });

  test('illegal transitions throw IllegalTransitionError', () => {
    const fsm = createStateMachine();
    expect(() => fsm.transition('playing')).toThrow(IllegalTransitionError);
    fsm.transition('preloader');
    fsm.transition('main');
    fsm.transition('playing');
    fsm.transition('celebration');
    expect(() => fsm.transition('celebration')).toThrow(IllegalTransitionError);
    expect(() => fsm.transition('timeout')).toThrow(IllegalTransitionError);
  });

  test('playing → playing is the in-place Yeni Oyun restart (no change event)', () => {
    const changes: StateChange[] = [];
    const fsm = createStateMachine({ initialState: 'playing', onChange: (c) => changes.push(c) });
    expect(fsm.can('playing')).toBe(true);
    const change = fsm.transition('playing');
    expect(change).toEqual({ previous: 'playing', state: 'playing' });
    expect(changes).toEqual([]);
  });

  test('state helpers classify every evidenced state', () => {
    const locked: GameState[] = ['boot', 'preloader', 'main', 'celebration', 'timeout'];
    for (const state of locked) {
      expect(isInputLocked(state)).toBe(true);
    }
    expect(isInputLocked('playing')).toBe(false);
    expect(isCompletionSequence('celebration')).toBe(true);
    expect(isCompletionSequence('timeout')).toBe(true);
    expect(isCompletionSequence('playing')).toBe(false);
    expect(isCompletionSequence('main')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// newRound: sequential selection, resets, deck, timer, bonus seed
// ---------------------------------------------------------------------------

describe('newRound', () => {
  test('boot chain reaches main, then the first round starts', () => {
    const harness = makeHarness({ rounds: [simpleRound('one', 'ABCDEFGH'), simpleRound('two', 'HGFEDCBA')] });
    const { lifecycle } = harness;
    expect(lifecycle.state).toBe('boot');
    expect(lifecycle.round).toBeNull();
    lifecycle.start();
    expect(lifecycle.state).toBe('main');
    const round = lifecycle.newRound();
    expect(round.main).toBe('ABCDEFGH');
    expect(lifecycle.state).toBe('playing');
    expect(lifecycle.roundIndex).toBe(0);
    expect(lifecycle.remainingSeconds).toBe(constants.timer.initialSeconds);
    expect(harness.audio).toEqual(['roundStart']);
    expect(harness.started).toEqual(['one']);
    expect(harness.stateChanges.map((change) => change.state)).toEqual([
      'preloader',
      'main',
      'playing',
    ]);
  });

  test('round ids may repeat: array order is identity (docs/06 §4)', () => {
    const first = simpleRound('same-id', 'ABCDEFGH');
    const second = simpleRound('same-id', 'HGFEDCBA');
    const harness = makeHarness({ rounds: [first, second] });
    harness.lifecycle.start();
    expect(harness.lifecycle.newRound().main).toBe('ABCDEFGH');
    expect(harness.lifecycle.newRound().main).toBe('HGFEDCBA');
    expect(harness.lifecycle.roundIndex).toBe(1);
  });

  test('deck starts shuffled with the recorded golden seed and counters reset', () => {
    const harness = makeHarness({ rounds: [detailedRound()] });
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    const snapshot = harness.lifecycle.snapshot();
    expect(snapshot.deck).not.toBeNull();
    expect(snapshot.deck?.order).toEqual(shuffleOrder(8, SHUFFLE_SEED_BASE));
    expect(harness.lifecycle.snapshot().remainingCounts).toEqual({
      3: 2,
      4: 2,
      5: 1,
      6: 1,
      7: 1,
      8: 1,
    });
    expect(snapshot.listedSlotCounts).toEqual({ 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1 });
  });

  test('selectRound starts a specific bank round without advancing the cursor', () => {
    const harness = makeHarness({ rounds: ROUNDS });
    harness.lifecycle.start();
    expect(harness.lifecycle.newRound().main).toBe(ROUNDS[0]!.main);
    const selected = harness.lifecycle.selectRound('FİNALİZM');
    expect(selected.main).toBe('FİNALİZM');
    expect(harness.lifecycle.roundIndex).toBe(ROUNDS.findIndex((round) => round.main === 'FİNALİZM'));
    expect(() => harness.lifecycle.selectRound('YOKBÖYLEBİRŞEY')).toThrow();
    // default sequential selection continues from where it was (index 1)
    expect(harness.lifecycle.newRound()).toBe(ROUNDS[1]);
  });
});

// ---------------------------------------------------------------------------
// submit: valid / invalid / already-found / bonus / caps
// ---------------------------------------------------------------------------

describe('submit', () => {
  test('valid word: scoring, found list, counters, tiles, audio (D2 §6.5 wiring)', () => {
    const harness = makeHarness();
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    harness.audio.length = 0;

    typeWord(harness.lifecycle, 'ABC');
    expect(harness.audio).toEqual(['letterKey', 'letterKey', 'letterKey']);
    expect(harness.lifecycle.snapshot().entryStatus).toBe('valid');

    const entry = pressEnter(harness.lifecycle);
    expect(entry).toBe('ABC');
    expect(harness.lifecycle.score).toBe(450);
    expect(harness.lifecycle.foundWords).toEqual(['ABC']);
    expect(harness.audio).toEqual(['letterKey', 'letterKey', 'letterKey', 'submitValid']);
    const snapshot = harness.lifecycle.snapshot();
    expect(snapshot.entry).toBe('');
    expect(snapshot.entryStatus).toBeNull();
    expect(snapshot.listedFound).toEqual([
      { length: 3, index: 0, word: 'ABC', revealed: false },
    ]);
    expect(snapshot.remainingCounts[3]).toBe(1);
    expect(snapshot.deck?.available.every((available) => available)).toBe(true);
  });

  test('already-found word: boing, no score, entry kept (O15(b))', () => {
    const harness = makeHarness();
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    typeWord(harness.lifecycle, 'ABC');
    pressEnter(harness.lifecycle);
    harness.audio.length = 0;

    typeWord(harness.lifecycle, 'ABC');
    expect(harness.lifecycle.snapshot().entryStatus).toBe('already-found');
    pressEnter(harness.lifecycle);
    expect(harness.lifecycle.score).toBe(450);
    expect(harness.lifecycle.foundWords).toEqual(['ABC']);
    expect(harness.audio).toEqual(['letterKey', 'letterKey', 'letterKey', 'submitAlreadyFound']);
    expect(harness.lifecycle.snapshot().entry).toBe('ABC');
  });

  test('invalid word and empty submit: buzz, no score, entry kept (O15(a)/(f))', () => {
    const harness = makeHarness();
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    typeWord(harness.lifecycle, 'ABD');
    expect(harness.lifecycle.snapshot().entryStatus).toBeNull();
    pressEnter(harness.lifecycle);
    expect(harness.lifecycle.score).toBe(0);
    expect(harness.lifecycle.foundWords).toEqual([]);
    expect(harness.audio.at(-1)).toBe('submitInvalid');
    expect(harness.lifecycle.snapshot().entry).toBe('ABD');

    // BACKSPACE twice -> entry "A", then empty ENTER reaches the buzz (O15(f))
    harness.lifecycle.handleKey({ keyCode: 8 });
    harness.lifecycle.handleKey({ keyCode: 8 });
    expect(harness.lifecycle.snapshot().entry).toBe('A');
    harness.lifecycle.handleKey({ keyCode: 8 });
    expect(harness.lifecycle.snapshot().entry).toBe('');
    expect(harness.audio.at(-1)).toBe('delete');
    pressEnter(harness.lifecycle);
    expect(harness.audio.at(-1)).toBe('submitInvalid');
    expect(harness.lifecycle.score).toBe(0);
  });

  test('pending bonus pays once through the D3 scoring rule (O02)', () => {
    const harness = makeHarness({ bonusRandom: ALWAYS_LUCKY });
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    typeWord(harness.lifecycle, 'ABC');
    pressEnter(harness.lifecycle);
    // lucky roll on the first add: ball = 1, valid submit pays base + bonus once
    expect(harness.lifecycle.score).toBe(450 + constants.scoring.bonusPoints);
    // the submit cleared the entry (bonusball reset); a new lucky roll may set
    // a fresh ball on the next add, so the next word pays the bonus again —
    // the reference rolls on every add while ball === -1.
    typeWord(harness.lifecycle, 'BCD');
    pressEnter(harness.lifecycle);
    expect(harness.lifecycle.score).toBe(2 * (450 + constants.scoring.bonusPoints));
  });

  test('scramble clears the entry, resets a pending bonus and reshuffles (D2 §6.1)', () => {
    const harness = makeHarness({ bonusRandom: ALWAYS_LUCKY, rounds: [detailedRound(), simpleRound('next', 'HGFEDCBA')] });
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    typeWord(harness.lifecycle, 'AB');
    harness.audio.length = 0;

    const event = harness.lifecycle.scramble();
    expect(event.type).toBe('scramble');
    expect(harness.lifecycle.snapshot().entry).toBe('');
    expect(harness.audio).toEqual(['scramble']);
    // second shuffle of the session uses base + 1
    expect(harness.lifecycle.snapshot().deck?.order).toEqual(shuffleOrder(8, SHUFFLE_SEED_BASE + 1));

    harness.lifecycle.newRound();
    expect(harness.lifecycle.snapshot().deck?.order).toEqual(shuffleOrder(8, SHUFFLE_SEED_BASE + 2));
  });

  test('submit outside a live round is ignored (locked input)', () => {
    const harness = makeHarness();
    harness.lifecycle.start();
    expect(harness.lifecycle.submit('ABC')).toBe('ignored');
    expect(harness.audio).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Completion: all listed slots filled (O13, cap-aware)
// ---------------------------------------------------------------------------

describe('completion (O13)', () => {
  test('every listed slot filled completes the round and adds the time bonus', () => {
    const harness = makeHarness();
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    harness.clock.advance(100_000); // remaining 100 s
    expect(harness.lifecycle.remainingSeconds).toBe(100);

    let expected = 0;
    DETAILED_WORDS.forEach((word, index) => {
      expected += scoreWord(word, -1, constants.scoring).totalPoints;
      expect(harness.lifecycle.submit(word)).toBe('valid');
      if (index < DETAILED_WORDS.length - 1) {
        expect(harness.lifecycle.state).toBe('playing');
      }
    });

    expect(harness.lifecycle.state).toBe('celebration');
    expect(harness.lifecycle.snapshot().inputLocked).toBe(true);
    expect(harness.completed).toEqual(['all-found']);
    const timeBonus = 100 * constants.scoring.timeFactor;
    expect(harness.lifecycle.snapshot().timeBonus).toBe(timeBonus);
    expect(harness.lifecycle.score).toBe(expected + timeBonus);
    expect(harness.lifecycle.remainingSeconds).toBe(100);
    expect(harness.lifecycle.remainingMs).toBe(100_000);
    expect(harness.lifecycle.snapshot().listedFound).toHaveLength(DETAILED_WORDS.length);
  });

  test('FİNALİZM completes after the 35 listed slots (10/10/10/4/0/1, cap-aware)', () => {
    const harness = makeHarness({ rounds: ROUNDS });
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    const round = harness.lifecycle.selectRound('FİNALİZM');
    expect(harness.lifecycle.snapshot().listedSlotCounts).toEqual({
      3: 10,
      4: 10,
      5: 10,
      6: 4,
      7: 0,
      8: 1,
    });
    const script: string[] = [];
    for (const length of [3, 4, 5, 6, 7, 8] as const) {
      script.push(...round.words[length].slice(0, LISTING_CAP));
    }
    expect(script).toHaveLength(35);

    let expected = 0;
    for (const word of script) {
      expected += scoreWord(word, -1, constants.scoring).totalPoints;
      expect(harness.lifecycle.submit(word)).toBe('valid');
    }
    expect(harness.lifecycle.state).toBe('celebration');
    // A2-labels §3: words beyond the listing cap stay unlisted and the bN
    // counter can stay > 0 after completion.
    expect(harness.lifecycle.snapshot().remainingCounts).toEqual({
      3: 18,
      4: 31,
      5: 7,
      6: 0,
      7: 0,
      8: 0,
    });
    expect(harness.lifecycle.score).toBe(expected + 200 * constants.scoring.timeFactor);
    expect(harness.lifecycle.foundWords).toEqual(script);
  });

  test('input is locked during the completion sequence; Yeni Oyun restarts', () => {
    const harness = makeHarness({ rounds: [detailedRound(), simpleRound('next', 'HGFEDCBA')] });
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    for (const word of DETAILED_WORDS) harness.lifecycle.submit(word);
    expect(harness.lifecycle.state).toBe('celebration');
    const audioCount = harness.audio.length;

    expect(harness.lifecycle.handleKey({ keyCode: 65 })).toEqual({ type: 'rejected', reason: 'locked' });
    expect(harness.lifecycle.submit('ABC')).toBe('ignored');
    expect(harness.lifecycle.scramble().type).toBe('rejected');
    expect(harness.lifecycle.deleteLast().type).toBe('rejected');
    const submitEvent = harness.lifecycle.submitCurrent();
    expect(submitEvent).toEqual({ type: 'rejected', reason: 'locked' });
    expect(harness.audio.length).toBe(audioCount);

    const next = harness.lifecycle.newRound();
    expect(next.main).toBe('HGFEDCBA');
    expect(harness.lifecycle.state).toBe('playing');
    expect(harness.lifecycle.score).toBe(0);
    expect(harness.lifecycle.foundWords).toEqual([]);
    expect(harness.lifecycle.snapshot().boardRevealed).toBe(false);
    expect(harness.audio.at(-1)).toBe('roundStart');
  });
});

// ---------------------------------------------------------------------------
// Timeout (O14)
// ---------------------------------------------------------------------------

describe('timeout (O14)', () => {
  test('entry is discarded, board revealed, input locked, no time bonus', () => {
    const harness = makeHarness({ rounds: [detailedRound(), simpleRound('next', 'HGFEDCBA')] });
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    typeWord(harness.lifecycle, 'ABCD');
    expect(harness.lifecycle.snapshot().entry).toBe('ABCD');
    harness.audio.length = 0;

    harness.clock.advance(constants.timer.initialSeconds * constants.timer.tickMs);

    expect(harness.lifecycle.state).toBe('timeout');
    expect(harness.completed).toEqual(['timeout']);
    expect(harness.lifecycle.snapshot().entry).toBe('');
    expect(harness.lifecycle.snapshot().boardRevealed).toBe(true);
    expect(harness.lifecycle.snapshot().inputLocked).toBe(true);
    expect(harness.lifecycle.score).toBe(0);
    expect(harness.lifecycle.snapshot().timeBonus).toBe(0);
    // countdown sound in the last 10 seconds (9..1) then finishsound once
    expect(harness.audio.filter((event) => event === 'countdown')).toHaveLength(9);
    expect(harness.audio.filter((event) => event === 'timeout')).toHaveLength(1);
    // every listed slot is revealed, in board order, none marked found
    expect(harness.lifecycle.snapshot().listedFound.map((word) => word.word)).toEqual([
      'ABC',
      'BCD',
      'ABCD',
      'EFGH',
      'ABCDE',
      'ABCDEF',
      'ABCDEFG',
      'ABCDEFGH',
    ]);
    expect(harness.lifecycle.snapshot().listedFound.every((word) => word.revealed)).toBe(true);
    expect(harness.lifecycle.foundWords).toEqual([]);

    // the timeout sequence is locked; Yeni Oyun starts the next round
    expect(harness.lifecycle.handleKey({ keyCode: 65 })).toEqual({ type: 'rejected', reason: 'locked' });
    expect(harness.lifecycle.newRound().main).toBe('HGFEDCBA');
    expect(harness.lifecycle.state).toBe('playing');
    expect(harness.lifecycle.remainingSeconds).toBe(constants.timer.initialSeconds);
  });

  test('reveal keeps the found words in their slots and fills the rest in list order', () => {
    const harness = makeHarness();
    harness.lifecycle.start();
    harness.lifecycle.newRound();
    harness.lifecycle.submit('BCD');
    harness.clock.advance(constants.timer.initialSeconds * constants.timer.tickMs);
    const listed = harness.lifecycle.snapshot().listedFound;
    expect(listed[0]).toEqual({ length: 3, index: 0, word: 'BCD', revealed: false });
    expect(listed[1]).toEqual({ length: 3, index: 1, word: 'ABC', revealed: true });
    expect(listed.filter((word) => word.revealed)).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// V7 — constant sources / V2 — ad identifiers (O19)
// ---------------------------------------------------------------------------

const GAME_VALUE_LITERALS = [200, 1000, 50, 5000, 100];

function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
  return withoutBlockComments
    .split('\n')
    .map(stripLineComment)
    .join('\n');
}

/** Remove a `//` line comment outside string literals (a URL's `//` stays). */
function stripLineComment(line: string): string {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote !== null) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '/' && line[index + 1] === '/') {
      return line.slice(0, index);
    }
  }
  return line;
}

describe('source scans', () => {
  test('V7: lifecycle/state never hardcode game values nor read constants.json', () => {
    for (const file of ['src/game/lifecycle.ts', 'src/game/state.ts']) {
      const code = stripComments(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
      for (const value of GAME_VALUE_LITERALS) {
        expect(code, `${file} contains the literal ${value}`).not.toMatch(
          new RegExp(`\\b${value}\\b`),
        );
      }
      expect(code).not.toMatch(/data\/constants\.json/);
    }
  });

  test('V7: shuffle base seed and listing cap equal the recorded values', () => {
    expect(SHUFFLE_SEED_BASE).toBe(constants.bonusLetter.seed);
    expect(SHUFFLE_SEED_BASE).toBe(2012);
    expect(LISTING_CAP).toBe(10);
  });

  test('V2: zero ad-network identifiers (O19 list) anywhere in src/', () => {
    // O19 identifiers (evidence/A2-mochi.md §2–§3): the MochiAds invocation,
    // its global/state properties, the ad host and the ad slot id. The scan
    // covers every text file under src/ (the ad script would have to appear in
    // one of them); binary assets (.mp3/.png) carry no code.
    const identifiers: readonly RegExp[] = [
      /MochiAd\.showPreGameAd/, // `MochiAd.showPreGameAd({id:...})` call
      /_mochiad|mochiad_options/i, // `_mochiad*` state/properties, `mochiad_options`
      /x\.mochiads\.com/i, // the blocked ad host (evidence/A2-mochi.md §2)
      /951545f2fdfbf4a6/i, // the ad slot id in the invocation
    ];
    const textFile = /\.(ts|mts|js|mjs|json|svg|html|css|txt)$/;
    const files = listFiles(path.resolve(process.cwd(), 'src')).filter((file) =>
      textFile.test(file),
    );
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const identifier of identifiers) {
        if (identifier.test(text)) hits.push(`${path.relative(process.cwd(), file)}: ${identifier}`);
      }
    }
    expect(hits).toEqual([]);

    // Self-test: the scanner is not vacuous.
    const adCall = 'MochiAd.showPreGameAd({id:"951545f2fdfbf4a6"});';
    expect(identifiers.some((identifier) => identifier.test(adCall))).toBe(true);
    const commentOnly = '// the MochiAds frame-1 script is removed (O19)';
    expect(identifiers.some((identifier) => identifier.test(commentOnly))).toBe(false);
  });
});

function listFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
