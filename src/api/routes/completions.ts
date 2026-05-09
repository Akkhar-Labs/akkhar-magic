/**
 * Akkhar-Magic :: Chat Completions Route
 * ========================================
 * POST /v1/chat/completions — OpenAI-compatible endpoint.
 */

import { Hono, type Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { ServerConfig } from '../../types/index.js';
import {
  RateLimitError,
  SafetyFilterError,
  AkkharError,
} from '../../types/errors.js';
import type { CompletionService } from '../../services/completion.service.js';
import type { TitleCache } from '../../services/title-cache.js';
import {
  generateCompletionId,
  buildStreamChunk,
  buildStopChunk,
  buildDoneSignal,
  buildHeartbeat,
  buildStreamError,
  SSE_HEADERS,
  HEARTBEAT_INTERVAL_MS,
} from '../../utils/index.js';
import { createLogger } from '../../utils/index.js';

const log = createLogger('Completions');

export function createCompletionsRoute(
  config: ServerConfig,
  completionService: CompletionService,
): Hono {
  const app = new Hono();

  app.post('/', async c => {
    try {
      const body = await c.req.json();
      const sessionId = c.req.header('X-Session-Id') || uuidv4();
      const isStreaming = body.stream ?? false;

      log.info(
        `Request: session=${sessionId.slice(0, 8)}, stream=${isStreaming}, messages=${body.messages?.length ?? 0}`,
      );

      // ─── Trivial Request Interceptor ─────────────────────────
      // Detect IDE side-channel requests (title generation, probes)
      // and handle locally to avoid disrupting the active conversation.
      const localResponse = tryLocalIntercept(
        body,
        config.modelName,
        completionService.getTitleCache(),
      );
      if (localResponse) {
        log.info(`Intercepted trivial request — responding locally`);
        if (isStreaming) {
          const interceptId = generateCompletionId();
          const encoder = new TextEncoder();
          const interceptStream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  buildStreamChunk(
                    interceptId,
                    config.modelName,
                    localResponse,
                    true,
                  ),
                ),
              );
              controller.enqueue(
                encoder.encode(buildStopChunk(interceptId, config.modelName)),
              );
              controller.enqueue(encoder.encode(buildDoneSignal()));
              controller.close();
            },
          });
          return new Response(interceptStream, {
            status: 200,
            headers: SSE_HEADERS,
          });
        }
        const interceptId = generateCompletionId();
        return c.json({
          id: interceptId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: config.modelName,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: localResponse },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }

      if (isStreaming) {
        const completionId = generateCompletionId();
        const encoder = new TextEncoder();
        let closed = false;
        let isFirst = true;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

        // Immediately commit 200 + SSE headers via ReadableStream.
        // This prevents IDE connection-establishment timeouts.
        let streamController!: ReadableStreamDefaultController<Uint8Array>;
        const sseStream = new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller;
          },
        });

        const writeSSE = (text: string): void => {
          if (closed) return;
          try {
            streamController.enqueue(encoder.encode(text));
          } catch {
            closed = true;
          }
        };

        const closeStream = (): void => {
          if (closed) return;
          closed = true;
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
          try {
            streamController.close();
          } catch {
            // Already closed
          }
        };

        const stopHeartbeat = (): void => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        };

        // Start heartbeat — keeps connection alive during
        // navigation, injection, and AI thinking phases.
        heartbeatTimer = setInterval(() => {
          writeSSE(buildHeartbeat());
        }, HEARTBEAT_INTERVAL_MS);

        // Fire-and-forget: completion runs in background,
        // writing into the already-committed SSE stream.
        completionService
          .handleCompletion(body, sessionId, {
            onChunk: delta => {
              stopHeartbeat();
              writeSSE(
                buildStreamChunk(
                  completionId,
                  config.modelName,
                  delta,
                  isFirst,
                ),
              );
              isFirst = false;
            },
            onComplete: _fullText => {
              stopHeartbeat();
              writeSSE(buildStopChunk(completionId, config.modelName));
              writeSSE(buildDoneSignal());
              closeStream();
            },
            onError: error => {
              stopHeartbeat();
              const { message, type, code } = mapErrorFields(error);
              writeSSE(
                buildStreamError(
                  completionId,
                  config.modelName,
                  message,
                  type,
                  code,
                ),
              );
              writeSSE(buildDoneSignal());
              closeStream();
            },
          })
          .catch(err => {
            stopHeartbeat();
            const error = err instanceof Error ? err : new Error(String(err));
            const { message, type, code } = mapErrorFields(error);
            writeSSE(
              buildStreamError(
                completionId,
                config.modelName,
                message,
                type,
                code,
              ),
            );
            writeSSE(buildDoneSignal());
            closeStream();
          });

        return new Response(sseStream, {
          status: 200,
          headers: SSE_HEADERS,
        });
      } else {
        const completionId = generateCompletionId();
        let fullText = '';

        await new Promise<void>((resolve, reject) => {
          completionService.handleCompletion(body, sessionId, {
            onChunk: delta => {
              fullText += delta;
            },
            onComplete: text => {
              fullText = text;
              resolve();
            },
            onError: error => {
              reject(error);
            },
          });
        });

        return c.json({
          id: completionId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: config.modelName,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: fullText },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: Math.ceil(
              (body.messages?.toString()?.length ?? 0) / 4,
            ),
            completion_tokens: Math.ceil(fullText.length / 4),
            total_tokens:
              Math.ceil((body.messages?.toString()?.length ?? 0) / 4) +
              Math.ceil(fullText.length / 4),
          },
        });
      }
    } catch (err) {
      log.error('Completion failed', err);
      return buildErrorResponse(
        c,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  });

  return app;
}

// ─── Error Response Builder ──────────────────────────────────────

/**
 * Maps AkkharError subtypes to OpenAI-compatible error responses
 * with correct HTTP status codes. Rate limits return 429 so agentic
 * IDEs (Cline/Cursor) stop retrying immediately.
 */
function buildErrorResponse(c: Context, error: Error): Response {
  if (error instanceof RateLimitError) {
    return c.json(
      {
        error: {
          message: 'Akkhar-Magic: Google Rate Limit Reached.',
          type: 'rate_limit_error',
          code: 'quota_exceeded',
        },
      },
      429,
    );
  }

  if (error instanceof SafetyFilterError) {
    return c.json(
      {
        error: {
          message: 'Akkhar-Magic: Content blocked by Google safety filters.',
          type: 'invalid_request_error',
          code: 'content_filter',
        },
      },
      400,
    );
  }

  if (error instanceof AkkharError) {
    return c.json(
      {
        error: {
          message: `Akkhar-Magic: ${error.message}`,
          type: 'server_error',
          code: error.code.toLowerCase(),
        },
      },
      500,
    );
  }

  return c.json(
    {
      error: {
        message: 'Internal server error',
        type: 'server_error',
        code: 'internal_error',
      },
    },
    500,
  );
}

// ─── Streaming Error Field Mapper ────────────────────────────────

/**
 * Extracts OpenAI-compatible error fields from an Error instance.
 * Used for SSE error events where we can't set HTTP status codes
 * (the 200 is already committed), but still need structured errors.
 */
function mapErrorFields(error: Error): {
  message: string;
  type: string;
  code: string;
} {
  if (error instanceof RateLimitError) {
    return {
      message: 'Akkhar-Magic: Google Rate Limit Reached.',
      type: 'rate_limit_error',
      code: 'quota_exceeded',
    };
  }

  if (error instanceof SafetyFilterError) {
    return {
      message: 'Akkhar-Magic: Content blocked by Google safety filters.',
      type: 'invalid_request_error',
      code: 'content_filter',
    };
  }

  if (error instanceof AkkharError) {
    return {
      message: `Akkhar-Magic: ${error.message}`,
      type: 'server_error',
      code: error.code.toLowerCase(),
    };
  }

  return {
    message: 'Internal server error',
    type: 'server_error',
    code: 'internal_error',
  };
}

// ─── Trivial Request Interceptor ─────────────────────────────────

/** Patterns that identify title-generation or summary side-channel requests */
const TITLE_REQUEST_PATTERNS = [
  'reply with a title',
  'title for the chat',
  'title for this conversation',
  'generate a title',
  'suggest a title',
  'short title',
  '3-4 words',
  'concise title',
] as const;

/**
 * Detects trivial IDE side-channel requests and returns a local response.
 * Returns null if the request should go to the browser.
 */
function tryLocalIntercept(
  body: { messages?: { role: string; content: string | null }[] },
  _model: string,
  titleCache: TitleCache,
): string | null {
  const messages = body.messages;
  if (!messages || messages.length === 0) return null;

  // Title gen requests typically have 1-2 messages, no assistant history
  const hasAssistant = messages.some(m => m.role === 'assistant');
  if (hasAssistant) return null;
  if (messages.length > 2) return null;

  // Check if any message content matches title-generation patterns
  const allContent = messages
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .join(' ')
    .toLowerCase();

  const isTitleRequest = TITLE_REQUEST_PATTERNS.some(p =>
    allContent.includes(p),
  );
  if (!isTitleRequest) return null;

  // Check title cache first — prefer AI-generated titles
  const cachedTitle = titleCache.getLatest();
  if (cachedTitle) {
    log.info(`Using cached AI-generated title: "${cachedTitle}"`);
    return cachedTitle;
  }

  // Fallback: generate title locally from content
  const lastContent = messages[messages.length - 1]?.content ?? '';
  const title = generateLocalTitle(
    typeof lastContent === 'string' ? lastContent : '',
  );
  return title;
}

/**
 * Generates a 3-4 word title from the provided text.
 * Extracts meaningful words, skipping common filler.
 */
function generateLocalTitle(text: string): string {
  const FILLER = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'shall',
    'can',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'it',
    'its',
    'this',
    'that',
    'these',
    'those',
    'i',
    'me',
    'my',
    'we',
    'our',
    'you',
    'your',
    'he',
    'she',
    'they',
    'and',
    'or',
    'but',
    'so',
    'if',
    'then',
    'than',
    'as',
    'not',
    'no',
    'just',
    'also',
    'very',
    'really',
    'please',
    'im',
    "i'm",
    'how',
    'what',
    'when',
    'where',
    'who',
    'why',
  ]);

  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !FILLER.has(w.toLowerCase()));

  const titleWords = words.slice(0, 4);

  if (titleWords.length === 0) return 'New Chat';

  return titleWords
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
