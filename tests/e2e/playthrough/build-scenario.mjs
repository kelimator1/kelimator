// tests/e2e/playthrough/build-scenario.mjs — F2 scenario generator (task F2).
//
// Builds the C3 reference scenario JSONs from the shared script fixture
// `tests/fixtures/playthrough.json` (owned by F2), so the app suite and the
// reference harness run the same inputs:
//
//   node tests/e2e/playthrough/build-scenario.mjs [--check]
//
// Outputs (F2-owned):
//   tests/fixtures/reference/playthrough/scenarios/playthrough.json
//   tests/fixtures/reference/playthrough/scenarios/timeout.json   (S9 variant)
//
// The script is deterministic: same input -> byte-identical outputs (verified
// by `--check`, which re-derives and compares instead of writing).
//
// Reference-step mapping (C3 scenario schema, verify/reference/README.md):
//   select            -> waitForState board + waitStable
//   type <word>       -> key* (with a 20 ms settle between keys) + waitStable
//   submit <word>     -> key* + ENTER; valid/completion waits for
//                        `entry-cleared`; completion additionally waits for the
//                        `hiscore-form` end screen; invalid/duplicate wait for
//                        a stable frame (buzz/boing settle)
//   clear <n>         -> BACKSPACE*n + waitStable
//   every step        -> capture <step.capture>
// A failed wait makes the harness step fail (scenario-report.ok = false,
// exit 1): acceptance is never assumed. `waitText` deliberately does not exist
// in the harness (no OCR); all waits are reference states.
//
// Sanity checks at generation time: every submitted word must be present in
// both the archived fixture word list (../kelimator-nostalji/calistir/xml64.php,
// read-only) and the app's FİNALİZM bank round (src/data/rounds.json); the
// valid submissions must exactly fill the cap-aware listed slots
// (10/10/10/4/0/1 = 35); the invalid entry must be in neither list.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const SCRIPT_PATH = path.join(REPO, 'tests/fixtures/playthrough.json');
const OUT_DIR = path.join(REPO, 'tests/fixtures/reference/playthrough/scenarios');
const CHECK = process.argv.includes('--check');

const script = JSON.parse(fs.readFileSync(SCRIPT_PATH, 'utf8'));

// --- inputs for the sanity checks ------------------------------------------
const bank = JSON.parse(fs.readFileSync(path.join(REPO, 'src/data/rounds.json'), 'utf8'));
const round = bank.rounds.find((candidate) => candidate.main === script.round);
if (round === undefined) throw new Error(`round ${script.round} not found in src/data/rounds.json`);

const fixtureXml = new TextDecoder('iso-8859-9').decode(
  fs.readFileSync(path.join(REPO, '..', 'kelimator-nostalji', 'calistir', 'xml64.php')),
);
const fixtureWords = new Set();
{
  const re = /<kelime harf="(\d+)">\s*<txt>([^<]*)<\/txt>/gs;
  for (const match of fixtureXml.matchAll(re)) {
    const harf = Number(match[1]);
    if (harf === 9999) continue;
    for (const word of match[2].split(',')) if (word !== '') fixtureWords.add(word);
  }
}

const bankWords = new Set();
for (const length of [3, 4, 5, 6, 7, 8]) {
  for (const word of round.words[String(length)] ?? []) bankWords.add(word);
}

const validSteps = script.steps.filter(
  (step) => step.action === 'submit' && (step.outcome === 'valid' || step.outcome === 'completion'),
);
const submitted = validSteps.map((step) => step.word ?? step.entry);
const listedSlots = [3, 4, 5, 6, 7, 8].flatMap((length) =>
  (round.words[String(length)] ?? []).slice(0, 10).map((word) => `${length}:${word}`),
);

const problems = [];
for (const step of script.steps) {
  const words = [step.word, step.entry].filter((value) => typeof value === 'string');
  for (const word of words) {
    if (step.outcome === 'invalid') {
      if (bankWords.has(word)) problems.push(`invalid entry ${word} is in the bank`);
      if (fixtureWords.has(word)) problems.push(`invalid entry ${word} is in the fixture`);
      continue;
    }
    if (!bankWords.has(word)) problems.push(`${step.id}: ${word} not in the bank round`);
    if (!fixtureWords.has(word)) problems.push(`${step.id}: ${word} not in the archived fixture`);
  }
}
if (submitted.length !== 35) {
  problems.push(`expected 35 valid submissions (cap-aware listed slots), got ${submitted.length}`);
}
const submittedSet = new Set(submitted);
for (const slot of listedSlots) {
  const word = slot.slice(slot.indexOf(':') + 1);
  if (!submittedSet.has(word)) problems.push(`listed slot ${slot} never submitted`);
}
if (problems.length > 0) {
  throw new Error(`playthrough.json sanity check failed:\n- ${problems.join('\n- ')}`);
}

// --- scenario construction --------------------------------------------------
const KEY_SETTLE = { action: 'waitMs', ms: 20 };
const typeKeys = (word) => [...word].flatMap((key) => [{ action: 'key', key }, KEY_SETTLE]);

function stepToScenarioSteps(step) {
  const steps = [];
  switch (step.action) {
    case 'select':
      steps.push({ action: 'waitForState', condition: 'board', timeoutMs: 60000 });
      steps.push({ action: 'waitStable', timeoutMs: 15000 });
      break;
    case 'type':
      steps.push(...typeKeys(step.word));
      steps.push({ action: 'waitStable', timeoutMs: 15000 });
      break;
    case 'submit': {
      if (step.word) steps.push(...typeKeys(step.word));
      steps.push({ action: 'key', key: 'ENTER' });
      if (step.outcome === 'valid') {
        steps.push({ action: 'waitForState', condition: 'entry-cleared', timeoutMs: 5000 });
        steps.push({ action: 'waitStable', timeoutMs: 15000 });
      } else if (step.outcome === 'completion') {
        // The all-found end screen: the reference transitions to `bravo` in the
        // same frame as the completing submit; the screen's fireworks never
        // settle, so the capture follows the state wait (C3 matrix discipline).
        steps.push({ action: 'waitForState', condition: 'hiscore-form', timeoutMs: 15000 });
      } else {
        // invalid / duplicate: entry kept; wait for the buzz/boing settle.
        steps.push({ action: 'waitStable', timeoutMs: 15000 });
      }
      break;
    }
    case 'clear':
      for (let i = 0; i < step.count; i += 1) {
        steps.push({ action: 'key', key: 'BACKSPACE' }, KEY_SETTLE);
      }
      steps.push({ action: 'waitStable', timeoutMs: 15000 });
      break;
    default:
      throw new Error(`unknown action ${JSON.stringify(step.action)}`);
  }
  if (step.capture !== undefined) steps.push({ action: 'capture', name: step.capture });
  return steps;
}

const playthrough = {
  name: 'f2-playthrough',
  steps: script.steps.flatMap(stepToScenarioSteps),
};

const timeout = {
  name: 'f2-timeout',
  steps: [
    { action: 'waitForState', condition: 'board', timeoutMs: 60000 },
    { action: 'waitStable', timeoutMs: 15000 },
    // S9 shortest path (O01/O14): a fresh round, clock waited out; the
    // reference's own `tamamla()` (gauge empty + action buttons hidden).
    { action: 'waitForState', condition: 'round-end', timeoutMs: 260000 },
    { action: 'waitStable', timeoutMs: 30000 },
    { action: 'capture', name: 'timeout' },
  ],
};

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const outputs = [
  [path.join(OUT_DIR, 'playthrough.json'), serialize(playthrough)],
  [path.join(OUT_DIR, 'timeout.json'), serialize(timeout)],
];

if (CHECK) {
  let ok = true;
  for (const [file, content] of outputs) {
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    const same = existing === content;
    console.log(`${same ? 'ok  ' : 'DIFF'} ${path.relative(REPO, file)}`);
    if (!same) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [file, content] of outputs) fs.writeFileSync(file, content);
console.log(
  `[F2] scenario written: ${playthrough.steps.length} steps + timeout (${timeout.steps.length} steps); ` +
    `${submitted.length} valid submissions, fixture+bank word checks passed`,
);
