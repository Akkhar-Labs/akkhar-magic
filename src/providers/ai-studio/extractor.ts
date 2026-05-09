/**
 * Akkhar-Magic :: AI Studio Extractor
 * =====================================
 * Extracts Gemini responses via CDP network interception (primary)
 * with DOM fallback. Handles both streaming and complete responses.
 */

import type { Page } from 'puppeteer-core';
import type { CdpMonitor } from '../../browser/cdp-monitor.js';
import type { ExtractionCallbacks } from '../../types/provider.js';
import { extractAllTags } from '../../network/tag-extractor.js';
import {
  detectRpcError,
  detectStreamError,
  detectDomError,
} from '../../network/error-detector.js';
import { parseAiStudioResponse } from './response-parser.js';
import { AI_STUDIO_SELECTORS } from './selectors.js';
import {
  STABLE_POLL_THRESHOLD,
  FIRST_RESPONSE_TIMEOUT,
} from '../../constants/timing.js';
import { createLogger, sleep } from '../../utils/index.js';

const log = createLogger('AiStudioExtractor');

export class AiStudioExtractor {
  /**
   * Extracts response via CDP network interception.
   * Falls back to DOM if circuit breaker is tripped.
   */
  async extract(
    page: Page,
    cdpMonitor: CdpMonitor,
    callbacks: ExtractionCallbacks,
    timeoutMs: number,
    useDomFallback: boolean = false,
  ): Promise<void> {
    if (useDomFallback) {
      await this.extractViaDOM(page, callbacks, timeoutMs);
      return;
    }

    await this.extractViaCDP(page, cdpMonitor, callbacks, timeoutMs);
  }

  /** CDP-based extraction (primary) */
  private async extractViaCDP(
    _page: Page,
    cdpMonitor: CdpMonitor,
    callbacks: ExtractionCallbacks,
    timeoutMs: number,
  ): Promise<void> {
    log.info('Starting CDP extraction...');

    let accumulatedText = '';

    // Wire up the CDP monitor to accumulate text
    cdpMonitor.onResponseBody = (_requestId: string, rawBody: string) => {
      // Layer 1: Check for structured RPC errors
      const rpcError = detectRpcError(rawBody);
      if (rpcError) {
        log.error(`RPC error detected: ${rpcError.message}`);
        cdpMonitor.signalError(rpcError);
        return;
      }

      // Layer 2: Scan raw body for known error strings
      const streamError = detectStreamError(rawBody);
      if (streamError) {
        log.error(`Stream error detected: ${streamError.message}`);
        cdpMonitor.signalError(streamError);
        return;
      }

      // Parse the response
      const fragments = parseAiStudioResponse(rawBody);
      for (const text of fragments) {
        if (text.length === 0) continue;

        if (
          text.startsWith(accumulatedText) &&
          text.length > accumulatedText.length
        ) {
          accumulatedText = text;
        } else {
          accumulatedText += text;
        }
      }

      // Extract tagged response + title (strips thinking)
      const { response: cleanText, title } = extractAllTags(accumulatedText);

      log.info(
        `Extraction complete — ${cleanText.length} chars (engine: network-cdp)`,
      );

      // Deliver title if present
      if (title && callbacks.onTitle) {
        callbacks.onTitle(title);
      }

      // Deliver as single chunk + complete
      if (cleanText.length > 0) {
        cdpMonitor.signalChunk(cleanText);
      }
      cdpMonitor.signalComplete(cleanText);
    };

    // Start listening
    return new Promise<void>((resolve, reject) => {
      cdpMonitor.startListening(
        {
          onChunk: delta => callbacks.onChunk(delta),
          onComplete: fullText => {
            callbacks.onComplete(fullText);
            resolve();
          },
          onError: err => {
            callbacks.onError(err);
            reject(err);
          },
        },
        timeoutMs,
      );
    });
  }

  /** DOM-based extraction (V0.0.1 fallback) */
  private async extractViaDOM(
    page: Page,
    callbacks: ExtractionCallbacks,
    timeoutMs: number,
  ): Promise<void> {
    log.info('Starting DOM extraction (fallback)...');

    let previousText = '';
    let stableCount = 0;
    let responseStarted = false;
    const startTime = Date.now();

    try {
      // Phase 1: Wait for first response
      const deadline = Date.now() + FIRST_RESPONSE_TIMEOUT;

      while (Date.now() < deadline) {
        const hasResponse = await page.evaluate(sel => {
          const primary = document.querySelector(sel.responseText);
          if (primary?.textContent?.trim()) return true;
          for (const s of sel.responseFallbacks) {
            const el = document.querySelector(s);
            if (el?.textContent?.trim()) return true;
          }
          for (const s of sel.structuredOutputSelectors) {
            const el = document.querySelector(s);
            if (el?.textContent?.trim()) return true;
          }
          return false;
        }, AI_STUDIO_SELECTORS);

        if (hasResponse) {
          responseStarted = true;
          log.info('First response detected');
          break;
        }

        // Layer 3: Scan DOM for error banners
        const bannerText = await page.evaluate(sel => {
          const el = document.querySelector(sel.limitBanner);
          return el?.textContent?.trim() ?? '';
        }, AI_STUDIO_SELECTORS);

        if (bannerText.length > 0) {
          const domError = detectDomError(bannerText);
          if (domError) {
            log.error(`DOM error detected: ${domError.message}`);
            callbacks.onError(domError);
            return;
          }
        }

        await sleep(500);
      }

      if (!responseStarted) {
        callbacks.onComplete('');
        return;
      }

      // Phase 2: Streaming extraction loop
      while (true) {
        if (Date.now() - startTime > timeoutMs) {
          callbacks.onComplete(previousText);
          break;
        }

        const currentText = await this.scrapeText(page);

        if (currentText.length > previousText.length) {
          const delta = currentText.slice(previousText.length);
          callbacks.onChunk(delta);
          previousText = currentText;
          stableCount = 0;
        } else if (
          currentText.length === previousText.length &&
          currentText.length > 0
        ) {
          stableCount++;
        }

        if (stableCount >= STABLE_POLL_THRESHOLD) {
          const generating = await this.isGenerating(page);
          if (!generating) {
            log.info(`DOM extraction complete — ${previousText.length} chars`);
            callbacks.onComplete(previousText);
            return;
          }
          stableCount = Math.max(0, stableCount - 2);
        }

        await sleep(150);
      }
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** Scrape current response text from DOM */
  private async scrapeText(page: Page): Promise<string> {
    return page.evaluate(sel => {
      const containers = document.querySelectorAll(sel.responseText);
      if (containers.length > 0) {
        return containers[containers.length - 1].textContent?.trim() ?? '';
      }
      for (const s of sel.responseFallbacks) {
        const els = document.querySelectorAll(s);
        if (els.length > 0) {
          return els[els.length - 1].textContent?.trim() ?? '';
        }
      }
      return '';
    }, AI_STUDIO_SELECTORS);
  }

  /** Check if AI Studio is still generating */
  private async isGenerating(page: Page): Promise<boolean> {
    return page.evaluate(sel => {
      for (const s of sel.toolInputIndicators) {
        const el = document.querySelector(s);
        if (el) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden')
            return false;
        }
      }
      const stopBtn = document.querySelector(sel.stopButton);
      if (stopBtn) {
        const style = window.getComputedStyle(stopBtn);
        if (style.display !== 'none' && style.visibility !== 'hidden')
          return true;
      }
      const runBtn = document.querySelector(
        sel.runButton,
      ) as HTMLButtonElement | null;
      if (runBtn && !runBtn.disabled) return false;
      return false;
    }, AI_STUDIO_SELECTORS);
  }
}
