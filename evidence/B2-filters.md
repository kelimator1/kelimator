# B2 — Entry-Type Filters and Blocklist — Evidence (closes O17)

**Task:** B2 — Word List Normalization and Filtering
**Started:** 2026-09-28T17:53:48Z (first artifact written; session began earlier the same hour)
**Ended:** 2026-09-28T18:06:41Z (follow-up amendment applied: GFGF/SFSFS exclusions)
**Host+OS:** dev-host.home / macOS

**Commands executed (exact):** §1.1 (analysis; the exact script text is embedded at the
top of `evidence/logs/B2-entry-types.log`), the pipeline/test/verify commands are in
`evidence/B2-normalization.md` §3–§5; the §4 spot checks are grep/hash reads of the
committed files.
**Exit codes:** all commands exited 0.
**Output summary:** entry-type inventory of the TDK snapshot (B1 artifact, site bundle,
cached API census), the applied/not-applied filter decisions, the `data/blocklist.txt`
content (53 offensive terms + 2 non-lexical fixture exclusions = 55 entries) with a
per-entry documented basis, the gap report, and the O17 closure proposal for the
orchestrator.
**Artifact SHA-256 hashes:**
`data/blocklist.txt` = `2094d3b09a90ef5ca4f3750c4800f55f3ef659ae472db5d3294cadcfdfc58b0a`;
`tools/wordlist.txt` = `ac9987ce0d07688ce5db913f5cb112efe0e035f227d908431350c2d96fde8758`;
`evidence/logs/B2-entry-types.log` = `208b5c0984e68977e2820f67e2959d8874923da256461a555add498c4cef865b`.
**Result: PASS**

---

## 1. Entry types found in the snapshot

### 1.1 Method (exact script in `evidence/logs/B2-entry-types.log`)

```sh
python3 - <<'PYEOF' > evidence/logs/B2-entry-types.log 2>&1
# A: artifacts/tdk/headwords.txt      (B1 artifact; categories by casing, charset, length, collisions)
# B: artifacts/tdk/raw/probe_app.js   (site bundle `{"madde":...}` forms: whitespace/digit/punctuation/circumflex classes)
# C: artifacts/tdk/raw/r_*.json       (cached API census: wordTypes of 58,500 distinct entries)
PYEOF
```

The full script is embedded verbatim at the top of
`evidence/logs/B2-entry-types.log`; its output follows in section `## output`.

### 1.2 Findings

| # | Entry type | Evidence (measured) | Examples |
|---|---|---|---|
| 1 | Single-token common words | 58,500-entry cached census wordTypes: `isim` 38,875 / `sıfat` 9,897 / `zarf` 2,631 / `ünlem` 270 / `zamir` 77 / `edat` 50 / `bağlaç` 42 flags (entries may carry several flags) | `aba`, `abartı`, `zurna` |
| 2 | Proper nouns | census `özel isim` flag on 1,692 entries; 2,150 of 63,967 snapshot headwords are upper-case-initial (proper-noun style) | `Abana`, `Akçaabat`, `Arap` vs `arap` |
| 3 | Abbreviations (letter-only) | exactly one all-caps token in the artifact: `DNA`; no `kısaltma` wordType occurs in the cached census. Dotted abbreviations exist in the raw bundle (punctuation inventory includes `.`) but are excluded by B1's letters-only rule | `DNA` |
| 4 | Multi-word phrases/compounds | 17,685 of 81,723 unique bundle forms contain whitespace; 135 forms contain punctuation (`- . ' ’ ( ) , / ” …`); 34 contain digits | `absorbe etmek`, `Ahd-i Atik`, `örnekKelime 5` |
| 5 | Circumflex forms | 1,232 bundle forms contain `â/î/û/Â/Î/Û`; 810 survive B1's letters-only rule into `headwords.txt` | `kâse`, `Kâbe`, `Elâzığ` |
| 6 | Case-distinct homographs | 78 display-form collisions after Turkish upper-casing (54 of them survive charset+shape and are merged by the output dedup) | `Akrep`/`akrep` → `AKREP`; `Arap`/`arap` → `ARAP` |
| 7 | Non-lexical bundle artifacts | site test fixtures with digits/spaces: `örnekKelime N`, `madde deneme N`, `test madde N`, `yeni madde N`, `bar4`, `asdf2`; short/no-vowel leftovers: `Ds` (line 540), `Sg` (1573), `dswwee` (15812), `gfgf` (21220), `sfsfs` (46612) | `gfgf`, `sfsfs` |

### 1.3 Consequences for the output

- Types 1–3 and 6 are retained: after step 1 the display form is upper case, so
  proper nouns and the abbreviation `DNA` are indistinguishable from common words
  and stay in `tools/wordlist.txt` (no rule in docs/06 §2 filters them).
- Type 4 and the circumflex forms (5) are dropped by the step-2 charset filter
  (whitespace/punctuation/digits/`â` etc. — counted in
  `evidence/B2-normalization.md` §3.2).
- Type 7 survivors `GFGF`/`SFSFS` are excluded via `data/blocklist.txt` per the
  recorded orchestrator decision 2026-09-28 (individual entries, no junk filter
  rule) — see §3.5 and §4.3.

## 2. Filter decisions

| Filter | Decision | Basis |
|---|---|---|
| Turkish casing (i→İ, ı→I; display = comparison) | Applied | docs/06 §2.1 |
| 29-letter charset (circumflex/punctuation/whitespace/digits dropped) | Applied | docs/06 §2.2 |
| Shape: single token, length ≥ 3 | Applied | docs/06 §2.3 |
| Blocklist (`data/blocklist.txt`, 55 entries) | Applied | docs/06 §2.4; basis table §3 |
| Sort + deduplicate | Applied | docs/06 §2.5 |
| Proper-noun filter | **Not applied** | no rule in docs/06 §2; adding one would violate the task's "no new filter without an explicit recorded decision" |
| Abbreviation filter | **Not applied** | same |
| wordType/domain filter (e.g. `özel isim`, `bitkiler`) | **Not applied** | same |
| Junk/non-lexical filter | **Applied via `data/blocklist.txt` (recorded orchestrator decision 2026-09-28)** — the two identified artifacts (`GFGF`, `SFSFS`) are excluded as individual content entries; no junk filter rule was added to the normalizer | docs/06 §2.4; §3.5 |

## 3. Blocklist — initial content and per-entry basis

Policy (documented rationale, recorded decision per docs/06 §2.4):

- Scope: Turkish obscenities and pejorative slurs (the task's offensive-term
  list). Every entry is present in the snapshot (`headwords.txt` line numbers
  below) and would otherwise enter the wordlist.
- Family rule: for an included root, the snapshot words derived from it in the
  same register are included as well; homographic/unrelated words that merely
  contain the string are not (e.g. `kerpiç`, `boks`/`boksör` boxing words,
  `götürmek` "to carry").
- Basis type: documented rationale (meaning/register below). No citable offline
  offensive-word corpus exists — see §4.1 for the exact limitation.
- Addendum (2026-09-28): §3.5 adds two **non-offensive** fixture exclusions by
  the recorded orchestrator decision, so the file has 55 entries in total.

### 3.1 Sexual obscenity (31 entries)

Basis: standard Turkish sexual obscenities; excluded because the game presents
its words to a general audience (family-game context, docs/06 §2.4).

| Word | Len | headwords.txt line | Basis (meaning / register) |
|---|---|---|---|
| SİK | 3 | 46675 | obscene noun "penis"; root of the family |
| SİKLEMEME | 9 | 46684 | vulgar "not caring" (verbal noun of *siklemek*) |
| SİKLEMEMEK | 10 | 46685 | vulgar infinitive of the same |
| SİKME | 5 | 46687 | obscene verbal noun of *sikmek* |
| SİKMEK | 6 | 46688 | obscene verb "to fuck" |
| SİKTİRİCİ | 9 | 46689 | vulgar derivative of *siktirmek* |
| SİKTİRMEK | 9 | 46690 | vulgar causative ("to send off" with the obscene root) |
| GÖT | 3 | 21977 | vulgar "buttocks/anus" |
| TAŞAK | 5 | 50447 | vulgar "testicles" |
| TAŞAKLI | 7 | 50448 | vulgar "ballsy" |
| YARAK | 5 | 55617 | vulgar slang "penis" |
| DALYARAK | 8 | 12764 | vulgar insult built on *yarak* |
| DALYARAKLIK | 11 | 12765 | derivative of *dalyarak* |
| ÇÜK | 3 | 60753 | vulgar "penis" |
| OROSPU | 6 | 40771 | vulgar slur "prostitute/whore" |
| OROSPULUK | 9 | 40772 | derivative of *orospu* |
| KAHPE | 5 | 27709 | vulgar slur (treacherous/promiscuous woman) |
| KAHPECE | 7 | 27710 | derivative of *kahpe* |
| KAHPELENME | 10 | 27711 | derivative of *kahpe* |
| KAHPELENMEK | 11 | 27712 | derivative of *kahpe* |
| KAHPELEŞME | 10 | 27713 | derivative of *kahpe* |
| KAHPELEŞMEK | 11 | 27714 | derivative of *kahpe* |
| KAHPELİK | 8 | 27715 | derivative of *kahpe* |
| SÜRTÜK | 6 | 48482 | vulgar slur (promiscuous woman) |
| SÜRTÜKLEŞME | 11 | 48483 | derivative of *sürtük* |
| SÜRTÜKLEŞMEK | 12 | 48484 | derivative of *sürtük* |
| SÜRTÜKLÜK | 9 | 48485 | derivative of *sürtük* |
| KALTAK | 6 | 28047 | vulgar slur (promiscuous woman) |
| KALTAKLIK | 9 | 28048 | derivative of *kaltak* |
| KALTAKÇI | 8 | 28049 | derivative of *kaltak* |
| ŞILLIK | 6 | 63908 | vulgar slang slur (promiscuous woman) |

### 3.2 Homophobic slurs (4 entries)

Basis: pejorative slurs for gay men; excluded as offensive terms.

| Word | Len | headwords.txt line | Basis |
|---|---|---|---|
| İBNE | 4 | 25084 | homophobic slur |
| İBNELİK | 7 | 25085 | derivative of *ibne* |
| PUŞT | 4 | 43178 | homophobic slur |
| PUŞTLUK | 7 | 43179 | derivative of *puşt* |

### 3.3 Pejorative slurs / insults (7 entries)

Basis: vulgar/argo insults; excluded as offensive terms.

| Word | Len | headwords.txt line | Basis |
|---|---|---|---|
| PEZEVENK | 8 | 42288 | "pimp" — vulgar insult |
| PEZEVENKLİK | 11 | 42289 | derivative of *pezevenk* |
| GODOŞ | 5 | 21442 | "pimp" — slang, vulgar insult |
| GODOŞLUK | 8 | 21443 | derivative of *godoş* |
| PİÇ | 3 | 42491 | pejorative slur "bastard" |
| PİÇLİK | 6 | 42494 | derivative of *piç* |
| YAVŞAK | 6 | 56003 | vulgar insult (servile/despicable person) |

### 3.4 Scatological obscenity (11 entries)

Basis: the vulgar word for "shit" and its same-register derivatives.

| Word | Len | headwords.txt line | Basis |
|---|---|---|---|
| BOK | 3 | 9890 | obscene "shit" |
| BOKLAMA | 7 | 9891 | vulgar derivative (*boklamak*) |
| BOKLAMAK | 8 | 9892 | vulgar verb (*boklamak*) |
| BOKLANMA | 8 | 9893 | vulgar derivative |
| BOKLANMAK | 9 | 9894 | vulgar derivative |
| BOKLAŞMA | 8 | 9895 | vulgar derivative |
| BOKLAŞMAK | 9 | 9896 | vulgar derivative |
| BOKLU | 5 | 9897 | vulgar "shitty" |
| BOKLUK | 6 | 9898 | vulgar derivative |
| BOKTAN | 6 | 9904 | vulgar slang "shitty, worthless" |
| BOKTANLIK | 9 | 9905 | derivative of *boktan* |

**Total: 53 offensive entries** (31 + 4 + 7 + 11 entries in §3.1–§3.4), plus the 2
non-offensive fixture exclusions in §3.5 = **55 entries in `data/blocklist.txt`**.
All 55 were matched and removed by the normalizer (no unmatched warnings;
`evidence/logs/B2-normalize-run1.log`).

### 3.5 Non-offensive fixture exclusions (2 entries — orchestrator decision 2026-09-28)

Basis: non-lexical site-bundle test fixtures (the `örnekKelime N` / `madde deneme N`
family, §1.2 item 7 and §4.3), **not offensive terms and not a new filter rule** —
individual content entries in `data/blocklist.txt` per docs/06 §2.4, added by the
recorded orchestrator decision of 2026-09-28 following the B2 §4.3 finding.

| Word | Len | headwords.txt line | Basis |
|---|---|---|---|
| GFGF | 4 | 21220 | non-lexical bundle fixture (no vowels; grouped with the digit-bearing `örnekKelime` fixture family); not a dictionary headword → excluded as undesired |
| SFSFS | 5 | 46612 | non-lexical bundle fixture (no vowels; same family evidence) → excluded as undesired |

Effect: both words are removed from `tools/wordlist.txt` (62,809 words; see
`evidence/B2-normalization.md` §3.2/§5); the two files' new SHA-256 values are in
the header of this file.

## 4. Gap report

### 4.1 No citable offline offensive-word corpus (limitation of every basis)

Checked local sources: `artifacts/tdk/raw/detay_*.json` (the only cached data
with TDK usage labels; 103 entries — labels found: `argo` on unrelated *duman*
idioms, `kaba konuşmada` on one unrelated entry; none of the 53 words has a
cached detail page), `headwords_stats.json`, the site bundle, the search caches
(wordTypes/domain metadata only), and the archived 2012 fixture dictionary
`../kelimator-nostalji/kayitlar/sozluk_29749_kelime.xml` (bare word list, no
labels). No network request was made (task rule). Therefore §3 bases are
documented rationales (meaning/register), not external citations. If citable
labels are required, fetch the TDK detail pages for the 53 headwords in a later
recorded amendment.

### 4.2 Reviewed but not included (recorded, not guessed)

| Word(s) | headwords.txt line(s) | Reason |
|---|---|---|
| PİÇLEŞME, PİÇLEŞMEK | 42492, 42493 | stem is the slur PİÇ, but the derivative's meaning/register is not documented offline → excluded pending verification |
| PİÇSİNEK, PİÇUTA | 42495, 42496 | zoological names containing the string `piç`; no evidence of offensive use |
| FAHİŞE, FAHİŞELİK, KERHANE, KERHANECİ | 18876, 18877, 30427, 30428 | neutral-register dictionary nouns about sex work (TDK plain `isim`), not obscenities → outside the offensive-term scope; flagged for the maintainer if a broader "undesired" scope is wanted |
| KAŞAR, KANCIK, YOLLU | 30050, 28285, 56889 | neutral primary meanings (cheese / female animal / striped); slang senses not documented offline |
| ŞEREFSİZ, DANGALAK, KEPAZE, YILIŞIK, SIRNAŞIK, … | 63486, 12880, 30378, 57694, 48910 | everyday insults, not obscenities → out of the offensive-term scope |
| AM | (present, 2 letters) | obscene, but removed by the shape filter (length ≥ 3) before the blocklist; a blocklist entry < 3 letters could never match (validator rejects it) |

### 4.3 Non-lexical bundle artifacts — excluded (orchestrator decision 2026-09-28)

The site bundle embeds test fixtures (`örnekKelime N`, `madde deneme N`,
`test madde N`, `yeni madde N`, `bar4`, `asdf2`, `Edebi N`). Their letters-only
survivors in the artifact are `dswwee` (line 15812; dropped by the charset rule
because of `w`) and `GFGF` (line 21220) / `SFSFS` (line 46612), which initially
reached `tools/wordlist.txt`; `Ds` (540) and `Sg` (1573) are dropped by the length
filter. Following the first B2 run's finding, the orchestrator decided on
2026-09-28 to **exclude `GFGF` and `SFSFS`**: they are now individual entries in
`data/blocklist.txt` (§3.5), with the basis "site-bundle test fixture, not a
dictionary headword". No junk filter rule was added to `tools/normalize-wordlist.mjs`
— the exclusion is content-level, per docs/06 §2.4. Re-run result: `tools/wordlist.txt`
= 62,809 words, sha256 `ac9987ce…e8758`; `data/blocklist.txt` = 55 entries, sha256
`2094d3b0…c58b0a` (see `evidence/B2-normalization.md` §3.2/§5/§6).

### 4.4 Profanities absent from the snapshot

`AMCIK`, `GÖTVEREN`, `SİKİK`, `SİKTİR` (interjection), `TAŞŞAK`, `SİKİŞ`,
`YARRAK`, `OÇ` — none is a B1 headword, so no blocklist entry was created (a
future snapshot that adds them requires a recorded blocklist amendment, per
docs/06 §2.4). Phrases such as `OROSPU ÇOCUĞU` are dropped by the charset rule
in any case.

## 5. O17 closure proposal (for the orchestrator to transcribe into `docs/08-open-items.md`)

Single-writer rule: this worker does not edit `docs/**`; the two exact
replacements below are proposed.

1. Table row `| O17 | … |` — replace the Status cell `OPEN` with:

   `RESOLVED — evidence/B2-filters.md`

2. Append to the "Resolved items" list (one line):

   `RESOLVED 2026-09-28 — evidence/B2-filters.md — Snapshot entry types inventoried (2,150 proper-noun-style capital-initial forms / 1,692 "özel isim" census flags; "DNA" the only letter-only abbreviation; 17,685 multi-word, 135 punctuation, 34 digit-bearing fixture and 1,232 circumflex bundle forms; 78 case-collisions; non-lexical bundle artifacts "GFGF"/"SFSFS"); only docs/06 §2 filters applied (no proper-noun/abbreviation filter and no junk filter rule added); blocklist = 53 offensive terms + the 2 fixture exclusions "GFGF"/"SFSFS" (recorded orchestrator decision 2026-09-28) = 55 entries with per-entry documented basis; gaps recorded (no citable offline offensive-word corpus; PİÇLEŞME/PİÇLEŞMEK and borderline terms left out).`
