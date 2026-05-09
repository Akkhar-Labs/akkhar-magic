/**
 * Akkhar-Magic :: Circuit Breaker Constants
 * ============================================
 * Controls when network extraction gives up and falls back to DOM.
 */

/** Number of consecutive failures before tripping the breaker */
export const CIRCUIT_BREAKER_THRESHOLD = 3;

/** Time window for consecutive failures (ms) */
export const CIRCUIT_BREAKER_WINDOW = 60_000;