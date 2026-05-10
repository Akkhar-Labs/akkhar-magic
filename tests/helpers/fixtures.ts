/**
 * Shared fixture builders for `PersistentSession` records.
 * Keeps tests terse and intent-focused.
 */

import type { PersistentSession } from '../../src/types/index.js';

/**
 * Build a `PersistentSession` with sane defaults.
 * Override any field by passing a partial.
 */
export function makePersistentSession(
  overrides: Partial<PersistentSession> = {},
): PersistentSession {
  const base: PersistentSession = {
    sessionId: 'AKID_1715234567890_f7a3b2',
    chatUrl: 'https://aistudio.google.com/prompts/abc123',
    ide: 'continue',
    firstMessage: 'Hello, world.',
    createdAt: '2026-05-09T06:00:00.000Z',
    lastActivityAt: '2026-05-09T06:00:00.000Z',
    gmail: 'rahat@gmail.com',
    profileName: 'default',
    title: 'Friendly Greeting',
    isDeleted: false,
    turnCount: 1,
    model: 'gemini-3-flash-preview',
  };
  return { ...base, ...overrides };
}
