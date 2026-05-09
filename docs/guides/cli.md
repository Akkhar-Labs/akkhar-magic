# CLI Reference

Akkhar-Magic includes a command-line interface for managing profiles, sessions, and authentication.

## Commands

### `login`

Open a browser window to authenticate with Google AI Studio.

```bash
npm run login
npm run login -- -p <profile-name>
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --profile <name>` | `default` | Profile to authenticate |

The browser opens directly to AI Studio. Sign into your Google account, then close the browser window when done. The session is saved to the specified profile.

If the profile doesn't exist, it will be created automatically.

---

### `switch`

Switch the active browser profile (identity hot-swap).

```bash
npm run switch -- <profile-name>
```

Changes which Google account is used for subsequent requests. The server must be restarted for the change to take effect.

---

### `status`

Display current system status.

```bash
npm run status
```

Shows:
- Server configuration (host, port, model)
- All profiles with authentication status
- Recent sessions

---

### `profiles`

List all browser profiles.

```bash
npm run cli -- profiles
```

Displays each profile's name, authentication status, data directory, and last usage time.

---

### `create-profile`

Create a new browser profile.

```bash
npm run cli -- create-profile <name>
```

Creates an empty profile directory. Run `npm run login -- -p <name>` afterwards to authenticate.

---

### `sessions`

List all tracked sessions.

```bash
npm run cli -- sessions
```

Displays session IDs, associated profiles, models, chat URLs, and timestamps.

---

## Full Help

```bash
npm run cli -- --help
```

Output:

```
Usage: akkhar-magic [options] [command]

Akkhar-Magic CLI — UI-to-API Bridge Management

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  login [options]     Open a visible browser to log into Google AI Studio
  switch <profile>    Switch the active browser profile
  status              Show current system status
  profiles            List all browser profiles
  create-profile <name>  Create a new browser profile
  sessions            List all tracked sessions
  help [command]      display help for command
```