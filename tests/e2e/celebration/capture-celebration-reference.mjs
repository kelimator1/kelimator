#!/usr/bin/env node
/* global document, window, HTMLElement */
/**
 * tests/e2e/celebration/capture-celebration-reference.mjs — Y10 reference
 * captures of the win celebration (SWF frames 132-241).
 *
 * Extends the C3/Y8 capture pattern (verify/reference/server.py + pinned
 * Ruffle 0.6.0 web build + the reconstructed Base64(UTF-8) fixture + muted
 * Chromium; no Ruffle CLI, no network beyond 127.0.0.1):
 *
 *   1. plays the reference to the all-found end screen by replaying the key
 *      steps of the committed F2 reference scenario
 *      (tests/fixtures/reference/playthrough/scenarios/playthrough.json —
 *      F2 verified that sequence reaches the `hiscore-form` state);
 *   2. pauses right after the completion ENTER (page-side 5 ms pauser) and
 *      captures the frame-132 state (board cleared; the first board-clear
 *      state is exactly frame 132 — see the report's `frame132` record);
 *   3. steps the SWF one frame at a time (page-side play/pause pairs) and
 *      screenshots each step (the "burst");
 *   4. after the last step lets the movie run to rest (the `bottom_marquee`
 *      fireworks are removed at sprite 170 frame 65) and captures the settled
 *      end screen;
 *   5. labels every shot against the win-timeline series of
 *      evidence/logs/Y10-win-series.json with self-calibrated probes (sky
 *      alpha ladder for frames 188-222, glow-disc edge for the opaque-sky
 *      frames, wordmark box for the early frames, card panel edge for frames
 *      226-241) and keeps the per-target best shot.
 *
 * Usage:
 *   node tests/e2e/celebration/capture-celebration-reference.mjs --dsf 1 --out evidence/visual/Y10/reference-dsf1
 *   node tests/e2e/celebration/capture-celebration-reference.mjs --dsf 2 --out evidence/visual/Y10/reference-dsf2
 *
 * Silent witness runs (EXECUTION.md §8): Chromium launches with `--mute-audio`;
 * no audio is played or verified.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../../verify/diff/diff.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const STAGE = { x: 0, y: 0, width: 550, height: 400 };
const SERIES = JSON.parse(
  fs.readFileSync(path.join(REPO, 'evidence/logs/Y10-win-series.json'), 'utf8'),
);
const SCENARIO = JSON.parse(
  fs.readFileSync(
    path.join(
      REPO,
      'tests/fixtures/reference/playthrough/scenarios/playthrough.json',
    ),
    'utf8',
  ),
);

// --- CLI --------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const DSF = Number(opt('--dsf', '1'));
const OUT = path.resolve(REPO, opt('--out', `evidence/visual/Y10/reference-dsf${DSF}`));
const PORT = Number(opt('--port', '8804'));
const RUN_LABEL = opt('--label', `dsf${DSF}`);
const URL = `http://127.0.0.1:${PORT}/`;
const TARGETS = opt('--targets', '132,159,186,214,241')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));
const MAX_SESSIONS = Number(opt('--max-sessions', '3'));
const MAX_STEPS = Number(opt('--max-steps', '130'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (buf) => createHash('sha256').update(buf).digest('hex');
const frame = 1 / 36;

// --- scenario key mapping (same as verify/reference/capture.mjs) ------------
const TR_KEY = {
  A: 'KeyA', B: 'KeyB', C: 'KeyC', Ç: 'Backslash', D: 'KeyD', E: 'KeyE',
  F: 'KeyF', G: 'KeyG', Ğ: 'BracketLeft', H: 'KeyH', I: 'KeyI', İ: 'Quote',
  J: 'KeyJ', K: 'KeyK', L: 'KeyL', M: 'KeyM', N: 'KeyN', O: 'KeyO',
  Ö: 'Slash', P: 'KeyP', R: 'KeyR', S: 'KeyS', Ş: 'Semicolon', T: 'KeyT',
  U: 'KeyU', Ü: 'BracketRight', V: 'KeyV', Y: 'KeyY', Z: 'KeyZ',
};
const NAMED_KEYS = { SPACE: 'Space', ENTER: 'Enter', BACKSPACE: 'Backspace' };
function scenarioKeyToPhysical(key, missing) {
  const upper = String(key).toUpperCase();
  if (NAMED_KEYS[upper]) return NAMED_KEYS[upper];
  const ch = String(key);
  const physical = TR_KEY[ch.toUpperCase()] ?? TR_KEY[ch];
  if (!physical) missing.add(ch);
  return physical ?? null;
}

// --- win series predictions -------------------------------------------------
const WIN_START = SERIES.win.frameStart; // 132
const WIN_END = SERIES.win.frameEnd; // 241
const glowTy = (f) => SERIES.win.glow[String(f)].ty;
const skyAlpha = (f) => SERIES.win.skyAlpha[String(f)] / 256;
const formTy = (f) => SERIES.win.form[String(f)].ty;
const logoFrame = (f) => SERIES.win.logo[String(Math.max(131, Math.min(202, f)))];

// --- image measurements (CSS-pixel space; Y8 pattern) -----------------------
function blobOf(img, mask, scale, band) {
  const ox0 = Math.max(0, Math.floor(band.x0 * scale));
  const ox1 = Math.min(img.width, Math.ceil(band.x1 * scale));
  const oy0 = Math.max(0, Math.floor(band.y0 * scale));
  const oy1 = Math.min(img.height, Math.ceil(band.y1 * scale));
  const seen = new Uint8Array(img.width * img.height);
  let best = null;
  for (let y = oy0; y < oy1; y += 1) {
    for (let x = ox0; x < ox1; x += 1) {
      const start = y * img.width + x;
      if (seen[start] === 1 || !mask(img, x, y)) continue;
      const stack = [start];
      seen[start] = 1;
      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (stack.length > 0) {
        const index = stack.pop();
        const px = index % img.width;
        const py = (index - px) / img.width;
        area += 1;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        for (const next of [index - img.width, index + img.width, px > 0 ? index - 1 : -1, px + 1 < img.width ? index + 1 : -1]) {
          if (next < 0 || next >= seen.length || seen[next] === 1) continue;
          const nx = next % img.width;
          const ny = (next - nx) / img.width;
          if (nx < ox0 || nx >= ox1 || ny < oy0 || ny >= oy1 || !mask(img, nx, ny)) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      if (area < 8) continue;
      if (best === null || area > best.area) {
        best = {
          area: area / (scale * scale),
          box: {
            x: minX / scale,
            y: minY / scale,
            w: (maxX - minX + 1) / scale,
            h: (maxY - minY + 1) / scale,
          },
        };
      }
    }
  }
  return best;
}

function maskUnion(img, mask, scale, band) {
  const ox0 = Math.max(0, Math.floor(band.x0 * scale));
  const ox1 = Math.min(img.width, Math.ceil(band.x1 * scale));
  const oy0 = Math.max(0, Math.floor(band.y0 * scale));
  const oy1 = Math.min(img.height, Math.ceil(band.y1 * scale));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = oy0; y < oy1; y += 1) {
    for (let x = ox0; x < ox1; x += 1) {
      if (!mask(img, x, y)) continue;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (count < 100 * scale * scale) return null;
  return {
    area: count / (scale * scale),
    box: {
      x: minX / scale,
      y: minY / scale,
      w: (maxX - minX + 1) / scale,
      h: (maxY - minY + 1) / scale,
    },
  };
}

const warmMask = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return r >= 180 && g >= 90 && b <= 205 && r - b >= 40;
};
const logoMask = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return r >= 175 && g >= 130 && b <= 165 && r - b >= 55;
};
const panelPixel = (img, x, y) => {
  // Card fill (#cccc33) over the night backdrop: yellow-green hue (r ~ g, low
  // blue), any alpha >= ~0.4; the intro ground (gold, r > g, higher blue) and
  // the firework sparks (orange/green) fail the hue test.
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return (
    r >= 80 &&
    g >= 80 &&
    g >= r - 12 &&
    r - b >= 55 &&
    g - b >= 55 &&
    b < 0.55 * g
  );
};

function sampleColor(img, scale, cx, cy) {
  const x = Math.round(cx * scale);
  const y = Math.round(cy * scale);
  const i = (y * img.width + x) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
}

/** Longest vertical run of card-coloured pixels in column `x` (panel edge). */
function panelEdge(img, scale, x, y0, y1) {
  const px = Math.round(x * scale);
  let run = 0;
  for (let y = Math.round(y0 * scale); y < Math.round(y1 * scale); y += 1) {
    if (panelPixel(img, px, y)) {
      run += 1;
      if (run >= Math.round(25 * scale)) return { top: (y - run + 1) / scale };
    } else {
      run = 0;
    }
  }
  return null;
}

/** Board-state probe: the board view at stage (40,120) is panel/white while
 * playing; every win frame has the re-placed day/night sky there. */
function boardProbe(img, scale) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = Math.round(40 * scale) + dx;
      const y = Math.round(120 * scale) + dy;
      const i = (y * img.width + x) * 4;
      r += img.data[i];
      g += img.data[i + 1];
      b += img.data[i + 2];
      n += 1;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Spark ink of the firework burst: saturated spark hues (orange/red, green,
 * cyan/blue) above the results card and the ground (band y 30..190). The
 * night sky (b-r ~ 37), the moon (grey) and the stars (near-white) fail the
 * hue test, so the count tracks the burst and nothing else.
 */
function sparkInk(img, scale) {
  let ink = 0;
  for (let y = Math.round(30 * scale); y < Math.round(190 * scale); y += 1) {
    for (let x = Math.round(30 * scale); x < Math.round(550 * scale); x += 1) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      if ((r - b > 80 && r > 150) || (g - b > 80 && g > 150) || (b - r > 50 && b > 120 && b - g > 40)) {
        ink += 1;
      }
    }
  }
  return ink / (scale * scale);
}

function measure(img, scale) {
  const sun = blobOf(img, warmMask, scale, { x0: 190, x1: 340, y0: 0, y1: 236 });
  // Wordmark ink above the intro ground (the ground's gold would merge into
  // the union box; y1=235 keeps the early wordmark frames measurable).
  const logo = maskUnion(img, logoMask, scale, { x0: 0, x1: 470, y0: 0, y1: 235 });
  const panel = panelEdge(img, scale, 400, 150, 375);
  const sky = sampleColor(img, scale, 500, 60);
  const board = boardProbe(img, scale);
  return {
    sun: sun === null ? null : sun.box,
    sunArea: sun === null ? 0 : sun.area,
    logo: logo === null ? null : logo.box,
    logoArea: logo === null ? 0 : logo.area,
    panelTop: panel === null ? null : panel.top,
    sky,
    boardVisible: board.b <= board.r + 10,
    sparkInk: sparkInk(img, scale),
  };
}

// --- labeling (two-pass with self-calibrated probes) ------------------------
function labelAll(shots, settled) {
  // Day sky green at (500,60) from an opaque-sky shot (frames 132-187).
  const opaque = shots.find((s) => !s.features.boardVisible && s.features.sky.g > 120);
  const dayGreen = opaque === undefined ? 157 : opaque.features.sky.g;
  // Night backdrop green at (500,60) from the loop sample's final sky
  // (alpha 36/256).
  const settledGreen = settled.features.sky.g;
  const settledAlpha = skyAlpha(241);
  const nightGreen = (settledGreen - settledAlpha * dayGreen) / (1 - settledAlpha);
  const alphaOf = (g) => (g - nightGreen) / (dayGreen - nightGreen);

  const skyFrame = (alpha) => {
    let best = null;
    for (let f = 188; f <= 222; f += 1) {
      const cost = Math.abs(alpha - skyAlpha(f));
      if (best === null || cost < best.cost) best = { f, cost };
    }
    return best !== null && best.cost <= 0.02 ? best : null;
  };

  // Pass 1: glow-disc bottom edge offset, derived from shots whose frame the
  // sky alpha identifies and whose disc is measurable (frames 188-222).
  const offsets = [];
  for (const shot of shots) {
    if (shot.features.boardVisible || shot.features.panelTop !== null) continue;
    const alpha = alphaOf(shot.features.sky.g);
    if (alpha >= 0.985) continue;
    const sky = skyFrame(alpha);
    if (sky === null) continue;
    const sun = shot.features.sun;
    if (sun === null || shot.features.sunArea < 60 || sun.w < 30 || sun.w > 130) continue;
    const bottom = sun.y + sun.h;
    if (bottom >= 236) continue;
    offsets.push(bottom - (glowTy(sky.f) + 46.75));
  }
  offsets.sort((a, b) => a - b);
  const bottomOffset = offsets.length === 0 ? -8.5 : offsets[Math.floor(offsets.length / 2)];

  // Pass 2: per-shot labels. Order matters: the card panel (frames 226-241),
  // then the sky-alpha ladder (188-222), then the glow disc, then the
  // wordmark box for the early frames (133-147, before the disc is on stage).
  const labeled = [];
  for (const shot of shots) {
    if (shot.features.boardVisible) continue;
    // The looping-burst sample is not a timeline frame (the main timeline is
    // stopped at 241 while the sprite keeps looping) — recorded separately.
    if (shot.phase === 'loop') continue;
    if (shot.forcedFrame !== undefined) {
      labeled.push({ shot, frame: shot.forcedFrame, stage: 'paused-enter', residual: 0 });
      continue;
    }
    const hit = { frame: null, stage: null, residual: null };
    if (shot.features.panelTop !== null) {
      let best = null;
      for (let f = 226; f <= 241; f += 1) {
        const predicted = formTy(f) - 114.5;
        const cost = Math.abs(shot.features.panelTop - predicted);
        if (best === null || cost < best.cost) best = { f, cost };
      }
      if (best !== null && best.cost <= 3) {
        hit.frame = best.f;
        hit.stage = 'panel';
        hit.residual = best.cost;
      }
    }
    const alpha = alphaOf(shot.features.sky.g);
    if (hit.frame === null && alpha < 0.985) {
      const sky = skyFrame(alpha);
      if (sky !== null) {
        hit.frame = sky.f;
        hit.stage = 'sky';
        hit.residual = sky.cost * 256;
      }
    }
    if (hit.frame === null && shot.features.sun !== null && shot.features.sunArea >= 60 && shot.features.sun.w >= 30 && shot.features.sun.w <= 130) {
      const bottom = Math.min(shot.features.sun.y + shot.features.sun.h, 236);
      let best = null;
      for (let f = 133; f <= 222; f += 1) {
        const predicted = glowTy(f) + 46.75 + bottomOffset;
        const cost = Math.abs(bottom - predicted);
        if (best === null || cost < best.cost) best = { f, cost };
      }
      if (best !== null && best.cost <= 4) {
        hit.frame = best.f;
        hit.stage = 'glow-bottom';
        hit.residual = best.cost;
      }
    }
    if (hit.frame === null && shot.features.logo !== null && shot.features.logoArea >= 200) {
      let best = null;
      for (let f = 133; f <= 157; f += 1) {
        const rec = logoFrame(f);
        const predictedY = rec.ty - rec.s * 52.3;
        const cost = Math.abs(shot.features.logo.y - predictedY);
        if (best === null || cost < best.cost) best = { f, cost };
      }
      if (best !== null && best.cost <= 3) {
        hit.frame = best.f;
        hit.stage = 'logo';
        hit.residual = best.cost;
      }
    }
    labeled.push({ shot, ...hit });
  }
  return { labeled, calibration: { dayGreen, nightGreen, bottomOffset, offsetSamples: offsets.length } };
}

// --- server -----------------------------------------------------------------
function portFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.on('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(true));
    socket.setTimeout(600, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

async function startServer(outDir) {
  if (!(await portFree(PORT))) throw new Error(`port ${PORT} in use`);
  const logPath = path.join(outDir, 'server.log');
  const fd = fs.openSync(logPath, 'w');
  const child = spawn('python3', [path.join(REPO, 'verify/reference/server.py'), String(PORT)], {
    stdio: ['ignore', fd, fd],
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(URL);
      if (res.ok) return { child, logPath };
    } catch {
      /* wait */
    }
    await sleep(200);
  }
  child.kill('SIGTERM');
  throw new Error('reference server did not start');
}

function readLog(logPath, offset) {
  const size = fs.statSync(logPath).size;
  if (size <= offset) return { text: '', size };
  const buf = Buffer.alloc(size - offset);
  const fd = fs.openSync(logPath, 'r');
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  return { text: buf.toString('utf8'), size };
}

async function waitForLog(logPath, offset, pattern, timeoutMs) {
  const started = Date.now();
  let cursor = offset;
  while (Date.now() - started < timeoutMs) {
    const { text, size } = readLog(logPath, cursor);
    cursor = size;
    const line = text.split('\n').find((l) => pattern.test(l));
    if (line !== undefined) return { matched: true, waitedMs: Date.now() - started, line };
    await sleep(200);
  }
  return { matched: false, waitedMs: Date.now() - started };
}

// --- capture ----------------------------------------------------------------
async function shot(page) {
  return page.locator('#stage canvas').screenshot();
}

async function playFor(page, ms) {
  await page.evaluate(async (duration) => {
    const player = document.getElementById('ruffle');
    if (player === null) return;
    player.play();
    await new Promise((resolve) => setTimeout(resolve, duration));
    player.pause();
    const playButton = player.shadowRoot?.getElementById('play-button');
    if (playButton instanceof HTMLElement) playButton.style.display = 'none';
  }, Math.max(0, ms));
  await sleep(35);
}

async function resume(page) {
  await page.evaluate(() => {
    if (window.__y10Pauser !== undefined) {
      clearInterval(window.__y10Pauser);
      window.__y10Pauser = undefined;
    }
    document.getElementById('ruffle')?.play();
    const playButton = document.getElementById('ruffle')?.shadowRoot?.getElementById('play-button');
    if (playButton instanceof HTMLElement) playButton.style.display = 'none';
  });
}

/**
 * Continuous page-side pauser (5 ms): the SWF's own `play()` calls override a
 * single API pause; re-pausing keeps the displayed frame under driver control
 * so the frame-132 state can be captured exactly after the completion ENTER.
 */
async function armPauser(page) {
  await page.evaluate(() => {
    const player = document.getElementById('ruffle');
    if (window.__y10Pauser !== undefined) clearInterval(window.__y10Pauser);
    window.__y10Pauser = setInterval(() => {
      if (player !== null && player.isPlaying) player.pause();
      const playButton = player?.shadowRoot?.getElementById('play-button');
      if (playButton instanceof HTMLElement) playButton.style.display = 'none';
    }, 5);
  });
}

async function clearPauser(page) {
  await page.evaluate(() => {
    if (window.__y10Pauser !== undefined) {
      clearInterval(window.__y10Pauser);
      window.__y10Pauser = undefined;
    }
  });
}

async function waitStable(page, { samples = 3, intervalMs = 150, timeoutMs = 8000 } = {}) {
  const started = Date.now();
  let previous = null;
  let streak = 0;
  while (Date.now() - started < timeoutMs) {
    const current = await shot(page);
    streak = previous !== null && current.equals(previous) ? streak + 1 : 1;
    if (streak >= samples) return { stable: true, elapsedMs: Date.now() - started };
    previous = current;
    await sleep(intervalMs);
  }
  return { stable: false, elapsedMs: Date.now() - started };
}

/**
 * Focus the reference player and dismiss Ruffle's hardware-acceleration notice
 * (it appears on the first `mouseover` with a software WebGL adapter — the C3
 * pattern: move, close through its own button, DOM-hide fallback), then click
 * the stage once so the SWF receives the keyboard (the C3 focus click).
 * Without this the reference drops every keystroke.
 */
async function ensureReferenceFocus(page) {
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
  let method = state.open ? 'open' : 'not-shown';
  if (state.open) {
    const rect = await page.evaluate(() => {
      const btn = document.querySelector('ruffle-player')?.shadowRoot?.querySelector('#hardware-acceleration-modal .close-modal');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (rect !== null) {
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
  await page.mouse.click(275, 30);
  await sleep(200);
  return { ...state, method, focusClick: true };
}

async function runSession(browser, log) {
  const context = await browser.newContext({
    viewport: { width: STAGE.width, height: STAGE.height },
    deviceScaleFactor: DSF,
  });
  const page = await context.newPage();
  const session = { startedAt: new Date().toISOString(), shots: 0, consoleErrors: [] };
  log.sessions.push(session);
  page.on('console', (m) => {
    if (m.type() === 'error') session.consoleErrors.push(m.text());
  });
  const shots = [];
  const missing = new Set();
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#stage canvas', { timeout: 30000 });
    await page.evaluate(() => {
      const playButton = document.getElementById('ruffle')?.shadowRoot?.getElementById('play-button');
      if (playButton instanceof HTMLElement) playButton.style.display = 'none';
    });
    // 1. Wait for the round to load (server log xml64.php 200 + stable frame).
    const boardWait = await waitForLog(log.logPath, 0, /xml64\.php[^\n]*-> 200/, 60000);
    if (!boardWait.matched) throw new Error('reference round did not load (no xml64.php 200)');
    await waitStable(page, { timeoutMs: 45000 });
    session.boardWaitMs = boardWait.waitedMs;
    session.focus = await ensureReferenceFocus(page);
    // 2. Replay the F2 completion keys (the committed sequence that reaches
    //    the hiscore form); everything up to and including the final ENTER.
    let finalEnterIndex = -1;
    for (let i = SCENARIO.steps.length - 1; i >= 0; i -= 1) {
      const step = SCENARIO.steps[i];
      if (step.action === 'key' && String(step.key).toUpperCase() === 'ENTER') {
        finalEnterIndex = i;
        break;
      }
    }
    if (finalEnterIndex === -1) throw new Error('scenario has no ENTER step');
    session.keySteps = finalEnterIndex + 1;
    for (const [index, step] of SCENARIO.steps.entries()) {
      if (index > finalEnterIndex) break;
      if (step.action === 'key') {
        const physical = scenarioKeyToPhysical(step.key, missing);
        if (physical !== null) {
          if (index === finalEnterIndex) {
            // The completion ENTER must be processed while the player is
            // playing (Ruffle queues input per SWF frame); the pauser is then
            // armed immediately so the movie stops on the board-clear frame.
            await clearPauser(page);
            await page.evaluate(() => document.getElementById('ruffle')?.play());
            await sleep(30);
            await page.keyboard.press(physical);
            await armPauser(page);
          } else {
            await page.keyboard.press(physical);
          }
          // Ruffle processes input per SWF frame (27.8 ms): keep keys apart
          // so no keystroke is dropped (the F2 engine's per-step overhead
          // effectively did the same).
          await sleep(45);
        }
      } else if (step.action === 'waitMs') {
        await sleep(Math.min(Number(step.ms) || 0, 60));
      } else if (step.action === 'waitForState' && step.condition === 'entry-cleared') {
        // The scenario synchronizes each submit on the entry row clearing
        // (the wordball slide, 0.2 s). A fixed short wait keeps the replay
        // fast (the reference's 200 s clock must not run out; screenshots at
        // dsf2 are too slow for a stable-frame wait here).
        await sleep(140);
      }
      if (index === finalEnterIndex) {
        await sleep(140);
        let raw = await shot(page);
        let features = measure(decodePng(raw), DSF);
        // If the paused player did not process the ENTER, re-send it the same
        // way (resume, press, re-arm the pauser).
        for (let attempt = 0; attempt < 3 && features.boardVisible; attempt += 1) {
          await clearPauser(page);
          await page.evaluate(() => document.getElementById('ruffle')?.play());
          await sleep(30);
          await page.keyboard.press('Enter');
          await armPauser(page);
          await sleep(180);
          raw = await shot(page);
          features = measure(decodePng(raw), DSF);
        }
        if (features.boardVisible) {
          // A session that misses the completion ENTER (input dropped under
          // load) is retried by the session loop; the shot is kept for
          // diagnostics only.
          fs.mkdirSync(path.join(REPO, 'artifacts/y10-scratch'), { recursive: true });
          fs.writeFileSync(path.join(REPO, 'artifacts/y10-scratch/ref-fail-132.png'), raw);
          session.error = 'frame-132 capture: board still visible after the completion ENTER';
          return session;
        }
        session.frame132 = {
          boardVisible: features.boardVisible,
          sky: features.sky,
          logo: features.logo,
          sunVisible: features.sun !== null,
          panelTop: features.panelTop,
        };
        shots.push({ phase: 'paused-132', raw, features, forcedFrame: 132 });
        fs.writeFileSync(path.join(OUT, 'frame-132.png'), raw);
        session.frame132Sha256 = hash(raw);
      }
    }
    // 4. Step one frame per play/pause pair, screenshotting each step.
    await clearPauser(page);
    for (let step = 0; step < MAX_STEPS; step += 1) {
      await playFor(page, 1000 * frame);
      const raw = await shot(page);
      shots.push({ phase: `step-${step}`, raw, features: measure(decodePng(raw), DSF) });
    }
    // 5. Let the movie run: DefineSprite_170 has 65 frames and no `stop()`,
    //    so the burst loops every 65/36 s (the frame-65 script removes the
    //    duplicates, frame 1 re-creates them at a new random position). Sample
    //    the spark ink for ~4 s (more than two cycles) — a "settled" end
    //    screen does not exist in the reference — and keep the last shot.
    await resume(page);
    const loop = { playing: false, samples: [], cycles: [] };
    const loopStart = Date.now();
    while (Date.now() - loopStart < 4200) {
      loop.playing = await page.evaluate(() => document.getElementById('ruffle')?.isPlaying === true);
      const current = await shot(page);
      loop.samples.push({ tMs: Date.now() - loopStart, ink: Math.round(sparkInk(decodePng(current), DSF)) });
      loop.last = current;
      await sleep(240);
    }
    const rawLoop = loop.last;
    delete loop.last;
    session.loop = { ...loop, endFeatures: measure(decodePng(rawLoop), DSF) };
    shots.push({ phase: 'loop', raw: rawLoop, features: session.loop.endFeatures });
  } finally {
    await context.close();
  }
  session.shots = shots.length;
  session.missingKeys = [...missing];
  // Keep the newest shots for labeling (the burst is ~130 frames long; older
  // sessions only extend coverage).
  log.shots.push(...shots);
  return session;
}

function serializable(log) {
  return {
    ...log,
    shots: undefined,
    best: Object.fromEntries(
      Object.entries(log.best).map(([frame, best]) => [frame, { ...best, raw: undefined }]),
    ),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer(OUT);
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  const log = {
    schemaVersion: 1,
    task: 'Y10',
    kind: 'reference-celebration-capture',
    label: RUN_LABEL,
    deviceScaleFactor: DSF,
    targets: TARGETS,
    startedAt: new Date().toISOString(),
    launchArgs: ['--mute-audio'],
    harness: {
      server: 'verify/reference/server.py',
      ruffle: 'verify/reference/ruffle/web (0.6.0 self-hosted)',
      fixture: 'verify/reference/fixtures/xml64.base64.php',
      scenario: 'tests/fixtures/reference/playthrough/scenarios/playthrough.json',
      swf: '../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf',
    },
    logPath: path.relative(REPO, server.logPath),
    sessions: [],
    shots: [],
    best: {},
    captures: [],
  };
  try {
    for (let session = 1; session <= MAX_SESSIONS; session += 1) {
      const info = await runSession(browser, log);
      console.log(
        `[Y10 ref] ${RUN_LABEL} session ${session}: ${info.shots} shots, frame132=`,
        JSON.stringify(info.frame132),
      );
      // The loop sample's sky is the final frame-241 sky (alpha 36/256); it
      // calibrates the night backdrop's green.
      const loopShot = log.shots.filter((s) => s.phase === 'loop').pop();
      if (loopShot !== undefined) {
        const { labeled, calibration } = labelAll(log.shots, loopShot);
        log.calibration = calibration;
        for (const { shot, frame: frameNo, stage, residual } of labeled) {
          if (frameNo === null || frameNo < WIN_START || frameNo > WIN_END) continue;
          const existing = log.best[String(frameNo)];
          if (existing === undefined || residual < existing.residual) {
            log.best[String(frameNo)] = {
              frame: frameNo,
              stage,
              residual: Number(residual.toFixed(3)),
              sha256: hash(shot.raw),
              raw: shot.raw,
              phase: shot.phase,
            };
          }
        }
      }
      const covered = TARGETS.filter((t) => log.best[String(t)] !== undefined);
      fs.writeFileSync(path.join(OUT, 'capture-report.json'), `${JSON.stringify(serializable(log), null, 2)}\n`);
      if (covered.length === TARGETS.length) break;
    }
    const missing = [];
    for (const target of TARGETS) {
      const best = log.best[String(target)];
      if (best === undefined) {
        missing.push(target);
        continue;
      }
      const name = `frame-${String(target).padStart(3, '0')}`;
      const file = path.join(OUT, `${name}.png`);
      fs.writeFileSync(file, best.raw);
      log.captures.push({
        target,
        name,
        file: path.relative(REPO, file),
        measuredFrame: best.frame,
        stage: best.stage,
        residual: best.residual,
        sha256: best.sha256,
        phase: best.phase,
        width: decodePng(best.raw).width,
        height: decodePng(best.raw).height,
      });
      console.log(
        `[Y10 ref] ${RUN_LABEL} frame ${target}: measured ${best.frame} (${best.stage}, residual ${best.residual}) ${best.sha256.slice(0, 12)}`,
      );
    }
    // Looping-burst sample (sprite 170 keeps re-creating the fireworks; the
    // main timeline stays stopped at 241).
    const loopShot = log.shots.filter((s) => s.phase === 'loop').pop();
    if (loopShot !== undefined) {
      const raw = loopShot.raw;
      fs.writeFileSync(path.join(OUT, 'frame-241-loop.png'), raw);
      log.captures.push({
        target: 241,
        name: 'frame-241-loop',
        file: path.relative(REPO, path.join(OUT, 'frame-241-loop.png')),
        measuredFrame: 241,
        stage: 'loop',
        residual: 0,
        sha256: hash(raw),
        features: loopShot.features,
        width: decodePng(raw).width,
        height: decodePng(raw).height,
      });
    }
    log.endedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'capture-report.json'), `${JSON.stringify(serializable(log), null, 2)}\n`);
    const logLine = `==== ${RUN_LABEL} ${new Date().toISOString()} out=${path.relative(REPO, OUT)} ` +
      log.captures.map((c) => `${c.name}@${c.measuredFrame}:${c.sha256.slice(0, 12)}`).join(' ') + '\n';
    fs.appendFileSync(path.join(REPO, 'evidence/logs/Y10-reference-capture.log'), logLine);
    console.log(
      `[Y10 ref] ${RUN_LABEL}: ${log.captures.length} captures written to ${path.relative(REPO, OUT)}` +
        (missing.length > 0 ? ` (MISSING frames: ${missing.join(',')})` : ''),
    );
    if (missing.length > 0) process.exitCode = 1;
  } catch (error) {
    log.error = String(error instanceof Error ? error.message : error);
    console.error(`[Y10 ref] ${RUN_LABEL} FAILED: ${log.error}`);
    fs.writeFileSync(path.join(OUT, 'capture-report.json'), `${JSON.stringify(serializable(log), null, 2)}\n`);
    throw error;
  } finally {
    log.endedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'capture-report.json'), `${JSON.stringify(serializable(log), null, 2)}\n`);
    await browser.close();
    server.child.kill('SIGTERM');
  }
}

await main();
