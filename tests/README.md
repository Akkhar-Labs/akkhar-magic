# Akkhar-Magic Test Suite

Mirrors the `src/` layout. Three flavors of tests, each with a clear job.

```
tests/
├── unit/           Fast, isolated. No filesystem, no network, no browser.
├── integration/    Real filesystem / real adapters, but no browser/network.
├── e2e/            Real browser, real AI Studio. Slow. Run before releases.
└── helpers/        Shared fixture builders and tmp-dir utilities.
```

## Running

```bash
npm test                # one-shot, all suites
npm run test:watch      # watch mode for active development
npm run test:ui         # vitest's web UI
npm run test:coverage   # v8 coverage report (text + HTML)
```

## Conventions

1. **One test file per source file.** `src/foo/bar.ts` → `tests/<flavor>/foo/bar.test.ts`.
2. **No tests in `src/`.** Source stays clean; verification has its own home.
3. **Helpers go in `tests/helpers/`.** Don't reach into another test's internals.
4. **Integration tests must clean up.** Use `withTmpDir()` or equivalent; never leave artifacts on disk.
5. **E2E tests are opt-in.** They require a real browser session and may be skipped in CI by default.

## Why three flavors?

| Flavor      | Speed     | What it catches                              |
| ----------- | --------- | -------------------------------------------- |
| Unit        | <10ms     | Logic bugs, regex mistakes, type misuse      |
| Integration | 10ms–1s   | Wiring bugs, I/O bugs, persistence bugs      |
| E2E         | seconds+  | Whole-system regressions, real-world drift   |

Most failures are caught by unit + integration. E2E is the safety net for the parts no mock can simulate (AI Studio's DOM, Google auth, browser quirks).
