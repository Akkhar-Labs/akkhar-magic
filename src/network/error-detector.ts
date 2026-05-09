/**
 * Akkhar-Magic :: Sovereign Error Detector
 * ==========================================
 * Scans raw RPC/JSON streams and DOM text for Google AI Studio
 * error conditions. Returns typed errors from the Akkhar hierarchy.
 *
 * Three detection layers:
 *   1. RPC code matching  (structured Google RPC errors)
 *   2. Stream text scan   (raw body string patterns)
 *   3. DOM text scan      (browser-rendered error banners)
 *
 * Deterministic: never passes raw error strings as model output.
 */

import {
  AkkharError,
  RpcError,
  AuthExpiredError,
  RateLimitError,
  SafetyFilterError,
  InternalProviderError,
} from '../types/errors.js';

// ─── Pattern Dictionaries ────────────────────────────────────────

const RATE_LIMIT_PATTERNS: readonly string[] = [
  "you've reached your rate limit",
  'rate limit reached',
  'rate limit exceeded',
  'quota exceeded',
  'exceeded your current quota',
  'too many requests',
  'resource exhausted',
  'resource has been exhausted',
  'try again later',
  'limit has been reached',
  'requests per minute',
  'rpm limit',
] as const;

const SAFETY_FILTER_PATTERNS: readonly string[] = [
  'safety filters',
  'safety settings',
  'blocked by safety',
  'content was blocked',
  'response was blocked',
  'harmful content',
  'violates our policies',
  'content policy violation',
] as const;

const INTERNAL_ERROR_PATTERNS: readonly string[] = [
  'internal error',
  'internal server error',
  'something went wrong',
  'an error occurred',
  'unexpected error',
  'service unavailable',
  'server error',
  'failed to generate',
] as const;

// ─── Layer 1: RPC Code Detection ─────────────────────────────────

/**
 * Checks if a raw response body is a Google RPC error.
 * Google RPC errors follow the pattern: [,[<code>,"<message>"]]
 */
export function detectRpcError(rawBody: string): AkkharError | null {
  const trimmed = rawBody.trim();

  // Pattern: [,[7,"The caller does not have permission"]] or
  //          [,[8,"message",[[ "type.googleapis.com/..." ]]]]
  // Tolerates optional trailing elements after the message string.
  const match = trimmed.match(/^\[,\[(\d+),"([^"]+)"/);
  if (!match) return null;

  const code = parseInt(match[1], 10);
  const message = match[2];

  if (code === 7 || code === 16) return new AuthExpiredError();
  if (code === 8 || code === 29) return new RateLimitError();

  return new RpcError(code, message);
}

// ─── Layer 2: Stream Text Scan ───────────────────────────────────

/**
 * Scans a raw RPC/JSON response body for known error strings.
 * Used on CDP-intercepted bodies before they reach the parser.
 */
export function detectStreamError(rawBody: string): AkkharError | null {
  const lower = rawBody.toLowerCase();

  if (matchesAny(lower, RATE_LIMIT_PATTERNS)) return new RateLimitError();
  if (matchesAny(lower, SAFETY_FILTER_PATTERNS)) return new SafetyFilterError();
  if (matchesAny(lower, INTERNAL_ERROR_PATTERNS))
    return new InternalProviderError();

  return null;
}

// ─── Layer 3: DOM Text Scan ──────────────────────────────────────

/**
 * Scans DOM-extracted text content for error conditions.
 * Called by extractors with text scraped from error banners / overlays.
 */
export function detectDomError(domText: string): AkkharError | null {
  const lower = domText.toLowerCase();

  if (matchesAny(lower, RATE_LIMIT_PATTERNS)) return new RateLimitError();
  if (matchesAny(lower, SAFETY_FILTER_PATTERNS)) return new SafetyFilterError();
  if (matchesAny(lower, INTERNAL_ERROR_PATTERNS))
    return new InternalProviderError();

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────

function matchesAny(text: string, patterns: readonly string[]): boolean {
  return patterns.some(p => text.includes(p));
}
