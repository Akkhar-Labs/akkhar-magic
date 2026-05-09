# Installation

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Node.js** | 20.0.0 | Latest LTS |
| **Operating System** | Windows 10 | Windows 11 |
| **RAM** | 4 GB | 8 GB |
| **Browser** | Any Chromium-based | Chrome or Brave |

> **Note:** macOS and Linux support is planned. Windows is the primary target for v0.0.1.

## Browser Compatibility

Akkhar-Magic auto-discovers a Chromium browser on your system. The following are supported:

| Browser | Auto-Detected | Notes |
|---------|--------------|-------|
| Google Chrome | Yes | Recommended |
| Brave | Yes | Fully supported |
| Microsoft Edge | Yes | Fallback — pre-installed on all Windows 10/11 |
| Chromium | No | Use `AKKHAR_BROWSER_PATH` to specify manually |
| Firefox / Safari | No | Not compatible (non-Chromium) |

## Install from Source

```bash
# Clone the repository
git clone https://github.com/akkhar-labs/akkhar-magic.git
cd akkhar-magic

# Install dependencies
npm install
```

## Verify Installation

```bash
# Check TypeScript compilation
npx tsc --noEmit

# Start in development mode
npm run dev
```

If successful, you'll see the Akkhar-Magic banner and server listening on `http://127.0.0.1:1337`.

## Portable Distribution

For deployment without a development environment:

```bash
# Build portable folder
npm run build:dist
```

This creates `dist/akkhar-magic/` containing:

```
akkhar-magic/
├── akkhar-magic.cjs     # Bundled application
├── akkhar-magic.bat     # Windows launcher (double-click to start)
└── node_modules/        # Runtime dependencies only
```

Transfer this folder to any Windows machine with Node.js 20+ installed.

## Manual Browser Path

If auto-discovery fails or you want to use a specific browser:

```bash
# Set the browser path manually
set AKKHAR_BROWSER_PATH=C:\path\to\chrome.exe
npm run dev
```

## Next Steps

- [Authentication](authentication.md) — Set up your Google account
- [IDE Configuration](ide-configuration.md) — Connect your IDE