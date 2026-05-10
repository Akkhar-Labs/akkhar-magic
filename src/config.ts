/**
 * Akkhar-Magic :: Configuration Defaults
 * =======================================
 * Deterministic defaults for the entire system. All paths resolve
 * relative to the project root to maintain strict sovereignty.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerConfig } from './types/index.js';

// CJS bundle: __dirname is a global. ESM: derive from import.meta.url.
// @ts-ignore — esbuild replaces import.meta with empty in CJS, but __dirname branch runs first
const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(_dirname, '..');

export const DEFAULT_CONFIG: ServerConfig = {
  port: 1337,
  host: '127.0.0.1',
  modelName: 'gemini-3-flash-preview',
  executablePath: '',
  googleAiStudioBaseUrl: 'https://aistudio.google.com',
  dataDir: path.join(PROJECT_ROOT, '.akkhar'),
  profilesDir: path.join(PROJECT_ROOT, 'profiles'),
  headless: false,
  typingDelayMin: 30,
  typingDelayMax: 90,
  extractionPollInterval: 150,
  generationTimeout: 300_000, // 5 minutes
  extractionMode: 'auto',
};

/**
 * Merges environment overrides into the default config.
 * Environment variables follow the pattern: AKKHAR_<KEY>
 */
export function resolveConfig(
  overrides: Partial<ServerConfig> = {},
): ServerConfig {
  const env = process.env;

  return {
    ...DEFAULT_CONFIG,
    port: parseInt(env.AKKHAR_PORT ?? '', 10) || DEFAULT_CONFIG.port,
    host: env.AKKHAR_HOST ?? DEFAULT_CONFIG.host,
    modelName: env.AKKHAR_MODEL ?? DEFAULT_CONFIG.modelName,
    executablePath: env.AKKHAR_BROWSER_PATH ?? DEFAULT_CONFIG.executablePath,
    headless: env.AKKHAR_HEADLESS === 'false' ? false : DEFAULT_CONFIG.headless,
    extractionMode:
      (env.AKKHAR_EXTRACTION_MODE as 'dom' | 'network' | 'auto') ??
      DEFAULT_CONFIG.extractionMode,
    ...overrides,
  };
}

export { PROJECT_ROOT };
