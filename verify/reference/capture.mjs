#!/usr/bin/env node
/**
 * C3 reference harness — Playwright capture driver (task C3, docs/07 §3 + §5).
 *
 * Runs the original 2012 reference build
 * (`../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf`) inside the
 * pinned Ruffle 0.6.0 web self-hosted player served by `verify/reference/server.py`
 * from the same origin as the fixture `xml64.php`. Screenshots for the S1–S10
 * state matrix are captured after *state-based* waits only (stable-frame
 * sampling, measured region detectors, server-log resource evidence — never a
 * fixed delay for a state transition).
 *
 * Modes:
 *   node verify/reference/capture.mjs --probe [--probe-dir <dir>]
 *       Observation mode: samples boot/board frames, exercises the input paths
 *       (click / type / SPACE / ENTER), saves before/after frames and writes
 *       probe.json into <dir>. Used to measure this script's constants and to
 *       record the observed reference flow.
 *   node verify/reference/capture.mjs [--runs 2] [--port 8797]
 *       Full matrix: runs S1–S10 twice, writes screenshots + interaction logs
 *       under tests/fixtures/reference/, then compares run1 vs run2
 *       (byte hashes + F1 pixel diffs) into stability-report.json.
 *
 * Outputs (matrix): tests/fixtures/reference/<state>.png (run 1, canonical),
 * run1/ + run2/ (screenshots + interaction-log.json), stability/<state>/,
 * stability-report.json, interaction-log.json.
 * Server request log: evidence/logs/C3-server.log (append; written by server.py).
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compareImages, decodePng, runComparison } from '../diff/diff.mjs';
import { decodeLatin5, swfBase64Decode } from './swf-codec.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CALISTIR = path.resolve(REPO, '..', 'kelimator-nostalji', 'calistir');
const OUT_ROOT = path.join(REPO, 'tests', 'fixtures', 'reference');
const LOG_DIR = path.join(REPO, 'evidence', 'logs');
const SERVER_LOG = path.join(LOG_DIR, 'C3-server.log');
const SERVER_PY = path.join(HERE, 'server.py');
const SWF = path.join(CALISTIR, 'kelimator_tr_2012_mochiads.swf');
// Fixture pipeline (task amendment 2026-09-28): the archived plain ISO-8859-9
// file is the sole word source; the served fixture is its Base64(UTF-8)
// re-encoding produced by make-fixture.mjs (server.py maps /xml64.php to it).
const FIXTURE_INPUT = path.join(CALISTIR, 'xml64.php');
const FIXTURE_SERVED = path.join(HERE, 'fixtures', 'xml64.base64.php');
const FIXTURE_SCRIPT = path.join(HERE, 'make-fixture.mjs');
const RUFFLE_ZIP = path.join(HERE, 'ruffle', 'ruffle-0.6.0-web-selfhosted.zip');
const RUFFLE_JS = path.join(HERE, 'ruffle', 'web', 'ruffle.js');

const STAGE = { x: 0, y: 0, width: 550, height: 400 };

// --- CLI -------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const PROBE = argv.includes('--probe');
const PORT = Number(opt('--port', String(process.env.C3_PORT || 8797)));
const RUNS = Number(opt('--runs', '2'));
const DSF = Number(opt('--dsf', '1')); // docs/07 §4: matrix at deviceScaleFactor 1 and 2
const PROBE_DIR = opt('--probe-dir', path.join(os.tmpdir(), 'c3-probe'));
const URL = `http://127.0.0.1:${PORT}/`;
// dsf 1 artifacts live at the reference root (unchanged); other scale factors
// get their own subdirectory, e.g. tests/fixtures/reference/dsf2/.
const RUN_ROOT = DSF === 1 ? OUT_ROOT : path.join(OUT_ROOT, `dsf${DSF}`);
// Silent witness runs (EXECUTION.md §8): explicit browser-level mute.
const LAUNCH_ARGS = ['--mute-audio'];
// Scenario mode (E3/F2 scripted captures): --scenario <json> --out <dir>.
const SCENARIO = opt('--scenario', null);
const SCENARIO_OUT = opt('--out', null);

// --- Measured geometry (probe run 2026-09-28, probe.json) ------------------
// Tile row: SWF `frame_131` places `button`/`bosbuton` duplicates at
// (_X, _Y) = (60 + t*60, 330) on the 550x400 stage; Ruffle scale=exactFit maps
// stage pixels 1:1 to the canvas, so the CSS click targets are those centers.
const TILE_Y = 330;
const TILE_XS = [60, 120, 180, 240, 300, 360, 420, 480];
// "Yeni Oyun" button (SWF `ybuton`, chid 71): placement translate
// (9827, 4119) twips = (491.35, 205.95) => CSS center (491, 206).
const YBUTTON = { x: 491, y: 206 };
// Remaining-time gauge (red fill) in the right panel: measured red-pixel bbox
// x 516..532, y 106..191 at t=44.5 s; padded box below. Board signal: the
// fraction of red pixels here is 0.0 on the intro and >= 0.2 once the round
// board is up (probe measurement).
const TIMER_BOX = { x: 513, y: 82, width: 24, height: 115 };
const BOARD_RED_MIN = 0.2;
const RED_PIXEL = { rMin: 150, gMax: 90, bMax: 90 };
// "Karıştır / Ekle / Sil" button bar: `tamamla()` (timeout) and `bittimi()`
// (all-found) hide these buttons exactly when the round ends — the definitive
// end-of-round signal (measured: orange fraction 0.31 while visible, 0.0 after
// the round end).
const BUTTON_BAR_BOX = { x: 150, y: 358, width: 195, height: 36 };
const ORANGE_PIXEL = { rMin: 200, gMin: 60, gMax: 170, bMax: 100 };
// Wordball entry row (wordballs at _Y = 263, x = (550 - t*40)/2 + 10 + i*40).
// "Bright" = the reference's bonus ball (orange); measured on a bonus-ball
// capture: >=344 unscaled bright pixels, while normal red balls contribute 0.
const ENTRY_ROW_BOX = { x: 20, y: 238, width: 510, height: 52 };
const BRIGHT_PIXEL = { rMin: 240, gMin: 110, gMax: 190, bMin: 60, bMax: 130, gbMin: 30 };
const WORD_BALL_RED = { rMin: 170, gMax: 95, bMax: 95 };
const BALL_MIN_PIXELS = 150;
// The intro (S1) screen contains one continuously animating element (the sun,
// measured diff bbox x 218..309, y 0..160 at 500 ms sampling). S1 stability is
// therefore checked with this region masked out; the mask is recorded in the
// interaction log.
const SUN_BOX = { x: 205, y: 0, width: 120, height: 175 };

// All measured boxes/points above are in CSS (stage) pixels: Playwright
// screenshot clips and mouse clicks use CSS pixels at any deviceScaleFactor
// (the PNG output scales automatically). Only operations on a *decoded* PNG
// (e.g. zeroing the stability mask) address device pixels, so the mask box is
// scaled there.
const scaleBox = (box) => ({ x: box.x * DSF, y: box.y * DSF, width: box.width * DSF, height: box.height * DSF });

// Stable-frame sampling: `samples` consecutive identical stage frames, sampled
// `intervalMs` apart.
const STABLE = { samples: 3, intervalMs: 150 };
const CONTENT_MIN_FRACTION = 0.2; // game frame: >=20% non-white, non-black px

// Physical key names for the Turkish letters the game maps in `frame_131`
// (`codes` -> `harf`); on the original Turkish-Q layout these are the same
// physical keys as US Backslash/Slash/Semicolon/BracketLeft/BracketRight/Quote.
const TR_KEY = {
  A: 'KeyA', B: 'KeyB', C: 'KeyC', 'Ç': 'Backslash', D: 'KeyD', E: 'KeyE',
  F: 'KeyF', G: 'KeyG', 'Ğ': 'BracketLeft', H: 'KeyH', I: 'KeyI', 'İ': 'Quote',
  J: 'KeyJ', K: 'KeyK', L: 'KeyL', M: 'KeyM', N: 'KeyN', O: 'KeyO',
  'Ö': 'Slash', P: 'KeyP', R: 'KeyR', S: 'KeyS', 'Ş': 'Semicolon', T: 'KeyT',
  U: 'KeyU', 'Ü': 'BracketRight', V: 'KeyV', Y: 'KeyY', Z: 'KeyZ',
};

// --- small utilities -------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (buf, algo = 'sha256') => createHash(algo).update(buf).digest('hex');

function readLogFrom(offset) {
  const fd = fs.openSync(SERVER_LOG, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size <= offset) return { text: '', size };
    const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    return { text: buf.toString('utf8'), size };
  } finally {
    fs.closeSync(fd);
  }
}

/** Wait for a line matching `pattern` in server-session log output. */
async function waitForLogMatch(fromOffset, pattern, { timeoutMs = 120000, pollMs = 250 } = {}) {
  const started = Date.now();
  let cursor = fromOffset;
  while (Date.now() - started < timeoutMs) {
    const { text, size } = readLogFrom(cursor);
    cursor = size;
    const line = text.split('\n').find((l) => pattern.test(l));
    if (line) return { matched: true, line: line.trim(), waitedMs: Date.now() - started, cursor };
    await sleep(pollMs);
  }
  return { matched: false, line: null, waitedMs: Date.now() - started, cursor };
}

function portFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.on('connect', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(true));
    socket.setTimeout(600, () => { socket.destroy(); resolve(true); });
  });
}

async function startServer() {
  if (!(await portFree(PORT))) throw new Error(`port ${PORT} is already in use`);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(SERVER_LOG, `\n==== C3 harness server start ${new Date().toISOString()} port=${PORT} ====\n`);
  const out = fs.openSync(SERVER_LOG, 'a');
  const child = spawn('python3', [SERVER_PY, String(PORT)], { stdio: ['ignore', out, out] });
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const res = await fetch(URL);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  child.kill('SIGTERM');
  throw new Error('server did not become ready within 15 s');
}

// --- page helpers ----------------------------------------------------------
function attachConsole(page, sink, t0) {
  const push = (type, text) => {
    if (sink.length < 1500) sink.push({ atMs: Date.now() - t0, type, text });
  };
  page.on('console', (m) => push(m.type(), m.text()));
  page.on('pageerror', (e) => push('pageerror', String(e)));
  page.on('requestfailed', (r) => push('requestfailed', `${r.url()} ${r.failure()?.errorText ?? ''}`));
}

async function stageShot(page, file) {
  return page.screenshot({ clip: STAGE, ...(file ? { path: file } : {}) });
}

/** Zero a device-pixel box in a decoded RGBA image (for masked hashing/diff). */
function maskImage(img, box) {
  if (!box) return img;
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      const i = (y * img.width + x) * 4;
      img.data[i] = 0;
      img.data[i + 1] = 0;
      img.data[i + 2] = 0;
      img.data[i + 3] = 0;
    }
  }
  return img;
}

/** Screenshot -> RGBA image with an optional region zeroed out for hashing. */
async function stageImage(page, maskBox) {
  return maskImage(decodePng(await stageShot(page)), maskBox);
}

async function waitStable(page, { samples = STABLE.samples, intervalMs = STABLE.intervalMs, timeoutMs = 30000, maskBox = null } = {}) {
  const started = Date.now();
  let last = null;
  let streak = 0;
  let count = 0;
  while (Date.now() - started < timeoutMs) {
    const img = await stageImage(page, maskBox ? scaleBox(maskBox) : null);
    const h = hash(Buffer.from(img.data));
    count += 1;
    if (h === last) streak += 1;
    else { streak = 1; last = h; }
    if (streak >= samples) {
      return { stable: true, samples: count, streak, elapsedMs: Date.now() - started, sha256: h, maskedBox: maskBox };
    }
    await sleep(intervalMs);
  }
  return { stable: false, samples: count, streak, elapsedMs: Date.now() - started, sha256: last, maskedBox: maskBox };
}

/** Fraction of stage pixels that are neither near-white nor near-black. */
async function stageContentFraction(page) {
  const img = decodePng(await stageShot(page));
  let content = 0;
  const total = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    if (min < 240 && max > 16) content += 1;
  }
  return content / total;
}

/** Wait for the first game content frame (skips the white Ruffle splash). */
async function waitForContent(page, timeoutMs = 30000) {
  const started = Date.now();
  let fraction = 0;
  while (Date.now() - started < timeoutMs) {
    fraction = await stageContentFraction(page);
    if (fraction >= CONTENT_MIN_FRACTION) return { content: true, fraction, waitedMs: Date.now() - started };
    await sleep(150);
  }
  return { content: false, fraction, waitedMs: Date.now() - started };
}

function redFraction(img) {
  let red = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] >= RED_PIXEL.rMin && img.data[i + 1] <= RED_PIXEL.gMax && img.data[i + 2] <= RED_PIXEL.bMax) red += 1;
  }
  return { redPixels: red, totalPixels: img.width * img.height, fraction: red / (img.width * img.height) };
}

async function timerRedFraction(page, box = TIMER_BOX) {
  return redFraction(decodePng(await page.screenshot({ clip: box })));
}

function orangeFraction(img) {
  let orange = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] >= ORANGE_PIXEL.rMin && img.data[i + 1] >= ORANGE_PIXEL.gMin && img.data[i + 1] <= ORANGE_PIXEL.gMax && img.data[i + 2] <= ORANGE_PIXEL.bMax) orange += 1;
  }
  return { orangePixels: orange, totalPixels: img.width * img.height, fraction: orange / (img.width * img.height) };
}

async function buttonBarFraction(page, box = BUTTON_BAR_BOX) {
  return orangeFraction(decodePng(await page.screenshot({ clip: box })));
}

function ballState(img) {
  let bright = 0;
  let red = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    if (r >= BRIGHT_PIXEL.rMin && g >= BRIGHT_PIXEL.gMin && g <= BRIGHT_PIXEL.gMax && b >= BRIGHT_PIXEL.bMin && b <= BRIGHT_PIXEL.bMax && g - b >= BRIGHT_PIXEL.gbMin) bright += 1;
    else if (r >= WORD_BALL_RED.rMin && g <= WORD_BALL_RED.gMax && b <= WORD_BALL_RED.bMax) red += 1;
  }
  return { brightPixels: bright, redPixels: red, ballPixels: bright + red, totalPixels: img.width * img.height };
}

/** Wordball entry-row state: red = normal balls, bright = bonus ("bonusball") ball. */
async function entryRowState(page, box = ENTRY_ROW_BOX) {
  return ballState(decodePng(await page.screenshot({ clip: box })));
}

async function clearEntry(page, presses = 10) {
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press('Backspace');
    await sleep(18);
  }
}

/** Wait until the entry row has no balls (the reference cleared the entry). */
async function waitEntryCleared(page, timeoutMs = 1500) {
  const started = Date.now();
  let state = await entryRowState(page);
  while (Date.now() - started < timeoutMs && state.ballPixels >= BALL_MIN_PIXELS) {
    await sleep(60);
    state = await entryRowState(page);
  }
  return state;
}

/**
 * Wait for the round end state. `tamamla()` (timeout) and `bittimi()` (all
 * found) both hide the Karıştır/Ekle/Sil buttons; the timer sprite is stopped
 * in both paths (`gotoAndStop(1)`, empty gauge). Confirmed by two consecutive
 * polls — the duration is the game's own timer, never a fixed delay.
 */
async function waitForRoundEnd(page, { timeoutMs = 240000, pollMs = 2000 } = {}) {
  const started = Date.now();
  let streak = 0;
  let first = null;
  let final = null;
  let count = 0;
  while (Date.now() - started < timeoutMs) {
    const gauge = await timerRedFraction(page);
    const buttons = await buttonBarFraction(page);
    count += 1;
    if (first === null) first = { gauge, buttons };
    final = { gauge, buttons };
    if (buttons.fraction <= 0.02) {
      streak += 1;
      if (streak >= 2) {
        return {
          ended: true,
          mode: 'round-end',
          waitedMs: Date.now() - started,
          samples: count,
          gaugeFraction: gauge.fraction,
          buttonBarFraction: buttons.fraction,
          first,
          final,
        };
      }
    } else {
      streak = 0;
    }
    await sleep(pollMs);
  }
  return { ended: false, mode: 'not-ended', waitedMs: Date.now() - started, samples: count, first, final };
}

// All-found end screen (TEBRİKLER + score form): night sky + yellow panel.
// Measured on the run at 2026-09-28T14:14: panel (275,240) = (204,204,51),
// sky (275,50) = (10,22,30).
const HISCORE_PROBE = { panel: { x: 275, y: 240 }, sky: { x: 275, y: 50 } };
const HISCORE_FORM = {
  name: { x: 316, y: 267 },
  email: { x: 316, y: 288 },
  send: { x: 268, y: 370 },
};

// Named click targets for scenario steps (`button:<name>`, CSS-pixel centers).
// Tile targets are `tile:<index>` (0..7 -> TILE_XS, TILE_Y). Measured centers:
// the three action buttons from the board's orange button bar (x 158-359,
// y 369-385).
const CLICK_TARGETS = {
  'yeni-oyun': YBUTTON,
  karistir: { x: 189, y: 377 },
  ekle: { x: 266, y: 377 },
  sil: { x: 334, y: 377 },
  gonder: HISCORE_FORM.send,
  'form-name': HISCORE_FORM.name,
  'form-email': HISCORE_FORM.email,
};

// Scenario `key` names for the non-letter keys (letters use TR_KEY, the
// physical Turkish-Q positions the SWF maps in frame_131).
const SCENARIO_NAMED_KEYS = { SPACE: 'Space', ENTER: 'Enter', BACKSPACE: 'Backspace' };

async function probePixel(page, point) {
  const img = decodePng(await page.screenshot({ clip: { x: point.x, y: point.y, width: 1, height: 1 } }));
  return { r: img.data[0], g: img.data[1], b: img.data[2] };
}

async function isHiscoreForm(page) {
  const panel = await probePixel(page, HISCORE_PROBE.panel);
  const sky = await probePixel(page, HISCORE_PROBE.sky);
  const ok = panel.r >= 180 && panel.g >= 180 && panel.b <= 90 && sky.r <= 60 && sky.g <= 70 && sky.b <= 90;
  return { ok, panel, sky };
}

async function waitForHiscoreForm(page, timeoutMs = 30000) {
  const started = Date.now();
  let state = { ok: false, panel: null, sky: null };
  while (Date.now() - started < timeoutMs) {
    state = await isHiscoreForm(page);
    if (state.ok) return { ...state, found: true, waitedMs: Date.now() - started };
    await sleep(250);
  }
  return { ...state, found: false, waitedMs: Date.now() - started };
}

/**
 * All-found return path of the reference: the end screen's only button is
 * "Gönder" (send). With a name and a valid e-mail it posts the score to the
 * excluded `hiscore.php` — the local server answers 404, nothing is stubbed —
 * and then runs `_root.gotoAndPlay("main")`, i.e. the intro plays again and a
 * new round starts (next `xml64.php` request). Measured field/button centers
 * are in HISCORE_FORM.
 */
async function submitHiscoreForm(page, log) {
  const offset = fs.statSync(SERVER_LOG).size;
  const result = { actions: [], hiscoreRequest: null, nextRoundSeen: false, nextRoundRequest: null };
  const quick = { settleMs: 150, stableTimeoutMs: 600 };
  result.actions.push(await action(page, log, 'S9-return-click-name', () => page.mouse.click(HISCORE_FORM.name.x, HISCORE_FORM.name.y), quick));
  result.actions.push(await action(page, log, 'S9-return-type-name', () => page.keyboard.type('C3ref', { delay: 40 }), quick));
  result.actions.push(await action(page, log, 'S9-return-click-email', () => page.mouse.click(HISCORE_FORM.email.x, HISCORE_FORM.email.y), quick));
  result.actions.push(await action(page, log, 'S9-return-type-email', () => page.keyboard.type('c3@reference.invalid', { delay: 40 }), quick));
  result.actions.push(await action(page, log, 'S9-return-click-gonder', () => page.mouse.click(HISCORE_FORM.send.x, HISCORE_FORM.send.y), quick));
  result.hiscoreRequest = await waitForLogMatch(offset, /hiscore\.php[^\n]*-> \d+/, { timeoutMs: 10000 });
  result.nextRoundRequest = await waitForLogMatch(offset, /xml64\.php[^\n]*-> 200/, { timeoutMs: 60000 });
  result.nextRoundSeen = result.nextRoundRequest.matched;
  return result;
}

// --- inputs ----------------------------------------------------------------
function manifest() {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  return {
    url: URL,
    viewport: { width: STAGE.width, height: STAGE.height },
    deviceScaleFactor: DSF,
    canvasDevicePixels: { width: STAGE.width * DSF, height: STAGE.height * DSF },
    outputRoot: path.relative(REPO, RUN_ROOT),
    launchArgs: LAUNCH_ARGS,
    ruffle: {
      release: 'v0.6.0',
      asset: 'ruffle-0.6.0-web-selfhosted.zip',
      zipSha256: hash(fs.readFileSync(RUFFLE_ZIP)),
      ruffleJsSha256: hash(fs.readFileSync(RUFFLE_JS)),
    },
    swf: { file: SWF, sha256: hash(fs.readFileSync(SWF)), md5: hash(fs.readFileSync(SWF), 'md5') },
    fixture: {
      input: { file: FIXTURE_INPUT, sha256: hash(fs.readFileSync(FIXTURE_INPUT)) },
      served: { file: FIXTURE_SERVED, sha256: hash(fs.readFileSync(FIXTURE_SERVED)) },
      script: { file: FIXTURE_SCRIPT, sha256: hash(fs.readFileSync(FIXTURE_SCRIPT)) },
    },
    playwright: pkg.devDependencies['@playwright/test'],
    node: process.version,
    port: PORT,
  };
}

/**
 * Enumerate the served fixture's round word list exactly as the 2012 client
 * sees it: every `<kelime harf="2".."8">` value is Base64(UTF-8)-decoded
 * (`swfBase64Decode`) before use; `harf="9999"` is not a word list.
 */
function readFixtureWords() {
  const xml = decodeLatin5(fs.readFileSync(FIXTURE_SERVED));
  const words = [];
  const re = /<kelime\s+harf="(\d+)">\s*<txt>([^<]*)<\/txt>\s*<\/kelime>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const len = Number(m[1]);
    if (len < 2 || len > 8) continue;
    const value = swfBase64Decode(m[2]);
    for (const w of value.split(',')) if (w.trim().length > 0) words.push({ word: w.trim(), len });
  }
  return words;
}

/**
 * Fixture pipeline evidence: archived input vs served Base64(UTF-8) re-encoding,
 * decoded with the SWF's own decoder (what the reference actually loads).
 */
function fixtureDecodeEvidence() {
  const inputXml = decodeLatin5(fs.readFileSync(FIXTURE_INPUT));
  const servedXml = decodeLatin5(fs.readFileSync(FIXTURE_SERVED));
  const grab = (xml, len) => xml.match(new RegExp(`<kelime\\s+harf="${len}">\\s*<txt>([^<]*)<\\/txt>`))?.[1] ?? '';
  const mainPlain = grab(inputXml, 8);
  const mainEncoded = grab(servedXml, 8);
  const mainDecoded = swfBase64Decode(mainEncoded);
  const threeDecoded = swfBase64Decode(grab(servedXml, 3));
  const wordCounts = {};
  for (const { len } of readFixtureWords()) wordCounts[len] = (wordCounts[len] ?? 0) + 1;
  return {
    note: 'the 2012 client Base64-decodes every round <txt> (frame_131 myOnLoad); the harness serves a Base64(UTF-8) re-encoding of the archived round data (verify/reference/fixtures/xml64.base64.php, generated by verify/reference/make-fixture.mjs)',
    input: { file: FIXTURE_INPUT, mainWordPlain: mainPlain, sha256: hash(fs.readFileSync(FIXTURE_INPUT)) },
    served: {
      file: FIXTURE_SERVED,
      sha256: hash(fs.readFileSync(FIXTURE_SERVED)),
      mainWordEncoded: mainEncoded,
      mainWordDecoded: mainDecoded,
      mainWordDecodedLength: mainDecoded.length,
      threeLetterWordCount: threeDecoded.split(',').filter(Boolean).length,
      wordCounts,
    },
  };
}

async function typeWord(page, word, missing) {
  for (const ch of word) {
    const key = TR_KEY[ch.toUpperCase()] ?? TR_KEY[ch];
    if (!key) { missing.add(ch); continue; }
    await page.keyboard.press(key);
    await sleep(12);
  }
}

// --- capture primitives ----------------------------------------------------
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function action(page, log, label, fn, { settleMs = 250, stableTimeoutMs = 5000 } = {}) {
  const before = await stageShot(page);
  await fn();
  await sleep(settleMs);
  const stability = await waitStable(page, { timeoutMs: stableTimeoutMs });
  const after = await stageShot(page);
  const entry = {
    label,
    atMs: Date.now() - log.t0,
    beforeSha256: hash(before),
    afterSha256: hash(after),
    stableAfter: stability.stable,
    ...diffBuffers(before, after),
  };
  log.actions.push(entry);
  return entry;
}

async function captureState(page, log, runDir, id, name, trigger, extra = {}) {
  const file = path.join(runDir, `${id}-${name}.png`);
  const buf = await stageShot(page, file);
  const entry = { id, name, trigger, file: path.relative(REPO, file), sha256: hash(buf), atMs: Date.now() - log.t0, ...extra };
  log.states.push(entry);
  console.log(`[C3] ${id}-${name}: ${entry.sha256.slice(0, 12)} at +${(entry.atMs / 1000).toFixed(1)}s`);
  return entry;
}

/**
 * Ruffle 0.6.0 shows its "hardware acceleration is disabled" notice once on the
 * first `mouseover` when the WebGL adapter is software ("Adapter Device Type:
 * Cpu", headless Chromium). It is a player-UI overlay, not game content; it is
 * dismissed through its own close button so captures see the reference stage.
 */
async function dismissHardwareAccelerationNotice(page, log) {
  await page.mouse.move(Math.round(STAGE.width / 2), 200);
  let state = { found: false, open: false };
  for (let i = 0; i < 60; i += 1) {
    state = await page.evaluate(() => {
      const modal = document.querySelector('ruffle-player')?.shadowRoot?.getElementById('hardware-acceleration-modal');
      return modal ? { found: true, open: !modal.classList.contains('hidden') } : { found: false, open: false };
    });
    if (state.open) break;
    await sleep(50);
  }
  let method = 'not-shown';
  if (state.open) {
    const rect = await page.evaluate(() => {
      const btn = document.querySelector('ruffle-player')?.shadowRoot?.querySelector('#hardware-acceleration-modal .close-modal');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (rect) {
      await page.mouse.click(rect.x, rect.y);
      await sleep(150);
      method = 'close-modal-click';
    }
    const after = await page.evaluate(() => {
      const modal = document.querySelector('ruffle-player')?.shadowRoot?.getElementById('hardware-acceleration-modal');
      return modal ? { open: !modal.classList.contains('hidden') } : { open: false };
    });
    if (after.open) {
      await page.evaluate(() => {
        document.querySelector('ruffle-player')?.shadowRoot?.getElementById('hardware-acceleration-modal')?.classList.add('hidden');
      });
      method = 'dom-hidden-fallback';
    }
  }
  const entry = { ...state, method };
  log.flowNotes.push(`Ruffle hardware-acceleration notice handled: ${JSON.stringify(entry)}`);
  return entry;
}

/** Round board wait: xml64.php 200 server evidence + stable frame + gauge check. */
async function waitForBoard(page, logOffset) {
  const ev = await waitForLogMatch(logOffset, /xml64\.php[^\n]*-> 200/, { timeoutMs: 120000 });
  const stable = await waitStable(page, { timeoutMs: 45000 });
  const red = await timerRedFraction(page);
  return { ev, stable, red, boardSignal: red.fraction >= BOARD_RED_MIN };
}

// --- probe mode ------------------------------------------------------------
function redBBoxOf(img) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      if (img.data[i] >= RED_PIXEL.rMin && img.data[i + 1] <= RED_PIXEL.gMax && img.data[i + 2] <= RED_PIXEL.bMax) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function probe(browser) {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const rawDir = path.join(PROBE_DIR, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const log = {
    schemaVersion: 1,
    task: 'C3',
    mode: 'probe',
    startedAt: new Date().toISOString(),
    t0: Date.now(),
    harness: manifest(),
    fixtureDecode: fixtureDecodeEvidence(),
    frames: [],
    serverEvidence: {},
    actions: [],
    console: [],
    flowNotes: [],
  };
  fs.appendFileSync(SERVER_LOG, `==== C3 harness probe start ${new Date().toISOString()} dsf=${DSF} ====\n`);
  const logOffset = fs.statSync(SERVER_LOG).size;
  const context = await browser.newContext({ viewport: { width: STAGE.width, height: STAGE.height }, deviceScaleFactor: DSF });
  const page = await context.newPage();
  attachConsole(page, log.console, log.t0);
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('#stage canvas', { timeout: 30000 });
  log.harness.canvasBox = await page.locator('#stage canvas').boundingBox();

  // Sample every 500 ms until the round board is up (max 30 s), then a few more.
  let boardSeen = false;
  for (let i = 0; i < 60; i += 1) {
    const buf = await stageShot(page);
    const file = path.join(PROBE_DIR, `t-${String(i * 500).padStart(5, '0')}.png`);
    fs.writeFileSync(file, buf);
    const img = decodePng(buf);
    const red = redFraction(img);
    if (!log.serverEvidence.xml64) {
      const { text } = readLogFrom(logOffset);
      const line = text.split('\n').find((l) => /xml64\.php[^\n]*-> 200/.test(l));
      if (line) log.serverEvidence.xml64 = { line: line.trim(), atMs: Date.now() - log.t0, sample: i };
    }
    log.frames.push({ atMs: Date.now() - log.t0, file: path.relative(PROBE_DIR, file), sha256: hash(buf), redFraction: red.fraction });
    if (!boardSeen && log.serverEvidence.xml64 && red.fraction >= BOARD_RED_MIN) boardSeen = true;
    await sleep(400);
    if (boardSeen && i >= 3 && log.frames.length > (log.serverEvidence.xml64?.sample ?? 0) + 4) break;
  }
  log.serverEvidence.boardSeen = boardSeen;
  const boardBuf = await stageShot(page);
  fs.writeFileSync(path.join(PROBE_DIR, 'board-latest.png'), boardBuf);
  log.redBBox = redBBoxOf(decodePng(boardBuf));

  const probed = async (label, fn) => {
    const before = await stageShot(page);
    fs.writeFileSync(path.join(rawDir, `${label}-before.png`), before);
    await fn();
    await sleep(250);
    const stability = await waitStable(page, { timeoutMs: 4000 });
    const after = await stageShot(page);
    fs.writeFileSync(path.join(rawDir, `${label}-after.png`), after);
    const entry = { label, atMs: Date.now() - log.t0, beforeSha256: hash(before), afterSha256: hash(after), stableAfter: stability.stable, ...diffBuffers(before, after) };
    log.actions.push(entry);
    return entry;
  };

  log.hardwareAcceleration = await dismissHardwareAccelerationNotice(page, log);
  await probed('focus-click-275-30', () => page.mouse.click(275, 30));
  await probed('press-space', () => page.keyboard.press('Space'));
  for (const x of TILE_XS) await probed(`click-tile-${x}-${TILE_Y}`, () => page.mouse.click(x, TILE_Y));
  await probed('backspace-x3', async () => {
    for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Backspace'); await sleep(80); }
  });
  await probed('type-FAL', async () => {
    for (const key of ['KeyF', 'KeyA', 'KeyL']) { await page.keyboard.press(key); await sleep(60); }
  });
  await probed('press-enter', () => page.keyboard.press('Enter'));
  log.endedAt = new Date().toISOString();
  writeJson(path.join(PROBE_DIR, 'probe.json'), log);
  await context.close();

  console.log('[C3 probe] frames:', log.frames.length, 'xml64:', log.serverEvidence.xml64 ? log.serverEvidence.xml64.line : 'NOT SEEN');
  console.log('[C3 probe] boardSeen:', boardSeen, 'redBBox:', JSON.stringify(log.redBBox));
  for (const a of log.actions) {
    console.log(`[C3 probe] ${a.label}: mismatchRatio=${a.mismatchRatio.toFixed(5)} bbox=${JSON.stringify(a.mismatchBBox)}`);
  }
  return log;
}

function diffBuffers(a, b) {
  const report = compareImages(decodePng(a), decodePng(b));
  return {
    mismatchRatio: report.mismatchRatio,
    mismatchedPixels: report.mismatchedPixels,
    maxDistance: report.maxDistance,
    mismatchBBox: report.mismatchBBox,
  };
}

// --- scenario mode (E3/F2 scripted captures) -------------------------------
// `node capture.mjs --scenario <scenario.json> --out <dir> [--dsf 1|2] [--runs N] [--port P]`
// Schema: `{ name, steps: [ { action, ... } ] }` — documented in README.md.
// Steps: waitStable | key | click | waitMs | capture | waitForState.
// Outputs: `<out>/<capture>.png`, `<out>/interaction-log.json`,
// `<out>/scenario-report.json` (compact per-step report; with `--runs N > 1`
// each run lands in `<out>/run<i>/` plus canonical copies and a repeat summary).

function scenarioKeyToPhysical(key, missing) {
  const upper = String(key).toUpperCase();
  if (SCENARIO_NAMED_KEYS[upper]) return SCENARIO_NAMED_KEYS[upper];
  const ch = String(key);
  const physical = TR_KEY[ch.toUpperCase()] ?? TR_KEY[ch];
  if (!physical) { missing.add(ch); return null; }
  return physical;
}

function resolveClickTarget(target) {
  const t = String(target ?? '');
  if (t.startsWith('tile:')) {
    const index = Number(t.slice('tile:'.length));
    if (!Number.isInteger(index) || index < 0 || index >= TILE_XS.length) return null;
    return { kind: 'tile', index, x: TILE_XS[index], y: TILE_Y };
  }
  if (t.startsWith('button:')) {
    const name = t.slice('button:'.length);
    const point = CLICK_TARGETS[name];
    return point ? { kind: 'button', name, x: point.x, y: point.y } : null;
  }
  if (t.startsWith('coord:')) {
    const [x, y] = t.slice('coord:'.length).split(',').map((v) => Number(v.trim()));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { kind: 'coord', x, y };
  }
  return null;
}

function scenarioCaptureName(name) {
  const slug = String(name ?? '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)) throw new Error(`invalid capture name ${JSON.stringify(name)} (allowed: letters, digits, . _ -)`);
  return slug;
}

/** Named state waits for scenario steps (`waitForState`; see README.md). */
async function scenarioWaitForState(page, step) {
  const timeoutMs = Number.isFinite(step.timeoutMs) ? step.timeoutMs : 60000;
  switch (step.condition) {
    case 'content': {
      const r = await waitForContent(page, timeoutMs);
      return { condition: 'content', matched: r.content, waitedMs: r.waitedMs, contentFraction: r.fraction };
    }
    case 'board': {
      const offset = fs.statSync(SERVER_LOG).size;
      const ev = await waitForLogMatch(offset, /xml64\.php[^\n]*-> 200/, { timeoutMs });
      if (!ev.matched) return { condition: 'board', matched: false, xml64: ev };
      const stable = await waitStable(page, { timeoutMs: Math.min(timeoutMs, 45000) });
      const gauge = await timerRedFraction(page);
      return { condition: 'board', matched: true, xml64: ev, stable, gaugeFraction: gauge.fraction, boardSignal: gauge.fraction >= BOARD_RED_MIN };
    }
    case 'xml64': {
      const offset = fs.statSync(SERVER_LOG).size;
      const ev = await waitForLogMatch(offset, /xml64\.php[^\n]*-> 200/, { timeoutMs });
      return { condition: 'xml64', matched: ev.matched, waitedMs: ev.waitedMs, line: ev.line };
    }
    case 'round-end': {
      const r = await waitForRoundEnd(page, { timeoutMs });
      return { condition: 'round-end', matched: r.ended, waitedMs: r.waitedMs, gaugeFraction: r.gaugeFraction };
    }
    case 'hiscore-form': {
      const r = await waitForHiscoreForm(page, timeoutMs);
      return { condition: 'hiscore-form', matched: r.found, waitedMs: r.waitedMs, panel: r.panel, sky: r.sky };
    }
    case 'entry-cleared': {
      const st = await waitEntryCleared(page, timeoutMs);
      return { condition: 'entry-cleared', matched: st.ballPixels < BALL_MIN_PIXELS, ballPixels: st.ballPixels };
    }
    case 'bonus-ball': {
      const started = Date.now();
      let best = 0;
      while (Date.now() - started < timeoutMs) {
        const st = await entryRowState(page);
        best = Math.max(best, st.brightPixels);
        if (st.brightPixels >= BALL_MIN_PIXELS) {
          return { condition: 'bonus-ball', matched: true, waitedMs: Date.now() - started, brightPixels: st.brightPixels };
        }
        await sleep(80);
      }
      return { condition: 'bonus-ball', matched: false, waitedMs: Date.now() - started, maxBrightPixels: best };
    }
    default:
      return { condition: step.condition, matched: false, reason: `unknown condition ${JSON.stringify(step.condition)}` };
  }
}

async function runScenarioSteps(page, log, outDir, scenario, report) {
  const missing = new Set();
  let noticeHandled = false;
  const ensureNotice = async () => {
    if (noticeHandled) return;
    noticeHandled = true;
    log.hardwareAcceleration = await dismissHardwareAccelerationNotice(page, log);
  };
  for (const [index, step] of scenario.steps.entries()) {
    const started = Date.now();
    const entry = { index, action: step.action, ok: false, atMs: Date.now() - log.t0 };
    try {
      switch (step.action) {
        case 'waitStable': {
          const stable = await waitStable(page, { timeoutMs: Number.isFinite(step.timeoutMs) ? step.timeoutMs : 30000 });
          entry.result = stable;
          entry.ok = true;
          break;
        }
        case 'key': {
          await ensureNotice();
          const physical = scenarioKeyToPhysical(step.key, missing);
          if (!physical) { entry.reason = `no physical key mapping for ${JSON.stringify(step.key)}`; break; }
          await page.keyboard.press(physical);
          entry.result = { key: step.key, physical };
          entry.ok = true;
          break;
        }
        case 'click': {
          await ensureNotice();
          const target = resolveClickTarget(step.target);
          if (!target) { entry.reason = `unknown click target ${JSON.stringify(step.target)}`; break; }
          await page.mouse.click(target.x, target.y);
          entry.result = { target: step.target, point: { x: target.x, y: target.y }, kind: target.kind };
          entry.ok = true;
          break;
        }
        case 'waitMs': {
          if (!Number.isFinite(step.ms) || step.ms < 0) { entry.reason = 'ms must be a non-negative number'; break; }
          await sleep(step.ms);
          entry.result = { requestedMs: step.ms };
          entry.ok = true;
          break;
        }
        case 'capture': {
          const name = scenarioCaptureName(step.name);
          const file = path.join(outDir, `${name}.png`);
          const buf = await stageShot(page, file);
          const img = decodePng(buf);
          entry.result = { name, file: path.relative(REPO, file), sha256: hash(buf), width: img.width, height: img.height };
          report.captures.push(entry.result);
          entry.ok = true;
          break;
        }
        case 'waitForState': {
          const result = await scenarioWaitForState(page, step);
          entry.result = result;
          entry.ok = result.matched === true;
          if (result.reason) entry.reason = result.reason;
          break;
        }
        default:
          throw new Error(`unknown action ${JSON.stringify(step.action)}`);
      }
    } catch (err) {
      entry.reason = err.message;
    }
    entry.durationMs = Date.now() - started;
    report.steps.push(entry);
    if (!entry.ok) report.ok = false;
    console.log(`[C3 scenario] step ${index} ${step.action}: ${entry.ok ? 'ok' : `FAILED (${entry.reason ?? 'state not reached'})`} (${entry.durationMs} ms)`);
  }
  report.missingKeys = [...missing];
  return report;
}

async function runScenario(browser, scenarioPath, outDir) {
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  if (!scenario || typeof scenario.name !== 'string' || !Array.isArray(scenario.steps)) {
    throw new Error('scenario must be { name: string, steps: [...] }');
  }
  const runCount = Math.max(1, RUNS);
  const canonical = path.resolve(REPO, outDir);
  const runDirs = [];
  const runReports = [];
  let allOk = true;
  for (let n = 1; n <= runCount; n += 1) {
    const runDir = runCount > 1 ? path.join(canonical, `run${n}`) : canonical;
    fs.mkdirSync(runDir, { recursive: true });
    runDirs.push(runDir);
    fs.appendFileSync(SERVER_LOG, `==== C3 harness scenario ${scenario.name} run ${n} start ${new Date().toISOString()} dsf=${DSF} ====\n`);
    const log = {
      schemaVersion: 1,
      task: 'C3',
      mode: 'scenario',
      scenario: { file: path.relative(REPO, scenarioPath), name: scenario.name, steps: scenario.steps.length },
      run: n,
      startedAt: new Date().toISOString(),
      t0: Date.now(),
      harness: manifest(),
      serverEvidence: {},
      flowNotes: [],
      states: [],
      actions: [],
      console: [],
    };
    log.harness.outputRoot = path.relative(REPO, runDir);
    const report = { schemaVersion: 1, task: 'C3', scenario: scenario.name, run: n, startedAt: log.startedAt, endedAt: null, ok: true, steps: [], captures: [], missingKeys: [] };
    const context = await browser.newContext({ viewport: { width: STAGE.width, height: STAGE.height }, deviceScaleFactor: DSF });
    const page = await context.newPage();
    attachConsole(page, log.console, log.t0);
    try {
      await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('#stage canvas', { timeout: 30000 });
      log.harness.canvasBox = await page.locator('#stage canvas').boundingBox();
      await runScenarioSteps(page, log, runDir, scenario, report);
    } finally {
      log.endedAt = new Date().toISOString();
      report.endedAt = log.endedAt;
      report.harness = log.harness;
      writeJson(path.join(runDir, 'interaction-log.json'), log);
      writeJson(path.join(runDir, 'scenario-report.json'), report);
      await context.close();
    }
    runReports.push({ run: n, dir: path.relative(REPO, runDir), report });
    if (!report.ok) allOk = false;
    console.log(`[C3 scenario] ${scenario.name} run ${n}: ${report.ok ? 'OK' : 'FAILED'} (${report.captures.length} captures, ${report.steps.length} steps)`);
  }
  if (runCount > 1) {
    const first = runDirs[0];
    for (const f of fs.readdirSync(first)) {
      if (f.endsWith('.png') || f === 'interaction-log.json' || f === 'scenario-report.json') {
        fs.copyFileSync(path.join(first, f), path.join(canonical, f));
      }
    }
    const summary = {
      schemaVersion: 1,
      task: 'C3',
      scenario: scenario.name,
      runs: runCount,
      allOk,
      repeats: runReports.map(({ run, dir, report }) => ({
        run,
        dir,
        ok: report.ok,
        captures: report.captures.map((c) => ({ name: c.name, sha256: c.sha256, width: c.width, height: c.height })),
      })),
    };
    writeJson(path.join(canonical, 'scenario-repeat.json'), summary);
  }
  return allOk;
}

// --- matrix mode -----------------------------------------------------------
const STATE_IDS = ['S1-boot', 'S2-idle-board', 'S3-scrambled', 'S4-partial-entry', 'S5-valid-word', 'S6-invalid-word', 'S7-bonus-word', 'S8-all-found', 'S9-timeout', 'S10-next-round'];

async function runMatrix(browser, n) {
  const runDir = path.join(RUN_ROOT, `run${n}`);
  fs.mkdirSync(runDir, { recursive: true });
  const log = {
    schemaVersion: 1,
    task: 'C3',
    run: n,
    startedAt: new Date().toISOString(),
    t0: Date.now(),
    harness: manifest(),
    fixtureDecode: fixtureDecodeEvidence(),
    serverEvidence: {},
    flowNotes: [],
    states: [],
    actions: [],
    console: [],
  };
  fs.appendFileSync(SERVER_LOG, `==== C3 harness run ${n} start ${new Date().toISOString()} dsf=${DSF} ====\n`);
  const logOffset = fs.statSync(SERVER_LOG).size;
  const context = await browser.newContext({ viewport: { width: STAGE.width, height: STAGE.height }, deviceScaleFactor: DSF });
  const page = await context.newPage();
  attachConsole(page, log.console, log.t0);

  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#stage canvas', { timeout: 30000 });
    log.harness.canvasBox = await page.locator('#stage canvas').boundingBox();

    // S1 boot/initial: first stable game-content frame. The white Ruffle splash
    // is skipped by the content check; the intro's sun animation region
    // (SUN_BOX) is excluded from the stability hash (measured, see constants).
    const content = await waitForContent(page, 30000);
    const s1 = await waitStable(page, { maskBox: SUN_BOX, intervalMs: 200, timeoutMs: 25000 });
    log.serverEvidence.firstContent = content;
    await captureState(page, log, runDir, 'S1', 'boot', 'load page, wait for first stable frame (SUN_BOX masked)', { stable: s1.stable, stability: s1, content });

    // S2 idle board: xml64.php 200 server evidence + stable frame + gauge check.
    const board = await waitForBoard(page, logOffset);
    log.serverEvidence.xml64Round1 = board.ev;
    if (!board.ev.matched) throw new Error('no xml64.php 200 observed in the server log');
    await captureState(page, log, runDir, 'S2', 'idle-board', 'round loaded; no input (xml64.php 200 + stable frame)', { stable: board.stable.stable, stability: board.stable, boardSignal: board.boardSignal, timerRedFraction: board.red.fraction });
    log.flowNotes.push(`round board: xml64.php 200 observed (${board.ev.waitedMs} ms after navigation), stable after ${board.stable.elapsedMs} ms, timer gauge red fraction ${board.red.fraction.toFixed(4)}`);

    // Player-UI notice (hardware acceleration, headless-only) before input.
    log.hardwareAcceleration = await dismissHardwareAccelerationNotice(page, log);
    await action(page, log, 'focus-click-275-30', () => page.mouse.click(275, 30));

    // S3 scrambled: press SPACE.
    const s3act = await action(page, log, 'S3-press-space', () => page.keyboard.press('Space'));
    await captureState(page, log, runDir, 'S3', 'scrambled', 'press SPACE', { effect: s3act });

    // S4 partial entry: click tiles (defined sequence: click/type 3 tiles). The
    // reference shuffles the deck randomly and only the tiles that exist respond;
    // the harness scans the row until 3 letters are entered or all slots are
    // tried, recording which clicks registered (measured hit vs miss separation:
    // a registered click changes >=0.2 % of the stage — tile hides + wordball —
    // a miss only the timer digits, ~0.02 %).
    const s4effects = [];
    let lettersEntered = 0;
    for (const x of TILE_XS) {
      if (lettersEntered >= 3) break;
      const effect = await action(page, log, `S4-click-tile-${x}`, () => page.mouse.click(x, TILE_Y));
      const registered = effect.mismatchRatio >= 0.002;
      if (registered) lettersEntered += 1;
      s4effects.push({ ...effect, registered });
    }
    log.flowNotes.push(`S4 tile scan: ${s4effects.length} slots clicked, ${lettersEntered} registered; the decoded main word has ${log.fixtureDecode.served.mainWordDecodedLength} chars (8 letter tiles)`);
    await captureState(page, log, runDir, 'S4', 'partial-entry', 'click/type 3 tiles (scan until 3 letters or the tile row is exhausted)', { effects: s4effects, tilesClicked: s4effects.length, lettersEntered });

    // S5 valid word: clear the S4 partial entry, type a 3-letter fixture word
    // (FAL) with the SWF's physical key codes and submit with ENTER.
    await action(page, log, 'S5-clear-entry', () => clearEntry(page, 4));
    const s5type = await action(page, log, 'S5-type-FAL', async () => {
      for (const key of ['KeyF', 'KeyA', 'KeyL']) { await page.keyboard.press(key); await sleep(50); }
    });
    const s5enter = await action(page, log, 'S5-press-enter', () => page.keyboard.press('Enter'));
    const s5entry = await waitEntryCleared(page, 2000);
    const s5accepted = s5entry.ballPixels < BALL_MIN_PIXELS;
    await captureState(page, log, runDir, 'S5', 'valid-word', 'submit a 3-letter fixture word (FAL typed, ENTER)', { effects: [s5type, s5enter], word: 'FAL', accepted: s5accepted, entryRowAfter: s5entry });

    // S6 invalid word: clear the entry and submit a non-list entry built from
    // deck letters (MİZ is not in the fixture's 3-letter list).
    await action(page, log, 'S6-clear-entry', () => clearEntry(page, 4));
    const s6type = await action(page, log, 'S6-type-MIZ', async () => {
      for (const key of ['KeyM', 'Quote', 'KeyZ']) { await page.keyboard.press(key); await sleep(50); }
    });
    const s6enter = await action(page, log, 'S6-press-enter', () => page.keyboard.press('Enter'));
    const s6entry = await waitEntryCleared(page, 1200);
    await captureState(page, log, runDir, 'S6', 'invalid-word', 'submit a non-list entry (MİZ typed, ENTER)', { effects: [s6type, s6enter], word: 'MİZ', accepted: s6entry.ballPixels < BALL_MIN_PIXELS, entryRowAfter: s6entry });

    // S7 bonus word: the bonus is a random per-letter event (O02) shown by the
    // reference as the bright/orange wordball. Clear, type a 4-letter fixture
    // word (FANİ) and wait for the bright ball (a reference state), retrying
    // within a bounded budget; submit once the bonus state is shown.
    const s7keys = ['KeyF', 'KeyA', 'KeyN', 'Quote'];
    let s7attempts = 0;
    let s7bonusSeen = false;
    let s7maxBright = 0;
    while (s7attempts < 40 && !s7bonusSeen) {
      s7attempts += 1;
      await clearEntry(page, 6);
      let seenThisAttempt = false;
      for (const key of s7keys) {
        await page.keyboard.press(key);
        await sleep(70);
        const st = await entryRowState(page);
        if (st.brightPixels > s7maxBright) s7maxBright = st.brightPixels;
        if (st.brightPixels >= BALL_MIN_PIXELS) seenThisAttempt = true;
      }
      if (seenThisAttempt) s7bonusSeen = true;
    }
    const s7enter = await action(page, log, 'S7-press-enter', () => page.keyboard.press('Enter'));
    const s7entry = await waitEntryCleared(page, 2000);
    await captureState(page, log, runDir, 'S7', 'bonus-word', 'submit a fixture word containing the bonus letter (FANİ typed; bright bonus ball waited for, ENTER)', { attempts: s7attempts, bonusSeen: s7bonusSeen, maxBrightPixels: s7maxBright, word: 'FANİ', accepted: s7entry.ballPixels < BALL_MIN_PIXELS, entryRowAfter: s7entry, effect: s7enter });

    // S8 all-found: scripted submission of every fixture word (docs/07 §5).
    // Acceptance = the reference cleared the entry row; round completion =
    // Karıştır/Ekle/Sil hidden. The round clock is 200 s: if it runs out
    // mid-script, `tamamla()` hides the same buttons but the all-found end
    // screen never appears — the harness records the timeout, restarts the
    // round through the reference's own "Yeni Oyun" button and completes the
    // scripted submission in the fresh round (bounded: one restart).
    const words = readFixtureWords();
    const missing = new Set();
    let s8accepted = 0;
    let s8failed = 0;
    let s8completed = false;
    let s8completedBy = null;
    let s8restarts = 0;
    let entryDirty = false;

    const runScriptedPass = async (pass) => {
      for (const { word } of words) {
        if (s8completed) return;
        if (entryDirty) { await clearEntry(page, 10); entryDirty = false; }
        let accepted = false;
        for (let attempt = 0; attempt < 3 && !accepted; attempt += 1) {
          if (attempt > 0) await clearEntry(page, 10);
          await typeWord(page, word, missing);
          await page.keyboard.press('Enter');
          const st = await waitEntryCleared(page, 1800);
          accepted = st.ballPixels < BALL_MIN_PIXELS;
          if (!accepted) entryDirty = true;
          if ((await buttonBarFraction(page)).fraction <= 0.02) {
            s8completed = true;
            s8completedBy = `${word} (pass ${pass})`;
            break;
          }
        }
        if (accepted) { s8accepted += 1; entryDirty = false; } else s8failed += 1;
      }
    };

    await runScriptedPass(1);
    if (s8completed) {
      const form = await waitForHiscoreForm(page, 8000);
      if (!form.found && s8restarts < 1) {
        s8restarts += 1;
        s8completed = false;
        s8completedBy = null;
        log.flowNotes.push(`S8 pass 1 ended before all-found (round clock ran out; ${s8accepted} accepted) — restarting via Yeni Oyun`);
        const restartOffset = fs.statSync(SERVER_LOG).size;
        await action(page, log, 'S8-restart-yeni-oyun', () => page.mouse.click(YBUTTON.x, YBUTTON.y));
        log.serverEvidence.xml64S8Restart = await waitForLogMatch(restartOffset, /xml64\.php[^\n]*-> 200/, { timeoutMs: 60000 });
        await waitStable(page, { timeoutMs: 45000 });
        entryDirty = false;
        await runScriptedPass(2);
      }
    }
    const endScreen = await waitForHiscoreForm(page, 30000);
    log.flowNotes.push(`S8 scripted submission: ${words.length} fixture words, ${s8accepted} accepted, ${s8failed} failed, restarts=${s8restarts}, completed=${s8completed}${s8completedBy ? ` (completing word "${s8completedBy}")` : ''}, missing key mappings: ${[...missing].join('') || 'none'}`);
    log.flowNotes.push(`all-found end screen detected=${endScreen.found} after ${endScreen.waitedMs} ms (panel rgb ${endScreen.panel?.r},${endScreen.panel?.g},${endScreen.panel?.b}; sky rgb ${endScreen.sky?.r},${endScreen.sky?.g},${endScreen.sky?.b})`);
    await captureState(page, log, runDir, 'S8', 'all-found', 'submit every fixture word (scripted) -> all-found end screen (TEBRİKLER + score form)', { wordsSubmitted: s8accepted, wordsFailed: s8failed, wordsTotal: words.length, restarts: s8restarts, completed: s8completed, completedBy: s8completedBy, missingKeyMappings: [...missing], endScreen });

    // S9 timeout: the all-found end screen is terminal unless the reference's
    // own return path is used — the "Gönder" handler posts the score to the
    // excluded hiscore.php (local 404, not stubbed) and runs `gotoAndPlay
    // ("main")`, which plays the intro again and starts a new round. Round 2 is
    // started that way, then its clock is waited out (`tamamla()`: gauge empty
    // + Karıştır/Ekle/Sil hidden + unfound words revealed) — the timeout state.
    const returnPath = await submitHiscoreForm(page, log);
    log.flowNotes.push(`S9 return path: hiscore.php request ${returnPath.hiscoreRequest?.matched ? 'logged' : 'not seen'}${returnPath.hiscoreRequest?.line ? ` (${returnPath.hiscoreRequest.line})` : ''}; next round xml64.php ${returnPath.nextRoundSeen ? 'requested' : 'NOT requested'}`);
    const s9end = await waitForRoundEnd(page, { timeoutMs: 260000 });
    const s9 = await waitStable(page, { timeoutMs: 30000 });
    await captureState(page, log, runDir, 'S9', 'timeout', 'return path from the end screen -> round 2; wait out the timer (gauge empty + Karıştır/Ekle/Sil hidden + unfound words revealed)', { end: s9end, stable: s9.stable, stability: s9, returnPath });

    // S10 next round: click "Yeni Oyun" (visible again on the timed-out round 2
    // board) and wait for round 3's xml64.php request.
    const s10Offset = fs.statSync(SERVER_LOG).size;
    const s10click = await action(page, log, 'S10-click-yeni-oyun', () => page.mouse.click(YBUTTON.x, YBUTTON.y));
    const nextEv = await waitForLogMatch(s10Offset, /xml64\.php[^\n]*-> 200/, { timeoutMs: 60000 });
    log.serverEvidence.xml64NextRound = nextEv;
    const s10 = await waitStable(page, { timeoutMs: 45000 });
    await captureState(page, log, runDir, 'S10', 'next-round', 'start a new round after completion (Yeni Oyun click; next xml64.php 200 + stable frame)', { effect: s10click, nextRoundRequest: nextEv.matched, stable: s10.stable, stability: s10 });
  } finally {
    log.endedAt = new Date().toISOString();
    writeJson(path.join(runDir, 'interaction-log.json'), log);
    await context.close();
  }
  return log;
}

// --- stability comparison --------------------------------------------------
function compareRuns() {
  const results = [];
  for (const state of STATE_IDS) {
    const a = path.join(RUN_ROOT, 'run1', `${state}.png`);
    const b = path.join(RUN_ROOT, 'run2', `${state}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(b)) {
      results.push({ state, present: false });
      continue;
    }
    const outDir = path.join(RUN_ROOT, 'stability', state);
    const report = runComparison(a, b, outDir);
    const entry = {
      state,
      present: true,
      byteIdentical: hash(fs.readFileSync(a)) === hash(fs.readFileSync(b)),
      mismatchRatio: report.mismatchRatio,
      mismatchedPixels: report.mismatchedPixels,
      mismatchBBox: report.mismatchBBox,
      pass: report.pass,
      report: path.relative(REPO, path.join(outDir, 'report.json')),
      heatmap: path.relative(REPO, path.join(outDir, 'heatmap.png')),
    };
    // S1's only animated element is the intro sun (SUN_BOX, the same region the
    // S1 capture rule masks); record the sun-masked ratio alongside the raw one.
    if (state === 'S1-boot') {
      const masked = compareImages(
        maskImage(decodePng(fs.readFileSync(a)), scaleBox(SUN_BOX)),
        maskImage(decodePng(fs.readFileSync(b)), scaleBox(SUN_BOX)),
      );
      entry.sunMaskedMismatchRatio = masked.mismatchRatio;
      entry.sunMaskedMismatchBBox = masked.mismatchBBox;
    }
    results.push(entry);
  }
  const summary = {
    schemaVersion: 1,
    task: 'C3',
    createdAt: new Date().toISOString(),
    threshold: { mismatchThreshold: 30, passRatio: 0.02 },
    states: results,
    allByteIdentical: results.every((r) => r.byteIdentical === true),
    allPass: results.every((r) => r.pass === true),
  };
  writeJson(path.join(RUN_ROOT, 'stability-report.json'), summary);
  return summary;
}

async function copyCanonical() {
  const run1 = path.join(RUN_ROOT, 'run1');
  const stability = JSON.parse(fs.readFileSync(path.join(RUN_ROOT, 'stability-report.json'), 'utf8'));
  for (const state of STATE_IDS) {
    const src = path.join(run1, `${state}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(RUN_ROOT, `${state}.png`));
  }
  const log = JSON.parse(fs.readFileSync(path.join(run1, 'interaction-log.json'), 'utf8'));
  log.stability = stability;
  writeJson(path.join(RUN_ROOT, 'interaction-log.json'), log);
}

// --- main ------------------------------------------------------------------
async function main() {
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  try {
    if (SCENARIO) {
      if (!SCENARIO_OUT) throw new Error('--scenario requires --out <dir>');
      const ok = await runScenario(browser, SCENARIO, SCENARIO_OUT);
      return ok ? 0 : 1;
    }
    if (PROBE) {
      await probe(browser);
      return 0;
    }
    for (let n = 1; n <= RUNS; n += 1) {
      console.log(`[C3] matrix run ${n}/${RUNS}`);
      await runMatrix(browser, n);
    }
    if (RUNS >= 2) {
      const summary = compareRuns();
      await copyCanonical();
      for (const r of summary.states) {
        console.log(`[C3] ${r.state}: byteIdentical=${r.byteIdentical} mismatchRatio=${r.mismatchRatio} pass=${r.pass}`);
      }
      if (!summary.allByteIdentical) console.log('[C3] WARNING: not all states are byte-identical across runs');
    }
    return 0;
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main()
    .then((code) => { process.exitCode = code; })
    .catch((err) => {
      console.error(`[C3] FAILED: ${err.message}`);
      process.exitCode = 1;
    });
}

