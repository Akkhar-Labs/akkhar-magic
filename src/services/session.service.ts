/**
 * Akkhar-Magic :: Session Service
 * =================================
 * Manages multi-turn session state and context recovery.
 * Bridges between Cline's per-request UUIDs and our persistent sessions.
 */

import type { Archivist } from '../persistence/archivist.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('SessionService');

export class SessionService {
  constructor(private archivist: Archivist) {}

  /** Resolve or create a session */
  async resolveSession(sessionId: string) {
    return this.archivist.resolveSession(sessionId);
  }

  /** Update the chat URL for a session (silently ignores missing sessions) */
  async updateChatUrl(sessionId: string, url: string): Promise<void> {
    try {
      await this.archivist.updateChatUrl(sessionId, url);
    } catch {
      // Follow-up session IDs aren't registered — this is expected
      log.debug(`Session ${sessionId.slice(0, 8)} not found for URL update (expected for follow-ups)`);
    }
  }

  /** Get the active profile directory */
  getActiveProfileDir(): string {
    return this.archivist.getActiveProfileDir();
  }

  /** Get active profile name */
  getActiveProfileName(): string {
    return this.archivist.getActiveProfileName();
  }
}