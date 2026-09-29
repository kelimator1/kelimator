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
