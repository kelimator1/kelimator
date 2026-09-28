#!/usr/bin/env node
/**
 * C3 verification checks (V1 / V2 / V5 self-check / V6) — reproducible report.
 *
 * Usage: node verify/reference/check.mjs
 * Exit code: 0 when every check passes, 1 otherwise. Prints one line per check.
 *
 * Checks
 *   V1  the pinned Ruffle web asset SHA-256 equals the recorded value
 *       (recorded in evidence/logs/C3-ruffle-sha256.log on 2026-09-28).
 *   V2  S1–S10 screenshots exist in run1/, run2/ and at the canonical flat
 *       paths; every interaction/stability JSON parses.
 *   V5  self-check: run1 vs run2 S2 are byte-identical, or the stabilization
 *       is quantified: within-run stable-frame streak >= 3 for S2 and the
 *       cross-run mismatch ratio is within the docs/07 §4 static threshold;
 *       the cause is documented in evidence/C3-stability.md.
 *   V6  the server log contains an `xml64.php ... -> 200` line in both matrix
 *       runs (segments delimited by "==== C3 harness run N start" markers).
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareImages, decodePng } from '../diff/diff.mjs';
import { decodeLatin5, swfBase64Decode } from './swf-codec.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = path.join(REPO, 'tests', 'fixtures', 'reference');
const LOG_DIR = path.join(REPO, 'evidence', 'logs');
const SERVER_LOG = path.join(LOG_DIR, 'C3-server.log');
const ZIP = path.join(HERE, 'ruffle', 'ruffle-0.6.0-web-selfhosted.zip');
const FIXTURE_INPUT = path.resolve(REPO, '..', 'kelimator-nostalji', 'calistir', 'xml64.php');
const FIXTURE_SERVED = path.join(HERE, 'fixtures', 'xml64.base64.php');
const FIXTURE_META = path.join(HERE, 'fixtures', 'fixture-meta.json');
const FIXTURE_SCRIPT = path.join(HERE, 'make-fixture.mjs');

// evidence/logs/C3-ruffle-sha256.log (2026-09-28); independent copy:
// artifacts/a3-captures/ruffle-0.6.0-web-selfhosted.zip has the same value.
const RUFFLE_ZIP_SHA256 = 'e8acfacc37443303872379d0e215999af846854d1dd3fa8fac0a765445b43dbf';

const STATES = ['S1-boot', 'S2-idle-board', 'S3-scrambled', 'S4-partial-entry', 'S5-valid-word', 'S6-invalid-word', 'S7-bonus-word', 'S8-all-found', 'S9-timeout', 'S10-next-round'];
const PASS_RATIO = 0.02;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const results = [];
function check(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
}

// --- V1 --------------------------------------------------------------------
const zipHash = sha256(fs.readFileSync(ZIP));
check('V1', zipHash === RUFFLE_ZIP_SHA256, `ruffle-0.6.0-web-selfhosted.zip sha256=${zipHash}`);

// --- V1fixture: fixture transform integrity (amendment 2026-09-28) ---------
function fixturePipelineCheck() {
  const inputBuf = fs.readFileSync(FIXTURE_INPUT);
  const servedBuf = fs.readFileSync(FIXTURE_SERVED);
  const meta = JSON.parse(fs.readFileSync(FIXTURE_META, 'utf8'));
  const inputText = decodeLatin5(inputBuf);
  const servedText = decodeLatin5(servedBuf);
  const entries = (text) => [...text.matchAll(/<kelime\s+harf="(\d+)">\s*<txt>([^<]*)<\/txt>\s*<\/kelime>/g)].map((m) => ({ harf: Number(m[1]), value: m[2] }));
  const archived = new Map(entries(inputText).map((e) => [e.harf, e.value]));
  const served = new Map(entries(servedText).map((e) => [e.harf, e.value]));
  const problems = [];
  for (const [harf, value] of archived) {
    if (!served.has(harf)) { problems.push(`harf=${harf} missing in served fixture`); continue; }
    if (harf >= 2 && harf <= 8) {
      const decoded = swfBase64Decode(served.get(harf));
      if (decoded !== value) problems.push(`harf=${harf} decodes to a different value`);
    } else if (served.get(harf) !== value) {
      problems.push(`harf=${harf} (raw-preserved entry) changed`);
    }
  }
  if (meta.input.sha256 !== sha256(inputBuf)) problems.push('meta input sha256 mismatch');
  if (meta.output.sha256 !== sha256(servedBuf)) problems.push('meta output sha256 mismatch');
  if (meta.script.sha256 !== sha256(fs.readFileSync(FIXTURE_SCRIPT))) problems.push('meta script sha256 mismatch (script edited after generation?)');
  const rerun = spawnSync(process.execPath, [FIXTURE_SCRIPT, '--check'], { encoding: 'utf8' });
  if (rerun.status !== 0) problems.push(`make-fixture.mjs --check exit ${rerun.status}: ${(rerun.stdout ?? '').trim()}`);
  return { problems, inputSha: sha256(inputBuf), servedSha: sha256(servedBuf), scriptSha: meta.script.sha256 };
}
const fixture = fixturePipelineCheck();
check(
  'V1fixture',
  fixture.problems.length === 0,
  `input sha256=${fixture.inputSha.slice(0, 12)} script sha256=${fixture.scriptSha.slice(0, 12)} served sha256=${fixture.servedSha.slice(0, 12)}; round trip + structure ${fixture.problems.length === 0 ? 'OK' : `PROBLEMS: ${fixture.problems.join('; ')}`}`,
);

// --- matrix presence / V5 / mute helpers ----------------------------------
function matrixPresenceCheck(label, base, expectedDims = null) {
  const missing = [];
  for (const state of STATES) {
    for (const p of [path.join(base, 'run1', `${state}.png`), path.join(base, 'run2', `${state}.png`), path.join(base, `${state}.png`)]) {
      if (!fs.existsSync(p)) missing.push(path.relative(REPO, p));
    }
  }
  const jsonFiles = [
    path.join(base, 'run1', 'interaction-log.json'),
    path.join(base, 'run2', 'interaction-log.json'),
    path.join(base, 'interaction-log.json'),
    path.join(base, 'stability-report.json'),
  ];
  for (const state of STATES) {
    const p = path.join(base, 'stability', state, 'report.json');
    if (fs.existsSync(p)) jsonFiles.push(p);
  }
  const badJson = [];
  for (const p of jsonFiles) {
    try {
      JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (err) {
      badJson.push(`${path.relative(REPO, p)}: ${err.message}`);
    }
  }
  const wrongDims = [];
  if (expectedDims) {
    for (const state of STATES) {
      const p = path.join(base, `${state}.png`);
      if (!fs.existsSync(p)) continue;
      const img = decodePng(fs.readFileSync(p));
      if (img.width !== expectedDims.width || img.height !== expectedDims.height) {
        wrongDims.push(`${state}=${img.width}x${img.height}`);
      }
    }
  }
  check(label, missing.length === 0 && badJson.length === 0 && wrongDims.length === 0,
    `${STATES.length * 3 - missing.length}/${STATES.length * 3} screenshots present; ${jsonFiles.length - badJson.length}/${jsonFiles.length} JSON files parse` +
    (expectedDims ? `; canonical dims ${expectedDims.width}x${expectedDims.height} ${wrongDims.length === 0 ? 'OK' : `WRONG: ${wrongDims.join(', ')}`}` : '') +
    (missing.length ? `; missing: ${missing.join(', ')}` : '') + (badJson.length ? `; bad: ${badJson.join('; ')}` : ''));
}

function v5Check(label, base) {
  const s2aPath = path.join(base, 'run1', 'S2-idle-board.png');
  const s2bPath = path.join(base, 'run2', 'S2-idle-board.png');
  if (!fs.existsSync(s2aPath) || !fs.existsSync(s2bPath)) {
    check(label, false, `run1/run2 S2 captures missing (${path.relative(REPO, s2aPath)}, ${path.relative(REPO, s2bPath)})`);
    return;
  }
  const s2a = fs.readFileSync(s2aPath);
  const s2b = fs.readFileSync(s2bPath);
  const byteIdentical = sha256(s2a) === sha256(s2b);
  const report = compareImages(decodePng(s2a), decodePng(s2b));
  const run1Log = JSON.parse(fs.readFileSync(path.join(base, 'run1', 'interaction-log.json'), 'utf8'));
  const run2Log = JSON.parse(fs.readFileSync(path.join(base, 'run2', 'interaction-log.json'), 'utf8'));
  const streak = (log) => log.states.find((s) => s.id === 'S2')?.stability?.streak ?? 0;
  const stable = (log) => log.states.find((s) => s.id === 'S2')?.stability?.stable === true;
  const withinRunStable = stable(run1Log) && stable(run2Log) && streak(run1Log) >= 3 && streak(run2Log) >= 3;
  const ok = byteIdentical || (withinRunStable && report.mismatchRatio <= PASS_RATIO);
  check(label, ok, byteIdentical
    ? `S2 byte-identical across runs (sha256=${sha256(s2a)})`
    : `S2 not byte-identical (stabilization documented): within-run stable streak run1=${streak(run1Log)} run2=${streak(run2Log)}; cross-run mismatchRatio=${report.mismatchRatio.toFixed(5)} (<=${PASS_RATIO}) bbox=${JSON.stringify(report.mismatchBBox)}`);
}

// Explicit mute (EXECUTION.md §8 silent witness runs): capture.mjs must launch
// Chromium with --mute-audio and every recorded run manifest must carry it.
function muteCheck(label, base) {
  const source = fs.readFileSync(path.join(HERE, 'capture.mjs'), 'utf8');
  const launchLine = source.split('\n').find((l) => l.includes('chromium.launch'));
  const sourceOk = Boolean(launchLine && launchLine.includes('args: LAUNCH_ARGS') && source.includes("['--mute-audio']"));
  const logPaths = ['run1', 'run2'].map((r) => path.join(base, r, 'interaction-log.json'));
  const missing = logPaths.filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    check(label, false, `capture.mjs launches with --mute-audio: ${sourceOk}; run manifests missing: ${missing.map((p) => path.relative(REPO, p)).join(', ')}`);
    return;
  }
  const logs = logPaths.map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  const recorded = logs.map((l) => (l.harness.launchArgs ?? []).includes('--mute-audio'));
  check(label, sourceOk && recorded.every(Boolean), `capture.mjs launches with --mute-audio: ${sourceOk}; recorded in run1/run2 manifests: ${recorded.join('/')}`);
}

// --- V2 / V5 at deviceScaleFactor 1 (outputs unchanged) --------------------
matrixPresenceCheck('V2', OUT);
v5Check('V5', OUT);

// --- dsf2 matrix (docs/07 §4: capture at deviceScaleFactor 1 and 2) --------
const DSF2 = path.join(OUT, 'dsf2');
matrixPresenceCheck('V2dsf2', DSF2, { width: 1100, height: 800 });
v5Check('V5dsf2', DSF2);
muteCheck('Vmute', DSF2);

// --- scenario smoke (E3/F2 scenario mode) ----------------------------------
// Runs `capture.mjs --scenario scenarios/smoke.json` (board wait -> stable ->
// one key -> capture -> waitMs -> capture) and validates the outputs.
const SMOKE_SCENARIO = path.join(HERE, 'scenarios', 'smoke.json');
const SMOKE_OUT = path.join(OUT, 'scenario-smoke');
function scenarioSmokeCheck() {
  const port = process.env.C3_SMOKE_PORT || '8798';
  fs.rmSync(SMOKE_OUT, { recursive: true, force: true });
  const res = spawnSync(
    process.execPath,
    [path.join(HERE, 'capture.mjs'), '--scenario', SMOKE_SCENARIO, '--out', SMOKE_OUT, '--port', port],
    { encoding: 'utf8', timeout: 240000 },
  );
  const problems = [];
  if (res.status !== 0) {
    const tail = `${(res.stdout ?? '').trim().split('\n').slice(-2).join(' | ')} ${(res.stderr ?? '').trim().split('\n').slice(-2).join(' | ')}`.trim();
    problems.push(`harness exit ${res.status}${res.error ? ` (${res.error.message})` : ''}: ${tail}`);
  }
  let report = null;
  let logOk = false;
  try {
    report = JSON.parse(fs.readFileSync(path.join(SMOKE_OUT, 'scenario-report.json'), 'utf8'));
  } catch (err) {
    problems.push(`scenario-report.json: ${err.message}`);
  }
  try {
    JSON.parse(fs.readFileSync(path.join(SMOKE_OUT, 'interaction-log.json'), 'utf8'));
    logOk = true;
  } catch (err) {
    problems.push(`interaction-log.json: ${err.message}`);
  }
  const captures = report?.captures ?? [];
  if (captures.length < 2) problems.push(`expected >=2 captures, found ${captures.length}`);
  for (const c of captures) {
    const p = path.join(SMOKE_OUT, `${c.name}.png`);
    if (!fs.existsSync(p)) { problems.push(`missing capture ${c.name}.png`); continue; }
    const img = decodePng(fs.readFileSync(p));
    if (img.width !== c.width || img.height !== c.height) problems.push(`${c.name}: file ${img.width}x${img.height} != report ${c.width}x${c.height}`);
  }
  if (report && Array.isArray(report.missingKeys) && report.missingKeys.length > 0) problems.push(`missing key mappings: ${report.missingKeys.join(',')}`);
  if (report && report.ok !== true) problems.push('scenario report ok=false');
  return { problems, captures: captures.length, logOk, dims: captures[0] ? `${captures[0].width}x${captures[0].height}` : 'n/a' };
}
const smoke = scenarioSmokeCheck();
check(
  'Vscenario',
  smoke.problems.length === 0,
  `smoke scenario: ${smoke.captures} captures (${smoke.dims}), JSONs parse: ${smoke.logOk}${smoke.problems.length ? `; PROBLEMS: ${smoke.problems.join('; ')}` : ''}`,
);

// --- V6 --------------------------------------------------------------------
const lines = fs.readFileSync(SERVER_LOG, 'utf8').split('\n');
const starts = [];
lines.forEach((line, i) => {
  const m = line.match(/^==== C3 harness run (\d+) start .*?(?: dsf=(\d+))? ====/);
  if (m) starts.push({ run: m[1], dsf: m[2] ?? '1', i });
});
const lastTwo = starts.slice(-2);
const v6 = lastTwo.map(({ run, dsf, i }) => {
  const end = starts.find((s) => s.i > i)?.i ?? lines.length;
  const segment = lines.slice(i, end);
  const hit = segment.find((l) => /GET \/xml64\.php\?\d+ HTTP\/1\.1" -> 200/.test(l));
  return { run, dsf, hit: hit ? hit.trim() : null };
});
check('V6', v6.length === 2 && v6.every((r) => r.hit), v6.map((r) => `run ${r.run} (dsf ${r.dsf}): ${r.hit ?? 'NO xml64.php 200'}`).join(' | '));

// --- summary ---------------------------------------------------------------
for (const [label, base] of [['deviceScaleFactor 1 (O20)', OUT], ['deviceScaleFactor 2', DSF2]]) {
  const p = path.join(base, 'stability-report.json');
  if (!fs.existsSync(p)) { console.log(`--- stability summary ${label}: MISSING ---`); continue; }
  const stability = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log(`--- stability summary ${label} ---`);
  for (const s of stability.states) {
    console.log(`  ${s.state}: byteIdentical=${s.byteIdentical} mismatchRatio=${Number(s.mismatchRatio).toFixed(5)} pass=${s.pass} bbox=${JSON.stringify(s.mismatchBBox)}`);
  }
  console.log(`  allByteIdentical=${stability.allByteIdentical} allPass=${stability.allPass}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`--- ${failed.length === 0 ? 'ALL CHECKS PASS' : `${failed.length} CHECK(S) FAILED`} ---`);
process.exitCode = failed.length === 0 ? 0 : 1;