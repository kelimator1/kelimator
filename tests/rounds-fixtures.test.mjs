// tests/rounds-fixtures.test.mjs — task B3 (docs/06 §5 fixtures + §4 id table).
//
// Covers:
//  - structural checks of the archived round fixtures (`finalizm`, `leavings`,
//    and `viroloji` when its source is available);
//  - the enumeration check against the archived site dictionary
//    (`sozluk_29749_kelime.xml`, normalized per docs/06 §2) for FİNALİZM;
//  - the docs/06 §4 `id` transliteration table (unit tests);
//  - V2 invariants of the emitted `src/data/rounds.json` bank.
//
// Fixture decoding (recorded byte-wise, evidence/B3-bank.md): the archived
// fixtures are plain ISO-8859-9 files (e.g. `<txt>F\xddNAL\xddZM</txt>` =
// FİNALİZM; 0xDD = İ) — NOT the 2012 Base64(UTF-8) wire form (see
// evidence/A2-kelimatorid.md, evidence/C3-fixture-format.md). This suite parses
// them as they are; no re-encoding is performed (the 2012 wire form is not
// required by any check here; the C3 harness owns that fixture).
//
// The canonical docs/06 §5 location `tests/fixtures/rounds/<name>.xml` is used
// when present; otherwise the archived sources listed in tasks/B3-round-generation.md
// (read-only `../kelimator-nostalji/`) are used. The `viroloji` source exists
// in neither location: it is a recorded BLOCKER (evidence/B3-viroloji-blocker.md)
// and its structural test is skipped explicitly until the fixture is provided.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeLatin5 } from '../verify/reference/swf-codec.mjs';
import { normalizeWord, parseBlocklist } from '../tools/normalize-wordlist.mjs';
import {
  CORE_LETTERS,
  ID_TRANSLITERATION,
  compareCodePoints,
  idCollisions,
  isSubMultiset,
  letterCounts,
  roundId,
  turkishLowerCase,
} from '../tools/build-rounds.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const nostaljiRoot = path.resolve(repoRoot, '..', 'kelimator-nostalji');
const bankPath = path.join(repoRoot, 'src', 'data', 'rounds.json');
const configPath = path.join(repoRoot, 'tools', 'build-config.json');
const wordlistPath = path.join(repoRoot, 'tools', 'wordlist.txt');
const blocklistPath = path.join(repoRoot, 'data', 'blocklist.txt');
const dictionaryPath = path.join(nostaljiRoot, 'kayitlar', 'sozluk_29749_kelime.xml');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** Parse one archived round XML (ISO-8859-9) into { main, lists, checksum }. */
function parseRoundXml(bytes) {
  const text = decodeLatin5(bytes);
  const entries = new Map();
  const pattern = /<kelime\s+harf="(\d+)">\s*<txt>([^<]*)<\/txt>\s*<\/kelime>/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const harf = Number(match[1]);
    if (entries.has(harf)) throw new Error(`duplicate harf="${harf}" entry`);
    entries.set(harf, match[2]);
  }
  if (!entries.has(8)) throw new Error('missing harf="8" entry');
  const lists = {};
  for (const length of [3, 4, 5, 6, 7]) {
    if (!entries.has(length)) throw new Error(`missing harf="${length}" entry`);
    lists[length] = entries.get(length) === '' ? [] : entries.get(length).split(',');
  }
  return { main: entries.get(8), lists, checksum: entries.get(9999) ?? null };
}

/**
 * Resolve a fixture: canonical `tests/fixtures/rounds/<name>` first, then the
 * archived sources (relative to the repository root). Returns null when no
 * source exists.
 */
function loadFixture(name, archivedRels = []) {
  const candidates = [path.join('tests', 'fixtures', 'rounds', name), ...archivedRels];
  for (const rel of candidates) {
    const file = path.join(repoRoot, rel);
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    return { file, rel, parsed: parseRoundXml(bytes), sha256: sha256(bytes) };
  }
  return null;
}

/** docs/06 §5 structural checks. Returns a list of violation strings. */
function structuralProblems(parsed) {
  const problems = [];
  const core = new Set([...CORE_LETTERS]);
  if ([...parsed.main].length !== 8) {
    problems.push(`main ${parsed.main}: length ${[...parsed.main].length} != 8`);
    return problems;
  }
  let mainCounts;
  try {
    mainCounts = letterCounts(parsed.main);
  } catch (error) {
    problems.push(`main ${parsed.main}: ${error.message}`);
    return problems;
  }
  for (const length of [3, 4, 5, 6, 7]) {
    const seen = new Set();
    for (const word of parsed.lists[length]) {
      if ([...word].length !== length) {
        problems.push(`word ${word}: length != harf="${length}"`);
      }
      if (![...word].every((ch) => core.has(ch))) {
        problems.push(`word ${word}: non-core letter`);
        continue;
      }
      if (seen.has(word)) problems.push(`duplicate ${word} in harf="${length}"`);
      seen.add(word);
      if (!isSubMultiset(letterCounts(word), mainCounts)) {
        problems.push(`multiset of ${word} is not contained in ${parsed.main}`);
      }
    }
  }
  return problems;
}

function isSorted(words) {
  for (let i = 1; i < words.length; i += 1) {
    if (compareCodePoints(words[i - 1], words[i]) >= 0) return false;
  }
  return true;
}

/** Archived dictionary normalized per docs/06 §2 (casing, charset, shape, blocklist). */
function loadArchivedDictionary() {
  const bytes = readFileSync(dictionaryPath);
  const text = decodeLatin5(bytes);
  const rawEntries = [...text.matchAll(/<li>([^<]*)<\/li>/g)].map((match) => match[1]);
  const blocklist = parseBlocklist(readFileSync(blocklistPath, 'utf8'));
  const normalized = new Set();
  let droppedByPipeline = 0;
  let blocklisted = 0;
  for (const entry of rawEntries) {
    const word = normalizeWord(entry);
    if (word === null) {
      droppedByPipeline += 1;
      continue;
    }
    if (blocklist.has(word)) {
      blocklisted += 1;
      continue;
    }
    normalized.add(word);
  }
  return {
    rawEntries: rawEntries.length,
    uniqueRaw: new Set(rawEntries).size,
    normalized,
    droppedByPipeline,
    blocklisted,
    sha256: sha256(bytes),
  };
}

const FINALIZM_ARCHIVED = ['../kelimator-nostalji/calistir/xml.php'];
const LEAVINGS_ARCHIVED = ['../kelimator-nostalji/calistir/xml_eng.php'];

const finalizm = loadFixture('finalizm.xml', FINALIZM_ARCHIVED);
const leavings = loadFixture('leavings.xml', LEAVINGS_ARCHIVED);
const viroloji = loadFixture('viroloji.xml');
const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const wordlist = new Set(
  readFileSync(wordlistPath, 'utf8')
    .split('\n')
    .filter((line) => line !== ''),
);

function requireFixture(fixture, name) {
  if (fixture === null) {
    throw new Error(`${name} fixture source is missing (canonical and archived locations)`);
  }
  return fixture;
}

function fixtureWords(parsed) {
  return [3, 4, 5, 6, 7].flatMap((length) => parsed.lists[length]);
}

if (finalizm === null) {
  console.warn(
    '[B3] finalizm fixture unavailable: neither tests/fixtures/rounds/finalizm.xml nor the local ' +
      'archive (../kelimator-nostalji/calistir/xml.php) exists — suite skipped (e.g. in CI, where the ' +
      'read-only archive is intentionally not part of this repository).',
  );
}

describe.skipIf(finalizm === null)('fixture: finalizm (archived xml.php, ISO-8859-9)', () => {
  it('is available and decodes byte-wise to FİNALİZM (plain text, not Base64)', () => {
    const fixture = requireFixture(finalizm, 'finalizm');
    console.log(`[B3] finalizm source: ${fixture.rel} sha256=${fixture.sha256}`);
    expect(fixture.parsed.main).toBe('FİNALİZM');
    // Byte-wise record: F İ N A L İ Z M is stored as 46 DD 4E 41 4C DD 5A 4D
    // (0xDD = İ in ISO-8859-9), i.e. the archived file is plain Latin-5 text.
    const raw = readFileSync(path.join(repoRoot, FINALIZM_ARCHIVED[0]));
    expect(raw.indexOf(Buffer.from([0x46, 0xdd, 0x4e, 0x41, 0x4c, 0xdd, 0x5a, 0x4d]))).toBeGreaterThan(-1);
  });

  it('passes all structural checks (3–8 letters, multiset ⊂ main, main present, no duplicates)', () => {
    const fixture = requireFixture(finalizm, 'finalizm');
    expect(structuralProblems(fixture.parsed)).toEqual([]);
    const counts = [3, 4, 5, 6, 7].map((length) => fixture.parsed.lists[length].length);
    console.log(
      `[B3] finalizm structural: main=${fixture.parsed.main} counts(3..7)=${counts.join('/')} ` +
        `total=${counts.reduce((a, b) => a + b, 0) + 1} sorted=${[3, 4, 5, 6, 7]
          .every((length) => isSorted(fixture.parsed.lists[length]))} ` +
        `checksum=${fixture.parsed.checksum ?? '(none)'}`,
    );
  });

  it('xml.php and xml64.php are byte-identical (the two archived FİNALİZM copies)', () => {
    const a = readFileSync(path.join(repoRoot, FINALIZM_ARCHIVED[0]));
    const b = readFileSync(path.join(repoRoot, '../kelimator-nostalji/calistir/xml64.php'));
    console.log(`[B3] xml.php = xml64.php sha256=${sha256(a)}`);
    expect(b.equals(a)).toBe(true);
  });

  it('enumeration check: every archived subword present in the archived dictionary is producible from FİNALİZM', () => {
    const fixture = requireFixture(finalizm, 'finalizm');
    const dictionary = loadArchivedDictionary();
    console.log(
      `[B3] archived dictionary: ${dictionaryPath} sha256=${dictionary.sha256} raw=${dictionary.rawEntries} ` +
        `uniqueRaw=${dictionary.uniqueRaw} normalized=${dictionary.normalized.size} ` +
        `droppedByPipeline=${dictionary.droppedByPipeline} blocklisted=${dictionary.blocklisted}`,
    );
    const mainCounts = letterCounts(fixture.parsed.main);
    const words = fixtureWords(fixture.parsed);
    const inDictionary = words.filter((word) => dictionary.normalized.has(word));
    const exceptions = inDictionary.filter(
      (word) => !isSubMultiset(letterCounts(word), mainCounts),
    );
    const gaps = words.filter((word) => !dictionary.normalized.has(word));
    console.log(
      `[B3] finalizm enumeration: fixtureWords=${words.length} inDictionary=${inDictionary.length} ` +
        `producible=${inDictionary.length - exceptions.length} exceptions=${exceptions.length}` +
        (exceptions.length > 0 ? ` -> ${exceptions.join(', ')}` : ''),
    );
    console.log(
      `[B3] finalizm dictionary gaps (archived words absent from the archived dictionary): ` +
        `${gaps.length}${gaps.length > 0 ? ` -> ${gaps.join(', ')}` : ''}`,
    );
    expect(exceptions).toEqual([]);
  });

  it('the bank round for FİNALİZM contains every archived subword present in tools/wordlist.txt', () => {
    const fixture = requireFixture(finalizm, 'finalizm');
    const round = bank.rounds.find((item) => item.main === fixture.parsed.main);
    expect(round, 'FİNALİZM must be in the bank (T=30; total words 91)').toBeTruthy();
    const fixtureList = fixtureWords(fixture.parsed);
    const expected = fixtureList.filter((word) => wordlist.has(word));
    const generated = new Set([3, 4, 5, 6, 7].flatMap((length) => round.words[String(length)]));
    const missing = expected.filter((word) => !generated.has(word));
    const fixtureSet = new Set(fixtureList);
    const added = [...generated].filter((word) => !fixtureSet.has(word));
    console.log(
      `[B3] finalizm bank round: generated=${generated.size} archivedWordsInCurrentWordlist=${expected.length} ` +
        `missing=${missing.length}${missing.length > 0 ? ` -> ${missing.join(', ')}` : ''} ` +
        `addedSince2007=${added.length}${added.length > 0 ? ` -> ${added.join(', ')}` : ''}`,
    );
    expect(missing).toEqual([]);
  });
});

if (leavings === null) {
  console.warn(
    '[B3] leavings fixture unavailable: neither tests/fixtures/rounds/leavings.xml nor the local ' +
      'archive (../kelimator-nostalji/calistir/xml_eng.php) exists — suite skipped (e.g. in CI, where ' +
      'the read-only archive is intentionally not part of this repository).',
  );
}

describe.skipIf(leavings === null)('fixture: leavings (archived xml_eng.php; English, no dictionary cross-check)', () => {
  it('is available and decodes to LEAVINGS', () => {
    const fixture = requireFixture(leavings, 'leavings');
    console.log(`[B3] leavings source: ${fixture.rel} sha256=${fixture.sha256}`);
    expect(fixture.parsed.main).toBe('LEAVINGS');
    expect(fixture.parsed.checksum).toBeNull();
  });

  it('passes all structural checks (3–8 letters, multiset ⊂ main, main present, no duplicates)', () => {
    const fixture = requireFixture(leavings, 'leavings');
    expect(structuralProblems(fixture.parsed)).toEqual([]);
    const counts = [3, 4, 5, 6, 7].map((length) => fixture.parsed.lists[length].length);
    console.log(
      `[B3] leavings structural: main=${fixture.parsed.main} counts(3..7)=${counts.join('/')} ` +
        `total=${counts.reduce((a, b) => a + b, 0) + 1} sorted=${[3, 4, 5, 6, 7]
          .every((length) => isSorted(fixture.parsed.lists[length]))}`,
    );
  });
});

describe('fixture: viroloji (Wayback xml.php capture 2007-05-14)', () => {
  if (viroloji === null) {
    console.warn(
      '[B3] viroloji fixture unavailable: neither tests/fixtures/rounds/viroloji.xml nor a local ' +
        'archived capture exists, ../kelimator-nostalji/README.md documents no 2007-05-14 URL, and ' +
        'task B3 forbids network requests. Recorded as a BLOCKER: evidence/B3-viroloji-blocker.md.',
    );
  } else {
    console.log(`[B3] viroloji source: ${viroloji.rel} sha256=${viroloji.sha256}`);
  }

  it.skipIf(viroloji === null)(
    'passes all structural checks (3–8 letters, multiset ⊂ main, main present, no duplicates)',
    () => {
      const fixture = requireFixture(viroloji, 'viroloji');
      expect(structuralProblems(fixture.parsed)).toEqual([]);
      const counts = [3, 4, 5, 6, 7].map((length) => fixture.parsed.lists[length].length);
      console.log(
        `[B3] viroloji structural: main=${fixture.parsed.main} counts(3..7)=${counts.join('/')}`,
      );
    },
  );
});

describe('id transliteration table (docs/06 §4)', () => {
  // Independent duplicate of the expected table: the test fails if the tool's
  // table drifts from the recorded mapping.
  const EXPECTED = {
    A: 'a',
    B: 'b',
    C: 'c',
    Ç: 'c',
    D: 'd',
    E: 'e',
    F: 'f',
    G: 'g',
    Ğ: 'g',
    H: 'h',
    I: 'i',
    İ: 'i',
    J: 'j',
    K: 'k',
    L: 'l',
    M: 'm',
    N: 'n',
    O: 'o',
    Ö: 'o',
    P: 'p',
    R: 'r',
    S: 's',
    Ş: 's',
    T: 't',
    U: 'u',
    Ü: 'u',
    V: 'v',
    Y: 'y',
    Z: 'z',
  };

  it('maps each of the 29 core letters through Turkish lower case + ASCII fold', () => {
    expect(Object.keys(EXPECTED)).toHaveLength(29);
    for (const [letter, ascii] of Object.entries(EXPECTED)) {
      expect(roundId(letter.repeat(8))).toBe(ascii.repeat(8));
    }
  });

  it('Turkish lower-casing distinguishes I → ı and İ → i', () => {
    expect(turkishLowerCase('I')).toBe('ı');
    expect(turkishLowerCase('İ')).toBe('i');
    expect(roundId('SINIRSIZ')).toBe('sinirsiz');
    expect(roundId('SİNİRSİZ')).toBe('sinirsiz');
  });

  it('the table only emits the schema alphabet [a-z0-9-]', () => {
    for (const mapped of Object.values(ID_TRANSLITERATION)) {
      expect(mapped).toMatch(/^[a-z0-9-]$/);
    }
  });

  it('archived fixture mains map to the expected ids', () => {
    expect(roundId('FİNALİZM')).toBe('finalizm');
    expect(roundId('LEAVINGS')).toBe('leavings');
  });

  it('throws on characters outside the table (no silent malformed id)', () => {
    expect(() => roundId('ABCÂDEFG')).toThrow();
    expect(() => roundId('ABC*DEFG')).toThrow();
  });
});

describe('emitted bank (src/data/rounds.json; V2 invariants)', () => {
  it('schemaVersion 1 and non-empty (schema requires minItems 1)', () => {
    expect(bank.schemaVersion).toBe(1);
    expect(Array.isArray(bank.rounds)).toBe(true);
    expect(bank.rounds.length).toBeGreaterThan(0);
  });

  it('every round: main length exactly 8 and letters length exactly 8 (V2)', () => {
    const problems = [];
    for (const round of bank.rounds) {
      if ([...round.main].length !== 8) problems.push(`${round.main}: main length`);
      if (round.letters.length !== 8) problems.push(`${round.main}: letters length`);
    }
    expect(problems).toEqual([]);
  });

  it('every round: letters are the multiset of main', () => {
    const problems = [];
    for (const round of bank.rounds) {
      const mainCounts = letterCounts(round.main);
      const letterCountsJoined = letterCounts(round.letters.join(''));
      if (
        !isSubMultiset(mainCounts, letterCountsJoined) ||
        !isSubMultiset(letterCountsJoined, mainCounts)
      ) {
        problems.push(`${round.main}: letters != main multiset`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every round: "8" list contains only the main word; word arrays strictly sorted', () => {
    const problems = [];
    for (const round of bank.rounds) {
      if (round.words['8'].length !== 1 || round.words['8'][0] !== round.main) {
        problems.push(`${round.main}: "8" list`);
      }
      for (const length of ['3', '4', '5', '6', '7']) {
        if (!isSorted(round.words[length])) problems.push(`${round.main}/${length}: not sorted`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every round: total words ≥ configured T, and id = roundId(main)', () => {
    const problems = [];
    for (const round of bank.rounds) {
      const total = ['3', '4', '5', '6', '7', '8'].reduce(
        (sum, length) => sum + round.words[length].length,
        0,
      );
      if (total < config.thresholdT) problems.push(`${round.main}: total ${total} < T`);
      if (round.id !== roundId(round.main)) problems.push(`${round.main}: id`);
    }
    console.log(
      `[B3] bank: rounds=${bank.rounds.length} T=${config.thresholdT} ` +
        `perLength(3..8)=${['3', '4', '5', '6', '7', '8']
          .map((length) => bank.rounds.reduce((sum, round) => sum + round.words[length].length, 0))
          .join('/')}`,
    );
    expect(problems).toEqual([]);
  });

  it('rounds are sorted strictly by main (sequential selection order)', () => {
    const problems = [];
    for (let i = 1; i < bank.rounds.length; i += 1) {
      if (compareCodePoints(bank.rounds[i - 1].main, bank.rounds[i].main) >= 0) {
        problems.push(`order at ${bank.rounds[i].main}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('records (does not resolve) id collisions of the docs/06 §4 rule', () => {
    const collisions = idCollisions(bank.rounds.map((round) => round.main));
    console.log(
      `[B3] id collisions within the bank under the docs/06 §4 rule ` +
        `(spec defines no disambiguation; recorded in evidence/B3-bank.md): ${collisions.size}`,
    );
    for (const [id, mains] of collisions) console.log(`[B3]   ${id} <- ${mains.join(', ')}`);
    expect(collisions.size).toBeGreaterThanOrEqual(0);
  });
});