// tests/audio.test.ts — D4 unit tests (V4, V7) for src/audio/audio.ts.
//
// Audio safety (EXECUTION.md §8 "Silent witness runs"): every manager under
// test receives an injected fake element factory and an in-memory storage; no
// real HTMLAudioElement is constructed and nothing is ever played audibly.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_EVENT_NAMES,
  clampVolume,
  createAudioManager,
  DEFAULT_VOLUME,
  getAudioManager,
  getLastAudioEvent,
  playAudioEvent,
  setVolume,
  soundFileForEvent,
  UnknownAudioEventError,
  VOLUME_STORAGE_KEY,
  type AudioElementLike,
  type AudioManagerOptions,
  type AudioStorage,
} from '../src/audio/audio';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const sfxDir = path.join(repoRoot, 'src', 'assets', 'sfx');
const soundMapPath = path.join(repoRoot, 'data', 'sound-map.json');

/** The 10 call sites tabulated in evidence/A2-sounds.md §2 (frozen names). */
const A2_EVENT_NAMES = [
  'roundStart',
  'scramble',
  'delete',
  'submitValid',
  'submitAlreadyFound',
  'submitInvalid',
  'letterKey',
  'tileClick',
  'countdown',
  'timeout',
] as const;

/** The 9 DefineSound ids exported by A1 (evidence/A1-export-manifest.md §6). */
const A1_SOUND_IDS = ['22', '24', '26', '30', '32', '34', '36', '38', '40'];

interface RawSoundMap {
  schemaVersion: number;
  sounds: Record<string, { file: string; durationSec: number }>;
  events: Record<string, { soundId: number; evidence: string }>;
}

const rawSoundMap = JSON.parse(readFileSync(soundMapPath, 'utf8')) as RawSoundMap;

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

describe('V7 — data/sound-map.json is the code contract', () => {
  it('declares exactly the 10 A2 call-site events (file and code agree)', () => {
    expect(Object.keys(rawSoundMap.events).sort()).toEqual([...A2_EVENT_NAMES].sort());
    expect([...AUDIO_EVENT_NAMES].sort()).toEqual([...A2_EVENT_NAMES].sort());
    expect(AUDIO_EVENT_NAMES).toHaveLength(10);
  });

  it('maps the 10 events onto the 9 A1 sound ids', () => {
    expect(Object.keys(rawSoundMap.sounds).sort()).toEqual([...A1_SOUND_IDS].sort());
    const referenced = new Set(Object.values(rawSoundMap.events).map((event) => event.soundId));
    expect([...referenced].sort()).toEqual([...A1_SOUND_IDS].map(Number).sort());
  });

  it('uses docs/03 §1 runtime names and carries per-event evidence', () => {
    for (const [eventName, event] of Object.entries(rawSoundMap.events)) {
      const file = rawSoundMap.sounds[String(event.soundId)].file;
      expect(file, eventName).toMatch(/^sfx_\d+_[a-z]+\.mp3$/);
      expect(event.evidence.length, eventName).toBeGreaterThan(0);
    }
  });
});

describe('event → file coverage', () => {
  it('every event resolves to its mapped file, and every file exists non-empty', () => {
    for (const [eventName, event] of Object.entries(rawSoundMap.events)) {
      const expectedFile = rawSoundMap.sounds[String(event.soundId)].file;
      expect(soundFileForEvent(eventName), eventName).toBe(expectedFile);

      const filePath = path.join(sfxDir, expectedFile);
      expect(existsSync(filePath), `${expectedFile} missing under src/assets/sfx/`).toBe(true);
      expect(statSync(filePath).size, `${expectedFile} is empty`).toBeGreaterThan(0);
    }
  });

  it('throws UnknownAudioEventError for unknown event names', () => {
    expect(() => soundFileForEvent('notAnEvent')).toThrow(UnknownAudioEventError);
    expect(() => soundFileForEvent('')).toThrow(UnknownAudioEventError);
  });
});

describe('playback routing (fake elements only)', () => {
  it('routes each event to the mapped file on a pooled element', () => {
    for (const [eventName, event] of Object.entries(rawSoundMap.events)) {
      const { manager, elements } = makeManager();
      expect(manager.play(eventName), eventName).toBe(true);
      expect(elements, eventName).toHaveLength(1);
      expect(elements[0].src, eventName).toBe(
        `/assets/sfx/${rawSoundMap.sounds[String(event.soundId)].file}`,
      );
      expect(elements[0].playCalls, eventName).toBe(1);
    }
  });

  it('stops pooled playback before the next sound (reference: stopAllSounds)', () => {
    const { manager, elements } = makeManager();
    manager.play('letterKey');
    manager.play('submitInvalid');
    expect(elements).toHaveLength(2);
    expect(elements[0].pauseCalls).toBeGreaterThan(0);
    expect(elements[1].playCalls).toBe(1);
    expect(elements[1].src).toBe('/assets/sfx/sfx_40_buzz.mp3');
  });

  it('never starts playback while muted but still records the requested event', () => {
    const { manager, elements } = makeManager();
    manager.setVolume(0);
    expect(manager.play('roundStart')).toBe(false);
    expect(elements).toHaveLength(0);
    expect(manager.getLastEvent()).toBe('roundStart');
  });

  it('throws for unknown events in dev and ignores them otherwise', () => {
    const devManager = makeManager({ dev: true }).manager;
    expect(() => devManager.play('notAnEvent')).toThrow(UnknownAudioEventError);
    expect(devManager.getLastEvent()).toBeNull();

    const prodManager = makeManager({ dev: false }).manager;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(prodManager.play('notAnEvent')).toBe(false);
      expect(prodManager.getLastEvent()).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('destroy() stops playback and releases the pool', () => {
    const { manager, elements } = makeManager();
    manager.play('roundStart');
    manager.destroy();
    expect(elements[0].pauseCalls).toBeGreaterThan(0);
    manager.play('submitValid');
    expect(elements).toHaveLength(2);
  });
});

describe('volume persistence — kelimator.volume (0–100)', () => {
  it('defaults to 100 when unset and does not write on read', () => {
    expect(DEFAULT_VOLUME).toBe(100);
    const storage = memoryStorage();
    const tracked = trackedElements();
    const manager = createAudioManager({
      storage,
      createElement: tracked.create,
      resolveUrl: (file) => file,
    });
    expect(manager.volume).toBe(100);
    expect(storage.map.has(VOLUME_STORAGE_KEY)).toBe(false);
  });

  it('persists under kelimator.volume and reloads it', () => {
    const storage = memoryStorage();
    const tracked = trackedElements();
    const first = createAudioManager({ storage, createElement: tracked.create });
    expect(first.setVolume(37)).toBe(37);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('37');

    const second = createAudioManager({ storage, createElement: tracked.create });
    expect(second.volume).toBe(37);
  });

  it('clamps to 0–100 on set and on load', () => {
    const storage = memoryStorage();
    const tracked = trackedElements();
    const manager = createAudioManager({ storage, createElement: tracked.create });

    expect(manager.setVolume(150)).toBe(100);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('100');
    expect(manager.setVolume(-20)).toBe(0);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('0');
    expect(manager.setVolume(42.4)).toBe(42);

    const reload = (stored: string): number => {
      storage.map.set(VOLUME_STORAGE_KEY, stored);
      return createAudioManager({ storage, createElement: tracked.create }).volume;
    };
    expect(reload('999')).toBe(100);
    expect(reload('-3')).toBe(0);
    expect(reload('64')).toBe(64);
    expect(reload('not-a-number')).toBe(100);
    expect(reload('')).toBe(100);
    expect(reload('   ')).toBe(100);
  });

  it('clampVolume rounds and bounds non-finite input to the default', () => {
    expect(clampVolume(50)).toBe(50);
    expect(clampVolume(100.6)).toBe(100);
    expect(clampVolume(-0.4)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(DEFAULT_VOLUME);
  });

  it('applies the stored volume to pooled elements and live-updates them', () => {
    const { manager, elements } = makeManager();
    manager.setVolume(25);
    manager.play('roundStart');
    expect(elements[0].volume).toBe(0.25);
    manager.setVolume(80);
    expect(elements[0].volume).toBe(0.8);
    expect(manager.volume).toBe(80);
  });

  it('recovers from a throwing storage without breaking volume or playback', () => {
    const throwing: AudioStorage = {
      getItem(): string | null {
        throw new Error('storage unavailable');
      },
      setItem(): void {
        throw new Error('storage unavailable');
      },
    };
    const tracked = trackedElements();
    const manager = createAudioManager({ storage: throwing, createElement: tracked.create });
    expect(manager.volume).toBe(DEFAULT_VOLUME);
    expect(manager.setVolume(30)).toBe(30);
    expect(manager.play('scramble')).toBe(true);
  });
});

describe('module-level default manager (silent stubs)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bootstraps volume from localStorage and feeds getLastAudioEvent', () => {
    const storage = memoryStorage({ [VOLUME_STORAGE_KEY]: '64' });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('Audio', FakeAudioElement);

    expect(getAudioManager().volume).toBe(64); // bootstrap read (docs/04 §3)
    expect(getLastAudioEvent()).toBeNull();

    expect(playAudioEvent('timeout')).toBe(true);
    expect(getLastAudioEvent()).toBe('timeout');

    expect(setVolume(10)).toBe(10);
    expect(storage.map.get(VOLUME_STORAGE_KEY)).toBe('10');

    // Vitest runs as a dev environment: unknown names are rejected by default.
    expect(() => getAudioManager().play('notAnEvent')).toThrow(UnknownAudioEventError);
  });
});
