import { defineConfig } from '@playwright/test';

// E2E/visual suites:
//   tests/e2e/**/*.spec.ts  — app suites (C2 smoke, E2 visual, E3 animation, F2 playthrough)
//   verify/**/*.spec.ts     — reference-harness suites (C3)
// Suite-level options (webServer, viewports, deviceScaleFactor) are added by
// the owning tasks; this is the C1 scaffold.
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
});
