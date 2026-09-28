// tests/e2e/offline/offline.spec.ts — T14 runtime offline check (task F3).
//
// Serves the production build (`npm run build` → `dist/`) from a local
// preview server (`vite preview`, port 5288) and loads the app with every
// non-local request blocked through Playwright routing. Assertions:
//   1. the app boots into the round board (`window.__game.state === 'playing'`,
//      `[data-testid="board"]` visible, 8 runtime letter tiles);
//   2. a basic interaction works through the real input path (tile center
//      click enters its letter; BACKSPACE removes it);
//   3. zero non-local requests are attempted — any non-localhost request would
//      be aborted and recorded, and the assertion fails when the list is
//      non-empty.
//
// Recording: the machine-readable report is written to
// `test-results/F3-offline/offline-report.json` (transient, gitignored) and
// printed to stdout; the committed evidence stays frozen — this suite never
// writes under `evidence/` (evidence-freeze amendment 2026-09-28, F3 amendment
// 2026-09-29). `tools/verify-all.sh` runs it without recording flags.
//
// Silent witness runs (EXECUTION.md §8): the "app" Playwright project launches
// Chromium with `--mute-audio` (playwright.config.ts); this suite never
// overrides it and asserts state, never audibility.
import { expect, test } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = 5288;
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const PREVIEW_COMMAND =
  `node_modules/.bin/vite preview --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`;
const PREVIEW_READY_TIMEOUT_MS = 30_000;
const REPORT_DIR = path.join(REPO_ROOT, 'test-results/F3-offline');

interface RequestRecord {
  url: string;
  resourceType: string;
  local: boolean;
}

interface OfflineReport {
  schemaVersion: number;
  task: string;
  generatedAt: string;
  build: {
    command: string;
    exitCode: number;
    durationMs: number;
    distFiles: number;
    indexHtmlSha256: string;
  };
  preview: { command: string; url: string; readyMs: number };
  requests: {
    observed: number;
    local: number;
    nonLocalAttempts: string[];
    byResourceType: Record<string, number>;
  };
  boot: { state: string | null; roundId: string | null; boardVisible: boolean; tileLetters: number };
  interaction: {
    tile: number;
    letter: string;
    entryAfterClick: string;
    entryAfterDelete: string;
  };
  pageErrors: string[];
  result: 'PASS';
}

/** Localhost is the only network origin allowed by T14. */
function isLocalHostname(hostname: string): boolean {
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/** Hostname of a request URL; '' for non-URL schemes (data:, blob:, …). */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // data:/blob: URLs never hit the network and carry no hostname.
    return '';
  }
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function sha256File(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function countByResourceType(requests: readonly RequestRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const request of requests) {
    counts[request.resourceType] = (counts[request.resourceType] ?? 0) + 1;
  }
  return counts;
}

test.describe('T14 runtime offline (served dist/)', () => {
  test('boots, interacts, and attempts zero non-local requests', async ({ page }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // --- 1. Production build (Verify: `npm run build` output works offline) --
    const buildStarted = Date.now();
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const buildDurationMs = Date.now() - buildStarted;
    if (build.status !== 0) {
      throw new Error(
        `npm run build exited ${String(build.status)}:\n${build.stdout ?? ''}${build.stderr ?? ''}`,
      );
    }
    const distDir = path.join(REPO_ROOT, 'dist');
    const distFiles = listFiles(distDir);
    const indexHtmlPath = path.join(distDir, 'index.html');
    expect(fs.existsSync(indexHtmlPath), 'dist/index.html exists after the build').toBe(true);
    const indexHtmlSha256 = sha256File(indexHtmlPath);
    expect(distFiles.length, 'dist/ carries the built assets').toBeGreaterThan(1);

    // --- 2. Local preview server for the built output ------------------------
    const server = spawn(
      path.join(REPO_ROOT, 'node_modules/.bin/vite'),
      ['preview', '--host', PREVIEW_HOST, '--port', String(PREVIEW_PORT), '--strictPort'],
      { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let serverLog = '';
    server.stdout.on('data', (chunk: Buffer) => {
      serverLog += chunk.toString();
    });
    server.stderr.on('data', (chunk: Buffer) => {
      serverLog += chunk.toString();
    });
    const previewReadyStarted = Date.now();

    try {
      const deadline = Date.now() + PREVIEW_READY_TIMEOUT_MS;
      let ready = false;
      while (Date.now() < deadline) {
        if (server.exitCode !== null) {
          throw new Error(
            `vite preview exited with code ${String(server.exitCode)}:\n${serverLog}`,
          );
        }
        try {
          const response = await fetch(`${PREVIEW_URL}/`);
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {
          // Server not answering yet; keep polling until the deadline.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(
        ready,
        `vite preview answered on ${PREVIEW_URL} within ${PREVIEW_READY_TIMEOUT_MS} ms`,
      ).toBe(true);
      const previewReadyMs = Date.now() - previewReadyStarted;

      // --- 3. Routing: only localhost may be reached -------------------------
      const requests: RequestRecord[] = [];
      const nonLocalAttempts: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        requests.push({
          url,
          resourceType: request.resourceType(),
          local: isLocalHostname(hostnameOf(url)),
        });
      });
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (isLocalHostname(hostnameOf(url))) {
          await route.continue();
          return;
        }
        nonLocalAttempts.push(url);
        await route.abort('blockedbyclient');
      });

      // --- 4. Boot: board / playing state ------------------------------------
      await page.goto(`${PREVIEW_URL}/`);
      await expect
        .poll(async () =>
          page.evaluate(
            () =>
              (window as unknown as { __game?: { state?: string } }).__game?.state ?? null,
          ),
        )
        .toBe('playing');
      await expect(page.locator('[data-testid="board"]')).toBeVisible();
      await page.waitForFunction(() => {
        const board = document.querySelector('[data-testid="board"]');
        if (!(board instanceof HTMLElement)) {
          return false;
        }
        const images = Array.from(board.querySelectorAll('img'));
        return (
          images.length > 0 &&
          images.every(
            (image) =>
              image.complete &&
              // Zero-size assets (action/sound-only sprites, E1 §11.2) never
              // report a naturalWidth; they only need to have finished decoding.
              (image.naturalWidth > 0 || image.clientWidth === 0 || image.clientHeight === 0),
          )
        );
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      const boot = await page.evaluate(() => {
        const game = (
          window as unknown as { __game?: { state?: string; roundId?: string | null } }
        ).__game;
        return {
          state: game?.state ?? null,
          roundId: game?.roundId ?? null,
          boardVisible: document.querySelector('[data-testid="board"]') instanceof HTMLElement,
        };
      });
      expect(boot.state, 'boot state').toBe('playing');
      expect(boot.roundId, 'round id is set').not.toBeNull();
      expect(boot.boardVisible, 'board is rendered').toBe(true);
      const tileLetters = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('[data-element]')).filter((node) =>
            /^letter\d+$/.test((node as HTMLElement).dataset.element ?? ''),
          ).length,
      );
      expect(tileLetters, '8 runtime letter tiles').toBe(8);

      // --- 5. Basic interaction (tile center click + BACKSPACE) --------------
      const letter0 = await page.evaluate(() => {
        const node = document.querySelector('[data-element="letter0"]');
        return node?.textContent ?? null;
      });
      if (letter0 === null || letter0 === '') {
        throw new Error('slot 0 letter is not rendered');
      }
      const socketBox = await page.locator('[data-element="bosbuton0"]').boundingBox();
      expect(socketBox, 'tile socket 0 is rendered').not.toBeNull();
      await page.mouse.click(
        socketBox!.x + socketBox!.width / 2,
        socketBox!.y + socketBox!.height / 2,
      );
      const entry = page.locator('[data-testid="entry"]');
      await expect(entry, 'clicked tile 0 enters its letter').toHaveText(letter0);
      const entryAfterClick = (await entry.textContent()) ?? '';
      // Wait for the E3 wordball slide to settle, then delete through the
      // same input path the interaction suite uses.
      await expect(page.locator('.e3-wordball-getir')).toHaveCount(0);
      await page.keyboard.press('Backspace');
      await expect(entry, 'BACKSPACE clears the entry').toHaveText('');
      const entryAfterDelete = (await entry.textContent()) ?? '';

      // --- 6. Zero non-local requests; no page errors ------------------------
      expect(
        nonLocalAttempts,
        `non-local requests attempted: ${nonLocalAttempts.join(', ')}`,
      ).toEqual([]);
      expect(
        requests.every((record) => record.local),
        'every observed request is localhost',
      ).toBe(true);
      expect(requests.length, 'the page fetched its document and assets').toBeGreaterThan(0);
      expect(pageErrors, 'no page errors').toEqual([]);

      // --- 7. Record outputs (transient) -------------------------------------
      const report: OfflineReport = {
        schemaVersion: 1,
        task: 'F3/T14 runtime offline',
        generatedAt: new Date().toISOString(),
        build: {
          command: 'npm run build',
          exitCode: 0,
          durationMs: buildDurationMs,
          distFiles: distFiles.length,
          indexHtmlSha256,
        },
        preview: {
          command: PREVIEW_COMMAND,
          url: `${PREVIEW_URL}/`,
          readyMs: previewReadyMs,
        },
        requests: {
          observed: requests.length,
          local: requests.filter((record) => record.local).length,
          nonLocalAttempts,
          byResourceType: countByResourceType(requests),
        },
        boot: { ...boot, tileLetters },
        interaction: { tile: 0, letter: letter0, entryAfterClick, entryAfterDelete },
        pageErrors,
        result: 'PASS',
      };
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(REPORT_DIR, 'offline-report.json'),
        `${JSON.stringify(report, null, 2)}\n`,
      );
      console.log(
        `[T14] dist: ${distFiles.length} files, index.html sha256=${indexHtmlSha256}`,
      );
      console.log(
        `[T14] requests: ${requests.length} observed, ${nonLocalAttempts.length} non-local attempts`,
      );
      console.log(
        `[T14] boot: state=${boot.state} roundId=${boot.roundId} tiles=${tileLetters}`,
      );
      console.log(
        `[T14] interaction: tile 0 "${letter0}" → entry "${entryAfterClick}" → ` +
          `backspace → "${entryAfterDelete}"`,
      );
      console.log('[T14] PASS — zero non-local requests; app functional offline');
      console.log(`[T14] report: ${JSON.stringify(report, null, 2)}`);
    } finally {
      if (server.exitCode === null) {
        server.kill('SIGTERM');
        const stopped = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), 5000);
          server.once('exit', () => {
            clearTimeout(timer);
            resolve(true);
          });
        });
        if (!stopped && server.exitCode === null) {
          server.kill('SIGKILL');
        }
      }
    }
  });
});
