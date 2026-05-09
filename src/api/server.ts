/**
 * Akkhar-Magic :: API Server
 * ===========================
 * Hono app factory with middleware and route mounting.
 * Clean separation — no business logic here.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ServerConfig } from '../types/index.js';
import type { CompletionService } from '../services/completion.service.js';
import type { BrowserLauncher } from '../browser/launcher.js';
import type { Archivist } from '../persistence/archivist.js';
import { createCompletionsRoute } from './routes/completions.js';
import { createModelsRoute } from './routes/models.js';
import { createStatusRoutes } from './routes/status.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('Server');

export function createServer(
  config: ServerConfig,
  completionService: CompletionService,
  launcher: BrowserLauncher,
  archivist: Archivist,
): Hono {
  const app = new Hono();

  // ─── Middleware ──────────────────────────────────────────────
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
    }),
  );

  app.use('*', async (c, next) => {
    const start = Date.now();
    log.debug(`-> ${c.req.method} ${c.req.path}`);
    await next();
    log.debug(`<- ${c.req.method} ${c.req.path} [${Date.now() - start}ms]`);
  });

  // ─── Routes ─────────────────────────────────────────────────
  app.route('/v1/chat/completions', createCompletionsRoute(config, completionService));
  app.route('/v1/models', createModelsRoute(config));
  app.route('/v1', createStatusRoutes(config, launcher, archivist));
  app.route('', createStatusRoutes(config, launcher, archivist));

  // ─── Catch-all ──────────────────────────────────────────────
  app.all('*', c => {
    return c.json(
      {
        error: {
          message: `Route not found: ${c.req.method} ${c.req.path}`,
          type: 'invalid_request_error',
        },
      },
      404,
    );
  });

  return app;
}