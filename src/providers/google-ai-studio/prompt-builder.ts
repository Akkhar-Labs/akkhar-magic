/**
 * Akkhar-Magic :: Google AI Studio Prompt Builder
 * =================================================
 * Pure function that assembles the final string injected into AI Studio's
 * textarea. Lives outside the Injector so it can be unit-tested without
 * a Puppeteer page.
 *
 * Composition order (top → bottom of the submitted prompt):
 *   1. (first turn, no IDE system prompt) PROMPT_GUARD
 *   2. The user's prompt (or fullPrompt fallback if context was lost)
 *   3. RESPONSE_TAG_DIRECTIVE  (every turn)
 *   4. TITLE_TAG_DIRECTIVE     (first turn only)
 *   5. <AKKHAR_ID_${sessionId}> (first turn only, when sessionId provided)
 *
 * The AKKHAR_ID tag goes at the very end so it survives any directive
 * rewrites and is the last thing the model sees before the next turn's
 * history is composed.
 */

import {
  PROMPT_GUARD,
  RESPONSE_TAG_DIRECTIVE,
  TITLE_TAG_DIRECTIVE,
} from '../../constants/prompts.js';
import { formatAkkharIdTag } from '../../utils/akkhar-id.js';

export interface BuildFinalPromptInput {
  /** The prompt body (follow-up text or composed full prompt). */
  prompt: string;
  /** Whether the IDE indicated this is a follow-up turn. */
  isFollowUp: boolean;
  /** Full prompt fallback used when context is lost mid-stream. */
  fullPrompt?: string | null;
  /**
   * Whether the underlying chat actually has live context. False means
   * the page was reloaded or the chat reset, so we must fall back to
   * `fullPrompt` even though `isFollowUp` is true.
   */
  hasActiveContext: boolean;
  /** Active Akkhar identity. Provided on first turns only. */
  sessionId?: string;
}

export interface BuildFinalPromptResult {
  /** The fully composed string ready to drop into the textarea. */
  finalPrompt: string;
  /**
   * The post-fallback follow-up state. May be `false` even when
   * `input.isFollowUp` was `true` (context-lost fallback path).
   */
  effectiveFollowUp: boolean;
  /**
   * Diagnostic flag — whether PROMPT_GUARD was prepended. Useful for
   * tests and log output; the injector ignores it.
   */
  guardApplied: boolean;
  /**
   * Whether the AKKHAR_ID tag was appended. Only true on first turns
   * with a non-empty `sessionId`.
   */
  akkharIdTagApplied: boolean;
}

/** Pure builder. No I/O, no Puppeteer — safe for unit tests. */
export function buildFinalPrompt(
  input: BuildFinalPromptInput,
): BuildFinalPromptResult {
  const { prompt, isFollowUp, fullPrompt, hasActiveContext, sessionId } = input;

  let body: string;
  let effectiveFollowUp = isFollowUp;
  let guardApplied = false;

  if (isFollowUp && !hasActiveContext) {
    // Context lost — fall back to full prompt if we have one.
    if (fullPrompt) {
      body = fullPrompt;
      effectiveFollowUp = false;
    } else {
      body = prompt;
    }
  } else if (isFollowUp) {
    body = prompt;
  } else {
    const hasIdeSystemPrompt = prompt.startsWith('[System Instructions]');
    if (hasIdeSystemPrompt) {
      body = prompt;
    } else {
      body = PROMPT_GUARD + prompt;
      guardApplied = true;
    }
  }

  // Always append the response tag directive.
  let finalPrompt = body + RESPONSE_TAG_DIRECTIVE;

  // First-turn-only: title directive.
  if (!effectiveFollowUp) {
    finalPrompt += TITLE_TAG_DIRECTIVE;
  }

  // First-turn-only: AKKHAR_ID tag — placed dead last so it sits at the
  // very tail of the submitted prompt, after every directive.
  let akkharIdTagApplied = false;
  if (!effectiveFollowUp && sessionId) {
    finalPrompt += `\n${formatAkkharIdTag(sessionId)}`;
    akkharIdTagApplied = true;
  }

  return { finalPrompt, effectiveFollowUp, guardApplied, akkharIdTagApplied };
}
