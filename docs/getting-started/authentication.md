# Authentication

Akkhar-Magic requires a Google account with access to [Google AI Studio](https://aistudio.google.com). Authentication is handled through browser profiles — the same mechanism Chrome uses to store your login state.

## First-Time Login

```bash
npm run login
```

This opens a visible browser window. Complete the following steps:

1. Sign into your Google account
2. Navigate to Google AI Studio (the browser opens directly to it)
3. Accept any terms or permissions if prompted
4. Verify you can see the AI Studio chat interface
5. Close the browser window

Akkhar-Magic saves your session to a local browser profile. You won't need to log in again unless your session expires.

## How Sessions Work

```
First Login:
  Browser opens → You sign in → Session saved to profiles/default/

Subsequent Starts:
  Server starts → Opens browser with saved profile → Already authenticated

Session Expired:
  Server detects auth failure → Re-run `npm run login`
```

## Using a Named Profile

By default, authentication saves to the `default` profile. To use a different profile:

```bash
# Login with a named profile
npm run login -- -p work-account
```

This is useful when you have multiple Google accounts. See [Profiles & Multi-Account](../guides/profiles.md) for details.

## Verifying Authentication

After login, verify everything works:

```bash
# Start the server
npm run dev

# In another terminal, check health
curl http://127.0.0.1:1337/health
```

A successful response:

```json
{
  "status": "ok",
  "version": "0.0.1",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "extraction": { "configuredMode": "auto" }
}
```

## Troubleshooting

### "No Chromium browser found"

Akkhar-Magic couldn't find Chrome, Brave, or Edge on your system. Solutions:

- Install any Chromium-based browser
- Set the path manually: `set AKKHAR_BROWSER_PATH=C:\path\to\chrome.exe`

### Session Expires Frequently

Google sessions typically last 2-4 weeks. If yours expires sooner:

- Ensure you're completing the login fully (not just reaching the Google sign-in page)
- Check that no other process is using the same browser profile directory
- Try creating a dedicated profile: `npm run login -- -p dedicated`

### Browser Opens But AI Studio Doesn't Load

- Check your internet connection
- Verify you can access [aistudio.google.com](https://aistudio.google.com) in your regular browser
- Some corporate networks block AI Studio — try a different network

## Data Security

Your authentication data is stored locally in `profiles/<name>/`. This directory:

- Contains the same data your regular browser stores (cookies, local storage)
- Is **gitignored** by default — never committed to version control
- Is accessible only to your local user account
- Is **never transmitted** to Akkhar-Labs or any external server

## Next Steps

- [IDE Configuration](ide-configuration.md) — Connect your development environment