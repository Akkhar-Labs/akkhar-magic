/**
 * Akkhar-Magic :: Browser Launcher
 * =================================
 * Manages Puppeteer browser lifecycle: launch, shutdown, reconnect.
 * Shared infrastructure — providers use the page, they don't own the browser.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer-core';
import type { ServerConfig } from '../types/index.js';
import { createLogger } from '../utils/index.js';

puppeteer.use(StealthPlugin());

const log = createLogger('BrowserLauncher');

export class BrowserLauncher {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private connected: boolean = false;
  private onDisconnect: (() => void) | null = null;

  constructor(private config: ServerConfig) {}

  /** Whether the browser is currently connected */
  isConnected(): boolean {
    return this.connected;
  }

  /** Returns the active page. Throws if not launched. */
  getPage(): Page {
    if (!this.page || !this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.page;
  }

  /** Register a callback for browser disconnect events */
  setOnDisconnect(fn: () => void): void {
    this.onDisconnect = fn;
  }

  /** Launches the stealth browser with the given userDataDir. */
  async launch(userDataDir: string): Promise<Page> {
    if (this.browser) {
      log.warn('Browser already launched. Closing existing instance...');
      await this.shutdown();
    }

    log.info(`[LAUNCH] Starting browser with profile: ${userDataDir}`);

    this.browser = await (
      puppeteer as unknown as typeof import('puppeteer-core')
    ).launch({
      headless: this.config.headless,
      executablePath: this.config.executablePath,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--lang=en-US,en',
        '--disable-session-crashed-bubble',
        '--disable-features=TabRestore',
        '--no-first-run',
        '--no-default-browser-check',
        '--restore-last-session=false',
      ],
      defaultViewport: { width: 1920, height: 1080 },
      ignoreDefaultArgs: ['--enable-automation'],
    });

    // Close restored tabs, keep one clean page
    const pages = await this.browser.pages();
    if (pages.length > 0) {
      this.page = pages[0];
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close().catch(() => {});
      }
      log.info(`[LAUNCH] Closed ${pages.length - 1} restored tab(s)`);
    } else {
      this.page = await this.browser.newPage();
    }

    // Stealth headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Override navigator.webdriver
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    this.connected = true;
    log.info('[LAUNCH] Browser launched successfully');

    // Handle disconnect
    this.browser.on('disconnected', () => {
      this.connected = false;
      this.browser = null;
      this.page = null;
      log.warn('[LAUNCH] Browser disconnected');
      this.onDisconnect?.();
    });

    return this.page;
  }

  /** Gracefully shuts down the browser. */
  async shutdown(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        log.warn('[SHUTDOWN] Error closing browser', err);
      }
      this.browser = null;
      this.page = null;
      this.connected = false;
      log.info('[SHUTDOWN] Browser shut down');
    }
  }

  /** Opens a visible browser for manual login. Returns when user closes it. */
  async openLoginBrowser(
    userDataDir: string,
    targetUrl: string,
  ): Promise<void> {
    const loginBrowser = await (
      puppeteer as unknown as typeof import('puppeteer-core')
    ).launch({
      headless: false,
      executablePath: this.config.executablePath,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
      ],
      defaultViewport: null,
    });

    const pages = await loginBrowser.pages();
    const loginPage = pages[0] || (await loginBrowser.newPage());

    await loginPage.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 60_000,
    });

    log.info('[LOGIN] Browser opened. Please sign in.');
    log.info('[LOGIN] Close the browser window when done...');

    await new Promise<void>(resolve => {
      loginBrowser.on('disconnected', () => resolve());
    });
  }
}
