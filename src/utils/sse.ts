/**
 * Akkhar-Magic :: SSE Stream Utilities
 * ======================================
 * Helpers for constructing OpenAI-compatible Server-Sent Events
 * stream responses. These are the atomic building blocks that
 * The Gatekeeper uses to deliver token-by-token responses.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ChatCompletionChunk } from '../types/index.js';

/**
 * Creates a unique completion ID in OpenAI format.
 */
export function generateCompletionId(): string {
  return `chatcmpl-${uuidv4().replace(/-/g, '').slice(0, 29)}`;
}

/**
 * Builds an SSE-formatted chunk for streaming.
 * The first chunk includes `role: 'assistant'` in the delta.
 */
export function buildStreamChunk(
  completionId: string,
  model: string,
  content: string,
  isFirst: boolean = false,
): string {
  const chunk: ChatCompletionChunk = {
    id: completionId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: isFirst ? { role: 'assistant', content } : { content },
        finish_reason: null,
      },
    ],
  };

  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Builds the terminal SSE chunk with finish_reason: 'stop'.
 */
export function buildStopChunk(completionId: string, model: string): string {
  const chunk: ChatCompletionChunk = {
    id: completionId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  };

  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Builds the final [DONE] marker that signals end of stream.
 */
export function buildDoneSignal(): string {
  return 'data: [DONE]\n\n';
}

/**
 * Builds an SSE comment used as a keepalive heartbeat.
 * Per SSE spec, lines starting with `:` are ignored by EventSource clients
 * but keep the TCP connection alive through proxies and IDE timeouts.
 */
export function buildHeartbeat(): string {
  return ': heartbeat\n\n';
}

/** Interval (ms) between heartbeat comments during the thinking phase */
export const HEARTBEAT_INTERVAL_MS = 3_000;

/**
 * Builds an SSE-formatted error event for mid-stream errors.
 * IDEs that parse SSE data will see a clean error instead of broken content.
 */
export function buildStreamError(
  completionId: string,
  model: string,
  errorMessage: string,
  errorType: string,
  errorCode: string,
): string {
  const payload = {
    id: completionId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [],
    error: {
      message: errorMessage,
      type: errorType,
      code: errorCode,
    },
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * SSE headers required for streaming responses.
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;
