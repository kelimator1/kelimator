# Y7 — Dotted/Dotless İ Input on Any Layout (owner directive) — evidence

Task: Y7 — Dotted/Dotless İ Input on Any Layout (`tasks/Y7-i-key-layout.md`).
Owner-investigated defect: the 2012 numeric table matches Flash/Windows
physical-position key codes — `73 → I` (dotless), `222 → İ` (dotted)
(`evidence/A2-input.md` §2, `LETTER_KEY_CODES` in `src/game/input.ts`) — while
this Mac (layout Turkish-QWERTY-PC) reports layout-derived keyCodes for the
dotted/dotless pair, so a produced `i` resolved to dotless `I` and rounds
containing `İ` (most words) ignored the press. Owner decision: layout-agnostic
produced-character priority (`'i'` → `İ`, `'ı'` → `I` on every layout); no
keyboard-type detection, no heuristics.

Started: 2026-09-29T14:03Z (first artifact `evidence/Y7-probe-uckeytranslate.c`)
Ended: 2026-09-29T14:18Z (last verification run `npm run build` 14:13Z;
synthetic-key probe 14:17Z; evidence finalized after — see §5)
Host+OS: dev-host.home / macOS (hidden, arm64 / arm64 host) · Node
v22.14.0 · npm 10.9.0 · @playwright/test 1.63.0 (`evidence/logs/Y7-env.log`)
Result: **PASS** (final statuses in §5)

All browser work ran muted Chromium (`--mute-audio`, `playwright.config.ts`);
no sound was played or decoded. No `docs/**` file was written (proposal §7);
no git operation; `../kelimator-nostalji/` was not touched. Writes went only
to the task's owned paths: `src/game/input.ts` (`resolveKey` only),
`tests/input.test.ts`, `evidence/D2-input.md` (§2 note only), `evidence/Y7-*`,
`evidence/logs/Y7-*`.

---

## 1. What changed

| Item | Change |
|---|---|
| `src/game/input.ts` (`resolveKey`) | Letter priority is now `key` (produced character, Turkish-uppercased, accepted only within the 29-letter alphabet) → `keyCode` (existing O04 table) → `code` (physical). Action keys SPACE/ENTER/BACKSPACE keep their D2 handling (`keyCode` → `key` → `code`). An `// evidence:` comment cites the measured conflict. No other function/table touched. |
| `tests/input.test.ts` | New conflict regressions `{keyCode:73, key:'i'} → İ` and `{keyCode:222, key:'ı'} → I`; the former "keyCode wins over key/code" test rewritten to the new letter priority ("letters: key wins over keyCode/code; a keyCode letter is the fallback"); every keyCode-only expectation (`73 → I`, `222 → İ`, full 29-pair table) and every key-only test kept intact. |
| `evidence/D2-input.md` §2 | Dated amendment note added after the browser resolution order (layout-derived keyCodes; produced-character compatibility rule; keyCode table as synthetic/legacy fallback). No other line of the file changed (§6 hashes). |

No other file changed: `src/game/tiles.ts`, `src/game/lifecycle.ts`,
`src/main.ts` and `data/constants.json` are byte-identical to the pre-task
state (`evidence/logs/Y7-hash-diff.log`; pre-hash of `src/game/input.ts` equals
D2's recorded `797cb8b0…`, so the starting tree was the committed one).

## 2. Probe outputs

### 2.1 UCKeyTranslate — owner measurement reproduced

Owner measurement (task directive): physical ANSI_I produces `ı`; ANSI_Quote
produces `i` (layout Turkish-QWERTY-PC, `UCKeyTranslate`). Y7 reproduced it
with `evidence/Y7-probe-uckeytranslate.c` (compiled with
`clang -framework Carbon`, `UCKeyTranslate`, `kUCKeyActionDown`, no modifiers;
run log `evidence/logs/Y7-uckeytranslate.log`):

| Physical key | kVK | Produced | Unicode |
|---|---|---|---|
| ANSI_I | `0x22` (34) | `ı` | U+0131 |
| ANSI_Quote | `0x27` (39) | `i` | U+0069 |

Input source: `com.apple.keylayout.Turkish-QWERTY-PC` ("Turkish Q");
`LMGetKbdType()` 92. The same log maps the other Turkish-QWERTY-PC positions
for completeness (`ANSI_Semicolon` → U+015F ş, `ANSI_LBracket` → U+011F ğ,
`ANSI_Comma` → U+00F6 ö, `ANSI_Period` → U+00E7 ç, `ANSI_RBracket` → U+00FC ü).
Browser-side observation ("the browser evidently reports layout-derived
keyCodes for these keys", i.e. a produced `i` arrives with keyCode 73 and a
produced `ı` with keyCode 222) is the owner's measurement from the task
directive; it is not reproducible through Playwright, whose synthetic events
carry Playwright's own US-layout keyCode. Y7 measured those synthetic shapes
separately (`evidence/Y7-probe-quoteevent.mjs`, log
`evidence/logs/Y7-playwright-key-probe.log`, Chromium 153.0.8010.12):
`press('Quote')` → `{"key":"'","code":"Quote","keyCode":222}` and
`press('KeyI')` → `{"key":"i","code":"KeyI","keyCode":73}` (Space/Enter/
Backspace → `32`/`13`/`8`).

### 2.2 `resolveKey` before/after behavior table

`evidence/Y7-probe-input.ts` (run with `node --experimental-strip-types`)
against the pre-Y7 and post-Y7 module; raw logs
`evidence/logs/Y7-before-resolvekey.log` / `Y7-after-resolvekey.log`,
combined machine-generated table `evidence/logs/Y7-resolvekey-table.log`.
"Before" = D2 (`keyCode` → `key` → `code` for letters); "after" = Y7.

| Case | Event | Before (D2) | After (Y7) |
|---|---|---|---|
| mac ANSI_Quote pressed (i) with dotless-I code 73 | `{"keyCode":73,"key":"i","code":"Quote"}` | letter I | **letter İ** |
| mac ANSI_I pressed (ı) with dotted-İ code 222 | `{"keyCode":222,"key":"ı","code":"KeyI"}` | letter İ | **letter I** |
| regression shape {keyCode:73, key:i} | `{"keyCode":73,"key":"i"}` | letter I | **letter İ** |
| regression shape {keyCode:222, key:ı} | `{"keyCode":222,"key":"ı"}` | letter İ | **letter I** |
| press KeyI (US event shape) | `{"keyCode":73,"key":"i","code":"KeyI"}` | letter I | **letter İ** |
| press Quote (US event shape) | `{"keyCode":222,"key":"'","code":"Quote"}` | letter İ | letter İ |
| keyCode 73 only | `{"keyCode":73}` | letter I | letter I |
| keyCode 222 only | `{"keyCode":222}` | letter İ | letter İ |
| keyCode 65 only | `{"keyCode":65}` | letter A | letter A |
| keyCode 220 only | `{"keyCode":220}` | letter Ç | letter Ç |
| keyCode 186 only | `{"keyCode":186}` | letter Ş | letter Ş |
| keyCode 17 only (CTRL) | `{"keyCode":17}` | none | none |
| keyCode 81 only (Q) | `{"keyCode":81}` | none | none |
| key i | `{"key":"i"}` | letter İ | letter İ |
| key ı | `{"key":"ı"}` | letter I | letter I |
| key İ | `{"key":"İ"}` | letter İ | letter İ |
| key I | `{"key":"I"}` | letter I | letter I |
| key a | `{"key":"a"}` | letter A | letter A |
| key q | `{"key":"q"}` | none | none |
| key 1 | `{"key":"1"}` | none | none |
| key Dead | `{"key":"Dead"}` | none | none |
| code KeyI | `{"code":"KeyI"}` | letter I | letter I |
| code KeyA | `{"code":"KeyA"}` | letter A | letter A |
| code KeyQ | `{"code":"KeyQ"}` | none | none |
| code Quote | `{"code":"Quote"}` | none | none |
| mixed {65,b,KeyB} | `{"keyCode":65,"key":"b","code":"KeyB"}` | letter A | **letter B** |
| mixed {222,a} | `{"keyCode":222,"key":"a"}` | letter İ | **letter A** |
| mixed {0,b,KeyB} | `{"keyCode":0,"key":"b","code":"KeyB"}` | letter B | letter B |
| mixed {0,KeyB} | `{"keyCode":0,"code":"KeyB"}` | letter B | letter B |
| action keyCode 32 | `{"keyCode":32}` | action SPACE | action SPACE |
| action keyCode 13 | `{"keyCode":13}` | action ENTER | action ENTER |
| action keyCode 8 | `{"keyCode":8}` | action BACKSPACE | action BACKSPACE |
| action key Space | `{"key":" "}` | action SPACE | action SPACE |
| action key Enter | `{"key":"Enter"}` | action ENTER | action ENTER |
| action key Backspace | `{"key":"Backspace"}` | action BACKSPACE | action BACKSPACE |
| action code Space | `{"code":"Space"}` | action SPACE | action SPACE |
| action code Enter | `{"code":"Enter"}` | action ENTER | action ENTER |
| action code Backspace | `{"code":"Backspace"}` | action BACKSPACE | action BACKSPACE |
| empty event | `{}` | none | none |
| CTRL full event | `{"keyCode":17,"key":"Control","code":"ControlLeft"}` | none | none |

Exactly seven cases change (✓ intended, everything else byte-equal):

| Changed case | Before | After |
|---|---|---|
| mac ANSI_Quote pressed (i) with dotless-I code 73 | I | İ |
| mac ANSI_I pressed (ı) with dotted-İ code 222 | İ | I |
| regression shape {keyCode:73, key:i} | I | İ |
| regression shape {keyCode:222, key:ı} | İ | I |
| press KeyI (US event shape) | I | İ |
| mixed {65,b,KeyB} (letter vs letter) | A | B |
| mixed {222,a} (letter vs letter) | İ | A |

The last two are the intended letter-priority change for mixed events; every
action-key row, every keyCode-only row, every key-only row and every code-only
row is unchanged. `{keyCode:222, key:"'", code:"Quote"}` (the measured
Playwright `press('Quote')` shape, §2.1) still resolves to `İ` because `'` is
not a letter and the keyCode table remains primary for this event. The
measured `press('KeyI')` shape `{keyCode:73, key:'i', code:'KeyI'}` is the one
e2e-relevant shape that changes (I → İ), but no e2e step presses it: the
FİNALİZM bank has no dotless I and scripted words type `İ` through `Quote`
(§5).

## 3. `resolveKey` after the fix (verbatim, `src/game/input.ts`)

```ts
/**
 * Resolve one key event. Action keys (SPACE/ENTER/BACKSPACE) keep the D2
 * priority: `keyCode` (the evidenced `Key.isDown` codes) → `key` → `code`.
 * Letters use the Y7 priority: `key` (produced character, Turkish uppercase,
 * accepted only within the 29-letter alphabet) → `keyCode` (the evidenced O04
 * table) → `code` (physical `Key[A-Z]`). A field that maps to nothing does not
 * block the fallbacks (covers `keyCode = 0` and layout-specific values).
 * evidence: evidence/D2-input.md §2 (2026-09-29 amendment), evidence/Y7-i-key.md.
 */
export function resolveKey(event: KeyEventLike): KeyResolution {
  const keyCode = event.keyCode;
  const hasKeyCode = typeof keyCode === 'number' && Number.isFinite(keyCode);

  if (hasKeyCode) {
    const action = ACTION_KEY_CODES.get(keyCode);
    if (action !== undefined) {
      return { kind: 'action', action };
    }
  }

  const key = event.key;
  if (typeof key === 'string') {
    const action = ACTION_BY_KEY.get(key);
    if (action !== undefined) {
      return { kind: 'action', action };
    }
    // evidence: evidence/Y7-i-key.md §2 (probe reproduced in
    // evidence/logs/Y7-uckeytranslate.log) — measured on this Mac (layout
    // Turkish-QWERTY-PC; UCKeyTranslate): physical ANSI_I produces 'ı' and
    // ANSI_Quote produces 'i', while the browser reports layout-derived
    // keyCodes for these keys, so keyCode 73 arrives with a produced 'i' and
    // keyCode 222 with 'ı'. The produced character must win on every layout
    // ('i' → İ, 'ı' → I); the keyCode table stays the fallback for
    // synthetic/legacy events (evidence/D2-input.md §2, amendment 2026-09-29).
    const letter = letterFromKey(key);
    if (letter !== undefined) {
      return { kind: 'letter', letter };
    }
  }

  if (hasKeyCode) {
    const letter = LETTER_BY_KEY_CODE.get(keyCode);
    if (letter !== undefined) {
      return { kind: 'letter', letter };
    }
  }

  const code = event.code;
  if (typeof code === 'string') {
    const action = ACTION_BY_CODE.get(code);
    if (action !== undefined) {
      return { kind: 'action', action };
    }
    const letter = letterFromCode(code);
    if (letter !== undefined) {
      return { kind: 'letter', letter };
    }
  }

  return { kind: 'none' };
}
```

Minimal-diff property (verified by the §2 table): the change moves only the
`letterFromKey` check ahead of the `LETTER_BY_KEY_CODE` lookup; all three
action checks stay in their D2 positions.

## 4. Test changes (`tests/input.test.ts`)

New test in the O04 describe (the two required conflict regressions):

```ts
it('Y7 conflict: a produced i/ı beats the layout-derived keyCode (measured)', () => {
  // evidence/Y7-i-key.md §2 — on the measured Mac (layout Turkish-QWERTY-PC)
  // the browser reports keyCode 73 for a produced 'i' and keyCode 222 for
  // 'ı'; the produced character must win on every layout. The keyCode-only
  // rows above stay the fallback for synthetic/legacy events.
  expect(resolveKey({ keyCode: 73, key: 'i' })).toEqual({ kind: 'letter', letter: 'İ' });
  expect(resolveKey({ keyCode: 222, key: 'ı' })).toEqual({ kind: 'letter', letter: 'I' });
});
```

Rewritten test (the only existing test that encoded the old mixed-event order):
"letters: key wins over keyCode/code; a keyCode letter is the fallback" —
`{keyCode:65,key:'b',code:'KeyB'} → B`, `{keyCode:222,key:'a',code:'KeyA'} → A`,
`{keyCode:73,code:'KeyB'} → I` (table fallback), `{keyCode:0,key:'b',
code:'KeyB'} → B`, `{keyCode:0,code:'KeyB'} → B`, plus the unchanged
none/action assertions.

Kept intact: the full 29-pair `LETTER_KEY_CODES` equality test, "every
evidenced numeric code resolves to its letter" (includes `73 → I`), "Turkish
letters use their evidenced Flash codes" (includes `222 → İ`), all key-only
cases (`i → İ`, `ı → I`, …, `q → none`), all code-only cases and all action
tests.

## 5. Suite results (final; logs in `evidence/logs/`)

| Run | Command | Result |
|---|---|---|
| Unit (input, with regressions) | `NO_COLOR=1 npm test -- input` | **30/30 passed**, exit 0 (`Y7-test-input.log`; was 29, +1 conflict test) |
| Interaction | `NO_COLOR=1 npm run e2e -- interaction` | **6/6 passed**, exit 0 (`Y7-interaction.log`, 29.0 s; dsf 1+2 center clicks + O15(a)/(c)/(d)/(b)/(f)) |
| Playthrough | `NO_COLOR=1 npm run e2e -- playthrough` | **3/3 passed**, exit 0 (`Y7-playthrough.log`, 5.0 m; basic 44.1 s; F2 40 steps worst tolerant **1.217 %**; S9 timeout tolerant **0.511 %**, appWaitMs 200513; every compared step `ignoredPixels=68023`) |
| Unit (full) | `NO_COLOR=1 npm test` | **14 files / 239 tests passed**, exit 0 (`Y7-test-full.log`; was 238, +1) |
| Lint | `NO_COLOR=1 npm run lint` | exit 0 (`Y7-lint.log`) |
| Build | `NO_COLOR=1 npm run build` | exit 0 (`Y7-build.log`; bundle `dist/assets/index-D0uU31ou.js`; pre-existing chunk-size warning only) |

Closing `tools/verify-all.sh` is the orchestrator's (task Y7 Verify).

**Closing suites not required by Y7 but run at the gate.** They do not type
letters: `visual.spec.ts` uses no keyboard at all; `animations.spec.ts` and
`offline.spec.ts` press only BACKSPACE (unchanged behavior); no `typeWord(`
call exists outside controls/interaction/playthrough
(`evidence/logs/Y7-unaffected-check.log`), and the change alters no rendering.
The measured Playwright event shapes (§2.1): `press('Quote')` (the `İ` typing
path) resolves identically before/after (`İ`); `press('KeyI')` — the changed
case (I → İ) — is never pressed by any suite, and the FİNALİZM bank contains
no dotless I, so no suite expectation depends on the changed letter-priority
case.

## 6. Hash inventory

| Artifact | SHA-256 (after Y7) | Pre-Y7 |
|---|---|---|
| `src/game/input.ts` | `28276d1758c6fa55d8f0231ce31537c3f92f4d95eb00c84d7460ac3cf98470b9` | `797cb8b0b9b5387d11595d0456b5660d547e0da8ac44b057d84d50dc8c3277fd` (= D2 record) |
| `tests/input.test.ts` | `885e5fc9a1c806b07f2acc475928db5b597742a09c88a0fe4604b61d7a89fc14` | `a07c9e5c84e1ddc164069431c2c0912993aa9d04147b1b2da5ee1716be5a97d1` (= D2 record) |
| `evidence/D2-input.md` | `5eb1a9dd754dbd427ee64c86218fb880526de3ade4d89fd64207f143a6aad668` | `dbf0e54c9ba04911bc36dae896d799d6e6ede719eb6408e8a1e3834fcaabb08f` |
| `src/game/tiles.ts` (untouched) | `7d9c47fc3112c2d8ff8901d89c421cd53b12753f72ad6cc2fecd4d6684394b66` | equal |
| `src/game/lifecycle.ts` (untouched) | `d78520bf1f033267eb7968c3c05ec32d1776bad4112249a9e8536228dfb279a1` | equal |
| `src/main.ts` (untouched) | `94a89d24c84890d8d8fbaccbc7c36bb7bc4abde0af1a5a24504981336eaf128e` | equal |
| `data/constants.json` (untouched) | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` | equal |

Pre/post raw logs: `evidence/logs/Y7-pre-hashes.log`,
`Y7-post-hashes.log`, `Y7-hash-diff.log` (only the first three rows differ).

| Probe / evidence artifact | SHA-256 |
|---|---|
| `evidence/Y7-probe-input.ts` | `df52840bc523d42e04e722c3e861f7403d30686c58e4e5c5add043b080fdb5bc` |
| `evidence/Y7-probe-uckeytranslate.c` | `6bc6ef7f1d4ddd07ac8138011a03a0287f633ff64af378fcca9fda8ef9cdc0c8` |
| `evidence/Y7-probe-quoteevent.mjs` | `e10f43e00acbc78d359322785b5290551e32ab48ccca788c55bbdae793cbd9d8` |

Their run logs `Y7-uckeytranslate.log`, `Y7-before-resolvekey.log`,
`Y7-after-resolvekey.log`, `Y7-resolvekey-table.log`,
`Y7-playwright-key-probe.log`; the full log-hash list is
`evidence/logs/Y7-artifact-hashes.log`.

## 7. Proposed `docs/05` §3 amendment line (single-writer: orchestrator applies)

> Amendment 2026-09-29e (task Y7): letter keys resolve by produced character
> first (`event.key`, Turkish-locale uppercase, accepted only within the
> 29-letter alphabet), then the O04 numeric `keyCode` table, then
> `event.code`; action keys keep `keyCode` → `key` → `code`. Reason: measured
> on the owner Mac (layout Turkish-QWERTY-PC; `UCKeyTranslate`) physical
> ANSI_I produces `ı` and ANSI_Quote produces `i`, while modern browsers may
> report layout-derived keyCodes for these keys (produced `i` arrives with
> keyCode 73, produced `ı` with 222), so the produced character wins on every
> layout (`'i'` → `İ`, `'ı'` → `I`); the keyCode table remains the fallback
> for synthetic/legacy events. No keyboard-type detection or heuristics.
> Evidence: `evidence/Y7-i-key.md` §2/§3, `evidence/D2-input.md` §2 amendment
> 2026-09-29.

(Suffix follows the Y5 `2026-09-29c` / Y6 `2026-09-29d` sequence; the
orchestrator may renumber. The `docs/08-open-items.md` "Wave follow-up **Y7**"
placeholder already exists; only the closure sentence would be added there.)

## 8. Hygiene and silent witness

- Every browser run (interaction 6/6, playthrough 3/3) used Chromium with
  `--mute-audio` (`playwright.config.ts`); no sound was played or decoded; no
  network beyond the local dev server; Playwright transient output stays in
  non-committed `test-results/`, evidence recordings were not used.
- The extra synthetic-shape probe (§2.1) also ran muted Playwright Chromium
  against a local dev server on `127.0.0.1:5433`; the server was stopped
  afterwards (only the probe log is kept).
- No `docs/**` write, no git operation, `../kelimator-nostalji/` untouched.
- Beyond the owned paths, the only writes are the mandated `npm run build`
  output in non-committed `dist/` and Playwright's transient `test-results/`,
  both outside committed evidence (nothing under `evidence/` was written by
  the suites — they ran without the recording flags).
- `src/game/input.ts` was edited only inside `resolveKey` (its doc comment
  and body); the module header's historical "Browser mapping" paragraph is
  intentionally left as the D2 record — the current contract is the
  `resolveKey` doc comment, the `// evidence:` note, the `evidence/D2-input.md`
  §2 amendment and the §7 docs line.

## 9. Result

**PASS** — the measured dotted/dotless conflict is fixed with
`key` → `keyCode` → `code` letter priority and untouched action keys; both
required regressions (`{keyCode:73,key:'i'} → İ`, `{keyCode:222,key:'ı'} → I`)
are in `tests/input.test.ts` with every keyCode-only/key-only expectation
kept; `evidence/D2-input.md` §2 carries the dated amendment; input 30/30,
interaction 6/6, playthrough 3/3, full suite 14/239, lint and build exit 0.
Evidence: this file, `evidence/Y7-probe-*.{c,ts}`,
`evidence/logs/Y7-*`.
