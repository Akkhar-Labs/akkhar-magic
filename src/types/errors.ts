/**
 * Akkhar-Magic :: Typed Error Hierarchy
 * ======================================
 * Deterministic, typed errors for the entire system.
 * Every catch site can match on `error.code` for programmatic handling.
 */

export class AkkharError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AkkharError';
  }
}

export class AuthExpiredError extends AkkharError {
  constructor() {
    super(
      'Google session expired. Run `npm run login` to re-authenticate.',
      'AUTH_EXPIRED',
    );
    this.name = 'AuthExpiredError';
  }
}

export class RateLimitError extends AkkharError {
  constructor() {
    super(
      'AI Studio rate limit reached. Switch profile with `npm run switch`.',
      'RATE_LIMIT',
    );
    this.name = 'RateLimitError';
  }
}

export class ExtractionTimeoutError extends AkkharError {
  constructor(timeoutMs: number) {
    super(
      `No response intercepted within ${timeoutMs}ms.`,
      'EXTRACTION_TIMEOUT',
    );
    this.name = 'ExtractionTimeoutError';
  }
}

export class BrowserDisconnectedError extends AkkharError {
  constructor() {
    super('Browser disconnected unexpectedly.', 'BROWSER_DISCONNECTED');
    this.name = 'BrowserDisconnectedError';
  }
}

export class PromptInjectionError extends AkkharError {
  constructor(reason: string) {
    super(`Prompt injection failed: ${reason}`, 'INJECTION_FAILED');
    this.name = 'PromptInjectionError';
  }
}

export class SafetyFilterError extends AkkharError {
  constructor() {
    super(
      'AI Studio safety filter triggered. The content was blocked.',
      'SAFETY_FILTER',
    );
    this.name = 'SafetyFilterError';
  }
}

export class InternalProviderError extends AkkharError {
  constructor() {
    super(
      'AI Studio internal error. The provider returned an unexpected failure.',
      'INTERNAL_PROVIDER_ERROR',
    );
    this.name = 'InternalProviderError';
  }
}

export class RpcError extends AkkharError {
  constructor(
    public readonly rpcCode: number,
    rpcMessage: string,
  ) {
    super(`Google RPC error ${rpcCode}: ${rpcMessage}`, 'RPC_ERROR');
    this.name = 'RpcError';
  }
}

// ─── Persistent Session Errors ───────────────────────────────────
// See: LocalDocs/BLUEPRINT_PERSISTENT_SESSIONS.md §9

/**
 * Stable error codes for the persistent-session subsystem.
 * Surfaced through the OpenAI-compatible error response shape.
 */
export const PERSISTENT_SESSION_ERROR_CODES = {
  SESSION_DELETED: 'session_deleted',
  SESSION_PROFILE_MISMATCH: 'session_profile_mismatch',
  SESSION_NOT_FOUND: 'session_not_found',
} as const;

export type PersistentSessionErrorCode =
  (typeof PERSISTENT_SESSION_ERROR_CODES)[keyof typeof PERSISTENT_SESSION_ERROR_CODES];

/**
 * The conversation's saved chatUrl no longer resolves in AI Studio
 * (redirected to /new_chat or 404'd). The session is permanently marked
 * deleted; the user must start a new conversation.
 */
export class SessionDeletedError extends AkkharError {
  constructor(
    public readonly sessionId: string,
    public readonly title: string | null,
    public readonly createdAt: string,
    public readonly gmail: string,
  ) {
    const titlePart = title ? ` titled "${title}"` : '';
    super(
      `Akkhar-Magic: This conversation was deleted in Google AI Studio. ` +
        `The session${titlePart} (created ${createdAt.slice(0, 10)}, ` +
        `account: ${gmail}) no longer exists. ` +
        `Please start a new conversation.`,
      PERSISTENT_SESSION_ERROR_CODES.SESSION_DELETED,
    );
    this.name = 'SessionDeletedError';
  }
}

/**
 * The session belongs to a different Gmail account than the one currently
 * active. The user must switch profiles to resume it.
 */
export class SessionProfileMismatchError extends AkkharError {
  constructor(
    public readonly sessionGmail: string,
    public readonly sessionProfileName: string,
    public readonly activeGmail: string,
    public readonly activeProfileName: string,
  ) {
    super(
      `Akkhar-Magic: This conversation belongs to ${sessionGmail} ` +
        `(profile: "${sessionProfileName}"). You are currently using ` +
        `${activeGmail} (profile: "${activeProfileName}"). ` +
        `Switch profiles with: npm run switch -- ${sessionProfileName}`,
      PERSISTENT_SESSION_ERROR_CODES.SESSION_PROFILE_MISMATCH,
    );
    this.name = 'SessionProfileMismatchError';
  }
}

/**
 * A follow-up arrived carrying an AKKHAR_ID, but no matching record exists
 * in the persistent store (e.g., the store was wiped, or the session was
 * created before persistent sessions were enabled).
 */
export class SessionNotFoundError extends AkkharError {
  constructor(public readonly sessionId: string) {
    super(
      `Akkhar-Magic: No saved session found for this conversation. ` +
        `This may happen if the server was restarted before persistent ` +
        `sessions were enabled. Starting a new conversation.`,
      PERSISTENT_SESSION_ERROR_CODES.SESSION_NOT_FOUND,
    );
    this.name = 'SessionNotFoundError';
  }
}
