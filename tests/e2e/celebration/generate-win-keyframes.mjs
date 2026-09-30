#!/usr/bin/env node
/**
 * tests/e2e/celebration/generate-win-keyframes.mjs — regenerate the Y10 win
 * timeline CSS blocks in src/styles/animations.css.
 *
 * Every number comes from evidence/logs/Y10-win-series.json (extracted from
 * artifacts/decompiled/tags.xml by tests/e2e/celebration/extract-win-series.py;
 * derivation in evidence/Y10-celebration.md). The blocks between the markers
 * `@y10-generated:begin` / `@y10-generated:end` are replaced in place; the
 * hand-written win-layer rules outside the markers are untouched.
 *
 * Conversions (same as task Y8, evidence/Y8-intro.md):
 *   - SWF frames are step-held at 36 fps: duration = frames / 36 s,
 *     keyframe percent = (frame - frameStart) / frames * 100;
 *   - glow: translateY = ty(frame) - ty(frame129) = ty + 59.9 (catalog y is
 *     the frame-129 display top);
 *   - logo: translate = (tx/20 - s*187.7, ty/20 - s*52.3) (the SWF sprite's
 *     registration point is the natural-box centre 375.4x104.6);
 *   - form: translateY = ty(frame) - 483.35 (the catalog box is the frame-222
 *     placement), opacity = alphaMultTerm / 256;
 *   - glow tint: opacity = 1 - redMultTerm/256, blend colour (255,103,51)
 *     (least-squares fit over the 133-222 move series, max |add-residual| 1);
 *   - spark: transform = matrix(scaleX, rotateSkew0, rotateSkew1, scaleY,
 *     tx/20, ty/20), colour = the sprite-168 frame (frame-1) colour, opacity =
 *     the sprite-169 frame alpha / 256.
 *
 * Usage: node tests/e2e/celebration/generate-win-keyframes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SERIES = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'evidence/logs/Y10-win-series.json'), 'utf8'),
);
const CSS_PATH = path.join(ROOT, 'src/styles/animations.css');

const START = 132;
const END = 241;
const FRAMES = END - START + 1; // 110
const pct = (frame) => (((frame - START) / FRAMES) * 100).toFixed(6);
const fmt = (value) => Number(value.toFixed(4));

const win = SERIES.win;

function block(name, body) {
  return `@keyframes ${name} {\n${body}\n}\n`;
}

function stops(entries) {
  return entries.map(([p, style]) => `  ${p}% { ${style} }`).join('\n');
}

// --- sky / layer3: per-frame opacity (116 stops: 132..241) -----------------
function alphaBlock(name, series) {
  const entries = [];
  for (let frame = START; frame <= END; frame += 1) {
    entries.push([pct(frame), `opacity: ${fmt(series[String(frame)] / 256)};`]);
  }
  // Explicit 100 % stop: without it the properties would revert to the
  // underlying values at the end of the animation (`fill: both`).
  entries.push(['100', `opacity: ${fmt(series[String(END)] / 256)};`]);
  return block(name, stops(entries));
}

// --- glow path: translateY (frames 133..222 + 241 hold) --------------------
const glowEntries = [['0', 'transform: translateY(0px);']];
for (let frame = 133; frame <= 222; frame += 1) {
  const ty = win.glow[String(frame)].ty;
  glowEntries.push([pct(frame), `transform: translateY(${fmt(ty + 59.9)}px);`]);
}
const glowFinal = `transform: translateY(${fmt(win.glow['222'].ty + 59.9)}px);`;
glowEntries.push([pct(241), glowFinal]);
glowEntries.push(['100', glowFinal]);
const glowBlock = block('e3-win-glow', stops(glowEntries));

// --- glow tint: opacity = 1 - redMultTerm/256 (frames 133..222) ------------
const tintEntries = [['0', 'opacity: 0;']];
for (let frame = 133; frame <= 222; frame += 1) {
  const mult = win.glow[String(frame)].mult;
  tintEntries.push([pct(frame), `opacity: ${fmt(1 - mult / 256)};`]);
}
const tintFinal = `opacity: ${fmt(1 - win.glow['222'].mult / 256)};`;
tintEntries.push(['100', tintFinal]);
const tintBlock = block('e3-win-glow-tint', stops(tintEntries));

// --- logo: translate + scale; removed at frame 203 -------------------------
const LOGO_RX = 187.7;
const LOGO_RY = 52.3;
function logoTransform(frame) {
  const rec = win.logo[String(frame)];
  // The series stores stage px (twips/20): the sprite's registration point is
  // the natural-box centre, so the top-left translate is tx - s*187.7.
  const x = fmt(rec.tx - rec.s * LOGO_RX);
  const y = fmt(rec.ty - rec.s * LOGO_RY);
  return `transform: translate(${x}px, ${y}px) scale(${Number(rec.s.toFixed(7))});`;
}
const logoEntries = [[pct(132), `${logoTransform(132)} visibility: visible;`]];
for (let frame = 133; frame <= 202; frame += 1) {
  logoEntries.push([pct(frame), logoTransform(frame)]);
}
// Reference frame 203 removes the wordmark; keep the frame-202 transform in
// the hidden/100 % stops so the removal does not snap the transform back.
const logoHidden = `${logoTransform(202)} visibility: hidden;`;
logoEntries.push([pct(203), logoHidden]);
logoEntries.push(['100', logoHidden]);
const logoBlock = block('e3-win-logo', stops(logoEntries));

// --- form: translateY + opacity (frames 222..241) --------------------------
function formTransform(frame) {
  const rec = win.form[String(frame)];
  return `transform: translateY(${fmt(rec.ty - 483.35)}px);`;
}
function formOpacity(frame) {
  const rec = win.form[String(frame)];
  const alpha = rec.alpha ?? 256;
  return `opacity: ${fmt(alpha / 256)};`;
}
const formEntries = [['0', `${formTransform(222)} ${formOpacity(222)}`]];
for (let frame = 223; frame <= 241; frame += 1) {
  formEntries.push([pct(frame), `${formTransform(frame)} ${formOpacity(frame)}`]);
}
const formFinal = `${formTransform(241)} ${formOpacity(241)}`;
formEntries.push(['100', formFinal]);
const formBlock = block('e3-win-form', stops(formEntries));

// --- spark: matrix + colour + opacity (sprite frames 2..60) ----------------
// The sprite-170 timeline has 65 frames and no `stop()`, so the whole burst
// repeats: the spark track runs on a 65-frame cycle (visible frames 2-60, the
// removal/gap at frame 65 and the loop back to frame 1), matching the
// reference's looping fireworks (evidence/Y10-celebration.md §fireworks).
const SPARK_CYCLE_FRAMES = 65; // DefineSprite_170 frameCount
const sparkEntries = [];
function sparkDeclaration(frame) {
  const rec = SERIES.havai.instance[frame - 2];
  const color = SERIES.havai.sparkColors[frame - 2].rgb; // sprite 168 frame N-1
  const matrix = `matrix(${rec.scaleX}, ${rec.rotateSkew0}, ${rec.rotateSkew1}, ${rec.scaleY}, ${fmt(
    rec.tx,
  )}, ${fmt(rec.ty)})`;
  return `transform: ${matrix}; color: rgb(${color[0]}, ${color[1]}, ${color[2]}); opacity: ${fmt(
    rec.alpha / 256,
  )};`;
}
for (const rec of SERIES.havai.instance) {
  sparkEntries.push([
    (((rec.frame - 1) / SPARK_CYCLE_FRAMES) * 100).toFixed(6),
    sparkDeclaration(rec.frame),
  ]);
}
sparkEntries.push(['100', sparkDeclaration(60)]);
const sparkBlock = block('e3-win-spark', stops(sparkEntries));

const generated = `/* @y10-generated:begin — regenerate with
   node tests/e2e/celebration/generate-win-keyframes.mjs
   (source: evidence/logs/Y10-win-series.json; do not hand-edit) */
${alphaBlock('e3-win-sky', win.skyAlpha)}${alphaBlock('e3-win-layer3', win.layer3Alpha)}
${glowBlock}
${tintBlock}
${logoBlock}
${formBlock}
/* Firework spark (DefineSprite_169 frames 2-60; see the win rules below). */
${sparkBlock}/* @y10-generated:end */`;

const css = fs.readFileSync(CSS_PATH, 'utf8');
const begin = css.indexOf('/* @y10-generated:begin');
const end = css.indexOf('/* @y10-generated:end */');
if (begin === -1 || end === -1) {
  throw new Error('generated markers not found in src/styles/animations.css');
}
const next = css.slice(0, begin) + generated + css.slice(end + '/* @y10-generated:end */'.length);
fs.writeFileSync(CSS_PATH, next);
console.log(`updated ${path.relative(ROOT, CSS_PATH)} (${generated.split('\n').length} generated lines)`);
