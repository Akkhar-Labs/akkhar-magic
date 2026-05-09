# Extraction Engine

The extraction engine captures model responses from AI Studio's browser interface. It uses a dual-strategy approach with automatic failover.

## Strategies

### CDP Extraction (Primary)

Uses Chrome DevTools Protocol to intercept network traffic at the protocol level.

**How it works:**

1. `CdpMonitor` attaches to the browser page via `page.createCDPSession()`
2. Enables `Network.enable` to passively monitor HTTP traffic
3. Filters requests matching AI Studio's generation endpoint pattern
4. When the generation request completes (`Network.loadingFinished`), retrieves the response body via `Network.getResponseBody`
5. Parses the response through `parseAiStudioResponse()` to extract text fragments
6. Runs `extractAllTags()` to separate response content from thinking and metadata

**Advantages:**
- Operates below JavaScript — immune to UI changes, framework updates, or prototype restoration
- Captures the raw response data, not rendered DOM text
- Single network event vs continuous polling

**Limitations:**
- Requires CDP session attachment (can fail in some environments)
- Response body retrieval can fail for very large responses

### DOM Extraction (Fallback)

Polls the rendered page DOM for response text.

**How it works:**

1. Waits for response elements to appear (CSS selector matching)
2. Polls at 150ms intervals, comparing text length
3. Detects stability (text unchanged for multiple polls) combined with UI state (stop button visibility)
4. Delivers text incrementally as deltas

**Advantages:**
- Works without CDP session
- More resilient to transport-level issues

**Limitations:**
- Dependent on CSS selectors (break when UI changes)
- Higher latency due to polling
- Captures rendered text, not raw response

## Circuit Breaker

The system tracks CDP extraction failures. After consecutive failures exceed the threshold, the circuit breaker trips and all subsequent extractions fall back to DOM.

```
CDP Success → Reset failure count
CDP Failure → Increment failure count
Failure count >= threshold → Circuit breaker trips → DOM fallback
```

The circuit breaker resets when:
- Manually reset via `cdpMonitor.resetCircuitBreaker()`
- Failures are spaced far enough apart (window-based)

## Error Detection Layers

During extraction, three layers scan for errors:

| Layer | Method | Catches |
|-------|--------|---------|
| **Layer 1: RPC** | Regex on raw response body | Structured error codes (auth expired, rate limit) |
| **Layer 2: Stream** | Pattern matching on response body | Text-based error indicators (quota exceeded, safety filter) |
| **Layer 3: DOM** | Pattern matching on UI banners | Visual error messages displayed in the interface |

Layers 1 and 2 run during CDP extraction. Layer 3 runs during DOM extraction.

## Tag Protocol

Akkhar-Magic embeds directives in prompts that instruct the model to wrap its output in structured tags:

```
<AKKHAR_RESPONSE>
The actual model output, with thinking content stripped.
</AKKHAR_RESPONSE>

<AKKHAR_TITLE>
A 3-5 word title for this conversation.
</AKKHAR_TITLE>
```

The `TITLE` tag is only requested on the first turn of a conversation. Both tags are parsed by `extractAllTags()` in `src/network/tag-extractor.ts`.

## Configuration

The extraction mode is configured via `AKKHAR_EXTRACTION_MODE`:

| Value | Behavior |
|-------|---------|
| `auto` (default) | CDP primary, DOM fallback via circuit breaker |
| `network` | CDP only, error if CDP fails |
| `dom` | DOM only, no CDP |

```bash
set AKKHAR_EXTRACTION_MODE=auto
npm run dev
```