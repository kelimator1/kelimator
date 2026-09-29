// evidence/Y7-probe-input.ts — task Y7: resolveKey behavior matrix probe.
//
// Prints one TSV line per case: label, JSON event, resolved outcome. Run it
// against the pre-Y7 and post-Y7 `src/game/input.ts`; the two logs are combined
// into the before/after table in evidence/Y7-i-key.md §2.
//
// Run (repo root):
//   node --experimental-strip-types evidence/Y7-probe-input.ts
//
// Node type stripping is enough: `src/game/input.ts` imports only the type
// `Deck` from `./tiles` (type-only import, erased at load).
import { resolveKey, type KeyEventLike } from '../src/game/input.ts';

interface ProbeCase {
  readonly label: string;
  readonly event: KeyEventLike;
}

// The measured conflict: on this Mac the browser reports layout-derived
// keyCodes (task Y7 directive; reproduced with the UCKeyTranslate probe in
// evidence/logs/Y7-uckeytranslate.log). The mirror event is the required unit
// regression shape.
const cases: readonly ProbeCase[] = [
  // Measured conflict / required regressions.
  { label: 'mac ANSI_Quote pressed (i) with dotless-I code 73', event: { keyCode: 73, key: 'i', code: 'Quote' } },
  { label: 'mac ANSI_I pressed (ı) with dotted-İ code 222', event: { keyCode: 222, key: 'ı', code: 'KeyI' } },
  { label: 'regression shape {keyCode:73, key:i}', event: { keyCode: 73, key: 'i' } },
  { label: 'regression shape {keyCode:222, key:ı}', event: { keyCode: 222, key: 'ı' } },
  { label: 'press KeyI (US event shape)', event: { keyCode: 73, key: 'i', code: 'KeyI' } },
  { label: 'press Quote (US event shape)', event: { keyCode: 222, key: "'", code: 'Quote' } },
  // keyCode-only fallback (O04 table, unchanged).
  { label: 'keyCode 73 only', event: { keyCode: 73 } },
  { label: 'keyCode 222 only', event: { keyCode: 222 } },
  { label: 'keyCode 65 only', event: { keyCode: 65 } },
  { label: 'keyCode 220 only', event: { keyCode: 220 } },
  { label: 'keyCode 186 only', event: { keyCode: 186 } },
  { label: 'keyCode 17 only (CTRL)', event: { keyCode: 17 } },
  { label: 'keyCode 81 only (Q)', event: { keyCode: 81 } },
  // key-only (produced character).
  { label: 'key i', event: { key: 'i' } },
  { label: 'key ı', event: { key: 'ı' } },
  { label: 'key İ', event: { key: 'İ' } },
  { label: 'key I', event: { key: 'I' } },
  { label: 'key a', event: { key: 'a' } },
  { label: 'key q', event: { key: 'q' } },
  { label: 'key 1', event: { key: '1' } },
  { label: 'key Dead', event: { key: 'Dead' } },
  // code-only (physical).
  { label: 'code KeyI', event: { code: 'KeyI' } },
  { label: 'code KeyA', event: { code: 'KeyA' } },
  { label: 'code KeyQ', event: { code: 'KeyQ' } },
  { label: 'code Quote', event: { code: 'Quote' } },
  // Mixed priority.
  { label: 'mixed {65,b,KeyB}', event: { keyCode: 65, key: 'b', code: 'KeyB' } },
  { label: 'mixed {222,a}', event: { keyCode: 222, key: 'a' } },
  { label: 'mixed {0,b,KeyB}', event: { keyCode: 0, key: 'b', code: 'KeyB' } },
  { label: 'mixed {0,KeyB}', event: { keyCode: 0, code: 'KeyB' } },
  // Action keys (must stay untouched).
  { label: 'action keyCode 32', event: { keyCode: 32 } },
  { label: 'action keyCode 13', event: { keyCode: 13 } },
  { label: 'action keyCode 8', event: { keyCode: 8 } },
  { label: 'action key Space', event: { key: ' ' } },
  { label: 'action key Enter', event: { key: 'Enter' } },
  { label: 'action key Backspace', event: { key: 'Backspace' } },
  { label: 'action code Space', event: { code: 'Space' } },
  { label: 'action code Enter', event: { code: 'Enter' } },
  { label: 'action code Backspace', event: { code: 'Backspace' } },
  // Edge.
  { label: 'empty event', event: {} },
  { label: 'CTRL full event', event: { keyCode: 17, key: 'Control', code: 'ControlLeft' } },
];

for (const { label, event } of cases) {
  const result = resolveKey(event);
  const summary =
    result.kind === 'letter'
      ? `letter ${result.letter}`
      : result.kind === 'action'
        ? `action ${result.action}`
        : 'none';
  console.log(`${label}\t${JSON.stringify(event)}\t${summary}`);
}
