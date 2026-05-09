/**
 * Akkhar-Magic :: CDP Monitor
 * ============================
 * Manages Chrome DevTools Protocol sessions and Network.enable monitoring.
 * Shared infrastructure — providers register URL patterns and receive callbacks.
 *
 * Operates BELOW JavaScript — immune to Google's prototype restoration.
 */

import type { Page, CDPSession } from 'puppeteer-core';
import { createLogger } from '../utils/index.js';
import {
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_WINDOW,
} from '../constants/circuit-breaker.js';

const log = createLogger('CdpMonitor');

export interface CdpCallbacks {
  onChunk: (delta: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

interface CircuitBreakerState {
  consecutiveFailures: number;
  lastFailureTime: number;
  tripped: boolean;
}

export class CdpMonitor {
  private cdpSession: CDPSession | null = null;
  private active: boolean = false;
  private trackedRequestIds: Map<string, string> = new Map();
  private activeGenerationRequestId: string | null = null;
  private currentCallbacks: CdpCallbacks | null = null;
  private completionTimeout: ReturnType<typeof setTimeout> | null = null;
  private responseReceived: boolean = false;
  private endpointPatterns: string[] = [];

  /** Called by providers to process accumulated text before delivery */
  public onResponseBody: ((requestId: string, body: string) => void) | null =
    null;

  private circuitBreaker: CircuitBreakerState = {
    consecutiveFailures: 0,
    lastFailureTime: 0,
    tripped: false,
  };

  /** Set the URL patterns this monitor should track */
  setEndpointPatterns(patterns: string[]): void {
    this.endpointPatterns = patterns;
  }

  /** Whether the circuit breaker has tripped */
  isCircuitBreakerTripped(): boolean {
    return this.circuitBreaker.tripped;
  }

  /** Reset circuit breaker */
  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      consecutiveFailures: 0,
      lastFailureTime: 0,
      tripped: false,
    };
    log.info('[CIRCUIT-BREAKER] Reset');
  }

  /** Attach to a page and start passive network monitoring */
  async attach(page: Page): Promise<void> {
    if (this.active) {
      log.debug('Already active');
      return;
    }

    this.cdpSession = await page.createCDPSession();
    await this.cdpSession.send('Network.enable');

    // Track matching requests
    this.cdpSession.on('Network.requestWillBeSent', (event: any) => {
      const { requestId, request } = event;
      const url = request?.url ?? '';

      if (this.isTrackedUrl(url)) {
        const method = (request?.method ?? '').toUpperCase();
        if (method === 'OPTIONS') return;

        this.trackedRequestIds.set(requestId, url);
        log.info(`Tracking: ${requestId} → ${url.slice(-60)}`);

        if (this.currentCallbacks && !this.activeGenerationRequestId) {
          this.activeGenerationRequestId = requestId;
          log.info(`★ Bound to active generation: ${requestId}`);
        }
      }
    });

    // Capture response body on completion
    this.cdpSession.on('Network.loadingFinished', async (event: any) => {
      const { requestId } = event;
      if (!this.trackedRequestIds.has(requestId)) return;

      const url = this.trackedRequestIds.get(requestId)!;
      this.trackedRequestIds.delete(requestId);

      if (requestId !== this.activeGenerationRequestId) return;

      try {
        const { body, base64Encoded } = await this.cdpSession!.send(
          'Network.getResponseBody',
          { requestId },
        );

        const text = base64Encoded
          ? Buffer.from(body, 'base64').toString('utf-8')
          : body;

        log.info(`★ Response body: ${text.length} bytes (${url.slice(-60)})`);
        this.activeGenerationRequestId = null;
        this.responseReceived = true;

        // Delegate to provider's response handler
        if (this.onResponseBody) {
          this.onResponseBody(requestId, text);
        }
      } catch (err) {
        log.error(`Failed to get response body for ${requestId}`, err);
      }
    });

    // Handle failed requests
    this.cdpSession.on('Network.loadingFailed', (event: any) => {
      const { requestId, errorText } = event;
      if (!this.trackedRequestIds.has(requestId)) return;

      this.trackedRequestIds.delete(requestId);
      log.error(`Request failed: ${requestId} — ${errorText}`);

      if (requestId === this.activeGenerationRequestId) {
        this.activeGenerationRequestId = null;
        this.recordFailure();
        if (this.currentCallbacks) {
          this.currentCallbacks.onError(
            new Error(`CDP_REQUEST_FAILED: ${errorText}`),
          );
          this.currentCallbacks = null;
        }
      }
    });

    this.active = true;
    log.info(
      'Network monitor activated — passively monitoring all HTTP traffic',
    );
  }

  /** Detach CDP session */
  async detach(): Promise<void> {
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch {
        // Ignore
      }
      this.cdpSession = null;
    }
    this.active = false;
    this.trackedRequestIds.clear();
    this.clearCompletionTimeout();
    log.info('Detached');
  }

  /** Start listening for the next generation response */
  startListening(callbacks: CdpCallbacks, timeoutMs: number): void {
    this.currentCallbacks = callbacks;
    this.responseReceived = false;
    this.activeGenerationRequestId = null;
    this.clearCompletionTimeout();

    log.info(`Listening for response (timeout: ${timeoutMs}ms)`);

    this.completionTimeout = setTimeout(() => {
      if (!this.responseReceived) {
        log.warn('Timeout — no response received');
        this.recordFailure();
        callbacks.onError(
          new Error('NETWORK_EXTRACTION_TIMEOUT: No response within timeout.'),
        );
      }
    }, timeoutMs);
  }

  /** Stop listening */
  stopListening(): void {
    this.currentCallbacks = null;
    this.clearCompletionTimeout();
  }

  /** Signal completion from the provider */
  signalComplete(fullText: string): void {
    if (!this.currentCallbacks) return;
    this.clearCompletionTimeout();
    this.recordSuccess();
    this.currentCallbacks.onComplete(fullText);
    this.currentCallbacks = null;
  }

  /** Signal a chunk from the provider */
  signalChunk(delta: string): void {
    this.currentCallbacks?.onChunk(delta);
  }

  /** Signal an error from the provider */
  signalError(error: Error): void {
    if (!this.currentCallbacks) return;
    this.clearCompletionTimeout();
    this.recordFailure();
    this.currentCallbacks.onError(error);
    this.currentCallbacks = null;
  }

  // ─── Internal ────────────────────────────────────────────────

  private isTrackedUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return this.endpointPatterns.some(p => lower.includes(p.toLowerCase()));
  }

  private recordSuccess(): void {
    this.circuitBreaker.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    const now = Date.now();
    if (now - this.circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_WINDOW) {
      this.circuitBreaker.consecutiveFailures = 0;
    }
    this.circuitBreaker.consecutiveFailures++;
    this.circuitBreaker.lastFailureTime = now;

    log.warn(
      `[CIRCUIT-BREAKER] Failure ${this.circuitBreaker.consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD}`,
    );

    if (this.circuitBreaker.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.tripped = true;
      log.warn('[CIRCUIT-BREAKER] TRIPPED — falling back to DOM');
    }
  }

  private clearCompletionTimeout(): void {
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }
  }
}
