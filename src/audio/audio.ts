// src/audio/audio.ts — audio manager: event→sound mapping and volume
// (docs/04-architecture.md §3–§4; docs/05-game-core.md §1).
//
// Contract (docs/03-assets-and-visuals.md §5): `data/sound-map.json` is the
// frozen event→sound map; consumers must not invent events. The 10 events map
// onto 9 DefineSound payloads exported byte-identically from the 2012 SWF
// (evidence/A2-sounds.md §2–§3; evidence/A1-export-manifest.md §6).
//
// Audio safety (EXECUTION.md §8 "Silent witness runs"): `AudioElementLike`
// exposes no `currentTime` and no `playbackRate`, so playback is a pool of
// fresh elements without seeking or resampling; tests inject fake elements and
// storages — a real element is never constructed or played in Node.
import soundMapJson from '../../data/sound-map.json';

/** One sound definition from data/sound-map.json (docs/03 §5 shape). */
export interface SoundEntry {
  /** Runtime file name (`sfx_<soundId>_<slug>.mp3`, docs/03 §1). */
  readonly file: string;
  readonly durationSec: number;
}

/** One event→sound mapping from data/sound-map.json. */
export interface EventEntry {
  readonly soundId: number;
  /** Call-site evidence recorded by A2 (evidence/A2-sounds.md §2). */
  readonly evidence: string;
}

/** Typed view of data/sound-map.json. */
export interface SoundMap {
  readonly schemaVersion: number;
  readonly sounds: Readonly<Record<string, SoundEntry | undefined>>;
  readonly events: Readonly<Record<string, EventEntry | undefined>>;
}

/**
 * The frozen event→sound map.
 * evidence: data/sound-map.json (A2, sha256
 * fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09;
 * evidence/A2-sounds.md §4); schema data/sound-map.schema.json (C1).
 */
export const SOUND_MAP: SoundMap = soundMapJson;

/** Union of the event names present in data/sound-map.json. */
export type AudioEventName = keyof typeof soundMapJson.events;

/**
 * Event names in map order.
 * evidence: keys of `events` in data/sound-map.json; the same 10 call sites
 * are tabulated in evidence/A2-sounds.md §2. V7 (`npm test -- audio`) asserts
 * this list equals both the file keys and the A2 table.
 */
export const AUDIO_EVENT_NAMES: readonly AudioEventName[] = Object.freeze(
  Object.keys(soundMapJson.events) as AudioEventName[],
);

/** Error thrown for event names that are not keys of data/sound-map.json. */
export class UnknownAudioEventError extends Error {
  constructor(eventName: string) {
    super(
      `unknown audio event ${JSON.stringify(eventName)}: not a key of data/sound-map.json "events"`,
    );
    this.name = 'UnknownAudioEventError';
  }
}

/**
 * Resolve the runtime file for an event.
 * evidence: `event.soundId` → `sounds[soundId].file` in data/sound-map.json;
 * runtime names per docs/03-assets-and-visuals.md §1; A1 export sources in
 * evidence/A2-sounds.md §3.
 * Throws UnknownAudioEventError for unknown names (single resolution point).
 */
export function soundFileForEvent(eventName: string): string {
  const event = SOUND_MAP.events[eventName];
  if (event === undefined) throw new UnknownAudioEventError(eventName);
  const sound = SOUND_MAP.sounds[String(event.soundId)];
  if (sound === undefined) {
    throw new Error(
      `data/sound-map.json: event ${JSON.stringify(eventName)} references undefined sound id ${event.soundId}`,
    );
  }
  return sound.file;
}

/**
 * Storage facade used for volume persistence; `window.localStorage` satisfies
 * it. Tests inject an in-memory replacement (EXECUTION.md §8).
 */
export interface AudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The subset of HTMLMediaElement used for playback. It deliberately exposes
 * no seeking (`currentTime`) and no rate control (`playbackRate`), so neither
 * can be used by this module (no seeking, no resampling).
 */
export interface AudioElementLike {
  src: string;
  volume: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play(): Promise<void>;
  pause(): void;
}

/** Options for {@link createAudioManager}; all browser APIs are injectable. */
export interface AudioManagerOptions {
  /**
   * Volume storage; defaults to `localStorage` when available, otherwise
   * persistence is disabled (in-memory only).
   */
  storage?: AudioStorage | null;
  /** Element factory; defaults to `new Audio()`. Tests inject fakes. */
  createElement?: () => AudioElementLike;
  /** URL resolver for a `sounds[].file` name; defaults to the bundled URL. */
  resolveUrl?: (file: string) => string;
  /** Pool capacity (elements are created lazily). */
  poolSize?: number;
  /**
   * Unknown-event strictness. Defaults to `import.meta.env.DEV` (true under
   * Vite dev and vitest, false in production bundles), where unknown names
   * throw instead of being ignored.
   */
  dev?: boolean;
}

/** Audio manager contract (docs/05-game-core.md §1: events; volume; lastAudioEvent). */
export interface AudioManager {
  /** Current volume, 0–100 (loaded from storage at construction). */
  readonly volume: number;
  /**
   * Last event name passed to {@link AudioManager.play}, or null before the
   * first call. This is the `window.__game.lastAudioEvent` source
   * (docs/04 §6) — a state hook, never evidence of audibility.
   */
  getLastEvent(): AudioEventName | null;
  /**
   * Play the sound mapped to `eventName`.
   * @returns true when playback started; false when muted or (prod mode) unknown.
   * @throws UnknownAudioEventError for unknown names in dev mode.
   */
  play(eventName: string): boolean;
  /** Persist + apply a volume (clamped to 0–100); returns the stored value. */
  setVolume(volume: number): number;
  /** True when muted (volume 0; the reference `vol` boolean, false). */
  isMuted(): boolean;
  /**
   * Toggle the reference speaker state
   * (`DefineButton2_90/BUTTONCONDACTION on(release).as` L1-L13): sound on →
   * volume 0 + `stopAllSounds()`; muted → full volume. Persists through
   * {@link setVolume}; never starts playback on unmute.
   * @returns 0 after muting, {@link DEFAULT_VOLUME} after unmuting.
   */
  toggleMute(): number;
  /** Stop every pooled element; mirrors the reference's `stopAllSounds()`. */
  stopAll(): void;
  /** Stop playback and release the pool. */
  destroy(): void;
}

/** Key fixed by docs/04-architecture.md §3: "localStorage only for volume (`kelimator.volume`)". */
export const VOLUME_STORAGE_KEY = 'kelimator.volume';

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;

/**
 * Default volume, full scale.
 * evidence: artifacts/decompiled/scripts/frame_2/DoAction.as L1-L9 — the boot
 * script restores `remembervol.data.vol` from the `data` shared object and
 * falls back to `vol = 1` (full volume) when no value is stored; the reference
 * gates playback on the truthy `vol` (`frame_131/DoAction.as` L130-L140).
 * `vol = 1` maps to 100 on the 0–100 scale fixed by the D4 task / docs/04 §3;
 * the scale itself is the app's interface (the reference stores a boolean).
 */
export const DEFAULT_VOLUME = 100;

/**
 * Clamp/round a volume to the fixed 0–100 range; non-finite input falls back
 * to {@link DEFAULT_VOLUME} (a corrupt stored value must not break boot).
 */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, Math.round(value)));
}

/**
 * Read the persisted volume; missing/blank/non-numeric values fall back to
 * {@link DEFAULT_VOLUME}. Reads never write (the reference only persists on
 * toggle — `DefineButton2_90/BUTTONCONDACTION on(release).as` L11-L12).
 */
export function readStoredVolume(storage: AudioStorage | null): number {
  if (storage === null) return DEFAULT_VOLUME;
  let raw: string | null;
  try {
    raw = storage.getItem(VOLUME_STORAGE_KEY);
  } catch {
    return DEFAULT_VOLUME;
  }
  if (raw === null || raw.trim() === '') return DEFAULT_VOLUME;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_VOLUME;
  return clampVolume(parsed);
}

/** Vite injects `import.meta.env`; vitest/dev run with DEV=true. */
function detectDevEnvironment(): boolean {
  // The shape is asserted locally so this module needs no ambient vite/client
  // types; production bundles still get the statically replaced value.
  const meta = import.meta as unknown as { env?: { DEV?: boolean } };
  return meta.env?.DEV ?? true;
}

const DEV_ENVIRONMENT = detectDevEnvironment();

/** Pool capacity: no seeking, so a fresh element serves each re-trigger. */
const DEFAULT_POOL_SIZE = 4;

function defaultStorage(): AudioStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Storage access can throw (e.g. privacy mode); volume is best-effort.
    return null;
  }
}

function defaultCreateElement(): AudioElementLike {
  const element = new Audio();
  element.preload = 'auto'; // tiny local payloads; no rate/payload change
  return element;
}

function defaultResolveUrl(file: string): string {
  // Bundled asset URL for `src/assets/sfx/<file>` (docs/03 §1); Vite rewrites
  // this dynamic `new URL(..., import.meta.url)` pattern at build time.
  return new URL(`../assets/sfx/${file}`, import.meta.url).href;
}

class PooledAudioManager implements AudioManager {
  private readonly storage: AudioStorage | null;
  private readonly createElement: () => AudioElementLike;
  private readonly resolveUrl: (file: string) => string;
  private readonly poolSize: number;
  private readonly dev: boolean;
  private readonly pool: AudioElementLike[] = [];
  private nextIndex = 0;
  private lastEventName: AudioEventName | null = null;
  private currentVolume: number;

  constructor(options: AudioManagerOptions = {}) {
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.createElement = options.createElement ?? defaultCreateElement;
    this.resolveUrl = options.resolveUrl ?? defaultResolveUrl;
    this.poolSize = Math.max(1, Math.floor(options.poolSize ?? DEFAULT_POOL_SIZE));
    this.dev = options.dev ?? DEV_ENVIRONMENT;
    // Bootstrap read (docs/04 §3): volume is restored from localStorage.
    this.currentVolume = readStoredVolume(this.storage);
  }

  get volume(): number {
    return this.currentVolume;
  }

  getLastEvent(): AudioEventName | null {
    return this.lastEventName;
  }

  play(eventName: string): boolean {
    const event = SOUND_MAP.events[eventName];
    if (event === undefined) {
      if (this.dev) throw new UnknownAudioEventError(eventName);
      console.warn(`[audio] ignoring unknown event ${JSON.stringify(eventName)}`);
      return false;
    }
    // Test hook (docs/04 §6): record the requested event even while muted —
    // E2E asserts the event→sound mapping, never audibility (EXECUTION.md §8).
    this.lastEventName = eventName as AudioEventName;
    // Reference order: `ses_cikart` runs `stopAllSounds()` before the `if(vol)`
    // gate (artifacts/decompiled/scripts/frame_131/DoAction.as L130-L140).
    this.stopAll();
    if (this.currentVolume === 0) return false;
    const file = soundFileForEvent(eventName);
    const element = this.nextElement();
    element.src = this.resolveUrl(file);
    element.volume = this.currentVolume / MAX_VOLUME;
    // Autoplay rejection is non-fatal; gameplay never depends on audibility.
    void element.play().catch((error: unknown) => {
      console.warn(`[audio] play() rejected for ${JSON.stringify(eventName)}:`, error);
    });
    return true;
  }

  setVolume(volume: number): number {
    this.currentVolume = clampVolume(volume);
    if (this.storage !== null) {
      try {
        this.storage.setItem(VOLUME_STORAGE_KEY, String(this.currentVolume));
      } catch {
        // Persistence is best-effort (private mode, quota); apply anyway.
      }
    }
    for (const element of this.pool) element.volume = this.currentVolume / MAX_VOLUME;
    // Muting stops current playback (reference mute branch:
    // DefineButton2_90/BUTTONCONDACTION on(release).as L2-L6 `stopAllSounds()`).
    if (this.currentVolume === 0) this.stopAll();
    return this.currentVolume;
  }

  isMuted(): boolean {
    return this.currentVolume === MIN_VOLUME;
  }

  toggleMute(): number {
    // Reference order (`DefineButton2_90/BUTTONCONDACTION on(release).as`
    // L1-L13): the truthy branch sets vol = 0 and calls stopAllSounds() —
    // setVolume(0) stops the pool; the else branch only sets vol = 1 (full
    // volume) — nothing is played or resumed on unmute.
    return this.isMuted() ? this.setVolume(DEFAULT_VOLUME) : this.setVolume(MIN_VOLUME);
  }

  stopAll(): void {
    for (const element of this.pool) element.pause();
  }

  destroy(): void {
    this.stopAll();
    this.pool.length = 0;
  }

  private nextElement(): AudioElementLike {
    if (this.pool.length < this.poolSize) {
      const element = this.createElement();
      this.pool.push(element);
      return element;
    }
    const element = this.pool[this.nextIndex % this.pool.length];
    this.nextIndex = (this.nextIndex + 1) % this.pool.length;
    return element;
  }
}

/**
 * Create an audio manager. Construction performs the volume bootstrap read;
 * browser APIs are injectable (tests always inject fakes, EXECUTION.md §8).
 */
export function createAudioManager(options: AudioManagerOptions = {}): AudioManager {
  return new PooledAudioManager(options);
}

let defaultManager: AudioManager | null = null;

/** Lazily-created app-wide manager (first call performs the volume bootstrap read). */
export function getAudioManager(): AudioManager {
  defaultManager ??= createAudioManager();
  return defaultManager;
}

/** Play an event through the app-wide manager (gameplay integration point for D5). */
export function playAudioEvent(eventName: string): boolean {
  return getAudioManager().play(eventName);
}

/**
 * `lastAudioEvent` test hook (docs/04-architecture.md §6; docs/05 §8): the last
 * event passed to {@link playAudioEvent}, or null before the first play.
 * D5 wires this into `window.__game.lastAudioEvent`.
 */
export function getLastAudioEvent(): AudioEventName | null {
  return defaultManager?.getLastEvent() ?? null;
}

/** Volume of the app-wide manager (0–100). */
export function getVolume(): number {
  return getAudioManager().volume;
}

/** Persist + apply volume on the app-wide manager; returns the clamped value. */
export function setVolume(volume: number): number {
  return getAudioManager().setVolume(volume);
}

/** Whether the app-wide manager is muted (volume 0; reference `spk_btn`). */
export function isMuted(): boolean {
  return getAudioManager().isMuted();
}

/**
 * Toggle the app-wide speaker state (reference `spk_btn` / `DefineButton2_90`
 * `on(release)`): sound on → mute (volume 0 + stopAllSounds), muted → full
 * volume; both persist under {@link VOLUME_STORAGE_KEY}. Returns the new volume.
 */
export function toggleMute(): number {
  return getAudioManager().toggleMute();
}
