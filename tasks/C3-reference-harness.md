# TASK C3 — Reference Harness (Ruffle Web + Static Fixtures)

- Workstream: C (application)
- Parallel group: 2
- Depends on: C1
- Owned paths: `verify/reference/**`, `tests/fixtures/reference/**` (capture outputs), `evidence/C3-*`

## Inputs
- `../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf`
- `../kelimator-nostalji/calistir/xml64.php` (fixture round)
- `docs/07-verification.md` §3

> Amendment 2026-09-28 (orchestrator): the 2012 client Base64-decodes every
> round value; the archived `calistir/xml64.php` is plain ISO-8859-9 and
> produces a broken board (A2 cross-check: `evidence/A2-kelimatorid.md`,
> `evidence/logs/A2-ruffle-*.log` — 6/8 tiles fail; with a Base64(UTF-8)
> fixture all 8 tiles load). The fixture served to the 2012 SWF must therefore
> be a Base64(UTF-8)-encoded variant of the archived round data (transformation
> script + input/output SHA-256 recorded; `../kelimator-nostalji/` remains
> unmodified). Recorded in `docs/08-open-items.md` (Amendments).

## Steps
1. Download the pinned Ruffle web self-hosted release
   (`ruffle-0.6.0-web-selfhosted.zip` from the official Ruffle releases).
   Record its SHA-256 before extracting; cache under `verify/reference/ruffle/`.
2. Build `verify/reference/index.html` embedding the Ruffle web player and the
   reference SWF, served from the same static root as `xml64.php` so the game's
   relative fetch resolves locally.
3. Provide a static server script (reuse the proven pattern from
   `../kelimator-nostalji/calistir/sunucu.py`) with request logging.
4. Write a Playwright harness that:
   - loads the page, waits for the first stable frame, then for the round board
     state (never assumes a fixed delay; waits for network/resource evidence:
     the `xml64.php` request must appear in the server log),
   - captures screenshots for the state matrix S1–S10 (`docs/07` §5) using the
     interaction sequence defined there,
   - records the interaction log as JSON next to the screenshots.
5. Stability check (closes O20): capture the matrix twice; compare screenshot
   hashes. If unstable, identify the cause and record it; if the cause is
   inherent to the reference (e.g., animations), record the stabilization
   method used (e.g., waiting for animation end states).

## Unknowns
- O20 resolved here. If the reference cannot reach the round board because of
  ad-network blocking behavior contrary to the earlier observation, record the
  observed flow and, if it blocks capture, open a BLOCKER — do not guess.

## Verify
- V1: Ruffle web asset SHA-256 recorded and stable.
- V6: harness run completes; server log contains the `xml64.php` request
  (200) for the reference session.
- V2: S1–S10 screenshots exist; interaction logs parse as JSON.
- V5 self-check: two captures of S2 are byte-identical (or the stabilization
  method is documented with quantitative evidence).

## Evidence
- `evidence/C3-harness.md`
- `evidence/C3-stability.md` (closes O20)
- `evidence/logs/C3-server.log`

## Done
- Verify passes; reference screenshots committed to `tests/fixtures/reference/`;
  O20 RESOLVED.
