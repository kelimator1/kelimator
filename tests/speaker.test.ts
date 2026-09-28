// tests/speaker.test.ts — X3 speaker-toggle unit tests (reference semantics).
//
// Reference evidence (verbatim excerpts in evidence/X3-speaker.md §1):
// - `DefineButton2_90/BUTTONCONDACTION on(release).as` L1-L13 — the speaker
//   button (`spk_btn`): `if(_root.vol)` → `_root.vol = 0; stopAllSounds();`
//   else `_root.vol = 1`; then `remembervol.data.vol = _root.vol` persists it.
// - `frame_2/DoAction.as` L1-L9 — boot restores `vol` from the shared object,
//   default `vol = 1`; `frame_131/DoAction.as` L130-L140 — `ses_cikart` gates
//   every sound on `if(vol)`.
// - The rebuild stores the same state as `kelimator.volume` on the D4 0–100
//   scale (0 = muted / `vol` false, 100 = full / `vol = 1`; docs/04 §3,
//   evidence/D4-audio.md §4).
//
// Silent witness runs (EXECUTION.md §8): every manager under test receives an
// injected fake element factory and an in-memory storage; no real
// HTMLAudioElement is constructed and nothing is played audibly.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampVolume,
  createAudioManager,
  DEFAULT_VOLUME,
  getLastAudioEvent,
  getVolume,
  isMuted,
  MAX_VOLUME,
  MIN_VOLUME,
  playAudioEvent,
  toggleMute,
  VOLUME_STORAGE_KEY,
  type AudioElementLike,
  type AudioManagerOptions,
  type AudioStorage,
} from '../src/audio/audio';

/** Silent stand-in for HTMLAudioElement (never a real media element). */
class FakeAudioElement implements AudioElementLike {
  src = '';
  volume = 1;
  paused = true;
  ended = false;
  /** Mirrors HTMLAudioElement.preload, which the default factory sets. */
  preload = '';
  playCalls = 0;
  pauseCalls = 0;

  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

interface FakeStorage extends AudioStorage {
  readonly map: Map<string, string>;
}

function memoryStorage(initial: Record<string, string> = {}): FakeStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

function trackedElements(): { elements: FakeAudioElement[]; create: () => AudioElementLike } {
  const elements: FakeAudioElement[] = [];
  return {
    elements,
    create(): AudioElementLike {
      const element = new FakeAudioElement();
      elements.push(element);
      return element;
    },
  };
}

function makeManager(overrides: Partial<AudioManagerOptions> = {}): {
  manager: ReturnType<typeof createAudioManager>;
  storage: FakeStorage;
  elements: FakeAudioElement[];
} {
  const storage = memoryStorage();
  const tracked = trackedElements();
  const manager = createAudioManager({
    storage,
    createElement: tracked.create,
    resolveUrl: (file) => `/assets/sfx/${file}`,
    ...overrides,
  });
  return { manager, storage, elements: tracked.elements };
}

describe('speaker toggle — reference on(release) semantics', () => {
  it('mutes with stopAllSounds and unmutes to full volume, persisting each step', () => {
    const { manager, storage, elements } = makeManager();
    expect(manager.isMuted()).toBe(false);

    manager.play('roundStart');
    expect(elements).toHaveLength(1);
    expect(elements[0].paused).toBe(false);

    // `if(_root.vol)` branch (L2-L6): vol = 0 and stopAllSounds().
    expect(manager.toggleMute()).toBe(MIN_VOLUME);
    expect(manager.volume).toBe(MIN_VOLUME);
    expect(manager.isMuted()).toBe(true);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('0');
    expect(elements[0].pauseCalls).toBeGreaterThan(0);

    // The gate: nothing new plays while muted; the hook still records the
    // requested event (docs/04 §6 — a state hook, never audibility).
    expect(manager.play('letterKey')).toBe(false);
    expect(manager.getLastEvent()).toBe('letterKey');
    expect(elements).toHaveLength(1);
    // The muted play still ran the reference's `stopAllSounds()` first
    // (frame_131 L132); record the count so the unmute can assert no resume.
    const pausesAfterMutedPlay = elements[0].pauseCalls;

    // `else` branch (L7-L10): vol = 1 (full volume); nothing is resumed.
    expect(manager.toggleMute()).toBe(DEFAULT_VOLUME);
    expect(manager.volume).toBe(DEFAULT_VOLUME);
    expect(manager.isMuted()).toBe(false);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('100');
    expect(elements[0].pauseCalls).toBe(pausesAfterMutedPlay);
    expect(elements[0].playCalls).toBe(1);
    expect(elements[0].volume).toBe(1); // full scale re-applied to the pool
  });

  it('toggles between exactly 0 and 100 over repeated presses', () => {
    const { manager } = makeManager();
    for (let press = 0; press < 5; press += 1) {
      expect(manager.toggleMute()).toBe(press % 2 === 0 ? MIN_VOLUME : DEFAULT_VOLUME);
      expect(manager.isMuted()).toBe(press % 2 === 0);
    }
  });

  it('unmutes to full volume after a partial volume (reference `vol` is boolean)', () => {
    const { manager, storage, elements } = makeManager();
    expect(manager.setVolume(37)).toBe(37);
    manager.play('scramble');
    expect(elements[0].volume).toBe(0.37);

    expect(manager.toggleMute()).toBe(MIN_VOLUME);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('0');
    expect(elements[0].volume).toBe(0);

    // L9 `_root.vol = 1`: the reference restores full volume, not 37.
    expect(manager.toggleMute()).toBe(DEFAULT_VOLUME);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('100');
    expect(elements[0].volume).toBe(1);
  });

  it('records the requested event while muted and resumes playback after unmute', () => {
    const { manager, elements } = makeManager();
    manager.toggleMute();
    expect(manager.play('timeout')).toBe(false);
    expect(manager.getLastEvent()).toBe('timeout');
    expect(elements).toHaveLength(0);

    manager.toggleMute();
    expect(manager.play('timeout')).toBe(true);
    expect(elements).toHaveLength(1);
    expect(elements[0].playCalls).toBe(1);
  });
});

describe('speaker persistence — kelimator.volume (0 or 100)', () => {
  it('defaults to 100, never writes on boot, and toggleMute persists both states', () => {
    const storage = memoryStorage();
    const tracked = trackedElements();
    const manager = createAudioManager({ storage, createElement: tracked.create });
    expect(manager.volume).toBe(DEFAULT_VOLUME);
    expect(manager.isMuted()).toBe(false);
    expect(storage.map.has(VOLUME_STORAGE_KEY)).toBe(false); // read-only boot

    manager.toggleMute();
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('0');
    manager.toggleMute();
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('100');
  });

  it('round-trips the muted state through a fresh manager (boot restore)', () => {
    const storage = memoryStorage();
    const tracked = trackedElements();
    const first = createAudioManager({ storage, createElement: tracked.create });
    first.toggleMute(); // -> 0
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('0');

    const second = createAudioManager({ storage, createElement: tracked.create });
    expect(second.volume).toBe(MIN_VOLUME);
    expect(second.isMuted()).toBe(true);
    expect(second.toggleMute()).toBe(DEFAULT_VOLUME);

    const third = createAudioManager({ storage, createElement: tracked.create });
    expect(third.volume).toBe(DEFAULT_VOLUME);
    expect(third.isMuted()).toBe(false);
  });

  it('keeps the toggle inside the 0–100 domain after clamped stored values', () => {
    const storage = memoryStorage({ [VOLUME_STORAGE_KEY]: '999' });
    const tracked = trackedElements();
    expect(createAudioManager({ storage, createElement: tracked.create }).volume).toBe(MAX_VOLUME);

    const muted = createAudioManager({
      storage: memoryStorage({ [VOLUME_STORAGE_KEY]: '-3' }),
      createElement: tracked.create,
    });
    expect(muted.volume).toBe(MIN_VOLUME);
    expect(muted.isMuted()).toBe(true);
    // A muted boot toggles straight to full volume.
    expect(muted.toggleMute()).toBe(DEFAULT_VOLUME);

    const corrupt = createAudioManager({
      storage: memoryStorage({ [VOLUME_STORAGE_KEY]: 'not-a-number' }),
      createElement: tracked.create,
    });
    expect(corrupt.volume).toBe(DEFAULT_VOLUME);
  });

  it('clampVolume bounds non-finite and out-of-range input', () => {
    expect(clampVolume(MIN_VOLUME)).toBe(0);
    expect(clampVolume(MAX_VOLUME)).toBe(100);
    expect(clampVolume(150)).toBe(MAX_VOLUME);
    expect(clampVolume(-0.4)).toBe(MIN_VOLUME);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(DEFAULT_VOLUME);
  });
});

describe('app-wide speaker toggle (module singleton, silent stubs)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('toggles kelimator.volume and still records lastAudioEvent while muted', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('Audio', FakeAudioElement);

    expect(getVolume()).toBe(DEFAULT_VOLUME);
    expect(isMuted()).toBe(false);
    expect(storage.map.has(VOLUME_STORAGE_KEY)).toBe(false);

    expect(playAudioEvent('roundStart')).toBe(true);
    expect(getLastAudioEvent()).toBe('roundStart');

    expect(toggleMute()).toBe(MIN_VOLUME);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('0');
    expect(isMuted()).toBe(true);
    expect(playAudioEvent('letterKey')).toBe(false);
    expect(getLastAudioEvent()).toBe('letterKey');

    expect(toggleMute()).toBe(DEFAULT_VOLUME);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('100');
    expect(isMuted()).toBe(false);
    expect(playAudioEvent('timeout')).toBe(true);
    expect(getLastAudioEvent()).toBe('timeout');
  });
});
