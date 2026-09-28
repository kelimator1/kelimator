#!/usr/bin/env node
/**
 * C3 fixture transformation (task amendment 2026-09-28).
 *
 * Reads the archived, read-only round fixture
 * (`../kelimator-nostalji/calistir/xml64.php`, ISO-8859-9) and writes
 * `verify/reference/fixtures/xml64.base64.php`: a deterministic Base64(UTF-8)
 * re-encoding of exactly the round values the 2012 client decodes
 * (`frame_131/DoAction.as` `myOnLoad`: `Base64.decode(al(8))` and
 * `Base64.decode(al(i))` for i = 8…2, i.e. every `<kelime harf="2".."8">`
 * `<txt>` value). The `harf="9999"` checksum entry is left untouched (the
 * client reads it raw via `al(9999)` and only uses it in the excluded
 * score-submission URL), and the XML structure, attributes and whitespace are
 * preserved byte-for-byte.
 *
 * The script verifies the round trip with the SWF's own decoder and writes a
 * deterministic `fixtures/fixture-meta.json` with the input/script/output
 * SHA-256 values. Input file is never modified.
 *
 * Usage: node verify/reference/make-fixture.mjs [--check]
 *   --check  verify the existing output is up to date (no write), exit 1 on drift
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeLatin5, swfBase64Decode, swfBase64Encode } from './swf-codec.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const INPUT = path.resolve(REPO, '..', 'kelimator-nostalji', 'calistir', 'xml64.php');
const SCRIPT = fileURLToPath(import.meta.url);
const OUT_DIR = path.join(HERE, 'fixtures');
const OUTPUT = path.join(OUT_DIR, 'xml64.base64.php');
const META = path.join(OUT_DIR, 'fixture-meta.json');

const CHECK_ONLY = process.argv.includes('--check');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function transform(inputText) {
  const entries = [];
  const output = inputText.replace(
    /<kelime\s+harf="(\d+)">(\s*)<txt>([^<]*)<\/txt>(\s*)<\/kelime>/g,
    (match, harf, ws1, value, ws2) => {
      const len = Number(harf);
      if (len < 2 || len > 8) {
        // e.g. the harf="9999" checksum: read raw by the client, preserved.
        entries.push({ harf: len, preserved: true, plainLength: value.length });
        return match;
      }
      const encoded = swfBase64Encode(value);
      const roundTrip = swfBase64Decode(encoded);
      if (roundTrip !== value) {
        throw new Error(`round trip mismatch for harf="${harf}": ${JSON.stringify(value)} -> ${JSON.stringify(roundTrip)}`);
      }
      entries.push({
        harf: len,
        preserved: false,
        plainLength: value.length,
        wordCount: value.length === 0 ? 0 : value.split(',').filter((w) => w.length > 0).length,
        encodedLength: encoded.length,
      });
      return `<kelime harf="${harf}">${ws1}<txt>${encoded}</txt>${ws2}</kelime>`;
    },
  );
  return { output, entries };
}

function meta(inputBuf, outputBuf) {
  const inputText = decodeLatin5(inputBuf);
  const outputText = decodeLatin5(outputBuf);
  const count = (text) => (text.match(/<kelime\s+harf="/g) ?? []).length;
  if (count(inputText) !== count(outputText)) throw new Error('kelime tag count changed');
  return {
    schemaVersion: 1,
    task: 'C3',
    description: 'Base64(UTF-8) re-encoding of the archived xml64.php round values the 2012 client decodes (harf 2..8); harf=9999 preserved; structure unchanged',
    input: { file: path.relative(REPO, INPUT), sha256: sha256(inputBuf) },
    script: { file: path.relative(REPO, SCRIPT), sha256: sha256(fs.readFileSync(SCRIPT)) },
    output: { file: path.relative(REPO, OUTPUT), sha256: sha256(outputBuf) },
  };
}

function main() {
  const inputBuf = fs.readFileSync(INPUT);
  const inputText = decodeLatin5(inputBuf);
  const { output, entries } = transform(inputText);
  const outputBuf = Buffer.from(output, 'utf8');
  const metaObj = { ...meta(inputBuf, outputBuf), entries };

  if (CHECK_ONLY) {
    const existing = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT) : null;
    const existingMeta = fs.existsSync(META) ? fs.readFileSync(META, 'utf8') : null;
    const ok = existing !== null && existing.equals(outputBuf) && existingMeta === `${JSON.stringify(metaObj, null, 2)}\n`;
    console.log(`${ok ? 'OK' : 'DRIFT'} fixture=${sha256(outputBuf)} input=${sha256(inputBuf)}`);
    return ok ? 0 : 1;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, outputBuf);
  fs.writeFileSync(META, `${JSON.stringify(metaObj, null, 2)}\n`);

  console.log('C3 fixture transform — Base64(UTF-8) re-encoding of the archived round values');
  console.log(`input : ${path.relative(REPO, INPUT)} sha256=${sha256(inputBuf)}`);
  console.log(`script: ${path.relative(REPO, SCRIPT)} sha256=${metaObj.script.sha256}`);
  console.log(`output: ${path.relative(REPO, OUTPUT)} sha256=${metaObj.output.sha256}`);
  for (const e of entries) {
    console.log(e.preserved
      ? `  harf=${e.harf} preserved (raw, ${e.plainLength} chars)`
      : `  harf=${e.harf} encoded (${e.plainLength} chars, ${e.wordCount} words, base64 ${e.encodedLength} chars)`);
  }
  console.log('round trip: OK (SWF decoder reproduces every archived value)');
  return 0;
}

process.exitCode = main();
