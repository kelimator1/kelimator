import { defineConfig } from '@playwright/test';

// E2E/visual suites:
//   tests/e2e/**/*.spec.ts  — app suites (C2 smoke, E2 visual, E3 animation, F2 playthrough)
//   verify/**/*.spec.ts     — reference-harness suites (C3)
// App-suite options (Vite webServer, baseURL, Chromium) added by task C2 per
// evidence/C1-scaffold.md §5. The "reference" project (C3) supplies its own
// harness/server and inherits no app baseURL.
const APP_PORT = 5199;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;

export default defineConfig({
  testDir: '.',
  testIgnore: [
    'node_modules/**',
    'dist/**',
    'artifacts/**',
    'data/**',
    'evidence/**',
    'src/**',
    'tools/**',
  ],
  testMatch: ['tests/e2e/**/*.spec.{ts,js,mjs}', 'verify/**/*.spec.{ts,js,mjs}'],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'app',
      testMatch: 'tests/e2e/**/*.spec.{ts,js,mjs}',
      use: {
        baseURL: APP_URL,
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'reference',
      testMatch: 'verify/**/*.spec.{ts,js,mjs}',
    },
  ],
});
