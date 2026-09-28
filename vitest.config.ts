import { defineConfig } from 'vitest/config';

// Unit/integration tests live in tests/** (tasks C2, D1-D5, E1) and
// verify/** (task F1 places its self-tests at verify/diff/*.test.mjs).
// passWithNoTests keeps `npm test` at exit 0 while the suite is still empty.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,mts,js,mjs}', 'verify/**/*.test.{ts,mts,js,mjs}'],
    passWithNoTests: true,
  },
});
