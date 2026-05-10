/**
 * Akkhar-Magic :: Internal Domain Types
 * ======================================
 * Core types for session management, bridge state, and configuration.
 */

// ─── Session / Archivist Types ───────────────────────────────────

export interface SessionEntry {
  /** IDE-provided or auto-generated session identifier */
  sessionId: string;
  /** The Google AI Studio chat URL for this session */
  chatUrl: string | null;
  /** Which browser profile (userDataDir name) is bound to this session */
  profileName: string;
  /** Model identifier surfaced to the IDE */
  model: string;
  /** ISO timestamp of session creation */
  createdAt: string;
  /** ISO timestamp of last activity */
  updatedAt: string;
}

export interface AkkharHeaderFile {
  version: string;
  activeProfile: string;
  sessions: Record<string, SessionEntry>;
}

// ─── Profile Types ───────────────────────────────────────────────

export interface BrowserProfile {
  /** Unique profile name (e.g., "default", "account-2") */
  name: string;
  /** Absolute path to the Chrome userDataDir */
  userDataDir: string;
  /** Whether this profile has been authenticated (user logged into Google) */
  authenticated: boolean;
  /** ISO timestamp of last usage */
  lastUsed: string;
  /**
   * Gmail address (Google account email) bound to this profile.
   * Captured once at `npm run login` time (Phase 2 of persistent sessions).
   * Optional for backwards compatibility with v0.0.1 profiles.
   */
  gmail?: string;
}

export interface ProfileRegistry {
  profiles: BrowserProfile[];
  activeProfile: string;
}

// ─── Extraction Mode ─────────────────────────────────────────────

/** Controls how response data is extracted from AI Studio */
export type ExtractionMode = 'dom' | 'network' | 'auto';

/** Tracks which extraction engine is currently active at runtime */
export type ActiveExtractionEngine =
  | 'dom'
  | 'network-fetch-hook'
  | 'network-cdp';

// ─── Bridge Types ────────────────────────────────────────────────

export type BridgeStatus =
  | 'idle'
  | 'launching'
  | 'navigating'
  | 'injecting'
  | 'extracting'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'limit_reached';

export interface BridgeState {
  status: BridgeStatus;
  currentSessionId: string | null;
  currentChatUrl: string | null;
  browserConnected: boolean;
  lastError: string | null;
  /** Which extraction engine is currently active */
  activeExtractionEngine: ActiveExtractionEngine;
  /** Configured extraction mode from env/config */
  configuredExtractionMode: ExtractionMode;
}

export interface ExtractionResult {
  /** The full text extracted so far */
  text: string;
  /** Whether the generation is still in progress */
  isGenerating: boolean;
  /** If the UI indicates a limit was reached */
  limitReached: boolean;
}

// ─── Server Config ───────────────────────────────────────────────

export interface ServerConfig {
  port: number;
  host: string;
  /** Model name to advertise to IDEs */
  modelName: string;
  /** Path to the Chromium executable (auto-discovered or manual override) */
  executablePath: string;
  /** Base URL for Google AI Studio */
  googleAiStudioBaseUrl: string;
  /** Directory for .akkhar header files */
  dataDir: string;
  /** Directory for browser profiles */
  profilesDir: string;
  /** Headless mode: false (visible), true (new headless — real Chrome, hidden window) */
  headless: boolean;
  /** Anthropic-style typing simulation delays (ms) */
  typingDelayMin: number;
  typingDelayMax: number;
  /** Polling interval for DOM extraction (ms) */
  extractionPollInterval: number;
  /** Max wait time for generation to complete (ms) */
  generationTimeout: number;
  /** Extraction strategy: 'dom' (V0.0.1), 'network' (V0.0.2), or 'auto' (try network, fallback to dom) */
  extractionMode: ExtractionMode;
}
