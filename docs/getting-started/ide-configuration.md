# IDE Configuration

Akkhar-Magic exposes an OpenAI-compatible API. Any IDE or tool that supports custom OpenAI endpoints will work.

## Connection Settings

| Setting   | Value                       |
|-----------|-----------------------------|
| Base URL  | `http://127.0.0.1:1337/v1`  |
| API Key   | `any-value`                 |
| Model     | `gemini-3-flash-preview`    |

The API key is not validated — any non-empty string works.

---

## Cline (VS Code)

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "Cline"
3. Set **API Provider** to `OpenAI Compatible`
4. Configure:
   - **Base URL:** `http://127.0.0.1:1337/v1`
   - **API Key:** `any-value`
   - **Model:** `gemini-3-flash-preview`
5. Save and start a conversation

## Cursor

1. Open Cursor Settings → **Models**
2. Click **Add Model**
3. Configure:
   - **Name:** `Akkhar-Magic (Gemini)`
   - **Provider:** `OpenAI`
   - **Base URL:** `http://127.0.0.1:1337/v1`
   - **API Key:** `any-value`
   - **Model ID:** `gemini-3-flash-preview`
4. Set as active model

## Windsurf

1. Open Windsurf Settings → **AI Configuration**
2. Select **Custom Provider**
3. Configure:
   - **Endpoint:** `http://127.0.0.1:1337/v1`
   - **API Key:** `any-value`
   - **Model:** `gemini-3-flash-preview`

## GitHub Copilot (Custom Backend)

Copilot requires additional configuration for custom backends. Consult your Copilot plugin's documentation for custom endpoint support.

General settings:

- **Base URL:** `http://127.0.0.1:1337/v1`
- **API Key:** `any-value`
- **Model:** `gemini-3-flash-preview`

## Any OpenAI-Compatible Tool

Akkhar-Magic works with any tool that supports the OpenAI Chat Completions API:

```bash
# Test with curl
curl http://127.0.0.1:1337/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-value" \
  -d '{
    "model": "gemini-3-flash-preview",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

## Changing the Model Name

The model name is cosmetic — it's what gets reported to the IDE. The actual model used is whatever your AI Studio account is configured for.

To change the advertised model name:

```bash
set AKKHAR_MODEL=gemini-2.5-pro
npm run dev
```

Then update your IDE to use `gemini-2.5-pro` as the model name.

## Streaming vs Non-Streaming

Akkhar-Magic supports both modes:

- **Streaming (`"stream": true`)** — Responses arrive as Server-Sent Events (SSE). Recommended for all IDE integrations.
- **Non-streaming (`"stream": false`)** — Full response returned as a single JSON object. Useful for scripts and testing.

Most IDEs default to streaming mode.

## Troubleshooting

### IDE Shows "Connection Refused"

- Verify Akkhar-Magic is running: `curl http://127.0.0.1:1337/health`
- Check the port isn't blocked by a firewall
- Ensure the Base URL includes `/v1` at the end

### IDE Shows "Invalid API Key"

- Akkhar-Magic accepts any API key. If your IDE requires a specific format, try `sk-akkhar-magic-local`.

### Responses Are Empty

- Check the Akkhar-Magic terminal for error messages
- Verify your Google session is still valid: `npm run login`
- Try a simple curl test to isolate the issue

### Response Is Slow on First Request

The first request launches the browser and navigates to AI Studio. This takes 5-10 seconds. Subsequent requests reuse the browser session and are significantly faster.