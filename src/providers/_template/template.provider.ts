/**
 * Akkhar-Magic :: Template Provider
 * ==================================
 * Copy this folder to create a new provider.
 * Rename all files and classes to match your platform.
 *
 * Steps:
 *   1. Copy _template/ → your-platform/
 *   2. Rename TemplateProvider → YourPlatformProvider
 *   3. Implement all IProvider methods
 *   4. Register in providers/index.ts
 */

import type { Page } from 'puppeteer-core';
import type { CdpMonitor } from '../../browser/cdp-monitor.js';
import type {
  IProvider,
  NavigateOptions,
  InjectOptions,
  ExtractionCallbacks,
} from '../../types/provider.js';

export class TemplateProvider implements IProvider {
  readonly name = 'template';
  readonly baseUrl = 'https://example.com';

  async navigate(_page: Page, _options: NavigateOptions): Promise<void> {
    throw new Error('Not implemented: navigate()');
  }

  async inject(_page: Page, _options: InjectOptions): Promise<void> {
    throw new Error('Not implemented: inject()');
  }

  async extract(
    _page: Page,
    _cdpMonitor: CdpMonitor,
    _callbacks: ExtractionCallbacks,
    _timeoutMs: number,
  ): Promise<void> {
    throw new Error('Not implemented: extract()');
  }

  isOnSite(_url: string): boolean {
    return false;
  }

  hasActiveChat(): boolean {
    return false;
  }

  resetState(): void {
    // Reset any internal state
  }
}
