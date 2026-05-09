/**
 * Akkhar-Magic :: AI Studio Navigator
 * =====================================
 * Handles navigation to AI Studio chats with smart multi-turn reuse.
 */

import type { Page } from 'puppeteer-core';
import type { ActiveChatState } from '../../types/browser.js';
import type { NavigateOptions } from '../../types/provider.js';
import { CHAT_STALE_TIMEOUT } from '../../constants/timing.js';
import { AI_STUDIO_NEW_CHAT_URL } from './constants.js';
import { createLogger, humanDelay } from '../../utils/index.js';

const log = createLogger('AiStudioNav');

export class AiStudioNavigator {
  private activeChatState: ActiveChatState | null = null;
  private lastActiveChatUrl: string | null = null;

  /** Whether an active chat exists that can accept follow-ups */
  hasActiveChat(): boolean {
    return this.activeChatState !== null && this.activeChatState.isActive;
  }

  /** Reset all navigation state (e.g., on browser disconnect) */
  resetState(): void {
    this.activeChatState = null;
  }

  /** Record a successful extraction — keeps chat state fresh */
  recordSuccess(pageUrl: string): void {
    if (this.activeChatState) {
      this.activeChatState.lastActivityTime = Date.now();
    }
    this.lastActiveChatUrl = pageUrl;
  }

  /** Smart navigation: reuse chat for follow-ups, new chat otherwise */
  async navigate(page: Page, options: NavigateOptions): Promise<void> {
    const { conversationFingerprint, isFollowUp } = options;

    // Can we reuse the current chat?
    if (isFollowUp && this.activeChatState) {
      const chat = this.activeChatState;
      const isFingerprintMatch =
        chat.conversationFingerprint === conversationFingerprint;
      const isFresh = Date.now() - chat.lastActivityTime < CHAT_STALE_TIMEOUT;
      const currentUrl = page.url();
      const isOnSite = currentUrl.includes('aistudio.google.com');

      if (chat.isActive && isFingerprintMatch && isFresh && isOnSite) {
        chat.turnCount++;
        log.info(
          `♻️ Reusing existing chat (turn ${chat.turnCount}, fp=${conversationFingerprint.slice(0, 8)})`,
        );
        return;
      }

      if (!isFingerprintMatch) log.info('Conversation changed — new chat');
      else if (!isFresh) log.info('Chat stale (>10 min) — new chat');
      else if (!isOnSite) log.info('Page navigated away — new chat');
    }

    // Navigate to new chat
    if (isFollowUp && this.lastActiveChatUrl) {
      log.info(
        `🔄 Attempting chat recovery: ${this.lastActiveChatUrl.slice(-40)}`,
      );
    }

    const targetUrl = AI_STUDIO_NEW_CHAT_URL;
    log.info(`Going to: ${targetUrl}`);

    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    });

    await humanDelay(1000, 2000);
    this.lastActiveChatUrl = null;

    const currentUrl = page.url();
    log.info(`Navigation complete: ${currentUrl}`);

    // Initialize new chat state
    this.activeChatState = {
      conversationFingerprint,
      turnCount: 1,
      lastActivityTime: Date.now(),
      isActive: true,
    };
    log.info(
      `🆕 New chat initialized (fp=${conversationFingerprint.slice(0, 8)})`,
    );
  }
}
