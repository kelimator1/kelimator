# Wave Y closing — G4 re-check + G5 revalidation

Task: owner final presentation wave Y1–Y3 (closing gate evidence)
Started: 2026-09-29T13:05+03:00
Ended: 2026-09-29T13:22+03:00
Host+OS: dev-host.home / macOS (arm64 / arm64 host)
Gate keeper: orchestrator (independent re-runs after the wave)

## G4 — re-check (visual fidelity)

| Check | Command | Result |
|---|---|---|
| Static states (with the owner-approved Y1 allowance + Y2 omission region) | `npm run e2e -- visual` | **18 passed** |
| Animation keyframes | `npm run e2e -- animation` | **8 passed** |
| Sound-event mapping | `npm test -- audio` | **17/17 passed** |
| Interaction (X1) | `npm run e2e -- interaction` | 6 passed |
| Controls (Y3) | `npm run e2e -- controls` | 4 passed |
| Speaker semantics (X3) | `npm run e2e -- speaker` | 3 passed |
| Playthrough (F2, wave state) | `npm run e2e -- playthrough` | 3 passed (worst tolerant 1.273 %; S9 0.567 %) |
| Unit / lint / build | `npm test` / `npm run lint` / `npm run build` | 238/238 · exit 0 · exit 0 |

Thresholds unchanged; allowances are the recorded `--ignore-rect` sets (Y1
138-rect backdrop-visible set + Y2 credit region, union-counted).

## G5 — revalidation (`tools/verify-all.sh`)

- **Run 1 (orchestrator): FAIL — only step 11 (frozen evidence)**, with
  `?? evidence/Y2/` — not a product failure: Y2's capture directory was left
  **untracked** by the previous staging glob; committed as `f52344b`.
- **Run 2 (orchestrator, after the commit): PASS — 11/11 steps, exit 0**:
  lint · unit 238 · schemas 4/4 · fixtures 20/20 · idempotency · T04/T05 ·
  visual · animation · playthrough · offline (T14) · frozen evidence (0 changes).
- Tree after the run: no non-artifact changes.

## Open items after the wave

- **O23** — intro/preloader timed motion: OPEN (unchanged; resolution pointer in
  `docs/08-open-items.md`; not a gate blocker).
- **O25** — speaker icon 0.5-px phase: **SUPERSEDED** by the owner-approved HD
  knob remaster (`evidence/Y1-remaster.md` §7).

## Wave commits

| Commit | What |
|---|---|
| `8f5dd59` | plan: owner presentation wave Y1–Y2 registered |
| `e010a3a` | task: Y1 HD asset remaster |
| `9efeadb` | plan: Y1 amendments (V5 allowance + HD deviation) + O25 superseded |
| `8348da6` | task: Y2 credit sprite omission |
| `10e5a18` | plan: Y2 omission amendment |
| `55ad50d` | plan: Y3 button hit-area fix registered |
| `1068677` | task: Y3 karıştır/sil hit-area fix |
| `e456114` | plan: Y3 control mapping note |
| `f52344b` | task: Y2 credit sprite omission (evidence captures) |

Key artifacts: `s48_board_backdrop.svg` `b06c67be…`, `s90_btn_speaker.svg`
`9538d9b7…`, `manifest.json` `15a32cc5…`, `verify/diff/diff.mjs` `1548ca36…`,
`src/ui/hud.ts` `4c365194…`; full lists in `evidence/Y1-remaster.md` §9,
`evidence/Y2-credits.md` §8, `evidence/Y3-buttons.md` §8.

## Result

**PASS** — G4 re-check green; `tools/verify-all.sh` exit 0 (11/11); wave
committed; F3/G5 stands valid.

---

## Addendum — Y4 (knob alpha restore, 2026-09-29)

- Defect fixed: Y1's RGB WebP payload made the knob's transparent corners
  opaque black (masked by the Y1 allowance); RGBA `ai86-8x-alpha.webp`
  (`a5a840ab…`) pinned and embedded; `s90` `19141e3d…`; manifest `776fb3fd…`.
- New regression guard: `tests/e2e/speaker/corner-alpha.spec.ts` (dsf 1+2,
  probe-verified against the old payload); speaker suite 5/5, visual 18/18,
  full 238/238, lint/build exit 0.
- Allowance re-measured: knob rect shrunk `515,367,22,30` → `515,370,22,20`
  (mirror + wired set consistent; ignored pixels unchanged 65 930/263 720).
- Bitmap-47 audit: RGB source, no alpha — no change.
- Closing revalidation (post-commit): `tools/verify-all.sh` **exit 0 — 11/11
  steps, frozen evidence 0**, no non-artifact changes. Commits: `f8e4d66`
  (task) · `2cdad33` (amendments) · `fa903ec` (SVGO summary refresh).

Result: **PASS**.

---

## Addendum — Y6 (Top10 omission) & Y7 (i-key layout, 2026-09-29)

- **Y6**: `btn_top10` omitted at renderer level (skip-before-DOM; absence
  asserted for the default and an explicit view; the visual suite stays at 18
  tests). Owner-approved region `419,372,91,23` wired into all three comparison
  suites (measured omission deviation `420,373,87,20` at dsf 1 / `840,746,174,40`
  at dsf 2; 0 px outside; combined `ignoredPixels` 68 023/272 092; no overlaps
  with Y1/Y2). Catalogs, animation, manifest and the s108 asset untouched
  (hashes = pins; no runtime reference). Suites: visual 18, animation 8,
  playthrough 3 (worst tolerant 1.217 %, S9 0.511 %), full 238. Commits:
  `7e70c56` (registered) · `db74de7` (task) · `12f7c93` (amendment).
- **Y7**: `resolveKey` letter priority is now produced character → keyCode table
  → code (`'i' → İ`, `'ı' → I` on every layout; no keyboard-type detection);
  action keys untouched; the O04 keyCode table remains the fallback. Conflict
  regressions `{73,'i'} → İ`, `{222,'ı'} → I`; existing table/key tests kept;
  `evidence/D2-input.md` §2 amended; `docs/05` §3 amendment 2026-09-29e.
  Suites: input 30/30, interaction 6/6, playthrough 3/3, full 239/239;
  lint/build exit 0. Commits: `32eaceb` (registered) · `426b03c` (task) ·
  `48170ad` (amendment).
- Closing revalidation (post-commit): `tools/verify-all.sh` **exit 0 — 11/11
  steps, frozen evidence 0**; no non-artifact changes.

Result: **PASS**.

---

## Addendum — Y5 (speaker immediate feedback, 2026-09-29)

- Defect: clicks toggled the persisted volume reliably (43/43 instrumented,
  36/36 grid, rapid parity verified) but the icon did not repaint at click time
  (faithful to the reference probe: 0 px) — users re-clicked and even counts
  flipped straight back ("sometimes does nothing"). Owner decision: immediate
  feedback, **no debouncing** (deliberate deviation from the reference's
  frame-entry timing).
- Fix: `src/ui/hud.ts` `onSpeakerClick` → `toggleMute()` + `syncSpeakerVisual`.
  Post-fix probe: 43/43 clicks flip the icon (36-point grid + 5 rapid) with
  0 intervening board renders at dsf 1+2; off vs ON differs 435/1225 px (dsf1),
  1427/4900 px (dsf2); restored ON 0 px.
- Guards: speaker suite **7** (3 X3 semantics + 2 Y5 immediate-flip tests with a
  board-render MutationObserver + node-identity guard, dsf1/2) + 2 Y4 corner
  tests; reload/persistence coverage kept. Visual 18/18; full 238/238;
  lint/build exit 0.
- Closing revalidation (post-commit): `tools/verify-all.sh` **exit 0 — 11/11
  steps, frozen evidence 0**, no non-artifact changes. Commits: `d5d055c`
  (registered) · `2f24fa9` (task) · `79e615a` (amendments + stale-header drift
  fix in `tests/speaker.test.ts`).

Result: **PASS**.

---

## Addendum — Y8 (intro, O23), Y9 (status lamp), Y10 (celebration), 2026-09-29/30

- **Y8** (`156f99c`, `c8c616d`; C2 smoke follow-up `8038587`): boot plays
  preloader(1–4) → intro(5–130) → settled board on every reload; night→day is a
  measured alpha crossfade (tags.xml excerpts), sun = `intro_glow` path with
  `GLOW_GRADIENT`, wordmark fall/settle/shrink; HD vector only; keyframes at
  both dsf worst tolerant 1.386 %; O23 **RESOLVED** (open queue empty).
- **Y9** (`c9576d9`, `137a372`): three status-lamp states with live text kept
  (worst tolerant 0.144 %; colours sampled `#336600` / `#ff0000`); frames 2/3
  processed deterministically (`_f<frame>` naming, manifest `frames[]`); all
  suites green after the ENOSPC recovery and lint fix.
- **Y10** (`5fbc6a0`, `e8179a5`): win celebration + results restored (owner
  Option A) — fireworks identified (marquee = 300× `havai` sparks, seeded
  65-frame cycle), win tracks from tags.xml, card edited (E-posta removed,
  "İsim"), placebo-local submit (zero requests/storage), `Yeni Oyun` return;
  keyframes dsf 1+2 worst tolerant 1.518 % with only the recorded allowances.
- Closing revalidation: `tools/verify-all.sh` **exit 0 — 11/11 steps, frozen
  evidence 0**; no non-artifact changes; celebration 15, intro 14, status 3,
  visual 18, animation 8, interaction 6, playthrough 3, speaker 7, controls 4,
  timeout 1, offline 1, smoke 7, unit 242+, lint/build 0.

Result: **PASS**.
