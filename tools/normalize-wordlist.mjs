#!/usr/bin/env node
/**
 * tools/normalize-wordlist.mjs — task B2 (docs/06 §2) deterministic pipeline
 * from the B1 snapshot `artifacts/tdk/headwords.txt` to `tools/wordlist.txt`.
 *
 * Steps, applied exactly as specified in docs/06 §2:
 *   1. Casing: Turkish upper case (`i → İ`, `ı → I`, `toLocaleUpperCase('tr')`
 *      semantics). Display form = comparison form (this game displays upper case).
 *   2. Charset: keep only words consisting of the 29 core Turkish letters
 *      A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z.
 *      A word containing any other character (circumflex forms, punctuation,
 *      whitespace, digits, …) is dropped entirely.
 *   3. Shape: single token, length ≥ 3 (single-token is implied by step 2 —
 *      whitespace can never pass the charset filter).
 *   4. Blocklist: drop words listed in `data/blocklist.txt` (one upper-case
 *      word per line; blank lines ignored).
 *   5. Output: sorted, deduplicated, one word per line, LF, UTF-8.
 *
 * The casing table below is an explicit, ICU-independent implementation of the
 * Turkish mapping for the core letters. Characters outside the table cannot
 * survive the charset filter (step 2), so the kept set is identical to what
 * `toLocaleUpperCase('tr')` produces (verified on the snapshot, see
 * evidence/B2-normalization.md §4).
 *
 * Usage:
 *   node tools/normalize-wordlist.mjs [input] [output] [blocklist]
 * Defaults: artifacts/tdk/headwords.txt, tools/wordlist.txt, data/blocklist.txt
 *
 * Exit code 0 on success; 1 on a failed precondition (no partial silent pass).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The 29 core Turkish letters (upper case) — docs/06 §2 step 2. */
export const CORE_LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

const CORE = new Set(CORE_LETTERS);

/**
 * Turkish lower → upper mapping (docs/06 §2 step 1). The circumflex letters
 * map to their upper-case forms too; they are dropped by the charset filter in
 * step 2 either way (kept here so the casing step mirrors `tr` semantics).
 */
const TURKISH_LOWER_TO_UPPER = new Map(
  Object.entries({
    a: 'A',
    b: 'B',
    c: 'C',
    ç: 'Ç',
    d: 'D',
    e: 'E',
    f: 'F',
    g: 'G',
    ğ: 'Ğ',
    h: 'H',
    ı: 'I',
    i: 'İ',
    j: 'J',
    k: 'K',
    l: 'L',
    m: 'M',
    n: 'N',
    o: 'O',
    ö: 'Ö',
    p: 'P',
    r: 'R',
    s: 'S',
    ş: 'Ş',
    t: 'T',
    u: 'U',
    ü: 'Ü',
    v: 'V',
    y: 'Y',
    z: 'Z',
    â: 'Â',
    î: 'Î',
    û: 'Û',
  }),
);

/** Turkish upper-casing (docs/06 §2 step 1). */
export function turkishUpperCase(text) {
  let out = '';
  for (const ch of text) out += TURKISH_LOWER_TO_UPPER.get(ch) ?? ch;
  return out;
}

/** True iff `word` is non-empty and consists only of core Turkish letters. */
export function isCoreWord(word) {
  if (word.length === 0) return false;
  for (const ch of word) if (!CORE.has(ch)) return false;
  return true;
}

/**
 * One word through docs/06 §2 steps 1–3.
 * Returns the normalized (upper-case, core-letters, length ≥ 3) word, or null
 * when the word is dropped by the charset or shape filter.
 */
export function normalizeWord(word) {
  const upper = turkishUpperCase(word);
  if (!isCoreWord(upper)) return null;
  if (upper.length < 3) return null;
  return upper;
}

/**
 * Parse `data/blocklist.txt`. Blank lines are ignored; every entry must be an
 * upper-case core-letters word of length ≥ 3 (a shorter entry could never match
 * the step-3 output and would be a silent no-op). Invalid entries throw.
 */
export function parseBlocklist(text) {
  const entries = new Set();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '') continue;
    if (!isCoreWord(line) || turkishUpperCase(line) !== line) {
      throw new Error(`blocklist entry is not upper-case core letters: ${JSON.stringify(line)}`);
    }
    if (line.length < 3) {
      throw new Error(`blocklist entry is shorter than the step-3 minimum: ${JSON.stringify(line)}`);
    }
    entries.add(line);
  }
  return entries;
}

/** Stable code-point comparison (equivalent to UTF-8 byte order for the BMP). */
function compareCodePoints(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Run docs/06 §2 steps 1–5 over input lines.
 * Returns the sorted unique kept words, the removed blocklisted words, the
 * blocklist entries that matched nothing, and per-step counts.
 */
export function normalizeLines(lines, blocklist = new Set()) {
  const stats = {
    input: 0,
    afterCasing: 0,
    afterCharset: 0,
    afterShape: 0,
    uniqueAfterShape: 0,
    blocked: 0,
    output: 0,
  };

  // Step 1 — casing (never drops a word).
  const cased = [];
  for (const line of lines) {
    if (line === '') continue;
    stats.input += 1;
    cased.push(turkishUpperCase(line));
  }
  stats.afterCasing = cased.length;

  // Step 2 — charset.
  const charset = cased.filter(isCoreWord);
  stats.afterCharset = charset.length;

  // Step 3 — shape (single token, length ≥ 3).
  const shape = charset.filter((word) => word.length >= 3);
  stats.afterShape = shape.length;

  // Step 5 — deduplicate (display form = comparison form, docs/06 §2 step 1).
  const unique = [...new Set(shape)].sort(compareCodePoints);
  stats.uniqueAfterShape = unique.length;

  // Step 4 — blocklist.
  const words = [];
  const removed = [];
  for (const word of unique) {
    if (blocklist.has(word)) removed.push(word);
    else words.push(word);
  }
  stats.blocked = removed.length;
  stats.output = words.length;

  const unmatchedBlocklist = [...blocklist]
    .filter((entry) => !removed.includes(entry))
    .sort(compareCodePoints);

  return {
    words,
    removedBlocklistWords: removed.sort(compareCodePoints),
    unmatchedBlocklist,
    stats,
  };
}

/** Serialize the output: one word per line, LF-terminated, UTF-8. */
export function renderWordlist(words) {
  return words.length === 0 ? '' : `${words.join('\n')}\n`;
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function main() {
  const [inputArg, outputArg, blocklistArg] = process.argv.slice(2);
  const inputPath = path.resolve(ROOT, inputArg ?? 'artifacts/tdk/headwords.txt');
  const outputPath = path.resolve(ROOT, outputArg ?? 'tools/wordlist.txt');
  const blocklistPath = path.resolve(ROOT, blocklistArg ?? 'data/blocklist.txt');

  const inputBytes = readFileSync(inputPath);
  const blocklistBytes = readFileSync(blocklistPath);
  const lines = inputBytes.toString('utf8').split('\n');

  const blocklist = parseBlocklist(blocklistBytes.toString('utf8'));
  const { words, removedBlocklistWords, unmatchedBlocklist, stats } = normalizeLines(lines, blocklist);
  const output = renderWordlist(words);
  writeFileSync(outputPath, output, 'utf8');

  console.log(`[B2] input: ${inputPath} (${stats.input} lines, sha256=${sha256(inputBytes)})`);
  console.log(`[B2] blocklist: ${blocklistPath} (${blocklist.size} entries, sha256=${sha256(blocklistBytes)})`);
  console.log(`[B2] step 1 after casing: ${stats.afterCasing}`);
  console.log(`[B2] step 2 after charset: ${stats.afterCharset}`);
  console.log(`[B2] step 3 after shape (length >= 3): ${stats.afterShape}`);
  console.log(`[B2] unique after shape: ${stats.uniqueAfterShape}`);
  console.log(`[B2] step 4 removed by blocklist: ${stats.blocked}`);
  console.log(`[B2] removed words: ${removedBlocklistWords.join(', ')}`);
  if (unmatchedBlocklist.length > 0) {
    console.log(`[B2] WARNING blocklist entries not present in the input: ${unmatchedBlocklist.join(', ')}`);
  }
  console.log(`[B2] output: ${outputPath} (${stats.output} lines, sha256=${sha256(output)})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[B2] FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
