import { describe, it, expect } from 'vitest';
import { buildFinalPrompt } from '../../../../src/providers/google-ai-studio/prompt-builder.js';
import {
  PROMPT_GUARD,
  RESPONSE_TAG_DIRECTIVE,
  TITLE_TAG_DIRECTIVE,
} from '../../../../src/constants/prompts.js';
import { AKKHAR_ID_TAG_REGEX } from '../../../../src/utils/akkhar-id.js';

const SESSION_ID = 'AKID_1715234567890_f7a3b2';

describe('buildFinalPrompt', () => {
  describe('first turn (no IDE system prompt)', () => {
    it('prepends PROMPT_GUARD and appends response + title directives', () => {
      const r = buildFinalPrompt({
        prompt: 'Hello world',
        isFollowUp: false,
        hasActiveContext: false,
      });
      expect(r.guardApplied).toBe(true);
      expect(r.effectiveFollowUp).toBe(false);
      expect(r.akkharIdTagApplied).toBe(false);
      expect(r.finalPrompt.startsWith(PROMPT_GUARD)).toBe(true);
      expect(r.finalPrompt).toContain('Hello world');
      expect(r.finalPrompt).toContain(RESPONSE_TAG_DIRECTIVE);
      expect(r.finalPrompt).toContain(TITLE_TAG_DIRECTIVE);
    });

    it('appends the AKKHAR_ID tag dead last when sessionId is provided', () => {
      const r = buildFinalPrompt({
        prompt: 'Hello',
        isFollowUp: false,
        hasActiveContext: false,
        sessionId: SESSION_ID,
      });
      expect(r.akkharIdTagApplied).toBe(true);
      expect(r.finalPrompt.endsWith(`\n<AKKHAR_ID_${SESSION_ID}>`)).toBe(true);

      // The tag must come AFTER both directives.
      const tagIdx = r.finalPrompt.indexOf(`<AKKHAR_ID_${SESSION_ID}>`);
      const titleIdx = r.finalPrompt.indexOf(TITLE_TAG_DIRECTIVE);
      const respIdx = r.finalPrompt.indexOf(RESPONSE_TAG_DIRECTIVE);
      expect(tagIdx).toBeGreaterThan(titleIdx);
      expect(tagIdx).toBeGreaterThan(respIdx);

      // And must round-trip through the extraction regex.
      expect(r.finalPrompt.match(AKKHAR_ID_TAG_REGEX)?.[1]).toBe(SESSION_ID);
    });
  });

  describe('first turn with IDE system prompt', () => {
    it('skips PROMPT_GUARD when prompt starts with [System Instructions]', () => {
      const ideBody = '[System Instructions]\nYou are an IDE.\n\nHi';
      const r = buildFinalPrompt({
        prompt: ideBody,
        isFollowUp: false,
        hasActiveContext: false,
        sessionId: SESSION_ID,
      });
      expect(r.guardApplied).toBe(false);
      expect(r.finalPrompt.startsWith(ideBody)).toBe(true);
      expect(r.akkharIdTagApplied).toBe(true);
    });
  });

  describe('follow-up with active context', () => {
    it('uses prompt as-is, no guard, no title, no AKKHAR_ID tag', () => {
      const r = buildFinalPrompt({
        prompt: 'next question',
        isFollowUp: true,
        hasActiveContext: true,
        sessionId: SESSION_ID, // ignored on follow-ups
      });
      expect(r.effectiveFollowUp).toBe(true);
      expect(r.guardApplied).toBe(false);
      expect(r.akkharIdTagApplied).toBe(false);
      expect(r.finalPrompt.startsWith('next question')).toBe(true);
      expect(r.finalPrompt).toContain(RESPONSE_TAG_DIRECTIVE);
      expect(r.finalPrompt).not.toContain(TITLE_TAG_DIRECTIVE);
      expect(r.finalPrompt).not.toContain('AKKHAR_ID_');
    });
  });

  describe('follow-up with lost context', () => {
    it('falls back to fullPrompt and re-treats the turn as a first turn', () => {
      const r = buildFinalPrompt({
        prompt: 'next question',
        fullPrompt: '[System Instructions]\nFoo\n\n[User Message]\nbar',
        isFollowUp: true,
        hasActiveContext: false,
        sessionId: SESSION_ID,
      });
      expect(r.effectiveFollowUp).toBe(false);
      expect(r.guardApplied).toBe(false); // IDE-style prompt skips guard
      expect(r.finalPrompt).toContain(TITLE_TAG_DIRECTIVE);
      expect(r.akkharIdTagApplied).toBe(true);
      expect(r.finalPrompt.endsWith(`\n<AKKHAR_ID_${SESSION_ID}>`)).toBe(true);
    });

    it('uses raw prompt when no fullPrompt is available', () => {
      const r = buildFinalPrompt({
        prompt: 'orphan follow-up',
        isFollowUp: true,
        hasActiveContext: false,
      });
      // No fullPrompt, so effectiveFollowUp stays true.
      expect(r.effectiveFollowUp).toBe(true);
      expect(r.finalPrompt.startsWith('orphan follow-up')).toBe(true);
      expect(r.finalPrompt).not.toContain(TITLE_TAG_DIRECTIVE);
    });
  });

  describe('AKKHAR_ID tag policy', () => {
    it('is never injected on a follow-up, even when sessionId is passed', () => {
      const r = buildFinalPrompt({
        prompt: 'q2',
        isFollowUp: true,
        hasActiveContext: true,
        sessionId: SESSION_ID,
      });
      expect(r.akkharIdTagApplied).toBe(false);
      expect(r.finalPrompt).not.toContain('AKKHAR_ID_');
    });

    it('is omitted on first turns when no sessionId is provided', () => {
      const r = buildFinalPrompt({
        prompt: 'hi',
        isFollowUp: false,
        hasActiveContext: false,
      });
      expect(r.akkharIdTagApplied).toBe(false);
      expect(r.finalPrompt).not.toContain('AKKHAR_ID_');
    });
  });
});
