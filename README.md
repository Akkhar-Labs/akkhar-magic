<div align="center">

# Akkhar-Magic

**The Open-Source UI-to-API Bridge for Google AI Studio**

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/akkhar-labs/akkhar-magic)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

Akkhar-Magic intercepts OpenAI-compatible API requests from agentic IDEs and
routes them through Google AI Studio's browser interface — giving you access to
Gemini models with zero API costs.

[Quick Start](#quick-start) · [Documentation](docs/) ·
[Architecture](docs/architecture/) · [API Reference](docs/reference/)

</div>

---

## Overview

Akkhar-Magic sits between your IDE and Google AI Studio. Your IDE thinks it's
talking to an OpenAI-compatible API. Akkhar-Magic translates those requests into
browser interactions, puppeteering AI Studio's UI to generate responses, then
streams them back in the format your IDE expects.

**Supported Models:** Any model available in your Google AI Studio account
(Gemini 2.5 Flash, Gemini 2.5 Pro, etc.)

### Key Features

- **OpenAI-Compatible API** — Drop-in replacement. Same endpoints, same SSE
  streaming, same response format.
- **Zero API Costs** — Uses AI Studio's web interface, not the paid Gemini API.
- **Multi-Turn Conversations** — Automatic session reuse with content-based
  fingerprinting.
- **Smart Error Handling** — Rate limits, safety filters, and internal errors
  mapped to proper HTTP status codes.
- **Browser Auto-Discovery** — Finds Chrome, Brave, or Edge automatically. No
  configuration needed.
- **Multi-Profile Support** — Switch between Google accounts without
  re-authenticating.
- **CDP Extraction** — Chrome DevTools Protocol for reliable response capture,
  with DOM fallback.

## Recommended Editor Setup

Akkhar-Magic works with any editor or tool that supports custom
OpenAI-compatible endpoints. However, **not all AI coding assistants are created
equal** when it comes to model flexibility.

Some AI coding tools are architecturally coupled to a specific model family —
their prompting strategies, system instructions, and UI extraction patterns are
tuned for one provider. When you route these tools through a different model
(like Gemini via Akkhar-Magic), you may experience degraded output quality,
formatting issues, or unexpected behavior — not because of Akkhar-Magic, but
because the tool wasn't designed to work with your model.

### Our Recommendation: Continue.dev

We recommend [**Continue.dev**](https://continue.dev) as the primary editor
integration for Akkhar-Magic.

|                      | Continue.dev                                                         |
| -------------------- | -------------------------------------------------------------------- |
| **Model-agnostic**   | Designed to work with any LLM provider — no hidden model assumptions |
| **Open source**      | Fully open, transparent prompt construction                          |
| **Custom endpoints** | First-class support for OpenAI-compatible APIs                       |
| **IDE support**      | VS Code and JetBrains IDEs                                           |
| **Configuration**    | Simple `config.json` — point it at `http://127.0.0.1:1337/v1` and go |

**Continue.dev configuration:**

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Akkhar-Magic (Gemini)",
      "provider": "openai",
      "model": "gemini-3-flash-preview",
      "apiBase": "http://127.0.0.1:1337/v1",
      "apiKey": "any-value"
    }
  ]
}
```

### Other Compatible Editors

| Editor                | Compatibility | Notes                             |
| --------------------- | ------------- | --------------------------------- |
| **Continue.dev**      | Excellent     | Model-agnostic, recommended       |
| **Cursor**            | Good          | Supports custom providers         |
| **Windsurf**          | Good          | Supports custom endpoints         |
| **Any OpenAI client** | Good          | `curl`, Python `openai` SDK, etc. |

> **Why not Cline?** Cline's agentic workflows and prompt templates are
> specifically optimized for Claude Sonnet's instruction-following patterns.
> Routing through Gemini can cause tool-use formatting mismatches and degraded
> agentic performance. It will work for basic chat, but you won't get the full
> agentic experience Cline is known for.

## Quick Start

### Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org)
- **A Chromium browser** — Chrome, Brave, or Edge (Edge is pre-installed on
  Windows)
- **A Google account** — With access to
  [Google AI Studio](https://aistudio.google.com)

### Installation

```bash
git clone https://github.com/akkhar-labs/akkhar-magic.git
cd akkhar-magic
npm install
```

### Step 1: Authenticate

```bash
npm run login
```

A browser window opens. Sign into your Google account, navigate to AI Studio,
then close the browser.

### Step 2: Start the Server

```bash
npm run dev
```

### Step 3: Configure Your IDE

| Setting  | Value                      |
| -------- | -------------------------- |
| Base URL | `http://127.0.0.1:1337/v1` |
| API Key  | `any-value`                |
| Model    | `gemini-3-flash-preview`   |

That's it. Your IDE is now powered by Google AI Studio.

> For detailed setup instructions per IDE, see
> [Getting Started](docs/getting-started/).

## Documentation

| Section                                  | Description                                     |
| ---------------------------------------- | ----------------------------------------------- |
| [Getting Started](docs/getting-started/) | Installation, authentication, IDE configuration |
| [Guides](docs/guides/)                   | CLI usage, profiles, build & distribution       |
| [Architecture](docs/architecture/)       | System design, data flow, provider pattern      |
| [API Reference](docs/reference/)         | Endpoints, environment variables, error codes   |

## API Endpoints

| Method | Endpoint               | Description                                  |
| ------ | ---------------------- | -------------------------------------------- |
| POST   | `/v1/chat/completions` | Chat completions (streaming & non-streaming) |
| GET    | `/v1/models`           | List available models                        |
| GET    | `/v1/status`           | Bridge status and diagnostics                |
| GET    | `/health`              | Health check                                 |

## Project Structure

```
akkhar-magic/
├── src/
│   ├── index.ts                 # Bootstrap & server startup
│   ├── config.ts                # Configuration resolution
│   ├── api/                     # HTTP layer (Hono routes)
│   │   ├── server.ts            # App factory & middleware
│   │   └── routes/              # Route handlers
│   ├── browser/                 # Browser automation
│   │   ├── launcher.ts          # Puppeteer lifecycle management
│   │   ├── cdp-monitor.ts       # Chrome DevTools Protocol monitor
│   │   └── discovery.ts         # System browser auto-discovery
│   ├── providers/               # Platform adapters
│   │   └── ai-studio/           # Google AI Studio provider
│   │       ├── navigator.ts     # Chat navigation & reuse
│   │       ├── injector.ts      # Prompt injection
│   │       └── extractor.ts     # Response extraction (CDP + DOM)
│   ├── services/                # Business logic
│   │   ├── completion.service.ts # Request orchestration
│   │   ├── prompt.service.ts    # Prompt preparation & fingerprinting
│   │   └── session.service.ts   # Session management
│   ├── network/                 # Protocol layer
│   │   ├── error-detector.ts    # Three-layer error detection
│   │   └── tag-extractor.ts     # Akkhar tag protocol parser
│   ├── persistence/             # Data persistence
│   │   └── archivist.ts         # Session & profile storage
│   ├── types/                   # TypeScript type definitions
│   ├── constants/               # Configuration constants
│   ├── utils/                   # Shared utilities
│   └── cli/                     # CLI commands
├── scripts/                     # Build tooling
│   └── build.cjs               # esbuild bundle + distribution
├── docs/                        # Documentation
├── .akkhar/                     # Session data (gitignored)
└── profiles/                    # Browser profiles (gitignored)
```

## Security & Privacy

- **All data stays on your machine.** Akkhar-Magic runs entirely on localhost.
- **No telemetry, no analytics, no external calls.** The only network traffic is
  between your machine and Google AI Studio.
- **Credentials are stored in local browser profiles** — the same way Chrome
  stores them.
- **Session data and profiles are gitignored** by default.

## Requirements

| Dependency            | Version    | Purpose                   |
| --------------------- | ---------- | ------------------------- |
| Node.js               | >= 20.0    | Runtime                   |
| Chrome / Brave / Edge | Any recent | Browser automation target |
| Google Account        | —          | AI Studio access          |

## Contributing

Akkhar-Magic is maintained by [Akkhar-Labs](https://github.com/akkhar-labs), a
PRIME Ecosystem company.

We welcome issues, bug reports, and feature requests. Please open an issue
before submitting a pull request.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
You are free to use, modify, and distribute this software under the terms of the
GPL-3.0.

---

<div align="center">

**Akkhar-Labs** · A PRIME Ecosystem Company · Bogura, Bangladesh

_"Silicon Valley will respect Bangladesh one day, Insha Allah."_ — Rahat Hasan,
Founder

</div>
