import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Look for tests under tests/ only — keeps src/ free of co-located tests.
    include: ['tests/**/*.test.ts'],
    // Sensible default: each test file runs in isolation.
    isolate: true,
    // Integration tests touch the filesystem; give them a little headroom.
    testTimeout: 10_000,
    // Reporters: default to terminal-friendly output.
    reporters: ['default'],
    // Silence the app logger during tests — set to 'debug' locally to debug.
    env: {
      AKKHAR_LOG_LEVEL: 'fatal',
    },
    // Coverage opt-in via `npm run test:coverage`.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/types/**'],
    },
  },
});
