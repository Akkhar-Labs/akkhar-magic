/**
 * Akkhar-Magic :: Persistent Session Schema
 * ==========================================
 * Defines the on-disk shape of a persisted conversation session.
 *
 * See: LocalDocs/BLUEPRINT_PERSISTENT_SESSIONS.md §2
 *
 * Lifecycle summary:
 *   - First turn  → generate sessionId → inject <AKKHAR_ID_...> into prompt
 *                 → capture chatUrl after AI Studio auto-saves
 *                 → store.create(session)
 *   - Follow-ups  → extract sessionId from message history
 *                 → store.get(sessionId) → navigate to session.chatUrl
 */

// ─── Known IDE Identifiers ───────────────────────────────────────

/**
 * Known IDE identifiers. New ones may be added without breaking changes;
 * `"other"` is the fallback when detection fails.
 */
export type KnownIde =
  | 'continue'
  | 'cursor'
  | 'windsurf'
  | 'cline'
  | 'copilot'
  | 'other';

// ─── Persistent Session Record ───────────────────────────────────

export interface PersistentSession {
  /**
   * Unique session identity — the Akkhar Session ID.
   * Format: "AKID_<timestamp_ms>_<random_hex_6>"
   * Example: "AKID_1715234567890_f7a3b2"
   *
   * Generated on the FIRST TURN and injected into the prompt as:
   *   <AKKHAR_ID_AKID_1715234567890_f7a3b2>
   *
   * On follow-up turns, the IDE echoes the message history (which contains
   * this tag in the first user message) back to us. We extract it and use
   * it as a direct key into the persistent session store.
   */
  sessionId: string;

  /**
   * The AI Studio chat URL for this session.
   * Example: "https://aistudio.google.com/prompts/abc123xyz"
   *
   * THIS IS THE SOVEREIGN FIELD. Without it, session resumption is
   * impossible. Used for direct navigation and delete detection.
   */
  chatUrl: string;

  /**
   * Which IDE created this session.
   * Detected from request headers, user-agent, or message structure
   * patterns. See `KnownIde` for known values.
   */
  ide: KnownIde | string;

  /**
   * The first user message content, truncated to 500 characters.
   * Stored for display/debugging only — NOT used for any matching logic.
   */
  firstMessage: string;

  /** ISO timestamp of session creation. */
  createdAt: string;

  /**
   * ISO timestamp of last activity. Updated on every successful
   * extraction. Used for staleness detection and cleanup.
   */
  lastActivityAt: string;

  /**
   * The Gmail address (Google account email) that owns this AI Studio
   * session. Derived from the active browser profile at session creation.
   *
   * Used to enforce profile-session binding and to surface helpful errors:
   *   "This session belongs to rahat@gmail.com. Please switch profiles."
   */
  gmail: string;

  /**
   * The browser profile name active at session creation.
   * Links to the `profiles/` directory structure.
   */
  profileName: string;

  /**
   * AI-generated conversation title (from TitleCache).
   * May be null if the model didn't generate one or it wasn't captured.
   */
  title: string | null;

  /**
   * Whether this session is known to be deleted in AI Studio.
   * Set true when navigation to chatUrl redirects to /new_chat or 404s.
   *
   * Once true:
   *   - The system will NOT attempt to navigate to this URL again.
   *   - The user receives a polite "session deleted" error.
   *   - The record is retained for historical reference.
   */
  isDeleted: boolean;

  /** Total number of turns (user messages) in this session. */
  turnCount: number;

  /**
   * The model name configured when this session was created.
   * Example: "gemini-3-flash-preview"
   */
  model: string;
}

// ─── Index File Schema ───────────────────────────────────────────

/**
 * Slim metadata stored in `.akkhar/persistent-sessions/index.json`.
 * Enough for fast lookups without reading individual session files.
 * Full session data (including `firstMessage`) lives in per-session files.
 */
export interface PersistentSessionIndexEntry {
  chatUrl: string;
  gmail: string;
  profileName: string;
  createdAt: string;
  lastActivityAt: string;
  isDeleted: boolean;
  title: string | null;
  ide: KnownIde | string;
}

export interface PersistentSessionIndexFile {
  version: '1';
  sessions: Record<string, PersistentSessionIndexEntry>;
}

// ─── Session Resolution (used by SessionResolver in Phase 4) ─────

export type SessionResolution =
  | { type: 'new' }
  | { type: 'resume'; sessionId: string };
