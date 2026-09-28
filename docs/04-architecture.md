# 04 — Architecture

Goal: a static, serverless, offline-capable web app with zero runtime network
requests, scaling cleanly to any screen including fullscreen, at minimal
complexity.

---

## 1. Stack (fixed)

| Concern | Choice | Notes |
|---|---|---|
| Build tool | Vite (pinned) | Static output |
| Language | TypeScript (strict) | Single language for app and tools |
| UI | Plain DOM + CSS + SVG | No UI framework |
| Tests | Vitest (unit) + Playwright (E2E/visual) | Versions pinned |
| Lint/format | ESLint + Prettier | Pinned config committed |
| Package manager | npm with committed `package-lock.json` | Single choice; no alternatives |
| Runtime deps | None beyond the app itself | No analytics, no CDN, no external fonts |

## 2. Stage scaling specification

- Logical stage: **550 × 400** px. All layout uses stage coordinates.
- Wrapper computes uniform scale:
  `scale = min(viewportWidth / 550, viewportHeight / 400)`.
- Applied via `transform: scale(s)` on the stage root, centered both axes.
- Remaining viewport area (letterbox) is filled with the reference background
  color from `data/constants.json` (extracted value; site fallback `#9DAF48`).
- Fractional scaling is allowed (vectors stay crisp). No integer-only scaling.
- Recompute on: `resize`, `orientationchange`, `fullscreenchange`.
- Fullscreen: `requestFullscreen()` on user gesture; ESC handled natively;
  scaling uses the same formula with the fullscreen element's dimensions.
- Device pixel ratio: SVG assets render sharp at any DPR; bitmap behavior per
  `docs/03` §2. No CSS `image-rendering` overrides unless A3 evidence shows the
  original used nearest-neighbor rendering for a bitmap.

## 3. Runtime constraints

- Zero network requests after page load. All assets local.
- No cookies; `localStorage` only for volume (`kelimator.volume`), mirroring
  the original's `remembervol` shared object.
- No service worker in the base build (optional PWA is explicitly out of
  scope; offline works because everything is local when served from a folder).

## 4. Source layout

```
src/
  main.ts            # bootstrap
  stage.ts           # scaler, fullscreen, viewport handling
  game/
    state.ts         # finite state machine
    round.ts         # round model + loader (validates rounds.json)
    tiles.ts         # deck + tile states
    input.ts         # keyboard + pointer handling
    scoring.ts       # scoring engine (constants from data/constants.json)
    timer.ts         # countdown
    lifecycle.ts     # round start/end, completion sequences
  ui/
    board.ts         # layout rendering from data/layout.json
    hud.ts           # counters, found list, score
    message.ts       # transient messages
  audio/
    audio.ts         # event→sound mapping consumer (data/sound-map.json)
  data/              # GENERATED files consumed at runtime
    rounds.json
    constants.json
    sound-map.json   # copied from /data at build time
```

## 5. Data files

- `data/rounds.schema.json`, `data/constants.schema.json`,
  `data/sound-map.schema.json` — frozen interfaces (created by C1).
- `src/data/rounds.json` — produced by B3 (committed).
- `src/data/constants.json` — produced by A2 (committed).
- `src/data/sound-map.json` — produced by A2 (committed).
- `src/data/layout.json`, `src/data/animation.json` — produced by A3 (committed).

> Amendment 2026-09-28 (orchestrator): runtime data paths are fixed as the task
> files execute them, superseding the A2/A3 `src/data/…` attributions above:
> A2 authors `data/constants.json` and `data/sound-map.json`; A3 authors
> `data/layout.json` and `data/animation.json`; E1 copies layout/animation into
> `src/data/`; B3 writes `src/data/rounds.json`. Consumers follow their task
> files (`D1`: `src/data/rounds.json`; `D2`/`D3`/`D4`/`D5`/`C2`:
> `data/constants.json`, `data/sound-map.json`; `E2`/`E3`: `src/data/`).
> Matching entry: `docs/08-open-items.md` (Amendments).

## 6. Test hooks (contract for E2E)

- `window.__game` exposes read-only getters: current state, round id, found
  words, score, remaining time (ms), and `lastAudioEvent`.
- All interactive elements carry stable `data-testid` attributes
  (`tile-0`…`tile-7`, `entry`, `score`, `timer`, `found-list`, buttons).
- The app emits nothing to the network; the UI must function with devtools
  offline (verified in G5).

## 7. Commands (fixed)

| Command | Purpose |
|---|---|
| `npm run dev` | Local development |
| `npm run build` | Static production build |
| `npm test` | Vitest unit/integration |
| `npm run lint` | ESLint |
| `npm run e2e` | Playwright suites (visual + playthrough) |
| `tools/verify-all.sh` | Full gate matrix, single entry point |

## 8. Non-goals

Backends, accounts, analytics, PWA install flow, i18n, mobile app packaging.
