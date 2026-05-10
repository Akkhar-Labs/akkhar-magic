/**
 * Akkhar-Magic :: Provider Interface
 * ===================================
 * Abstract contract that every AI platform provider must implement.
 * Adding a new platform (ChatGPT, Claude, Manus) means implementing
 * this interface — zero changes to api/, services/, or other providers.
 */

import type { Page } from 'puppeteer-core';
import type { CdpMonitor } from '../browser/cdp-monitor.js';

// ─── Callback Types ──────────────────────────────────────────────

export interface ExtractionCallbacks {
  onChunk: (delta: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  /** Called when an AI-generated title is extracted (first turn only) */
  onTitle?: (title: string) => void;
}

// ─── Option Types ────────────────────────────────────────────────

export interface NavigateOptions {
  sessionId: string;
  conversationFingerprint: string;
  isFollowUp: boolean;
}

export interface InjectOptions {
  prompt: string;
  isFollowUp: boolean;
  fullPrompt?: string | null;
  /**
   * Active Akkhar identity to embed in the submitted prompt. Provided
   * on first turns only; absent for follow-ups. The injector appends
   * `<AKKHAR_ID_${sessionId}>` at the very end of the final prompt so
   * the model echoes it back through future conversation history.
   */
  sessionId?: string;
}

// ─── The Provider Interface ──────────────────────────────────────

export interface IProvider {
  /** Unique provider identifier (e.g., 'google-ai-studio', 'chatgpt') */
  readonly name: string;

  /** Base URL for the platform */
  readonly baseUrl: string;

  /** Navigate to a chat (new or existing). Handles smart reuse internally. */
  navigate(page: Page, options: NavigateOptions): Promise<void>;

  /** Inject a prompt into the platform's UI and submit it. */
  inject(page: Page, options: InjectOptions): Promise<void>;

  /** Extract the model's response via CDP or DOM. */
  extract(
    page: Page,
    cdpMonitor: CdpMonitor,
    callbacks: ExtractionCallbacks,
    timeoutMs: number,
  ): Promise<void>;

  /** Check if the given URL belongs to this provider's site. */
  isOnSite(url: string): boolean;

  /** Whether this provider has an active chat that can be reused. */
  hasActiveChat(): boolean;

  /** Reset any internal chat state (e.g., on browser disconnect). */
  resetState(): void;
}
