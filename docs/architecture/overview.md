# System Architecture

## Overview

Akkhar-Magic is a local proxy server that translates OpenAI API requests into browser interactions with Google AI Studio. It operates as a middleware layer between agentic IDEs and AI Studio's web interface.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  IDE (Cline / Cursor / Windsurf)                                │
│  Sends: POST /v1/chat/completions                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Layer (Hono)                                               │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐                      │
│  │ Request         │  │ Trivial Request  │                      │
│  │ Interceptor     │──│ (title gen, etc.)│──→ Local Response    │
│  └────────┬────────┘  └──────────────────┘                      │
│           │                                                     │
│           ▼ Immediate 200 + SSE Headers + Heartbeat             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Service Layer                                                  │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐                      │
│  │ PromptService   │  │ CompletionService│                      │
│  │ • Fingerprint   │──│ • Orchestration  │                      │
│  │ • Follow-up     │  │ • Title Cache    │                      │
│  │   detection     │  │ • Error mapping  │                      │
│  └─────────────────┘  └────────┬─────────┘                      │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Provider Layer (AI Studio)                                     │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐                   │
│  │ Navigator │  │ Injector  │  │ Extractor  │                   │
│  │ • Chat    │  │ • Prompt  │  │ • CDP      │                   │
│  │   reuse   │──│   guard   │──│   primary  │                   │
│  │ • Session │  │ • Tag     │  │ • DOM      │                   │
│  │   matching│  │   directives│ │   fallback │                   │
│  └───────────┘  └───────────┘  └────────────┘                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Puppeteer / CDP
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Chrome / Brave / Edge)                                │
│  → Google AI Studio (aistudio.google.com)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### API Layer

- Receives OpenAI-format requests from IDEs
- Intercepts trivial requests (title generation) and responds locally
- Commits SSE response immediately with heartbeat keepalives
- Maps errors to OpenAI-compatible format

### Service Layer

- **CompletionService** — Orchestrates the full request lifecycle: browser → navigate → inject → extract
- **PromptService** — Prepares prompts, detects follow-ups, computes conversation fingerprints
- **SessionService** — Manages session persistence through the Archivist
- **TitleCache** — Caches AI-generated conversation titles for IDE side-channel requests

### Provider Layer

Platform-specific adapters implementing the `IProvider` interface:

- **Navigator** — Handles chat page navigation with smart reuse (fingerprint matching, staleness detection)
- **Injector** — Injects prompts into the textarea, appends tag directives, submits
- **Extractor** — Captures model responses via CDP network interception (primary) or DOM scraping (fallback)

### Browser Layer

- **Launcher** — Manages Puppeteer browser lifecycle with stealth plugins
- **CdpMonitor** — Chrome DevTools Protocol session for network traffic monitoring
- **Discovery** — Auto-detects installed Chromium browsers on Windows

### Network Layer

- **ErrorDetector** — Three-layer error detection (RPC codes, stream patterns, DOM banners)
- **TagExtractor** — Parses Akkhar protocol tags from model output

## Design Principles

1. **Provider-agnostic core** — All platform-specific logic lives in `providers/`. The service layer, API layer, and browser layer are shared infrastructure.

2. **Fail gracefully** — CDP extraction has a circuit breaker that falls back to DOM scraping. SSE errors are sent as structured events when HTTP status codes can't be changed.

3. **Minimal browser interaction** — Navigate once, reuse the chat for follow-ups. Intercept trivial requests locally. Every avoided browser interaction is latency saved.

4. **IDE-agnostic** — Content-based fingerprinting works with any IDE. No IDE-specific code paths.