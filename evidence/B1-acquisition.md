# B1 — TDK Headword Acquisition — Evidence

**Task:** B1 — TDK Headword Acquisition
**Started:** 2026-09-28T12:27:27Z
**Ended:** 2026-09-28T17:46:00Z
**Host+OS:** dev-host.home / macOS

**Commands executed (exact):** see §5 below (key commands); the complete request
metadata log is `evidence/logs/B1-requests.log` (every HTTP request, URL, status,
byte count, SHA-256 and cache filename).

**Exit codes:** all extraction/verification commands exited 0 (see
`evidence/logs/B1-final-verify.log`, `EXIT:` markers). HTTP-level non-200s
during probing: 6× 403 (API without Origin/Referer, expected), 1× 404 (proxy
path test), 4× transient network errors that were retried successfully; none
affected the final artifact (all final inputs are cached, hash-pinned files).

**Output summary:** `artifacts/tdk/headwords.txt` — 63,967 unique headwords,
one per line, UTF-8, LF, sorted by UTF-8 byte order; every line consists only
of Unicode letters (category L*); deterministic re-extraction from the cached
sources reproduces the identical SHA-256.

**Artifact SHA-256 hashes:**

| Artifact | SHA-256 |
|---|---|
| `artifacts/tdk/headwords.txt` | `79ad954e569e806b230a82582f1b4e6167faf6a78163d93db9982b325a6a9a89` |
| `artifacts/tdk/headwords_stats.json` | `c79829f5a47583e9a748c5267a3a4fc78773994813115d01f5718ae6960611c8` |
| `artifacts/tdk/bundle_coverage.json` (audit) | `051b1efedd84cac571641d3b33373e003e503b1109bdc7ee3f09959ee5251ffa` |
| `artifacts/tdk/raw/probe_app.js` (source) | `1387c14446995b595ca02c75c8966842aa3104e2b557f16a58e1caa96c3fe133` |
| `artifacts/tdk/raw/probe_sitemap-1.xml` (source) | `ef9e761d6b79ab5866886bdf643d8e3b3d85fc8819f27ace59d76f9f5cd3f2a9` |
| `artifacts/tdk/raw/probe_sitemap-2.xml` (source) | `35c4847cd089f83288dd2938c9dc7e78041b12ad82a078895f2112a48e3696b7` |
| `artifacts/tdk/overlap_fixture.json` | `40a41e801fe1dde170536a70ab18f6bb04ca65999bcf9516a3f1343a64f9caee` |
| `artifacts/tdk/sitemap_coverage.json` | `4eca1b6ce819acc7e188d65e6cb2d72e6d6e0fea52e45dd2ee1d32c4a943fa1f` |
| `artifacts/tdk/request_summary.json` | `f50793db8f7f8cea0a143de6546ac2a4cacddf3046bd48b9efe708cbaf650b05` |
| `evidence/logs/B1-final-verify.log` | `9addb12b4f5798a4b0079b2935988124cb7d437b7bc541eb97ab20f2f596af26` |
| `evidence/logs/B1-requests.log` | `c99b8e808efe3cf37a3267bb1f19f20a0de3a04651e7e954b84a0a382e0d85d8` |

**Result: PASS**

---

## 1. Owner directive (2026-09-28) — scope reduction

The orchestrator terminated the `enumerate.py regex-pages` process (PID 88762,
SIGTERM at 2026-09-28T17:39:17Z, see `evidence/logs/orchestrator-B1-halt.log`)
and directed that the task be finalized from the already-cached site datasets
with **no further network requests**. This evidence follows that directive:

- API enumeration discontinued early at **1,170 of 1,644 pages** of the
  `mode=regex, q="."` chain (offsets 0…58,450 of 0…82,150), plus a substring
  probe census of **845 of 1,260 probes** (all 35 one-letter probes + 810 of
  1,225 two-letter probes). All cached pages are kept as informational evidence
  under `artifacts/tdk/raw/` and were not extended.
- Final sources: the cached site app bundle (`raw/probe_app.js`) and the cached
  sitemap files (`raw/probe_sitemap-1.xml`, `raw/probe_sitemap-2.xml`),
  following the audit `artifacts/tdk/bundle_coverage.json`.
- Owner decision: **`abartmasız` and `karzıhasen` are excluded silently** — no
  BLOCKER, no open-item entry, no follow-up queries. Both are 10 letters long
  and can never appear in gameplay (mains are 8 letters, subwords 3–7). They
  were observed once via the API census, are absent from both cached datasets,
  and are recorded here only as a factual note.
- No HTTP request was made after 2026-09-28T17:38:59Z; every command after the
  directive (including the full verification run) was offline.

## 2. Step-1/2 probe findings (recorded before the directive)

Full metadata: `evidence/logs/B1-requests.log`; curated JSON:
`artifacts/tdk/probe_findings.json`.

- **Legacy endpoint** `https://sozluk.gov.tr/gts?ara=X` = exact headword match
  only. `kelime`→1 row, `aba`→2 rows (homonyms), `kelim` (prefix) and `zzzz`
  → `{"error":"Sonuç bulunamadı"}`. No substring/prefix enumeration possible.
- **Modern API** `https://api.sozluk.gov.tr/gts-yeni/arama` (requires
  `Origin: https://sozluk.gov.tr` + `Referer: https://sozluk.gov.tr/`;
  without them → 403 `{"error":"FORBIDDEN", ...}`). Parameters discovered from
  the site bundle `raw/probe_app.js`: `q`, `mode` ∈ {start,end,middle,exact,
  wildcard,regex}, `scope` ∈ {madde,anlam,ornek,all}, `sort`, `limit`,
  `offset`, `searchType=web`.
- **Response shape:** `{sorgu, toplam, sayfa:{limit,offset,sonrakiOffset},
  sonuclar:[{madde_id, madde, ...}]}`; `madde_id` is unique per entry
  (homonyms get distinct ids, e.g. `aba` 74625 / 6173). `mode=middle` is a true
  substring ("contains") match: `q=aba` → `toplam=610`, including compounds
  (`ağababalık`, `Akçaabat`); `mode=start` → 86; `mode=exact` → 2.
- **Caps/pagination:** page size capped at 50 (`limit=1000` returns 50 rows);
  no total cap — offsets were verified to the last result (e.g. offset 37,364
  of 37,365 for `middle "a"`; offset 82,174 of 82,175 for `regex "."`).
  Complete population `toplam = 82,175` entries.
- **Measured budget for the literal full substring route:** all 35 one-letter
  probe totals sum to 494,519 entries → **9,908 pages**; measured 810
  two-letter probes average 12.5 pages each → projected **~15,300 pages**;
  route total **≈25,200 requests**. The complete-enumeration route (same
  endpoint, regex `.`, 50/page) needs **1,644 requests**. This measured 15×
  difference (plus server pacing of ~1 request/12 s observed after ~700 fast
  requests) is why the regex chain was used for the snapshot capture.
- Sitemap (`robots.txt` → `sitemap.xml` → `sitemap-1/2.xml`): 81,050 unique
  `/kelime/<slug>` URLs, cached and used as cross-check data.

## 3. Final extraction (deterministic, offline)

`artifacts/tdk/extract_headwords.py` (no network) builds the artifact from the
cached files only:

1. Bundle words: `raw/probe_app.js`, regex `{"madde":"..."}` occurrences,
   JSON-unescaped → 81,723 unique words (display forms, case-distinct entries
   kept).
2. Sitemap words: `raw/probe_sitemap-1/2.xml`, URL-decoded → 81,050 unique
   slug forms.
3. Merge (Turkish-lowercase key `I→ı, İ→i`, then `.lower()`): all bundle forms
   are kept; a sitemap-only form is added only if it is letters-only and has no
   bundle counterpart under NFD-fold comparison (strip combining marks,
   lower). Of the 128 sitemap-only forms: 118 are non-letter/combining forms
   (excluded by the letters-only rule), 10 are İ/I lowercase artifacts of
   bundle headwords (`isparta`↔`Isparta`, `iğdır`↔`Iğdır`, …) and are excluded
   as duplicates in disguise; **0 genuine additions**.
4. Letters-only filter (every character must have Unicode category `L*`);
   63,967 words written; 17,756 merged forms (compounds, punctuation, digits,
   abbreviations) are excluded from the artifact and remain available in the
   cached sources for B2/O17.
5. Output: one word per line, LF, UTF-8, sorted by UTF-8 byte order.

## 4. Verify results (task block)

| Check | Result |
|---|---|
| V2: `artifacts/tdk/headwords.txt` exists; line count > 10,000 | **63,967 lines** (`wc -l`), 681,749 bytes, `file` → UTF-8 text |
| V1: SHA-256 recorded | `79ad954e569e806b230a82582f1b4e6167faf6a78163d93db9982b325a6a9a89` |
| V8: re-running extraction from cache reproduces the same hash | **identical hash on both runs** (offline; `extract_headwords.py` run twice in `B1-final-verify.log`) |
| V2: no empty lines; every line matches `^[\p{L}]+$` | `verify_format.py`: empty lines **0**, non-letter lines **0** (per-character `unicodedata.category(ch).startswith("L")`, the verifiable equivalent of `\p{L}`), duplicates **0**, byte-order sorted **true** |

Additional informational checks (offline):

- **Audit result** (`bundle_coverage.json`): 81,723 bundle words vs 81,050
  sitemap words vs 14,236 API-observed headwords; after diacritic folding the
  API census shows only **61** net entry deficit across 982,352 matched entries
  (consistent with homonym entries, which the bundle collapses), and exactly
  **2** API-observed headwords absent from the bundle: `abartmasız`,
  `karzıhasen` (both 10 letters; excluded silently per owner directive).
- **Sitemap cross-check** (`sitemap_coverage.json`): under `tr_lower`, 63,759
  of 63,967 headwords match the sitemap; 208 bundle-only forms have no sitemap
  slug (newer/quirky forms); the reverse difference is dominated by the
  sitemap's compound/non-letter slugs that the letters-only artifact excludes.
- **Archived-fixture overlap** (informational, task step 6;
  `overlap_fixture.json`): fixture `sozluk_29749_kelime.xml` = 29,749 entries
  (27,856 unique); **28,044 of 29,749 (94.3%)** are present in the snapshot
  under Turkish case-insensitive comparison; 1,705 fixture words are absent
  (words dropped from the modern dictionary since 2012); 26,335 snapshot words
  (41.2%) are present in the fixture.
- **Request totals** (`request_summary.json`): 2,070 HTTP requests total
  (2,059 × 200, 6 × 403, 1 × 404, 4 × transient), first
  2026-09-28T12:27:41Z, last 2026-09-28T17:38:59Z. Cached pages: 845 substring
  probe pages (`m_*`), 1,170 regex-chain pages (`r_*`), plus step-1 probes,
  sitemaps, bundle and spot files.

## 5. Key commands executed (exact)

Probing (each request ≥1 s apart; every response cached and logged):

1. `python3 probe.py --queries kelime aba --prefix probe`
2. `python3 probe.py --queries ab kelim kaba zzzz a --prefix probe`
3. `probe.fetch_url(...)` jobs against
   `https://api.sozluk.gov.tr/gts-yeni/arama?q=<q>&mode=<mode>&scope=madde&sort=madde_asc&limit=50&offset=<n>&searchType=web`
   (legacy/API shape, cap and pagination probes; see `B1-requests.log`)
4. `curl -sS -A "<browser-like UA>" -o raw/probe_robots.txt https://sozluk.gov.tr/robots.txt`,
   `... -o raw/probe_home.html https://sozluk.gov.tr/`,
   `... -o raw/probe_app.js https://sozluk.gov.tr/assets/index-DKbruKc0.js`,
   `... -o raw/probe_sitemap.xml https://sozluk.gov.tr/sitemap.xml`,
   then `probe.fetch_url("https://sozluk.gov.tr/sitemap-1.xml", "probe_sitemap-1.xml")`
   and the same for `sitemap-2.xml`
5. `python3 enumerate.py counts` (substring probe census; halted at 845/1,260
   probes when the server pacing of ~12 s/request was diagnosed)
6. `python3 enumerate.py regex-pages` (complete-enumeration chain; terminated
   by orchestrator per owner directive at 1,170/1,644 pages)
7. `python3 extract_headwords.py` (final extraction, offline)
8. `zsh finalize_offline.sh` → `evidence/logs/B1-final-verify.log` (offline:
   extraction ×2, hashes, `wc -l`, `verify_format.py`, `sitemap_check.py`,
   `overlap_fixture.py`, `summarize_log.py`, `file`)

Supporting scripts (all under `artifacts/tdk/`): `probe.py`, `enumerate.py`,
`extract.py` (API-route extraction, discontinued route), `extract_headwords.py`
(final), `verify_format.py`, `overlap_fixture.py`, `sitemap_check.py`,
`bundle_check.py`, `summarize_log.py`, `probe_findings.py`, `spotcheck.py`
(not run — requires network), `finalize_offline.sh`, `verify_all.sh` (superseded).

## 6. Notes

- English only; no git commands were run; `../kelimator-nostalji/` was only
  read (fixture overlap), never modified.
- The artifact intentionally contains only letter-only headwords (task Verify),
  so compounds such as `aba güreşi`, abbreviations, and punctuation forms are
  not in `headwords.txt`; their counts and examples are in
  `headwords_stats.json` for B2 (O17).
- The API-route cache (`m_*`, `r_*`, `api_*` pages) is informational only and
  is not the source of the final artifact.
