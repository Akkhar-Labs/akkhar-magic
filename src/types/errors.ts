/**
 * Akkhar-Magic :: Typed Error Hierarchy
 * ======================================
 * Deterministic, typed errors for the entire system.
 * Every catch site can match on `error.code` for programmatic handling.
 */

export class AkkharError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AkkharError';
  }
}

export class AuthExpiredError extends AkkharError {
  constructor() {
    super(
      'Google session expired. Run `npm run login` to re-authenticate.',
      'AUTH_EXPIRED',
    );
    this.name = 'AuthExpiredError';
  }
}

export class RateLimitError extends AkkharError {
  constructor() {
    super(
      'AI Studio rate limit reached. Switch profile with `npm run switch`.',
      'RATE_LIMIT',
    );
    this.name = 'RateLimitError';
  }
}

export class ExtractionTimeoutError extends AkkharError {
  constructor(timeoutMs: number) {
    super(
      `No response intercepted within ${timeoutMs}ms.`,
      'EXTRACTION_TIMEOUT',
    );
    this.name = 'ExtractionTimeoutError';
  }
}

export class BrowserDisconnectedError extends AkkharError {
  constructor() {
    super('Browser disconnected unexpectedly.', 'BROWSER_DISCONNECTED');
    this.name = 'BrowserDisconnectedError';
  }
}

export class PromptInjectionError extends AkkharError {
  constructor(reason: string) {
    super(`Prompt injection failed: ${reason}`, 'INJECTION_FAILED');
    this.name = 'PromptInjectionError';
  }
}

export class SafetyFilterError extends AkkharError {
  constructor() {
    super(
      'AI Studio safety filter triggered. The content was blocked.',
      'SAFETY_FILTER',
    );
    this.name = 'SafetyFilterError';
  }
}

export class InternalProviderError extends AkkharError {
  constructor() {
    super(
      'AI Studio internal error. The provider returned an unexpected failure.',
      'INTERNAL_PROVIDER_ERROR',
    );
    this.name = 'InternalProviderError';
  }
}

export class RpcError extends AkkharError {
  constructor(
    public readonly rpcCode: number,
    rpcMessage: string,
  ) {
    super(`Google RPC error ${rpcCode}: ${rpcMessage}`, 'RPC_ERROR');
    this.name = 'RpcError';
  }
}