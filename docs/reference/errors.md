# Error Reference

Akkhar-Magic maps Google AI Studio errors to OpenAI-compatible error responses. This reference covers all error types, their causes, and resolution steps.

## Error Response Format

### HTTP Error (Pre-Stream)

Returned when the error occurs before streaming begins:

```json
{
  "error": {
    "message": "Human-readable error description",
    "type": "error_category",
    "code": "machine_readable_code"
  }
}
```

### SSE Error (Mid-Stream)

When an error occurs after streaming has started (HTTP 200 already committed), the error is delivered as an SSE event:

```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"error"}],"error":{"message":"...","type":"...","code":"..."}}

data: [DONE]
```

## Error Types

### Rate Limit Error

| Field | Value |
|-------|-------|
| HTTP Status | `429` |
| Type | `rate_limit_error` |
| Code | `quota_exceeded` |
| Message | `Akkhar-Magic: Google Rate Limit Reached.` |

**Cause:** Google AI Studio's per-account rate limit has been exceeded.

**Resolution:**
- Wait for the rate limit to reset (typically 60 seconds)
- Switch to a different Google account profile: `npm run switch -- account-2`
- Reduce request frequency

**Detection:** Triggered by RPC error codes 8 or 29, or by text patterns like "exceeded your current quota" or "resource has been exhausted" in the response body.

---

### Safety Filter Error

| Field | Value |
|-------|-------|
| HTTP Status | `400` |
| Type | `invalid_request_error` |
| Code | `content_filter` |
| Message | `Akkhar-Magic: Content blocked by Google safety filters.` |

**Cause:** The prompt or response was blocked by Google's content safety filters.

**Resolution:**
- Rephrase the prompt to avoid triggering safety filters
- This is a Google-side restriction and cannot be bypassed

**Detection:** Triggered by text patterns like "safety filter", "blocked by safety", "content policy violation" in the response.

---

### Authentication Error

| Field | Value |
|-------|-------|
| HTTP Status | `500` |
| Type | `server_error` |
| Code | `auth_expired` |
| Message | `Akkhar-Magic: Authentication expired or invalid.` |

**Cause:** The Google session has expired or the authentication cookies are invalid.

**Resolution:**
- Re-authenticate: `npm run login`
- If using a named profile: `npm run login -- -p <profile-name>`

**Detection:** Triggered by RPC error codes 7 or 16.

---

### Internal Provider Error

| Field | Value |
|-------|-------|
| HTTP Status | `500` |
| Type | `server_error` |
| Code | `internal_provider_error` |
| Message | `Akkhar-Magic: <specific error description>` |

**Cause:** Google AI Studio returned an internal error. This can be a temporary server issue.

**Resolution:**
- Retry the request
- If persistent, check [Google AI Studio status](https://status.cloud.google.com)

**Detection:** Triggered by text patterns like "internal error", "server error", "temporarily unavailable" in the response.

---

### Network Extraction Timeout

| Field | Value |
|-------|-------|
| Type | `server_error` |
| Code | `internal_error` |
| Message | `NETWORK_EXTRACTION_TIMEOUT: No response within timeout.` |

**Cause:** The model didn't produce a response within the configured timeout (default: 5 minutes).

**Resolution:**
- Check that AI Studio is responding in your browser
- Verify your internet connection
- The model may be overloaded — retry after a few seconds

---

### CDP Request Failed

| Field | Value |
|-------|-------|
| Type | `server_error` |
| Code | `internal_error` |
| Message | `CDP_REQUEST_FAILED: <browser error text>` |

**Cause:** The browser's network request to AI Studio failed at the transport level.

**Resolution:**
- Check your internet connection
- Restart Akkhar-Magic
- If persistent, try `AKKHAR_EXTRACTION_MODE=dom` to bypass CDP

## Error Detection Architecture

Errors are detected through three independent layers:

```
Layer 1: RPC Error Detection
  → Parses Google's proprietary RPC response format
  → Matches error codes (7, 8, 16, 29) to error types
  → Most reliable for structured errors

Layer 2: Stream Error Detection
  → Scans raw response body against known error text patterns
  → 12 rate-limit patterns, 8 safety patterns, 8 internal error patterns
  → Catches errors that bypass RPC structure

Layer 3: DOM Error Detection
  → Reads error banners displayed in AI Studio's UI
  → Same pattern dictionaries as Layer 2
  → Only active during DOM extraction
```

Each layer catches errors that the previous layers might miss. All detected errors are mapped to the appropriate `AkkharError` subtype before being returned to the IDE.