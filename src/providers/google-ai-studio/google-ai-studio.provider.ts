/**
 * Akkhar-Magic :: Google AI Studio Provider
 * ============================================
 * Implements IProvider for Google AI Studio.
 * Encapsulates all Google AI Studio-specific logic: navigation, injection, extraction.
 */

import type { Page } from 'puppeteer-core';
import type { CdpMonitor } from '../../browser/cdp-monitor.js';
import type {
  IProvider,
  NavigateOptions,
  InjectOptions,
  ExtractionCallbacks,
} from '../../types/provider.js';
import {
  GOOGLE_AI_STUDIO_BASE_URL,
  GOOGLE_AI_STUDIO_ENDPOINTS,
} from './constants.js';
import { GoogleAiStudioNavigator } from './navigator.js';
import { GoogleAiStudioInjector } from './injector.js';
import { GoogleAiStudioExtractor } from './extractor.js';
import { createLogger } from '../../utils/index.js';

const log = createLogger('GoogleAiStudioProvider');

export class GoogleAiStudioProvider implements IProvider {
  readonly name = 'google-ai-studio';
  readonly baseUrl = GOOGLE_AI_STUDIO_BASE_URL;

  private navigator = new GoogleAiStudioNavigator();
  private injector = new GoogleAiStudioInjector();
  private extractor = new GoogleAiStudioExtractor();

  /** Configure CDP monitor with Google AI Studio endpoint patterns */
  configureCdp(cdpMonitor: CdpMonitor): void {
    cdpMonitor.setEndpointPatterns([...GOOGLE_AI_STUDIO_ENDPOINTS]);
  }

  async navigate(page: Page, options: NavigateOptions): Promise<void> {
    await this.navigator.navigate(page, options);
    this.injector.setHasActiveContext(this.navigator.hasActiveChat());
  }

  async inject(page: Page, options: InjectOptions): Promise<void> {
    this.injector.setHasActiveContext(this.navigator.hasActiveChat());
    await this.injector.inject(page, options);
  }

  async extract(
    page: Page,
    cdpMonitor: CdpMonitor,
    callbacks: ExtractionCallbacks,
    timeoutMs: number,
  ): Promise<void> {
    const useDomFallback = cdpMonitor.isCircuitBreakerTripped();

    await this.extractor.extract(
      page,
      cdpMonitor,
      callbacks,
      timeoutMs,
      useDomFallback,
    );

    // Record success for navigator's chat freshness tracking
    this.navigator.recordSuccess(page.url());
  }

  isOnSite(url: string): boolean {
    return url.includes('aistudio.google.com');
  }

  hasActiveChat(): boolean {
    return this.navigator.hasActiveChat();
  }

  resetState(): void {
    this.navigator.resetState();
    log.info('State reset');
  }
}
