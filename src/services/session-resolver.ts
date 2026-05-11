/**
 * Akkhar-Magic :: Session Resolver
 * ==================================
 * Scans incoming conversation history for a previously-injected
 * AKKHAR_ID tag. If an assistant message contains the tag, the request
 * is a resumable follow-up; otherwise it is a new conversation.
 *
 * Phase 4 (extraction only) — the resolver logs its verdict but does
 * not alter the request flow. Phase 6 will act on 'resume' verdicts.
 */

import type { ChatMessage } from '../types/index.js';
import { AKKHAR_ID_TAG_REGEX } from '../utils/index.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('SessionResolver');

// ─── Result Types ────────────────────────────────────────────────

export type SessionResolution =
  | { type: 'new' }
  | { type: 'resume'; sessionId: string };

// ─── Resolver ────────────────────────────────────────────────────

/**
 * Inspects the message history for an echoed `<AKKHAR_ID_...>` tag
 * inside assistant messages. Returns the most recently echoed AKID
 * (last match wins) or `{ type: 'new' }` when none is found.
 */
export function resolveSession(messages: ChatMessage[]): SessionResolution {
  let lastMatchedId: string | null = null;

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.content) continue;

    const match = AKKHAR_ID_TAG_REGEX.exec(msg.content);
    if (match) {
      lastMatchedId = match[1];
    }
  }

  if (lastMatchedId) {
    log.info(`Resolved existing session: ${lastMatchedId}`);
    return { type: 'resume', sessionId: lastMatchedId };
  }

  log.info('No AKKHAR_ID found in history — new session');
  return { type: 'new' };
}
