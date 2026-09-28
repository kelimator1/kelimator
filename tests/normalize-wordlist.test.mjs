// Unit tests for tools/normalize-wordlist.mjs — task B2 (docs/06 §2).
//
// V4 cases named in tasks/B2-wordlist-normalization.md: Turkish casing
// (i → İ, ı → I, mixed), circumflex rejection (KÂSE dropped), punctuation
// rejection, blocklist application. The last describe block re-asserts the V2
// format of the committed artifacts (tools/wordlist.txt, data/blocklist.txt).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  CORE_LETTERS,
  turkishUpperCase,
  isCoreWord,
  normalizeWord,
  parseBlocklist,
  normalizeLines,
  renderWordlist,
} from '../tools/normalize-wordlist.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

describe('turkishUpperCase (docs/06 §2 step 1)', () => {
  it('maps i → İ and ı → I', () => {
    expect(turkishUpperCase('i')).toBe('İ');
    expect(turkishUpperCase('ı')).toBe('I');
  });

  it('maps mixed-case Turkish letters', () => {
    expect(turkishUpperCase('iyi')).toBe('İYİ');
    expect(turkishUpperCase('ırmak')).toBe('IRMAK');
    expect(turkishUpperCase('kişi')).toBe('KİŞİ');
    expect(turkishUpperCase('çğıöşü')).toBe('ÇĞIÖŞÜ');
  });

  it('leaves upper-case input unchanged', () => {
    expect(turkishUpperCase('İSTANBUL')).toBe('İSTANBUL');
    expect(turkishUpperCase('IRMAK')).toBe('IRMAK');
  });
});

describe('normalizeWord (docs/06 §2 steps 1–3)', () => {
  it('drops words containing circumflex letters (KÂSE)', () => {
    expect(normalizeWord('KÂSE')).toBeNull();
    expect(normalizeWord('kâse')).toBeNull();
    expect(normalizeWord('kîtap')).toBeNull();
  });

  it('drops words containing punctuation, whitespace or digits', () => {
    expect(normalizeWord('K-T')).toBeNull();
    expect(normalizeWord("K'T")).toBeNull();
    expect(normalizeWord('K T')).toBeNull();
    expect(normalizeWord('K.T')).toBeNull();
    expect(normalizeWord('K3')).toBeNull();
  });

  it('drops single tokens shorter than 3 letters', () => {
    expect(normalizeWord('ab')).toBeNull();
    expect(normalizeWord('B')).toBeNull();
  });

  it('keeps single-token core words, cased and upper-case', () => {
    expect(normalizeWord('iyi')).toBe('İYİ');
    expect(normalizeWord('ırmak')).toBe('IRMAK');
    expect(normalizeWord('Kâse')).toBeNull();
    expect(isCoreWord('İYİ')).toBe(true);
    expect(isCoreWord('IXI')).toBe(false);
  });

  it('uses exactly the 29 core letters (docs/06 §2 step 2)', () => {
    expect(CORE_LETTERS).toHaveLength(29);
    expect(CORE_LETTERS).toBe('ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ');
  });
});

describe('normalizeLines (docs/06 §2 steps 1–5)', () => {
  it('deduplicates case-distinct forms after casing and sorts the output', () => {
    const { words } = normalizeLines(['akrep', 'Akrep', 'abalı', 'Abalı', 'zurna']);
    expect(words).toEqual(['ABALI', 'AKREP', 'ZURNA']);
  });

  it('applies the blocklist after the charset and shape steps', () => {
    const input = ['iyi', 'sik', 'köpek', 'test'];
    const { words, removedBlocklistWords, stats } = normalizeLines(input, new Set(['SİK']));
    // Code-point order (= UTF-8 byte order for the BMP): İ (U+0130) > Z (U+005A).
    expect(words).toEqual(['KÖPEK', 'TEST', 'İYİ']);
    expect(removedBlocklistWords).toEqual(['SİK']);
    expect(stats).toEqual({
      input: 4,
      afterCasing: 4,
      afterCharset: 4,
      afterShape: 4,
      uniqueAfterShape: 4,
      blocked: 1,
      output: 3,
    });
  });

  it('records the charset and shape drops in the step counts', () => {
    const input = ['kâse', 'ab', 'abc', 'a-b'];
    const { words, stats } = normalizeLines(input, new Set());
    expect(words).toEqual(['ABC']);
    expect(stats).toEqual({
      input: 4,
      afterCasing: 4,
      afterCharset: 2, // kâse (â) and a-b (-) fail step 2
      afterShape: 1, // ab fails length ≥ 3
      uniqueAfterShape: 1,
      blocked: 0,
      output: 1,
    });
  });

  it('renders one LF-terminated word per line', () => {
    expect(renderWordlist(['AB', 'CD'])).toBe('AB\nCD\n');
  });
});

describe('parseBlocklist (data/blocklist.txt format)', () => {
  it('parses upper-case core words and ignores blank lines', () => {
    expect(parseBlocklist('SİK\n\nGÖT\n')).toEqual(new Set(['SİK', 'GÖT']));
  });

  it('rejects entries that are not upper-case core letters', () => {
    expect(() => parseBlocklist('sik\n')).toThrow();
    expect(() => parseBlocklist('AB\n')).toThrow();
    expect(() => parseBlocklist('A-B\n')).toThrow();
  });
});

describe('committed artifacts (V2 format)', () => {
  const blocklist = parseBlocklist(readFileSync(`${repoRoot}data/blocklist.txt`, 'utf8'));
  const wordlistText = readFileSync(`${repoRoot}tools/wordlist.txt`, 'utf8');

  it('data/blocklist.txt is non-empty and well-formed', () => {
    expect(blocklist.size).toBeGreaterThan(0);
  });

  it('tools/wordlist.txt is sorted, deduplicated, LF-terminated and > 10,000 lines', () => {
    expect(wordlistText.endsWith('\n')).toBe(true);
    const lines = wordlistText.split('\n').slice(0, -1);
    expect(lines.length).toBeGreaterThan(10_000);
    expect(lines).toEqual([...new Set(lines)].sort());
  });

  it('every wordlist line has ≥ 3 letters from the 29-letter alphabet', () => {
    const core = new Set(CORE_LETTERS);
    const bad = wordlistText
      .split('\n')
      .slice(0, -1)
      .filter((line) => line.length < 3 || [...line].some((ch) => !core.has(ch)));
    expect(bad).toEqual([]);
  });

  it('no blocklisted word occurs in the wordlist', () => {
    const words = new Set(wordlistText.split('\n'));
    const present = [...blocklist].filter((entry) => words.has(entry));
    expect(present).toEqual([]);
  });

  it('excludes the non-lexical fixture words GFGF and SFSFS (orchestrator decision 2026-09-28)', () => {
    // Basis: site-bundle test fixtures (`örnekKelime N` family), not dictionary
    // headwords — evidence/B2-filters.md §3.5/§4.3. Non-offensive exclusions,
    // added to the blocklist by the recorded decision (not a new filter rule).
    expect(blocklist.has('GFGF')).toBe(true);
    expect(blocklist.has('SFSFS')).toBe(true);
    const words = new Set(wordlistText.split('\n'));
    expect(words.has('GFGF')).toBe(false);
    expect(words.has('SFSFS')).toBe(false);
  });
});
