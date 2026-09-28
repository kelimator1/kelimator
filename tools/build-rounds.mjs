#!/usr/bin/env node
/**
 * tools/build-rounds.mjs — task B3 (docs/06 §3) deterministic round-bank build.
 *
 * Input : `tools/wordlist.txt` (B2 output; 29-letter upper-case core words)
 * Config: `tools/build-config.json` (threshold T + evidence path, chosen by the
 *         docs/06 §3 step-3 measurement; see `evidence/B3-threshold.md`)
 * Output: `src/data/rounds.json` (schema `data/rounds.schema.json`)
 *
 * Algorithm, applied exactly as specified in docs/06 §3:
 *   1. Candidates: all words of length 8 from the wordlist.
 *   2. For each candidate C (letter multiset M): subwords = every dictionary
 *      word W with 3 ≤ len(W) ≤ 7 whose letter multiset is contained in M.
 *      The main word itself is added to the "8" list (only C).
 *   3. Round validity: total words (3–7 list + main) ≥ T. T comes from
 *      `tools/build-config.json`; T was selected by the recorded measurement
 *      (largest T ∈ {10,15,20,25,30} with bank size ≥ 500 rounds).
 *   4. Output: rounds sorted by `main` (code-point order), `words` arrays
 *      sorted lexicographically (the wordlist itself is sorted, so collected
 *      subwords keep code-point order), stable JSON (2-space indent, LF,
 *      trailing newline).
 *   5. `id` transliteration (docs/06 §4): Turkish lower case, then the
 *      `ID_TRANSLITERATION` table maps the result to `[a-z0-9-]`. The table is
 *      exported and unit-tested (`tests/rounds-fixtures.test.mjs`).
 *
 * Recorded decisions (docs leave these open; evidence records them):
 *   - `letters` = the letters of `main` in main-word order. The frozen schema
 *     only requires 8 single-character items; docs/05 calls the field "multiset
 *     of main word letters". Main order is the original client's tile-creation
 *     order (`enbuyukkelime` characters, then shuffle) and is fully
 *     deterministic; consumers may canonicalize (sort) if they need a bag.
 *   - The build fails fast (exit 1) on a missing/invalid config, a wordlist
 *     entry outside the 29-letter upper-case core set, or a pinned wordlist
 *     SHA-256 mismatch (no silent drift, no partial output).
 *
 * Usage:
 *   node tools/build-rounds.mjs --measure            # bank sizes for T ∈ {10,15,20,25,30}
 *   node tools/build-rounds.mjs                      # build src/data/rounds.json
 *   node tools/build-rounds.mjs --check              # re-validate the emitted file
 *   node tools/build-rounds.mjs --wordlist <file> --config <file> --out <file>
 * Exit code 0 on success; 1 on a failed precondition.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCoreWord, sha256, turkishUpperCase } from './normalize-wordlist.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The 29 core Turkish letters (docs/06 §2 step 2). */
export const CORE_LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';
export const LETTER_COUNT = CORE_LETTERS.length;

const LETTER_INDEX = new Map([...CORE_LETTERS].map((ch, index) => [ch, index]));

/** Candidate thresholds measured by docs/06 §3 step 3. */
export const MEASURE_THRESHOLDS = Object.freeze([10, 15, 20, 25, 30]);

/** The docs/06 §3 step-3 selection rule. */
export const MIN_BANK_SIZE = 500;

/** Turkish upper → lower mapping (docs/06 §2 step 1 read backwards). */
const TURKISH_UPPER_TO_LOWER = new Map(
  Object.entries({
    A: 'a',
    B: 'b',
    C: 'c',
    Ç: 'ç',
    D: 'd',
    E: 'e',
    F: 'f',
    G: 'g',
    Ğ: 'ğ',
    H: 'h',
    I: 'ı',
    İ: 'i',
    J: 'j',
    K: 'k',
    L: 'l',
    M: 'm',
    N: 'n',
    O: 'o',
    Ö: 'ö',
    P: 'p',
    R: 'r',
    S: 's',
    Ş: 'ş',
    T: 't',
    U: 'u',
    Ü: 'ü',
    V: 'v',
    Y: 'y',
    Z: 'z',
  }),
);

/** Turkish lower-casing (mirror of B2's explicit upper-casing table). */
export function turkishLowerCase(text) {
  let out = '';
  for (const ch of text) out += TURKISH_UPPER_TO_LOWER.get(ch) ?? ch;
  return out;
}

/**
 * docs/06 §4 `id` transliteration table (recorded; unit-tested).
 * Input alphabet: Turkish lower-case letters (plus digits and `-`, which the
 * long-word candidates never contain); output alphabet: `[a-z0-9-]`.
 */
export const ID_TRANSLITERATION = Object.freeze({
  a: 'a',
  b: 'b',
  c: 'c',
  ç: 'c',
  d: 'd',
  e: 'e',
  f: 'f',
  g: 'g',
  ğ: 'g',
  h: 'h',
  ı: 'i',
  i: 'i',
  j: 'j',
  k: 'k',
  l: 'l',
  m: 'm',
  n: 'n',
  o: 'o',
  ö: 'o',
  p: 'p',
  r: 'r',
  s: 's',
  ş: 's',
  t: 't',
  u: 'u',
  ü: 'u',
  v: 'v',
  y: 'y',
  z: 'z',
  0: '0',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  '-': '-',
});

const ID_PATTERN = /^[a-z0-9-]+$/;

/**
 * docs/06 §4: `id` = lowercased main word (Turkish casing) transliterated to
 * `[a-z0-9-]`. Throws when a character has no table entry, so an unexpected
 * character can never silently produce a malformed id.
 */
export function roundId(main) {
  const lowered = turkishLowerCase(main);
  let id = '';
  for (const ch of lowered) {
    const mapped = ID_TRANSLITERATION[ch];
    if (mapped === undefined) {
      throw new Error(
        `id transliteration has no mapping for ${JSON.stringify(ch)} in ${JSON.stringify(main)}`,
      );
    }
    id += mapped;
  }
  if (!ID_PATTERN.test(id)) {
    throw new Error(`id ${JSON.stringify(id)} does not match ${ID_PATTERN}`);
  }
  return id;
}

/** Stable code-point comparison (same basis as the B2 wordlist order). */
export function compareCodePoints(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Letter multiset of a word as a 29-slot count array. */
export function letterCounts(word) {
  const counts = new Uint8Array(LETTER_COUNT);
  for (const ch of word) {
    const index = LETTER_INDEX.get(ch);
    if (index === undefined) {
      throw new Error(`non-core letter ${JSON.stringify(ch)} in ${JSON.stringify(word)}`);
    }
    counts[index] += 1;
  }
  return counts;
}

/** Letter set of a word as a 29-bit mask (fast subword pre-filter). */
function letterMask(word) {
  let mask = 0;
  for (const ch of word) {
    const index = LETTER_INDEX.get(ch);
    if (index === undefined) {
      throw new Error(`non-core letter ${JSON.stringify(ch)} in ${JSON.stringify(word)}`);
    }
    mask |= 1 << index;
  }
  return mask;
}

/** True iff the multiset `subCounts` is contained in the multiset `superCounts`. */
export function isSubMultiset(subCounts, superCounts) {
  for (let i = 0; i < LETTER_COUNT; i += 1) {
    if (subCounts[i] > superCounts[i]) return false;
  }
  return true;
}

/**
 * Index a wordlist per docs/06 §3: candidates (length 8) and subword pool
 * (length 3–7) with precomputed masks/counts. Every word must be an upper-case
 * core word (the B2 output invariant).
 */
export function prepareWordlist(words) {
  const candidates = [];
  const subwords = [];
  for (const word of words) {
    if (!isCoreWord(word) || turkishUpperCase(word) !== word) {
      throw new Error(`wordlist entry is not an upper-case core word: ${JSON.stringify(word)}`);
    }
    if (word.length === 8) candidates.push(word);
    else if (word.length >= 3 && word.length <= 7) subwords.push(word);
  }
  const subMasks = new Int32Array(subwords.length);
  const subCounts = new Uint8Array(subwords.length * LETTER_COUNT);
  for (let i = 0; i < subwords.length; i += 1) {
    subMasks[i] = letterMask(subwords[i]);
    subCounts.set(letterCounts(subwords[i]), i * LETTER_COUNT);
  }
  return { candidates, subwords, subMasks, subCounts };
}

/** Number of 3–7 subwords of `main` plus the main word itself (docs/06 §3 step 3). */
export function countRoundWords(main, prepared) {
  const mainCounts = letterCounts(main);
  const mainMask = letterMask(main);
  let total = 1; // the main word (length-8 list)
  for (let i = 0; i < prepared.subwords.length; i += 1) {
    if ((prepared.subMasks[i] & ~mainMask) !== 0) continue;
    const base = i * LETTER_COUNT;
    let contained = true;
    for (let k = 0; k < LETTER_COUNT; k += 1) {
      if (prepared.subCounts[base + k] > mainCounts[k]) {
        contained = false;
        break;
      }
    }
    if (contained) total += 1;
  }
  return total;
}

/**
 * Enumerate one round for candidate `main` (docs/06 §3 steps 1–2).
 * Returns the schema-shaped round plus the internal `total`.
 */
export function enumerateRound(main, prepared) {
  if (main.length !== 8) {
    throw new Error(`candidate is not 8 letters: ${JSON.stringify(main)}`);
  }
  const mainCounts = letterCounts(main);
  const mainMask = letterMask(main);
  const words = { 3: [], 4: [], 5: [], 6: [], 7: [], 8: [main] };
  for (let i = 0; i < prepared.subwords.length; i += 1) {
    if ((prepared.subMasks[i] & ~mainMask) !== 0) continue;
    const base = i * LETTER_COUNT;
    let contained = true;
    for (let k = 0; k < LETTER_COUNT; k += 1) {
      if (prepared.subCounts[base + k] > mainCounts[k]) {
        contained = false;
        break;
      }
    }
    if (contained) words[prepared.subwords[i].length].push(prepared.subwords[i]);
  }
  const total =
    1 + words[3].length + words[4].length + words[5].length + words[6].length + words[7].length;
  return {
    id: roundId(main),
    main,
    letters: [...main],
    words,
    total,
  };
}

/** totals[main] → number of words (3–7 + main) of that candidate. */
export function computeTotals(prepared) {
  const totals = new Map();
  for (const main of prepared.candidates) {
    totals.set(main, countRoundWords(main, prepared));
  }
  return totals;
}

/** Bank size for threshold T: candidates whose total word count is ≥ T. */
export function bankSize(totals, thresholdT) {
  let size = 0;
  for (const total of totals.values()) if (total >= thresholdT) size += 1;
  return size;
}

/** The docs/06 §3 step-3 selection: largest T with bank ≥ 500, else null. */
export function selectThreshold(totals, thresholds = MEASURE_THRESHOLDS) {
  let selected = null;
  for (const t of thresholds) {
    if (bankSize(totals, t) >= MIN_BANK_SIZE && (selected === null || t > selected)) {
      selected = t;
    }
  }
  return selected;
}

/**
 * Build the bank (docs/06 §3 step 4): rounds with total ≥ thresholdT, sorted
 * by `main` (code-point order).
 */
export function buildRounds(prepared, thresholdT) {
  const rounds = [];
  for (const main of prepared.candidates) {
    if (countRoundWords(main, prepared) < thresholdT) continue;
    const round = enumerateRound(main, prepared);
    rounds.push({ id: round.id, main: round.main, letters: round.letters, words: round.words });
  }
  rounds.sort((a, b) => compareCodePoints(a.main, b.main));
  return rounds;
}

/** Stable JSON serialization for `src/data/rounds.json` (docs/06 §3 step 4). */
export function renderRoundsJson(rounds) {
  return `${JSON.stringify({ schemaVersion: 1, rounds }, null, 2)}\n`;
}

/**
 * Deterministic id collisions of a list of main words under the docs/06 §4
 * rule (recorded, not resolved: the spec defines no disambiguation).
 */
export function idCollisions(mains) {
  const first = new Map();
  const collisions = new Map();
  for (const main of mains) {
    const id = roundId(main);
    if (first.has(id)) {
      if (!collisions.has(id)) collisions.set(id, [first.get(id)]);
      collisions.get(id).push(main);
    } else {
      first.set(id, main);
    }
  }
  return collisions;
}

/** Per-length statistics of an emitted bank. */
export function perLengthStats(rounds) {
  const stats = { totals: {}, distinct: {}, minWords: null, maxWords: null, meanWords: 0 };
  const distinct = new Map();
  let sum = 0;
  for (const round of rounds) {
    let roundTotal = 0;
    for (const length of ['3', '4', '5', '6', '7', '8']) {
      const words = round.words[length];
      stats.totals[length] = (stats.totals[length] ?? 0) + words.length;
      if (!distinct.has(length)) distinct.set(length, new Set());
      for (const word of words) distinct.get(length).add(word);
      roundTotal += words.length;
    }
    sum += roundTotal;
    stats.minWords = stats.minWords === null ? roundTotal : Math.min(stats.minWords, roundTotal);
    stats.maxWords = stats.maxWords === null ? roundTotal : Math.max(stats.maxWords, roundTotal);
  }
  for (const length of ['3', '4', '5', '6', '7', '8']) {
    stats.distinct[length] = (distinct.get(length) ?? new Set()).size;
  }
  stats.meanWords = rounds.length === 0 ? 0 : sum / rounds.length;
  return stats;
}

/**
 * V2/V8-style invariants of an emitted bank: main/letters lengths, letters
 * multiset = main multiset, sorted words, sorted rounds, schema id pattern,
 * every round ≥ thresholdT. Returns a list of violation strings.
 */
export function checkBank(bank, thresholdT) {
  const violations = [];
  let previousMain = null;
  for (const round of bank.rounds) {
    if (round.main.length !== 8) violations.push(`${round.main}: main length ${round.main.length}`);
    if (round.letters.length !== 8) {
      violations.push(`${round.main}: letters length ${round.letters.length}`);
    } else if (!isSubMultiset(letterCounts(round.letters.join('')), letterCounts(round.main))
      || !isSubMultiset(letterCounts(round.main), letterCounts(round.letters.join('')))) {
      violations.push(`${round.main}: letters are not the main word's multiset`);
    }
    if (round.words['8'].length !== 1 || round.words['8'][0] !== round.main) {
      violations.push(`${round.main}: "8" list must contain exactly the main word`);
    }
    if (!ID_PATTERN.test(round.id)) violations.push(`${round.main}: id ${round.id} invalid`);
    let total = 0;
    for (const length of ['3', '4', '5', '6', '7', '8']) {
      const words = round.words[length];
      total += words.length;
      for (let i = 1; i < words.length; i += 1) {
        if (compareCodePoints(words[i - 1], words[i]) >= 0) {
          violations.push(`${round.main}/${length}: words not strictly sorted at ${words[i]}`);
        }
      }
      for (const word of words) {
        if (!isCoreWord(word)) violations.push(`${round.main}/${length}: non-core word ${word}`);
      }
    }
    if (total < thresholdT) violations.push(`${round.main}: total ${total} < T ${thresholdT}`);
    if (previousMain !== null && compareCodePoints(previousMain, round.main) >= 0) {
      violations.push(`rounds not strictly sorted at ${round.main} (previous ${previousMain})`);
    }
    previousMain = round.main;
  }
  return violations;
}

function parseArgs(argv) {
  const args = { measure: false, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--measure') args.measure = true;
    else if (arg === '--check') args.check = true;
    else if (arg === '--wordlist') args.wordlist = argv[(i += 1)];
    else if (arg === '--config') args.config = argv[(i += 1)];
    else if (arg === '--out') args.out = argv[(i += 1)];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function log(line) {
  console.log(`[B3] ${line}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const wordlistPath = path.resolve(ROOT, args.wordlist ?? 'tools/wordlist.txt');
  const configPath = path.resolve(ROOT, args.config ?? 'tools/build-config.json');

  const wordlistBytes = readFileSync(wordlistPath);
  const wordlistSha = sha256(wordlistBytes);
  const words = wordlistBytes
    .toString('utf8')
    .split('\n')
    .filter((line) => line !== '');
  const prepared = prepareWordlist(words);

  log(`wordlist: ${path.relative(ROOT, wordlistPath)} (${words.length} words, sha256=${wordlistSha})`);
  log(
    `batch: candidates(length 8)=${prepared.candidates.length} subwords(3..7)=${prepared.subwords.length}`,
  );

  if (args.measure) {
    const totals = computeTotals(prepared);
    console.log('# B3 threshold measurement — docs/06 §3 step 3');
    console.log(`# wordlist: ${path.relative(ROOT, wordlistPath)} sha256=${wordlistSha}`);
    console.log('# bank(T) = candidates whose total words (3-7 + main) is >= T');
    console.log('T\tbank_rounds');
    for (const t of MEASURE_THRESHOLDS) {
      console.log(`${t}\t${bankSize(totals, t)}`);
    }
    const selected = selectThreshold(totals);
    console.log(
      selected === null
        ? 'selected\tNONE (no T reaches 500; docs/06 §3 step 3 => T=10 + BLOCKER)'
        : `selected\t${selected} (largest T with bank >= ${MIN_BANK_SIZE})`,
    );
    return;
  }

  const configBytes = readFileSync(configPath);
  const config = JSON.parse(configBytes.toString('utf8'));
  const thresholdT = config.thresholdT;
  if (!Number.isInteger(thresholdT) || thresholdT < 1) {
    throw new Error(
      `${path.relative(ROOT, configPath)}: thresholdT must be a positive integer, got ${JSON.stringify(thresholdT)}`,
    );
  }
  if (config.wordlistSha256 !== undefined && config.wordlistSha256 !== wordlistSha) {
    throw new Error(
      `wordlist SHA-256 mismatch: ${wordlistSha} != pinned ${config.wordlistSha256} (${path.relative(ROOT, wordlistPath)})`,
    );
  }
  log(
    `config: ${path.relative(ROOT, configPath)} thresholdT=${thresholdT} evidence=${config.thresholdEvidence ?? '(none)'}`,
  );

  const outputPath = path.resolve(ROOT, args.out ?? config.output ?? 'src/data/rounds.json');
  if (args.check) {
    const bank = JSON.parse(readFileSync(outputPath, 'utf8'));
    const violations = checkBank(bank, thresholdT);
    const stats = perLengthStats(bank.rounds);
    log(
      `check: ${path.relative(ROOT, outputPath)} rounds=${bank.rounds.length} T=${thresholdT} ` +
        `perLength=${JSON.stringify(stats.totals)} min=${stats.minWords} max=${stats.maxWords} ` +
        `mean=${stats.meanWords.toFixed(2)}`,
    );
    if (violations.length > 0) {
      for (const violation of violations) console.error(`[B3] VIOLATION ${violation}`);
      throw new Error(`${violations.length} invariant violation(s)`);
    }
    log('check: all invariants hold (V2: main/letters lengths; sorted; ids; T)');
    return;
  }

  const rounds = buildRounds(prepared, thresholdT);
  const output = renderRoundsJson(rounds);
  writeFileSync(outputPath, output, 'utf8');

  const stats = perLengthStats(rounds);
  const outputSha = createHash('sha256').update(output).digest('hex');
  log(`rounds: ${rounds.length} (total words per round >= ${thresholdT})`);
  for (const length of ['3', '4', '5', '6', '7', '8']) {
    log(
      `words length ${length}: total=${stats.totals[length]} distinct=${stats.distinct[length]}`,
    );
  }
  log(
    `words per round: min=${stats.minWords} max=${stats.maxWords} mean=${stats.meanWords.toFixed(2)}`,
  );
  const candidateCollisions = idCollisions(prepared.candidates);
  const bankCollisions = idCollisions(rounds.map((round) => round.main));
  log(`id collisions over all candidates: ${candidateCollisions.size}`);
  for (const [id, mains] of candidateCollisions) log(`  id collision: ${id} <- ${mains.join(', ')}`);
  log(`id collisions within the bank: ${bankCollisions.size}`);
  for (const [id, mains] of bankCollisions) log(`  bank id collision: ${id} <- ${mains.join(', ')}`);
  log(`output: ${path.relative(ROOT, outputPath)} (${Buffer.byteLength(output)} bytes, sha256=${outputSha})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[B3] FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
