# TASK X3 — Speaker Toggle (owner defect 3)

- Workstream: X (owner defect wave)
- Parallel group: X
- Depends on: D4, D5 (completed)
- Owned paths: `src/audio/audio.ts`, `src/ui/hud.ts`, `tests/speaker.test.ts`, `tests/e2e/speaker/**`, `evidence/X3-*`, `evidence/logs/X3-*`

## Inputs
- Layout element `btn_speaker` (`s90_btn_speaker.svg`, bitmap 86 / sprite 87 with frame label `on` — A1 fonts/bitmaps evidence); `docs/04` §3 (volume persistence `kelimator.volume`), `docs/02` §6/§7; `evidence/A2-*.md` (strings/labels/sounds); D4 audio API (`src/audio/audio.ts`); C3 scenario mode (read-only, for reference observation if needed)

## Steps
1. **Evidence first**: extract the speaker control's reference semantics from the decompiled ActionScript (button/sprite 87 frames, `on(release)` handlers, volume/sound gating) and/or observe the reference via C3's scenario mode. If exact semantics cannot be evidenced, implement the evidenced core (toggle sound on/off with persisted volume) and record the remainder as an open-item proposal — no guessing.
2. Implement end-to-end: the control (use the existing `btn_speaker` board element; add listener/visual state without disturbing E2's layout render) + audio-manager wiring (mute/unmute or evidenced equivalent) + persistence (`kelimator.volume`, default 100).
3. Tests: unit — toggle semantics, persistence round-trip, default value, clamp; e2e — click the speaker control and assert state/persistence + `lastAudioEvent` behavior with mute state (SILENT: the browser is launched with `--mute-audio`; never play audible sound).

## Unknowns
- Reference semantics of the speaker control may be partially un-evidenced: implement the evidenced core and PROPOSE an open item; do not block.

## Verify
- `npm test -- speaker` passes (unit).
- `npm run e2e -- speaker` passes (click + assertions).
- Full `npm test`, `npm run lint`, `npm run build` green.

## Evidence
- `evidence/X3-speaker.md` (extracted semantics with excerpt refs, implementation, tests, any open-item proposal)
- `evidence/logs/X3-*.log`

## Done
- Verify passes; committed as `task: X3 speaker toggle`.
