# Build & Distribution

Akkhar-Magic provides multiple build targets for different deployment scenarios.

## Build Commands

| Command | Output | Size | Use Case |
|---------|--------|------|----------|
| `npm run dev` | — | — | Development with hot-reload |
| `npm run bundle` | `dist/akkhar-magic.cjs` | ~197 KB | Single-file bundle |
| `npm run build:dist` | `dist/akkhar-magic/` | ~33 MB | Portable folder distribution |
| `npm run build:exe` | `dist/akkhar-magic.exe` | ~92 MB | Standalone executable (experimental) |

## Development Mode

```bash
npm run dev
```

Uses `tsx watch` for TypeScript execution with automatic restart on file changes.

## Bundle

```bash
npm run bundle
```

Uses [esbuild](https://esbuild.github.io) to compile all TypeScript into a single CommonJS file. The bundle contains all application code except browser automation dependencies (puppeteer-core, puppeteer-extra).

Run the bundle directly:

```bash
node dist/akkhar-magic.cjs
```

## Portable Distribution

```bash
npm run build:dist
```

Creates a self-contained folder that can be transferred to any Windows machine with Node.js 20+:

```
dist/akkhar-magic/
├── akkhar-magic.cjs      # Bundled application (197 KB)
├── akkhar-magic.bat      # Windows launcher
└── node_modules/         # Runtime dependencies (~33 MB)
    ├── puppeteer-core/
    ├── puppeteer-extra/
    ├── puppeteer-extra-plugin-stealth/
    └── ... (transitive dependencies)
```

### Deploying the Portable Build

1. Build: `npm run build:dist`
2. Copy `dist/akkhar-magic/` to the target machine
3. Ensure Node.js 20+ is installed on the target
4. Double-click `akkhar-magic.bat` or run `node akkhar-magic.cjs`
5. On first run, authenticate: the browser opens for Google login

### What's Included

The portable build includes only the runtime dependencies required for browser automation:

- `puppeteer-core` — Browser control protocol
- `puppeteer-extra` — Plugin system
- `puppeteer-extra-plugin-stealth` — Anti-detection measures
- Transitive dependencies (`chromium-bidi`, `ws`, `devtools-protocol`, etc.)

All application code (routes, services, providers) is bundled into the single `.cjs` file.

## Standalone Executable (Experimental)

```bash
npm run build:exe
```

Uses [Node SEA](https://nodejs.org/api/single-executable-applications.html) (Single Executable Applications) to embed the bundle into a copy of `node.exe`.

**Status:** Experimental. Currently blocked by `puppeteer-extra`'s use of dynamic `require()` calls that Node SEA's module resolver cannot handle. The portable distribution is the recommended approach.

## Type Checking

```bash
# Type check without emitting
npx tsc --noEmit

# Full TypeScript build
npm run build
```

The TypeScript build outputs to `dist/` with declarations, source maps, and declaration maps.