# Provider Pattern

Akkhar-Magic uses a provider architecture to support multiple AI platforms. Each platform (Google AI Studio, ChatGPT, Claude, etc.) is implemented as an independent provider that conforms to the `IProvider` interface.

## The IProvider Interface

```typescript
interface IProvider {
  readonly name: string;
  readonly baseUrl: string;

  navigate(page: Page, options: NavigateOptions): Promise<void>;
  inject(page: Page, options: InjectOptions): Promise<void>;
  extract(page: Page, cdpMonitor: CdpMonitor, callbacks: ExtractionCallbacks, timeoutMs: number): Promise<void>;

  isOnSite(url: string): boolean;
  hasActiveChat(): boolean;
  resetState(): void;
}
```

### Methods

| Method | Purpose |
|--------|---------|
| `navigate` | Navigate to a chat page (new or existing). Handles smart reuse internally. |
| `inject` | Insert a prompt into the platform's UI and submit it. |
| `extract` | Capture the model's response via CDP or DOM. |
| `isOnSite` | Check if a URL belongs to this provider. |
| `hasActiveChat` | Whether a reusable chat session exists. |
| `resetState` | Clear internal state (called on browser disconnect). |

## Current Providers

### AI Studio (`src/providers/ai-studio/`)

The primary provider for Google AI Studio.

```
ai-studio/
├── ai-studio.provider.ts   # IProvider implementation (delegates to components)
├── navigator.ts            # Chat navigation with fingerprint-based reuse
├── injector.ts             # Prompt injection with tag directives
├── extractor.ts            # CDP + DOM response extraction
├── response-parser.ts      # Google RPC response parsing
├── selectors.ts            # CSS selectors for AI Studio UI elements
└── constants.ts            # AI Studio URLs and configuration
```

## Adding a New Provider

A template is provided at `src/providers/_template/`.

### Step 1: Copy the Template

```bash
cp -r src/providers/_template src/providers/chatgpt
```

### Step 2: Implement the Interface

Rename `TemplateProvider` and implement all methods. Each provider manages its own:

- **Selectors** — CSS selectors for the platform's UI
- **Navigation logic** — How to reach a new or existing chat
- **Injection strategy** — How prompts are entered and submitted
- **Extraction method** — How responses are captured

### Step 3: Register the Provider

In `src/providers/index.ts`:

```typescript
import { ChatGPTProvider } from './chatgpt/chatgpt.provider.js';

export function createProvider(name: string): IProvider {
  switch (name) {
    case 'ai-studio':
      return new AiStudioProvider();
    case 'chatgpt':
      return new ChatGPTProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
```

### Step 4: Activate

```bash
set AKKHAR_PROVIDER=chatgpt
npm run dev
```

## Provider Isolation

Providers have no dependencies on each other. The service layer interacts exclusively through the `IProvider` interface:

```
CompletionService
       │
       ▼
  IProvider ─────┐
       │         │
   ai-studio   chatgpt   (future providers)
```

Changing or adding a provider requires zero modifications to:

- `src/api/` — Route handlers
- `src/services/` — Business logic
- `src/browser/` — Browser management
- `src/network/` — Protocol utilities