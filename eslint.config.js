// ESLint flat configuration (eslint.config.js — pinned, docs/04-architecture.md §1).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'artifacts/**',
      'evidence/**',
      // Vendored third-party reference material: pinned Ruffle web self-hosted
      // distribution (task C3) and any other minified bundles. Hand-written
      // C3 harness scripts outside this directory stay linted.
      'verify/reference/ruffle/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'tests/**/*.{ts,mts,js,mjs}',
      'verify/**/*.{ts,mts,js,mjs}',
      'tools/**/*.{ts,mts,js,mjs}',
      '*.config.{ts,js,mjs}',
      'eslint.config.js',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // C3 harness scripts run in Node but embed browser-context callbacks
    // (Playwright `page.evaluate`), so they see both global sets. Not ignored —
    // every rule still applies.
    files: ['verify/reference/**/*.{ts,mts,js,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
