# Profiles & Multi-Account

Akkhar-Magic supports multiple Google accounts through browser profiles. Each
profile is an isolated browser environment with its own cookies, session data,
and authentication state.

## How Profiles Work

```
profiles/
├── default/        # Default profile (created on first login)
├── work-account/   # A work Google account
└── personal/       # A personal Google account
```

Each profile directory is a complete Chromium user data directory — the same
structure Chrome uses internally.

## Managing Profiles

### Create a Profile

```bash
npm run cli -- create-profile work-account
```

### Authenticate a Profile

```bash
npm run login -- -p work-account
```

### Switch Active Profile

```bash
npm run switch -- work-account
```

The server uses the active profile for all subsequent requests. Restart the
server after switching.

### List All Profiles

```bash
npm run cli -- profiles
```

Output:

```
✦ Browser Profiles
─────────────────────────────────────────────

  default [ACTIVE]
    Status:    authenticated
    Data dir:  /path/to/profiles/default
    Last used: 2025-01-01T12:00:00.000Z

  work-account
    Status:    authenticated
    Data dir:  /path/to/profiles/work-account
    Last used: 2025-01-01T10:00:00.000Z
```

## Use Cases

### Separate Work and Personal Accounts

Create a profile for each Google account. Switch between them as needed:

```bash
# Work tasks
npm run switch -- work-account
npm run dev

# Personal projects
npm run switch -- personal
npm run dev
```

### Account Switching

Google AI Studio applies usage limits per account. Multiple profiles allow you
to switch between accounts when needed:

```bash
# Switch to a different account
npm run switch -- account-2
# Restart the server
npm run dev
```

### Team Sharing

Each team member creates their own profile on a shared development machine.
Profiles are isolated — one person's session doesn't affect another.

## Data Storage

Profile data is stored in the `profiles/` directory at the project root. This
directory is:

- **Gitignored** — never committed to version control
- **Local only** — never transmitted externally
- **Self-contained** — can be backed up by copying the directory

## Limitations

- Only one profile can be active at a time
- Switching profiles requires a server restart
- Profile data is stored unencrypted (same as Chrome's local storage)
