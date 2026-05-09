/**
 * Akkhar-Magic :: Browser Types
 * ==============================
 * Types specific to browser automation and chat state tracking.
 */

/** Tracks the current AI Studio chat for multi-turn reuse */
export interface ActiveChatState {
  /** Hash of first user message — stable conversation identity across all turns */
  conversationFingerprint: string;
  /** How many turns have been completed in this chat */
  turnCount: number;
  /** Timestamp of the last successful extraction */
  lastActivityTime: number;
  /** Whether the page is currently on a valid chat */
  isActive: boolean;
}

/** State of the browser launcher */
export interface BrowserState {
  connected: boolean;
  status:
    | 'idle'
    | 'launching'
    | 'navigating'
    | 'injecting'
    | 'extracting'
    | 'error';
  lastError: string | null;
}
