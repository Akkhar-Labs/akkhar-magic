/**
 * Akkhar-Magic :: Prompt Service
 * ================================
 * Handles prompt normalization, follow-up detection, and content extraction.
 * Pure business logic — no browser or HTTP dependencies.
 */

import crypto from 'node:crypto';
import type { ChatCompletionRequest } from '../types/index.js';
import { generateAkkharId, createLogger } from '../utils/index.js';

const log = createLogger('PromptService');

export interface PreparedPrompt {
  /** The prompt to inject (follow-up or full) */
  prompt: string;
  /** Full prompt with system instructions (fallback for context recovery) */
  fullPrompt: string | null;
  /** Whether this is a follow-up turn */
  isFollowUp: boolean;
  /** The raw system prompt text (for hashing) */
  systemPrompt: string;
  /** Stable conversation identity: hash of first user message content */
  conversationFingerprint: string;
  /**
   * Active Akkhar identity (AKID) generated for first-turn prompts.
   * `null` on follow-ups — the existing AKID is recovered from message
   * history by SessionResolver in a later phase.
   */
  akkharId: string | null;
}

export class PromptService {
  /**
   * Prepares the prompt from a ChatCompletionRequest.
   * Detects follow-ups, normalizes content, extracts system prompt.
   */
  prepare(request: ChatCompletionRequest): PreparedPrompt {
    const isFollowUp = this.detectFollowUp(request);
    const systemPrompt = this.extractSystemPrompt(request);
    const fullPrompt = this.extractFullPrompt(request);
    const followUpPrompt = this.extractLastUserMessage(request);

    const conversationFingerprint = this.computeFingerprint(request);

    // First turn only: mint a fresh Akkhar identity. Follow-ups inherit
    // their AKID from message history (resolved in a later phase).
    const akkharId = isFollowUp ? null : generateAkkharId();
    if (akkharId) {
      log.info(`Minted Akkhar identity for new conversation: ${akkharId}`);
    }

    return {
      prompt: (isFollowUp ? followUpPrompt : fullPrompt) ?? '',
      fullPrompt,
      isFollowUp,
      systemPrompt,
      conversationFingerprint,
      akkharId,
    };
  }

  /**
   * Detects whether this request is a follow-up turn.
   * A follow-up has: messages.length > 2 AND at least one assistant message exists.
   */
  private detectFollowUp(request: ChatCompletionRequest): boolean {
    const msgs = request.messages;
    if (msgs.length <= 2) return false;
    return msgs.some(m => m.role === 'assistant');
  }

  /**
   * Computes a stable conversation fingerprint from the first user message.
   * This is IDE-agnostic — every IDE sends the same first user message
   * across all turns of the same conversation.
   */
  private computeFingerprint(request: ChatCompletionRequest): string {
    const firstUser = request.messages.find(
      m => m.role === 'user' && m.content,
    );
    const content = firstUser ? this.normalizeContent(firstUser.content) : '';
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, 16);
  }

  /** Extracts the system prompt text for hashing */
  private extractSystemPrompt(request: ChatCompletionRequest): string {
    return request.messages
      .filter(m => m.role === 'system' && m.content)
      .map(m => this.normalizeContent(m.content))
      .join('\n');
  }

  /** Extracts ONLY the last user message (for follow-ups) */
  private extractLastUserMessage(
    request: ChatCompletionRequest,
  ): string | null {
    const userMessages = request.messages.filter(
      m => m.role === 'user' && m.content,
    );
    if (userMessages.length === 0) return null;
    return this.normalizeContent(userMessages[userMessages.length - 1].content);
  }

  /** Extracts the full prompt (system + user concatenated) for first turns */
  private extractFullPrompt(request: ChatCompletionRequest): string | null {
    const messages = request.messages;
    const userMessages = messages.filter(m => m.role === 'user' && m.content);
    if (userMessages.length === 0) return null;

    const lastUserContent = this.normalizeContent(
      userMessages[userMessages.length - 1].content,
    );

    const systemMessages = messages.filter(
      m => m.role === 'system' && m.content,
    );
    if (systemMessages.length > 0) {
      const systemContext = systemMessages
        .map(m => this.normalizeContent(m.content))
        .join('\n');
      return `[System Instructions]\n${systemContext}\n\n[User Message]\n${lastUserContent}`;
    }

    return lastUserContent;
  }

  /**
   * Normalizes message content to a plain string.
   * OpenAI API allows content as string or array of content parts.
   * Cline sends the array format — without normalization,
   * Array.toString() produces "[object Object]".
   */
  private normalizeContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (content === null || content === undefined) return '';
    if (Array.isArray(content)) {
      return content
        .filter(
          (part: any) =>
            part?.type === 'text' && typeof part?.text === 'string',
        )
        .map((part: any) => part.text)
        .join('\n');
    }
    return String(content);
  }
}
