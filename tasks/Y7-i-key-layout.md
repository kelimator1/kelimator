# TASK Y7 — Dotted/Dotless İ Input on Any Layout (owner directive)

- Workstream: Y (owner presentation wave follow-up)
- Parallel group: Y (single task)
- Depends on: D2 (input), X1 (interaction suite)
- Owned paths: `src/game/input.ts` (`resolveKey` letter resolution only), `tests/input.test.ts`, `evidence/D2-input.md` (§2 dated amendment note only), `evidence/Y7-*`, `evidence/logs/Y7-*`

## Defect (owner-investigated; no layout detection allowed)
- The 2012 table matches by Flash/Windows physical-position key codes: `73 → I` (dotless), `222 → İ` (dotted) (`evidence/A2-input.md` §2; data `LETTER_KEY_CODES`).
- Measured on this Mac (layout Turkish-QWERTY-PC, `UCKeyTranslate`): physical ANSI_I produces `ı`; ANSI_Quote produces `i`. The browser evidently reports codes derived from the produced character for these keys, so a pressed `i` lands on the dotless-I code → in rounds containing `İ` (most words) nothing happens. All other letters are unaffected (no dotted/dotless split).
- Owner decision: layout-agnostic behavior — the produced character must win (`'i' → İ`, `'ı' → I` on every layout). **Do NOT add keyboard-type detection or heuristics.**

## Steps
1. `src/game/input.ts` `resolveKey`: letter resolution priority = `key` (produced character, Turkish-uppercased, accepted only if within the 29-letter alphabet) → `keyCode` (existing table) → `code` (physical). Action keys (SPACE/ENTER/BACKSPACE) keep their current handling untouched. Add an `// evidence:` comment citing the measured conflict.
2. `tests/input.test.ts`: add the conflict regressions — `{ keyCode: 73, key: 'i' } → İ` and `{ keyCode: 222, key: 'ı' } → I`; keep the existing keyCode-only expectations (`73 → I`, `222 → İ`) and the key-only tests intact.
3. Dated amendment note appended to `evidence/D2-input.md` §2 (browser-mapping paragraph): modern browsers may report layout-derived keyCodes; produced-character priority is the compatibility rule; the keyCode table remains the fallback for synthetic/legacy events. (Do not rewrite the rest of the file.)
4. Evidence `evidence/Y7-i-key.md`: probe outputs (`UCKeyTranslate` results + before/after `resolveKey` behavior tables), suite results, and a proposed `docs/05` §3 amendment line for the orchestrator.

## Unknowns
- None.

## Verify
- `npm test -- input` passes with the conflict regressions; `npm run e2e -- interaction` 6/6; `npm run e2e -- playthrough` 3/3 unaffected; full `npm test`, `npm run lint`, `npm run build` green.
- Closing: `tools/verify-all.sh` exit 0 (orchestrator).

## Evidence
- `evidence/Y7-i-key.md` + logs `evidence/logs/Y7-*`.

## Done
- Verify passes; committed as `task: Y7 i-key layout fix`.
