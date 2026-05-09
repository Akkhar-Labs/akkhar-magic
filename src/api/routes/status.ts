/**
 * Akkhar-Magic :: Status & Health Routes
 * ========================================
 * GET /v1/status  — Bridge status (browser, provider, sessions)
 * GET /health     — Simple health check
 */

import { Hono } from 'hono';
import type { ServerConfig } from '../../types/index.js';
import type { BrowserLauncher } from '../../browser/launcher.js';
import type { Archivist } from '../../persistence/archivist.js';

export function createStatusRoutes(
  config: ServerConfig,
  launcher: BrowserLauncher,
  archivist: Archivist,
): Hono {
  const app = new Hono();

  // GET /v1/status
  app.get('/status', c => {
    return c.json({
      version: '0.0.1',
      browser: {
        connected: launcher.isConnected(),
      },
      config: {
        model: config.modelName,
        port: config.port,
        extractionMode: config.extractionMode,
      },
      sessions: {
        total: archivist.listSessions().length,
        activeProfile: archivist.getActiveProfileName(),
      },
    });
  });

  // GET /health
  app.get('/health', c => {
    return c.json({
      status: 'ok',
      version: '0.0.1',
      timestamp: new Date().toISOString(),
      extraction: {
        configuredMode: config.extractionMode,
      },
    });
  });

  return app;
}
