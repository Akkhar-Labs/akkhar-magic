/**
 * Akkhar-Magic :: AI Studio Provider
 * ====================================
 * Implements IProvider for Google AI Studio.
 * Encapsulates all AI Studio-specific logic: navigation, injection, extraction.
 */

import type { Page } from 'puppeteer-core';
import type { CdpMonitor } from '../../browser/cdp-monitor.js';
import type {
  IProvider,
  NavigateOptions,
  InjectOptions,
  ExtractionCallbacks,
} from '../../types/provider.js';
import { AI_STUDIO_BASE_URL, AI_STUDIO_ENDPOINTS } from './constants.js';
import { AiStudioNavigator } from './navigator.js';
import { AiStudioInjector } from './injector.js';
import { AiStudioExtractor } from './extractor.js';
import { createLogger } from '../../utils/index.js';

const log = createLogger('AiStudioProvider');

export class AiStudioProvider implements IProvider {
  readonly name = 'ai-studio';
  readonly baseUrl = AI_STUDIO_BASE_URL;

  private navigator = new AiStudioNavigator();
  private injector = new AiStudioInjector();
  private extractor = new AiStudioExtractor();

  /** Configure CDP monitor with AI Studio endpoint patterns */
  configureCdp(cdpMonitor: CdpMonitor): void {
    cdpMonitor.setEndpointPatterns([...AI_STUDIO_ENDPOINTS]);
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
