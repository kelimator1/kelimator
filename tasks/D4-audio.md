# TASK D4 — Audio Manager

- Workstream: D (core)
- Parallel group: 4
- Depends on: A2 (sound map resolved)
- Owned paths: `src/audio/audio.ts`, `tests/audio.test.ts`, `evidence/D4-*`

## Inputs
- `data/sound-map.json` (A2; if missing or containing OPEN items, do not start)
- `artifacts/decompiled/sfx/` (A1) — during development only; runtime uses
  `src/assets/sfx/` after E1. Until E1 completes, use copies under
  `src/assets/sfx/` produced here from A1 exports with recorded hashes.
- `docs/04-architecture.md` §3 (volume persistence)

## Steps
1. Implement `audio.ts`:
   - load the sound map; each event → one sound file
   - playback with an audio element pool; no seeking or resampling
   - expose `lastAudioEvent` for test hooks
2. Volume persistence in `localStorage` key `kelimator.volume` (0–100), loaded
   at bootstrap; default value recorded from evidence if the reference exposes
   one, otherwise 100 with a note (no invented behavior in gameplay; volume
   default is presentation-only and is recorded as a decision).
3. Copy the mapped sound payloads from A1 exports into `src/assets/sfx/` with
   the names from `data/sound-map.json`; record SHA-256 for each.
4. Unit tests: every event in the map resolves to an existing file; unknown
   event throws in dev; volume persists and clamps to 0–100.

## Unknowns
- O06 must be RESOLVED before start. O11 may add a streaming/music element; if
  O11 resolved it as in-scope, integrate per its evidence; otherwise EXCLUDED.

## Verify
- V4: `npm test -- audio` passes.
- V7: event names in code equal the keys of `data/sound-map.json` (test).
- V1: SHA-256 of each `src/assets/sfx/*` equals the hash recorded for the
  corresponding A1 export.

## Evidence
- `evidence/D4-audio.md` (map coverage, hashes, volume default decision)
- `evidence/logs/D4-*.log`

## Done
- Verify passes; committed.
