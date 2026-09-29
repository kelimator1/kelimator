#!/usr/bin/env node
/* global document, window, HTMLElement */
/**
 * tests/e2e/intro/capture-intro-reference.mjs — Y8/O23 reference captures of
 * the boot intro (task Y8; extends the C3 scenario pattern).
 *
 * The C3 scenario engine (verify/reference/capture.mjs) captures at step
 * boundaries (waitForState/waitMs) and cannot pin a *frame* of the intro: the
 * intro runs between the preloader and the board and has no state trigger
 * (evidence/E3-animations.md §3 rows 1–2/5–6, the O23 gap). This driver uses
 * the same harness ingredients — `verify/reference/server.py`, the pinned
 * Ruffle 0.6.0 web build, the reconstructed Base64(UTF-8) fixture, muted
 * Chromium — and captures the intro in a tight screenshot loop while the movie
 * plays, then measures every capture against the main-timeline tracks
 * (evidence/logs/Y8-intro-series.json, extracted from tags.xml) and keeps the
 * best capture per target frame:
 *
 *   1. per screenshot, measure the SWF-visible state: the sun disc edges
 *      (warm-pixel blob), the wordmark union box, the sky alpha ramp, the
 *      preloader bar / board probes;
 *   2. estimate the displayed SWF frame from those measurements (calibrated
 *      sun-edge offsets, occlusion-aware);
 *   3. keep the capture whose measured frame equals the target (ties → the
 *      smaller measurement residual).
 *
 * Reference frames captured (the `intro` sequence keyframes of
 * data/animation.json): 5, 36, 68, 99, 130 — the same offsets the app suite
 * drives to (tests/e2e/intro/intro.spec.ts). Sessions repeat until every
 * target is covered; running two sessions into separate output directories
 * gives the byte-identity stability record (`--stability`).
 *
 * Usage:
 *   node tests/e2e/intro/capture-intro-reference.mjs --dsf 1 --out <dir>
 *   node tests/e2e/intro/capture-intro-reference.mjs --dsf 2 --out <dir>
 *
 * Silent witness runs (EXECUTION.md §8): Chromium launches with `--mute-audio`;
 * no Ruffle CLI; no network beyond 127.0.0.1.
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

// --- CLI --------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const DSF = Number(opt('--dsf', '1'));
const OUT = path.resolve(REPO, opt('--out', 'artifacts/y8-captures/reference-dsf1'));
const PORT = Number(opt('--port', '8802'));
const RUN_LABEL = opt('--label', `dsf${DSF}`);
const URL = `http://127.0.0.1:${PORT}/`;
const TARGETS = opt('--targets', '5,36,68,99,130')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));
const SESSION_SECONDS = Number(opt('--session-seconds', '8'));
const MAX_SESSIONS = Number(opt('--max-sessions', '8'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (buf) => createHash('sha256').update(buf).digest('hex');

// --- main-timeline series (evidence/logs/Y8-intro-series.json) ---------------
const SERIES = JSON.parse(
  fs.readFileSync(path.join(REPO, 'evidence/logs/Y8-intro-series.json'), 'utf8'),
);
const SUN_CENTER_X = 260.1; // twips 5202/20
const SUN_RADIUS = 46.75; // shape 20 SVG (93.5/2)
// The sun disc is measured only above the ground's top edge (240.7): the
// golden intro_layer3 (SWF ch8) reaches the warm threshold once its alpha is
// near full (~frame 38) and would otherwise merge into the blob. 236 keeps a
// 4.7 px safety gap; the disc's visible bottom edge (when above the ground)
// is unaffected.
const SUN_BAND_BOTTOM = 236;
// Day-sky green channel at the probe point (500,60) at full fade (77,157,213):
// measured identically in tests/fixtures/reference/S1-boot.png (+dsf2), the
// owner capture artifacts/o23-captures/frames/f69.png and the C3 board
// captures — the alpha ramp is read as green/157.
const DAY_GREEN_AT_PROBE = 157;
// Preloader progress bar (SWF ch12, layout x 169.3 y 176.85 w 201.1 h 6):
// present on frames 2–4 and removed before the `main` intro (tags.xml
// RemoveObject2 depth 11 at frame 4; owner capture o23 f38+ shows no bar).
// Measured bar fill colour (255,102,51), empty track (255,255,204).
const BAR_BAND = { x0: 150, x1: 400, y0: 170, y1: 190 };

function glowTrack(frame) {
  const rec = SERIES.glow[String(Math.max(5, Math.min(129, frame)))];
  return { y: rec.ty / 20, mult: rec.mult };
}
function logoBox(frame) {
  if (frame < 41) return null;
  const rec = SERIES.logo[String(Math.max(41, Math.min(130, frame)))];
  const s = rec.s;
  const cx = rec.tx / 20;
  const cy = rec.ty / 20;
  const w = 375.4 * s;
  const h = 104.6 * s;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function skyAlpha(frame) {
  const f = String(Math.max(5, Math.min(130, frame)));
  return SERIES.skyAlpha[f] / 256;
}
function sunBox(frame) {
  const track = glowTrack(frame);
  return {
    top: track.y - SUN_RADIUS,
    bottom: track.y + SUN_RADIUS,
    cx: SUN_CENTER_X,
  };
}

// --- image measurements (CSS-pixel space) -----------------------------------
/** Largest connected component of `mask` inside the scaled band. */
function blobOf(img, mask, scale, band) {
  const x0 = Math.max(0, Math.floor(band.x0 * scale));
  const x1 = Math.min(img.width, Math.ceil(band.x1 * scale));
  const y0 = Math.max(0, Math.floor(band.y0 * scale));
  const y1 = Math.min(img.height, Math.ceil(band.y1 * scale));
  const seen = new Uint8Array(img.width * img.height);
  let best = null;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const start = y * img.width + x;
      if (seen[start] === 1) continue;
      if (!mask(img, x, y)) continue;
      // Flood fill (4-neighbour) with an explicit stack.
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
        const neighbours = [
          index - img.width,
          index + img.width,
          px > 0 ? index - 1 : -1,
          px + 1 < img.width ? index + 1 : -1,
        ];
        for (const next of neighbours) {
          if (next < 0 || next >= seen.length || seen[next] === 1) continue;
          const nx = next % img.width;
          const ny = (next - nx) / img.width;
          if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
          if (!mask(img, nx, ny)) continue;
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

/** Bounding box of all `mask` pixels in the scaled band (wordmark ink union). */
function maskUnion(img, mask, scale, band) {
  const x0 = Math.max(0, Math.floor(band.x0 * scale));
  const x1 = Math.min(img.width, Math.ceil(band.x1 * scale));
  const y0 = Math.max(0, Math.floor(band.y0 * scale));
  const y1 = Math.min(img.height, Math.ceil(band.y1 * scale));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
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

const barMask = (img, x, y) => {
  // bar fill (255,102,51)
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return r >= 240 && g >= 60 && g <= 140 && b <= 80;
};
const barTrackMask = (img, x, y) => {
  // empty bar track (255,255,204): the fill starts at 0 % and grows, so the
  // track alone must identify the preloader frames too (stars/moon are
  // 255,255,222 — outside this blue band).
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return r >= 250 && g >= 250 && b >= 190 && b <= 215;
};
const sunMask = (img, x, y) => {
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

function sampleColor(img, scale, cx, cy) {
  const x = Math.round(cx * scale);
  const y = Math.round(cy * scale);
  const i = (y * img.width + x) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
}

function contentFraction(img) {
  let content = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    if (min < 240 && max > 16) content += 1;
  }
  return content / (img.width * img.height);
}

/**
 * Board-state probe (SWF frame 131+): the round board covers the intro sky at
 * stage (40,120) — white word-list field / yellow panel (S2-idle-board.png
 * probes (255,255,255)/(213,185,87)) while every intro frame 5–130 is sky
 * there (blue: b > r; the moon (50..87, 37..87), the falling logo (x ≥ 80 at
 * y 120) and the sun (x ≥ 213) never reach the point).
 */
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

/** Measure the SWF-visible features of one stage image (CSS px). */
function measure(img, scale) {
  const sun = blobOf(img, sunMask, scale, { x0: 190, x1: 340, y0: 0, y1: SUN_BAND_BOTTOM });
  const bar = blobOf(img, barMask, scale, { ...BAR_BAND });
  const barTrack = blobOf(img, barTrackMask, scale, { ...BAR_BAND });
  const barFillArea = bar === null ? 0 : bar.area;
  const barTrackArea = barTrack === null ? 0 : barTrack.area;
  const barProgress = barFillArea + barTrackArea > 0 ? barFillArea / (barFillArea + barTrackArea) : 0;
  // Wordmark: union bbox (the glyphs may not form one connected blob).
  const logo = maskUnion(img, logoMask, scale, { x0: 0, x1: 280, y0: 0, y1: 190 });
  const sky = sampleColor(img, scale, 500, 60);
  const board = boardProbe(img, scale);
  return {
    contentFraction: contentFraction(img),
    boardVisible: board.b <= board.r + 10,
    barVisible: barFillArea >= 30 || barTrackArea >= 200,
    barProgress,
    sun: sun === null ? null : sun.box,
    sunArea: sun === null ? 0 : sun.area,
    logo: logo === null ? null : logo.box,
    logoArea: logo === null ? 0 : logo.area,
    sky,
    skyAlpha: DAY_GREEN_AT_PROBE > 0 ? sky.g / DAY_GREEN_AT_PROBE : null,
  };
}

/**
 * Displayed-frame estimate from measured features (null when no game content).
 *
 * The sun disc (frames 5–124) is the strongest signal; the falling logo can
 * occlude one of its edges, so each edge is only compared when the logo box
 * predicted for that candidate frame leaves it visible. The warm-pixel blob is
 * the disc's saturated core, so the measured edges carry small systematic
 * offsets: the warm threshold cuts inside the disc's rim, so the measured top
 * edge sits ≈ +7 px below the geometric top and the bottom edge ≈ −8.5 px above
 * the geometric bottom at the mid-intro tint (derived in evidence/Y8-intro.md
 * §3.1 and validated against the sky alpha ramp, which labels frames 5–41
 * offset-free). A blob much wider than the 93.5 px disc is the merged
 * sun+logo shape and is rejected. Falling/settled wordmark boxes cover frames
 * 41–130; the top-left board position (frames ≥ 112) is the only fully-in-band
 * logo state. The sky alpha ramp discriminates frames 5–41 when no blob is
 * measurable.
 */
function estimateFrame(features, offsets) {
  if (features.contentFraction < 0.2) return null;
  // Preloader frames 2–4 (progress bar visible): not an intro frame yet.
  if (features.barVisible === true) return null;
  // Board state (frame 131+): past the `intro` span entirely.
  if (features.boardVisible === true) return null;
  const topOffset = offsets?.top ?? 7;
  const bottomOffset = offsets?.bottom ?? -8.5;
  // Stage 1: sun disc edges (strongest; clean for every target frame).
  if (features.sun !== null && features.sunArea >= 60 && features.sun.w >= 30 && features.sun.w <= 130) {
    let best = null;
    for (let frame = 5; frame <= 125; frame += 1) {
      const predicted = sunBox(frame);
      const logo = logoBox(frame);
      const top = Math.max(predicted.top, 0);
      const bottom = Math.min(predicted.bottom, SUN_BAND_BOTTOM);
      if (bottom <= 0 || top >= SUN_BAND_BOTTOM) continue; // sun not visible
      // An edge is occluded only when the predicted logo box actually covers
      // it; a logo entirely above/below the disc leaves both edges visible.
      const coversTop =
        logo !== null && logo.y <= predicted.top && logo.y + logo.h > predicted.top;
      const coversBottom =
        logo !== null && logo.y <= predicted.bottom && logo.y + logo.h >= predicted.bottom;
      let cost = 0;
      let terms = 0;
      if (!coversTop && predicted.top > 0) {
        cost += Math.abs(Math.max(features.sun.y, 0) - (predicted.top + topOffset));
        terms += 1;
      }
      if (!coversBottom && predicted.bottom < SUN_BAND_BOTTOM) {
        cost += Math.abs(
          Math.min(features.sun.y + features.sun.h, SUN_BAND_BOTTOM) -
            (predicted.bottom + bottomOffset),
        );
        terms += 1;
      }
      if (terms === 0) continue;
      const score = cost / terms;
      if (best === null || score < best.cost) best = { frame, cost: score };
    }
    if (best !== null && best.cost <= 4) {
      const sunFrame = best.frame;
      // Frames 5–41: validate against the offset-free sky-alpha ruler and
      // prefer it when the two disagree (the sun-edge offsets vary with the
      // tint + sky brightness; the sky ramp is quantitative).
      if (features.skyAlpha !== null && sunFrame <= 44) {
        let skyBest = null;
        for (let frame = 5; frame <= 41; frame += 1) {
          const cost = Math.abs(features.skyAlpha - skyAlpha(frame)) * 256;
          if (skyBest === null || cost < skyBest.cost) skyBest = { frame, cost };
        }
        if (skyBest !== null && skyBest.cost <= 2) {
          return { frame: skyBest.frame, stage: 'sky', residual: skyBest.cost };
        }
      }
      return { frame: sunFrame, stage: 'sun', residual: best.cost };
    }
  }
  // Stage 2: fully visible wordmark box (top-left board position, ≥ 112).
  if (features.logo !== null && features.logoArea >= 300) {
    let best = null;
    for (let frame = 41; frame <= 130; frame += 1) {
      const predicted = logoBox(frame);
      if (
        predicted === null ||
        predicted.y < 0 ||
        predicted.y + predicted.h > 190 ||
        predicted.x < 0 ||
        predicted.x + predicted.w > 280
      ) {
        continue;
      }
      const cost =
        Math.abs(features.logo.x - predicted.x) +
        Math.abs(features.logo.y - predicted.y) +
        Math.abs(features.logo.w - predicted.w) +
        Math.abs(features.logo.h - predicted.h);
      if (best === null || cost < best.cost) best = { frame, cost };
    }
    if (best !== null && best.cost <= 20) return { frame: best.frame, stage: 'logo', residual: best.cost };
  }
  // Stage 3: sky alpha ramp (frames 5..41).
  if (features.skyAlpha !== null) {
    let best = null;
    for (let frame = 5; frame <= 41; frame += 1) {
      const cost = Math.abs(features.skyAlpha - skyAlpha(frame)) * 256;
      if (best === null || cost < best.cost) best = { frame, cost };
    }
    if (best !== null && best.cost <= 3) return { frame: best.frame, stage: 'sky', residual: best.cost };
  }
  return null;
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
  fs.appendFileSync(
    logPath,
    `==== Y8 reference capture ${new Date().toISOString()} port=${PORT} dsf=${DSF} ====\n`,
  );
  const child = spawn('python3', [path.join(REPO, 'verify/reference/server.py'), String(PORT)], {
    stdio: ['ignore', fd, fd],
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(URL);
      if (res.ok) return child;
    } catch {
      /* wait */
    }
    await sleep(200);
  }
  child.kill('SIGTERM');
  throw new Error('reference server did not start');
}

// --- capture ----------------------------------------------------------------
/** Screenshot the SWF canvas (excludes Ruffle's DOM chrome, e.g. its splash). */
async function shot(page) {
  return page.locator('#stage canvas').screenshot();
}

/**
 * Play for `ms` and pause again with the timer inside the page: the play/pause
 * pair has no driver round-trip latency between it, so the SWF advances
 * ≈ ms / (1/36 s) frames (paused time does not accumulate).
 */
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
  await sleep(40);
}

/**
 * Frame 5 (`main` debut) capture. The reference resumes the preloader loop only
 * when the MochiAds timeout fires (`ad_timeout: 3000`; the ad fetch itself is
 * blocked by Ruffle) and the resume skips straight to frame 6 in this player,
 * so frame 5 is only observable paused: pause on the preloader bar, then step
 * in sub-frame increments (10 ms < 1/36 s) until the night sky's frame-5 alpha
 * is measured. Returns the paused capture or null.
 */
async function captureFrame5(page, log) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    // Continuous page-side pauser: the SWF's own `play()` calls (frame-4
    // preloader script, MochiAds timeout callback) override a single API pause
    // and the timeline then races ahead; re-pausing every few ms keeps the
    // displayed frame under driver control so frame 5 can be observed.
    await page.evaluate(() => {
      const player = document.getElementById('ruffle');
      if (window.__y8Pauser !== undefined) clearInterval(window.__y8Pauser);
      window.__y8Pauser = setInterval(() => {
        if (player !== null && player.isPlaying) player.pause();
        const playButton = player?.shadowRoot?.getElementById('play-button');
        if (playButton instanceof HTMLElement) playButton.style.display = 'none';
      }, 5);
    });
    await sleep(120);
    for (let step = 0; step < 300; step += 1) {
      const raw = await shot(page);
      const features = measure(decodePng(raw), DSF);
      if (!features.barVisible && features.contentFraction >= 0.2 && !features.boardVisible) {
        const estimate = estimateFrame(features, log.calibration);
        if (estimate !== null && estimate.frame === 5) {
          return { raw, features, estimate };
        }
        if (estimate !== null && estimate.frame > 5) break; // overshot
      }
      await playFor(page, 10);
    }
    console.log(`[Y8 ref] ${RUN_LABEL} frame 5 attempt ${attempt}: overshot; retrying`);
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#stage canvas', { timeout: 30000 });
  }
  return null;
}

async function runSession(browser, log, sessionIndex) {
  const context = await browser.newContext({
    viewport: { width: STAGE.width, height: STAGE.height },
    deviceScaleFactor: DSF,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  const session = { startedAt: new Date().toISOString(), shots: 0, hits: [], consoleErrors };
  log.sessions.push(session);
  const shots = [];
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#stage canvas', { timeout: 30000 });
    // Ruffle shows its own play overlay only while paused; hide it defensively.
    await page.evaluate(() => {
      const player = document.getElementById('ruffle');
      const playButton = player?.shadowRoot?.getElementById('play-button');
      if (playButton instanceof HTMLElement) playButton.style.display = 'none';
    });
    // Frame 5 needs the paused capture (the ad gate skips it in this player);
    // then resume and capture the rest as fast as the driver allows (no inline
    // measurement: every shot is measured after the session so the cadence
    // stays at its minimum, ~1–2 SWF frames at dsf 1).
    if (log.best['5'] === undefined) {
      const captured5 = await captureFrame5(page, log);
      if (captured5 !== null) {
        log.best['5'] = {
          frame: 5,
          stage: captured5.estimate.stage,
          residual: Number(captured5.estimate.residual.toFixed(3)),
          sha256: hash(captured5.raw),
          raw: captured5.raw,
          features: captured5.features,
        };
        session.hits.push({ frame: 5, stage: captured5.estimate.stage, residual: log.best['5'].residual });
        console.log(`[Y8 ref] ${RUN_LABEL} frame 5 captured (paused, ${captured5.estimate.stage})`);
      }
    }
    await page.evaluate(() => {
      if (window.__y8Pauser !== undefined) clearInterval(window.__y8Pauser);
      document.getElementById('ruffle')?.play();
    });
    // Rotating phase offset so repeated sessions sample different frame
    // residues (the shot cadence is coarser than 1/36 s at dsf 2).
    await sleep((sessionIndex % 5) * 11);
    const deadline = Date.now() + SESSION_SECONDS * 1000;
    while (Date.now() < deadline && shots.length < 700) {
      shots.push(await shot(page));
    }
  } finally {
    await context.close();
  }
  session.shots = shots.length;
  // Measure every shot and keep the best candidate per frame.
  for (const raw of shots) {
    const features = measure(decodePng(raw), DSF);
    const estimate = estimateFrame(features, log.calibration);
    if (estimate === null) continue;
    const frame = estimate.frame;
    const existing = log.best[String(frame)];
    if (
      existing === undefined ||
      estimate.residual < existing.residual ||
      (estimate.residual === existing.residual && estimate.stage === 'sky' && existing.stage !== 'sky')
    ) {
      log.best[String(frame)] = {
        frame,
        stage: estimate.stage,
        residual: Number(estimate.residual.toFixed(3)),
        sha256: hash(raw),
        raw,
        features,
      };
      session.hits.push({
        frame,
        stage: estimate.stage,
        residual: Number(estimate.residual.toFixed(3)),
      });
    }
  }
  return session;
}

/** Report view without the captured-image buffers (`raw`). */
function serializable(log) {
  return {
    ...log,
    best: Object.fromEntries(
      Object.entries(log.best).map(([frame, best]) => [
        frame,
        { ...best, raw: undefined, sha256: best.sha256 },
      ]),
    ),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer(OUT);
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  const log = {
    schemaVersion: 1,
    task: 'Y8',
    kind: 'reference-intro-capture',
    label: RUN_LABEL,
    deviceScaleFactor: DSF,
    targets: TARGETS,
    startedAt: new Date().toISOString(),
    launchArgs: ['--mute-audio'],
    harness: {
      server: 'verify/reference/server.py',
      ruffle: 'verify/reference/ruffle/web (0.6.0 self-hosted)',
      fixture: 'verify/reference/fixtures/xml64.base64.php',
      swf: '../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf',
    },
    calibration: { top: 7, bottom: -8.5 },
    sessions: [],
    best: {},
    captures: [],
  };
  try {
    for (let session = 1; session <= MAX_SESSIONS; session += 1) {
      const covered = TARGETS.filter((target) => log.best[String(target)] !== undefined);
      if (covered.length === TARGETS.length) break;
      const info = await runSession(browser, log, session);
      console.log(
        `[Y8 ref] ${RUN_LABEL} session ${session}: ${info.shots} shots, hits ` +
          `${info.hits.map((hit) => hit.frame).join(',') || '—'}`,
      );
      fs.writeFileSync(
        path.join(OUT, 'capture-report.json'),
        `${JSON.stringify(serializable(log), null, 2)}\n`,
      );
    }
    // Select the target captures and write them out.
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
      const captured = {
        target,
        name,
        file: path.relative(REPO, file),
        measuredFrame: best.frame,
        stage: best.stage,
        residual: best.residual,
        sha256: best.sha256,
        width: decodePng(best.raw).width,
        height: decodePng(best.raw).height,
        features: {
          sun: best.features.sun,
          sky: best.features.sky,
          skyAlpha:
            best.features.skyAlpha === null ? null : Number(best.features.skyAlpha.toFixed(4)),
          logo: best.features.logo,
        },
      };
      log.captures.push(captured);
      console.log(
        `[Y8 ref] ${RUN_LABEL} frame ${target}: measured ${best.frame} (${best.stage}, ` +
          `residual ${best.residual}) ${best.sha256.slice(0, 12)} ${captured.width}x${captured.height}`,
      );
    }
    log.endedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(OUT, 'capture-report.json'),
      `${JSON.stringify(serializable(log), null, 2)}\n`,
    );
    fs.appendFileSync(
      path.join(REPO, 'evidence/logs/Y8-reference-capture.log'),
      `==== ${RUN_LABEL} ${new Date().toISOString()} out=${path.relative(REPO, OUT)} ` +
        log.captures
          .map((c) => `frame${c.target}@${c.measuredFrame}:${c.sha256.slice(0, 12)}`)
          .join(' ') +
        '\n',
    );
    console.log(
      `[Y8 ref] ${RUN_LABEL}: ${log.captures.length} captures written to ${path.relative(REPO, OUT)}` +
        (missing.length > 0 ? ` (MISSING frames: ${missing.join(',')})` : ''),
    );
    if (missing.length > 0) {
      log.missing = missing;
      process.exitCode = 1;
    }
  } catch (error) {
    log.error = String(error instanceof Error ? error.message : error);
    console.error(`[Y8 ref] ${RUN_LABEL} FAILED: ${log.error}`);
    throw error;
  } finally {
    log.endedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(OUT, 'capture-report.json'),
      `${JSON.stringify(serializable(log), null, 2)}\n`,
    );
    await browser.close();
    server.kill('SIGTERM');
  }
}

await main();
