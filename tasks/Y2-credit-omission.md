# TASK Y2 — Credit Sprite Omission (owner final wave; owner Task B)

- Workstream: Y (owner presentation wave)
- Parallel group: Y (serialized after Y1 — shared files)
- Depends on: Y1 (provides the diff `--ignore-rect` mechanism)
- Owned paths: `src/ui/board.ts` (omission list + dead `ELEMENT_DELTA` entries), `tests/e2e/visual-states.ts`, `tests/e2e/visual.spec.ts`, `tests/e2e/animations/**`, `tests/e2e/playthrough/**`, `evidence/Y2-*`, `evidence/logs/Y2-*`

## Inputs
- `src/ui/board.ts` (`ELEMENT_DELTA` entries `credit_line`/`credit_site`; element loop)
- `tests/e2e/visual-states.ts` (`BOARD_ELEMENTS`), `tests/e2e/visual.spec.ts` (`V7_SAMPLE`)
- `verify/diff/README.md` (`--ignore-rect` from Y1)
- Sprites: `credit_line` (DefineSprite_97 → `s97`, "Diğer oyunlar") and `credit_site` (DefineSprite_103 → `s103`, "kelimator.com"); visible bbox union (0, 367)–(105, 403)

## Steps
1. `src/ui/board.ts`: explicit omission list for `credit_line` and `credit_site` with a dated `// evidence:` comment; delete the now-dead `ELEMENT_DELTA` entries for both; ensure NO DOM nodes are created for them (the element loop must skip before creation).
2. Tests: drop both ids from `BOARD_ELEMENTS` and `credit_line` from `V7_SAMPLE`; add assertions that `[data-element="credit_line"]` and `[data-element="credit_site"]` are absent from the rendered board.
3. Wire the credit rect `0,367,105,36` (tight box covering the visible sprite bbox) into the visual/animation/playthrough comparison calls via `--ignore-rect`; document as the owner-approved omission region.
4. Keep `data/layout.json`, `src/data/layout.json` and the `s97`/`s103` assets untouched (provenance only); prove with a grep that nothing references them at runtime afterwards.
5. Dated amendment (orchestrator applies): renderer omission + diff basis in `docs/07` §4.

## Unknowns
- None.

## Verify
- Absence assertions pass; `grep` shows no runtime references to `s97`/`s103`.
- `npm run e2e -- visual`, `-- animation`, `-- playthrough` green with the credit ignore-rect; `npm test`, `npm run lint`, `npm run build` green.

## Evidence
- `evidence/Y2-credits.md` (omission mechanism, rect wiring, grep proof, suite results)
- `evidence/logs/Y2-*`

## Done
- Verify passes; committed as `task: Y2 credit sprite omission`.
