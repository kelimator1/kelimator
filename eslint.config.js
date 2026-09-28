// ESLint flat configuration (eslint.config.js — pinned, docs/04-architecture.md §1).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'artifacts/**', 'evidence/**'],
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
);
