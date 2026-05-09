# API Reference

Akkhar-Magic exposes an OpenAI-compatible REST API on `http://127.0.0.1:1337`.

---

## POST `/v1/chat/completions`

Create a chat completion. Supports both streaming and non-streaming responses.

### Request

```http
POST /v1/chat/completions HTTP/1.1
Content-Type: application/json
Authorization: Bearer <any-value>
X-Session-Id: <optional-session-id>
```

```json
{
  "model": "gemini-3-flash-preview",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "stream": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model identifier (cosmetic, see note) |
| `messages` | array | Yes | Array of message objects |
| `stream` | boolean | No | Enable SSE streaming (default: `false`) |

> **Note:** The `model` field is not used for routing. All requests go to whichever model is configured in your AI Studio session.

### Message Object

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | `system`, `user`, or `assistant` |
| `content` | string | Message content |

### Response (Non-Streaming)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "gemini-3-flash-preview",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello! How can I help?" },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### Response (Streaming)

Returns a stream of Server-Sent Events:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1700000000,"model":"gemini-3-flash-preview","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1700000000,"model":"gemini-3-flash-preview","choices":[{"index":0,"delta":{"content":"! How can I help?"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1700000000,"model":"gemini-3-flash-preview","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

Heartbeat comments (`: heartbeat`) are sent every 3 seconds during processing to keep the connection alive.

### Error Responses

| HTTP Status | Error Type | Cause |
|-------------|-----------|-------|
| 429 | `rate_limit_error` | Google AI Studio rate limit reached |
| 400 | `invalid_request_error` | Content blocked by safety filters |
| 500 | `server_error` | Internal error (browser disconnected, extraction failed, etc.) |

Example error:

```json
{
  "error": {
    "message": "Akkhar-Magic: Google Rate Limit Reached.",
    "type": "rate_limit_error",
    "code": "quota_exceeded"
  }
}
```

---

## GET `/v1/models`

List available models.

### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-3-flash-preview",
      "object": "model",
      "created": 1700000000,
      "owned_by": "akkhar-magic"
    }
  ]
}
```

---

## GET `/v1/status`

Get bridge status and diagnostics.

### Response

```json
{
  "version": "0.0.1",
  "browser": {
    "connected": true
  },
  "config": {
    "model": "gemini-3-flash-preview",
    "port": 1337,
    "extractionMode": "auto"
  },
  "sessions": {
    "total": 42,
    "activeProfile": "default"
  }
}
```

---

## GET `/health`

Simple health check.

### Response

```json
{
  "status": "ok",
  "version": "0.0.1",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "extraction": {
    "configuredMode": "auto"
  }
}
```

---

## Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `Authorization` | No | Accepted but not validated. Any value works. |
| `X-Session-Id` | No | Custom session identifier. Auto-generated if not provided. |

### Response Headers (SSE)

| Header | Value |
|--------|-------|
| `Content-Type` | `text/event-stream` |
| `Cache-Control` | `no-cache` |
| `Connection` | `keep-alive` |
| `X-Accel-Buffering` | `no` |