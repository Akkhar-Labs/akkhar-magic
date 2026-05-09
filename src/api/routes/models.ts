/**
 * Akkhar-Magic :: Models Route
 * =============================
 * GET /v1/models — OpenAI-compatible model listing.
 */

import { Hono } from 'hono';
import type { ServerConfig } from '../../types/index.js';

export function createModelsRoute(config: ServerConfig): Hono {
  const app = new Hono();

  app.get('/', c => {
    return c.json({
      object: 'list',
      data: [
        {
          id: config.modelName,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'akkhar-labs',
        },
        {
          id: 'gemini-3-flash-preview',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'akkhar-labs',
        },
      ],
    });
  });

  return app;
}