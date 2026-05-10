/**
 * Akkhar-Magic :: Akkhar Identity (AKID)
 * =======================================
 * Generates and validates the active-identity tags Akkhar appends to
 * first-turn prompts. The model echoes the tag back through subsequent
 * follow-ups in its conversation history, letting Akkhar correlate an
 * incoming request to a persisted session.
 *
 * Format: AKID_<ms_timestamp>_<6_hex_chars>
 *   e.g. AKID_1715234567890_f7a3b2
 *
 * Collision space ≈ 5.3 × 10^20 / year (16.7M ids/ms × 31.5T ms/year).
 */

import { randomBytes } from 'node:crypto';

/** Matches a bare AKID (no surrounding tag). */
export const AKKHAR_ID_REGEX = /^AKID_\d+_[a-f0-9]{6}$/;

/**
 * Matches the wire-format tag used inside prompts and message history.
 *   <AKKHAR_ID_AKID_1715234567890_f7a3b2>
 * Capture group 1 is the bare AKID.
 */
export const AKKHAR_ID_TAG_REGEX = /<AKKHAR_ID_(AKID_\d+_[a-f0-9]{6})>/;

/** Generates a fresh Akkhar identity. */
export function generateAkkharId(): string {
  const timestamp = Date.now();
  const random = randomBytes(3).toString('hex');
  return `AKID_${timestamp}_${random}`;
}

/** True if the given string is a syntactically valid bare AKID. */
export function isAkkharId(value: string): boolean {
  return AKKHAR_ID_REGEX.test(value);
}

/** Builds the wire-format tag string from a bare AKID. */
export function formatAkkharIdTag(akid: string): string {
  return `<AKKHAR_ID_${akid}>`;
}
