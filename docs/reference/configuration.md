# Configuration Reference

Akkhar-Magic is configured through environment variables. All variables are optional — sensible defaults are provided.

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `AKKHAR_PORT` | `1337` | TCP port for the API server |
| `AKKHAR_HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` to accept external connections. |
| `AKKHAR_MODEL` | `gemini-3-flash-preview` | Model name advertised to IDEs. Cosmetic only — does not affect which model AI Studio uses. |

### Browser

| Variable | Default | Description |
|----------|---------|-------------|
| `AKKHAR_BROWSER_PATH` | *(auto-detected)* | Absolute path to a Chromium executable. Overrides auto-discovery. |
| `AKKHAR_HEADLESS` | `false` | Set to `true` for headless operation (no visible browser window). |

### Extraction

| Variable | Default | Description |
|----------|---------|-------------|
| `AKKHAR_EXTRACTION_MODE` | `auto` | Extraction strategy: `auto`, `network`, or `dom`. |

| Mode | Behavior |
|------|----------|
| `auto` | CDP extraction with automatic DOM fallback on failure |
| `network` | CDP only — fails if CDP is unavailable |
| `dom` | DOM polling only — no CDP |

### Provider

| Variable | Default | Description |
|----------|---------|-------------|
| `AKKHAR_PROVIDER` | `ai-studio` | Which platform provider to use. Currently only `ai-studio` is implemented. |

## Setting Variables

### Windows (Command Prompt)

```cmd
set AKKHAR_PORT=8080
set AKKHAR_MODEL=gemini-2.5-pro
npm run dev
```

### Windows (PowerShell)

```powershell
$env:AKKHAR_PORT = "8080"
$env:AKKHAR_MODEL = "gemini-2.5-pro"
npm run dev
```

### Linux / macOS

```bash
export AKKHAR_PORT=8080
export AKKHAR_MODEL=gemini-2.5-pro
npm run dev
```

### Using a .env File

Create a `.env` file in the project root:

```env
AKKHAR_PORT=8080
AKKHAR_MODEL=gemini-2.5-pro
AKKHAR_HEADLESS=true
AKKHAR_BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

> **Note:** Akkhar-Magic does not load `.env` files automatically. Use a tool like `dotenv-cli` or source the file manually.

## Internal Defaults

These values are hardcoded and not configurable via environment variables:

| Setting | Value | Location |
|---------|-------|----------|
| AI Studio Base URL | `https://aistudio.google.com` | `src/config.ts` |
| Generation Timeout | 300,000 ms (5 min) | `src/config.ts` |
| Heartbeat Interval | 3,000 ms | `src/utils/sse.ts` |
| Title Cache TTL | 60,000 ms | `src/services/title-cache.ts` |
| Circuit Breaker Threshold | 3 failures | `src/constants/circuit-breaker.ts` |
| Chat Stale Timeout | 600,000 ms (10 min) | `src/constants/timing.ts` |

## File Paths

| Path | Purpose | Gitignored |
|------|---------|------------|
| `.akkhar/` | Session persistence (JSON header files) | Yes |
| `profiles/` | Browser profiles (Chrome user data directories) | Yes |
| `dist/` | Build output | Yes |