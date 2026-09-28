# TASK E1 — Asset Integration

- Workstream: E (visuals)
- Parallel group: 4
- Depends on: A3, C2
- Owned paths: `src/assets/**`, `tools/process-assets.*`, `src/data/layout.json`, `src/data/animation.json`, `evidence/E1-*`

> Amendment 2026-09-28 (orchestrator): Owned paths additionally include a
> minimal, exact-pinned `svgo` devDependency addition to root
> `package.json`/`package-lock.json` (no other dependency changes); re-run
> C1's verification set (build/test/lint) after the change and record it.
> Owned paths also include `tests/assets.test.mjs` — the file the Verify
> block's `npm test -- assets` requires. Silent witness runs (`EXECUTION.md`
> §8) are mandatory: sound files are hashed with `shasum`, never played;
> screenshot comparisons run through the muted Playwright setup
> (`--mute-audio`). Recorded in `docs/08-open-items.md` (Amendments).

## Steps (inputs and details)
- Inputs: `artifacts/decompiled/{svg,img,sfx}/**` (A1),
  `data/layout.json`, `data/animation.json` (A3)

1. Implement `tools/process-assets.*`:
   - SVG: optimize with a pinned SVGO version; verify byte-level geometry
     preservation by comparing rendered snapshots before/after
     (Playwright screenshot of each asset in isolation; pass if zero visual
     difference).
   - Images: apply the `docs/03` §2 decision procedure per bitmap; record the
     chosen path (as-is / one deterministic upscale / SVG-CSS equivalent) with
     hashes.
   - Sounds: verify each file matches A1 hashes; copy to `src/assets/sfx/`.
2. Copy processed assets to `src/assets/svg/`, `src/assets/img/`,
   `src/assets/sfx/` with the naming convention from `docs/03` §1.
3. Copy `data/layout.json` and `data/animation.json` to `src/data/` and ensure
   every `asset` reference resolves to a file that exists.
4. Write an asset manifest `src/assets/manifest.json` (name → sha256 → source).

## Unknowns
- O08/O09/O10 must be RESOLVED before start. O18 must be RESOLVED (layout wins
  from 2012).

## Verify
- V2: every `layout.json` asset reference resolves; SVG set parses; image
  dimensions match the catalog values (± 0).
- V1: manifest hashes recorded; sound hashes equal A1 hashes.
- V5 self-check: before/after SVGO screenshots identical (zero mismatched
  pixels) for every SVG.
- V4: `npm test -- assets` (manifest coverage: every asset used is listed;
  every listed asset exists).

## Evidence
- `evidence/E1-assets.md` (manifest summary, decisions, hashes)
- `evidence/visual/E1-svgo/` (before/after screenshots)
- `evidence/logs/E1-*.log`

## Done
- Verify passes; committed.
