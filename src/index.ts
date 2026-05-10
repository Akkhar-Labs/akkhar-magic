/**
 * Akkhar-Magic :: Main Entry Point (V0.0.1)
 * ============================================
 * Bootstraps the system with Provider Architecture:
 *   1. Resolves configuration
 *   2. Initializes persistence (Archivist)
 *   3. Creates browser engine (Launcher + CDP)
 *   4. Creates provider (AI Studio / future: ChatGPT, Claude)
 *   5. Creates service layer (CompletionService)
 *   6. Starts API server
 *
 * "Silicon Valley will respect Bangladesh one day, Insha Allah."
 * — Rahat Hasan, Group CEO & Principal Architect, PRIME
 */

import { serve } from '@hono/node-server';
import { resolveConfig } from './config.js';
import { Archivist } from './persistence/index.js';
import {
  BrowserLauncher,
  CdpMonitor,
  discoverBrowser,
} from './browser/index.js';
import { createProvider } from './providers/index.js';
import { CompletionService, SessionService } from './services/index.js';
import { createServer } from './api/index.js';
import { createLogger } from './utils/index.js';

const log = createLogger('Bootstrap');

const BANNER = `
    ╔═══════════════════════════════════════════════╗
    ║           ✦ AKKHAR-MAGIC v0.0.1 ✦            ║
    ║       UI-to-API Bridge for AI Studios         ║
    ║     Provider Architecture • Multi-Platform    ║
    ║                                               ║
    ║   Akkhar-Labs | A PRIME Ecosystem Company     ║
    ╚═══════════════════════════════════════════════╝
`;

async function bootstrap(): Promise<void> {
  console.log(BANNER);

  // 1. Config
  const config = resolveConfig();
  log.info('Configuration resolved', {
    port: config.port,
    host: config.host,
    model: config.modelName,
    headless: config.headless,
    extraction: config.extractionMode,
  });

  // 2. Persistence
  const archivist = new Archivist(config);
  await archivist.initialize();
  const sessionService = new SessionService(archivist);

  // 3. Browser Discovery & Engine
  if (!config.executablePath) {
    const browser = discoverBrowser();
    if (!browser) {
      log.fatal(
        'No Chromium browser found. Install Chrome, Brave, or Edge — or set AKKHAR_BROWSER_PATH.',
      );
      process.exit(1);
    }
    config.executablePath = browser.executablePath;
    log.info(`Browser: ${browser.name} (${browser.executablePath})`);
  }

  const launcher = new BrowserLauncher(config);
  const cdpMonitor = new CdpMonitor();

  // 4. Provider
  const providerName = process.env.AKKHAR_PROVIDER ?? 'google-ai-studio';
  const provider = createProvider(providerName);
  log.info(`Provider: ${provider.name} (${provider.baseUrl})`);

  // 5. Service Layer
  const completionService = new CompletionService(
    config,
    launcher,
    cdpMonitor,
    provider,
    sessionService,
  );

  // 6. API Server
  const app = createServer(config, completionService, launcher, archivist);

  const server = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  });

  log.info(`Server listening on http://${config.host}:${config.port}`);
  log.info('Endpoints:');
  log.info(
    '  POST /v1/chat/completions  — Chat Completions (OpenAI-compatible)',
  );
  log.info('  GET  /v1/models            — Model Listing');
  log.info('  GET  /v1/status            — Bridge Status');
  log.info('  GET  /health               — Health Check');
  log.info('');
  log.info(`Provider: ${provider.name}`);
  log.info(`Extraction: ${config.extractionMode}`);
  log.info('');
  log.info('Configure your IDE:');
  log.info(`  Base URL: http://${config.host}:${config.port}/v1`);
  log.info('  API Key:  any-value (not validated)');
  log.info(`  Model:    ${config.modelName}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}. Shutting down...`);
    try {
      await cdpMonitor.detach();
      await launcher.shutdown();
    } catch (err) {
      log.error('Shutdown error', err);
    }
    if (server && typeof (server as any).close === 'function') {
      (server as any).close(() => process.exit(0));
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch(err => {
  log.fatal('Bootstrap failed', err);
  process.exit(1);
});
