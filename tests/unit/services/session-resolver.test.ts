/**
 * Unit tests — SessionResolver
 * ===============================
 * Verifies that resolveSession() correctly identifies new vs. resume
 * sessions by scanning assistant messages for AKKHAR_ID tags.
 */

import { describe, it, expect } from 'vitest';
import { resolveSession } from '../../../src/services/session-resolver.js';
import type { ChatMessage } from '../../../src/types/index.js';
import {
  formatAkkharIdTag,
  generateAkkharId,
} from '../../../src/utils/index.js';

// ─── Helpers ─────────────────────────────────────────────────────

function msg(role: ChatMessage['role'], content: string | null): ChatMessage {
  return { role, content };
}

const SAMPLE_AKID = 'AKID_1715234567890_f7a3b2';
const SAMPLE_TAG = formatAkkharIdTag(SAMPLE_AKID); // <AKKHAR_ID_AKID_1715234567890_f7a3b2>

// ─── Tests ───────────────────────────────────────────────────────

describe('resolveSession', () => {
  // ── New session cases ────────────────────────────────────────

  it('returns { type: "new" } for an empty message array', () => {
    expect(resolveSession([])).toEqual({ type: 'new' });
  });

  it('returns { type: "new" } when there are no assistant messages', () => {
    const messages: ChatMessage[] = [
      msg('system', 'You are a helpful assistant.'),
      msg('user', 'Hello, world!'),
    ];
    expect(resolveSession(messages)).toEqual({ type: 'new' });
  });

  it('returns { type: "new" } when assistant messages exist but contain no AKKHAR_ID tag', () => {
    const messages: ChatMessage[] = [
      msg('system', 'You are a helpful assistant.'),
      msg('user', 'Hello'),
      msg('assistant', 'Hi there! How can I help you today?'),
      msg('user', 'Follow-up question'),
    ];
    expect(resolveSession(messages)).toEqual({ type: 'new' });
  });

  it('returns { type: "new" } when assistant message content is null', () => {
    const messages: ChatMessage[] = [
      msg('user', 'Hello'),
      msg('assistant', null),
    ];
    expect(resolveSession(messages)).toEqual({ type: 'new' });
  });

  it('returns { type: "new" } when AKKHAR_ID tag appears in a user message (not assistant)', () => {
    const messages: ChatMessage[] = [
      msg('user', `Here is some text ${SAMPLE_TAG}`),
      msg('assistant', 'Got it.'),
    ];
    expect(resolveSession(messages)).toEqual({ type: 'new' });
  });

  it('returns { type: "new" } when AKKHAR_ID tag appears in a system message (not assistant)', () => {
    const messages: ChatMessage[] = [
      msg('system', `Instructions ${SAMPLE_TAG}`),
      msg('user', 'Hello'),
    ];
    expect(resolveSession(messages)).toEqual({ type: 'new' });
  });

  // ── Resume cases ─────────────────────────────────────────────

  it('returns { type: "resume" } when a single assistant message contains the tag', () => {
    const messages: ChatMessage[] = [
      msg('system', 'You are helpful.'),
      msg('user', 'Hello'),
      msg('assistant', `Sure! Here is my response.\n${SAMPLE_TAG}`),
      msg('user', 'Follow-up'),
    ];
    const result = resolveSession(messages);
    expect(result).toEqual({ type: 'resume', sessionId: SAMPLE_AKID });
  });

  it('returns the AKID even when tag is embedded mid-text', () => {
    const messages: ChatMessage[] = [
      msg('user', 'Hello'),
      msg('assistant', `Some text before ${SAMPLE_TAG} and some after.`),
    ];
    const result = resolveSession(messages);
    expect(result).toEqual({ type: 'resume', sessionId: SAMPLE_AKID });
  });

  it('returns the last AKID when multiple assistant messages contain different tags', () => {
    const firstAkid = 'AKID_1000000000000_aaaaaa';
    const secondAkid = 'AKID_2000000000000_bbbbbb';

    const messages: ChatMessage[] = [
      msg('user', 'Turn 1'),
      msg('assistant', `Response 1 ${formatAkkharIdTag(firstAkid)}`),
      msg('user', 'Turn 2'),
      msg('assistant', `Response 2 ${formatAkkharIdTag(secondAkid)}`),
      msg('user', 'Turn 3'),
    ];
    const result = resolveSession(messages);
    expect(result).toEqual({ type: 'resume', sessionId: secondAkid });
  });

  it('skips assistant messages without the tag and finds the one that has it', () => {
    const messages: ChatMessage[] = [
      msg('user', 'Turn 1'),
      msg('assistant', 'Plain response with no tag'),
      msg('user', 'Turn 2'),
      msg('assistant', `Tagged response ${SAMPLE_TAG}`),
      msg('user', 'Turn 3'),
      msg('assistant', 'Another plain response'),
      msg('user', 'Turn 4'),
    ];
    // The last *matched* AKID is from the second assistant message
    const result = resolveSession(messages);
    expect(result).toEqual({ type: 'resume', sessionId: SAMPLE_AKID });
  });

  // ── Integration with generateAkkharId ────────────────────────

  it('round-trips with a dynamically generated AKID', () => {
    const freshId = generateAkkharId();
    const tag = formatAkkharIdTag(freshId);

    const messages: ChatMessage[] = [
      msg('user', 'First turn'),
      msg('assistant', `Model response\n${tag}`),
      msg('user', 'Second turn'),
    ];

    const result = resolveSession(messages);
    expect(result).toEqual({ type: 'resume', sessionId: freshId });
  });
});
