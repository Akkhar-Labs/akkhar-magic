/**
 * Akkhar-Magic :: Timing Constants
 * =================================
 * All timeouts, delays, and polling intervals.
 */

/** Max time to wait for the textarea to appear (AI Studio loads slowly) */
export const TEXTAREA_WAIT_TIMEOUT = 30_000;

/** Max time to wait for the first response text to appear (thinking phase) */
export const FIRST_RESPONSE_TIMEOUT = 120_000;

/** How long text must be stable + no generation indicators before we finalize */
export const STABLE_POLL_THRESHOLD = 5;

/** Max time (ms) a chat can be idle before we treat it as stale and start fresh */
export const CHAT_STALE_TIMEOUT = 10 * 60 * 1000; // 10 minutes