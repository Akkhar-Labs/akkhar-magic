/**
 * Akkhar-Magic :: Browser Discovery (Windows)
 * ==============================================
 * Scans the system for installed Chromium-based browsers.
 * Priority: Chrome → Brave → Edge (Edge is the guaranteed fallback).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../utils/index.js';

const log = createLogger('BrowserDiscovery');

interface DiscoveredBrowser {
  name: string;
  executablePath: string;
}

/**
 * Known Chromium browser locations on Windows.
 * Ordered by preference: Chrome → Brave → Edge.
 */
const WINDOWS_CANDIDATES: { name: string; paths: string[] }[] = [
  {
    name: 'Google Chrome',
    paths: [
      '%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe',
      '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe',
      '%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe',
    ],
  },
  {
    name: 'Brave',
    paths: [
      '%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      '%ProgramFiles(x86)%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      '%LocalAppData%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    ],
  },
  {
    name: 'Microsoft Edge',
    paths: [
      '%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe',
      '%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
  },
];

/** Expands Windows environment variables in a path string */
function expandEnvVars(p: string): string {
  return p.replace(/%([^%]+)%/g, (_, varName: string) => {
    return process.env[varName] ?? '';
  });
}

/**
 * Discovers the best available Chromium browser on this Windows system.
 * Returns the first match in priority order, or null if none found.
 */
export function discoverBrowser(): DiscoveredBrowser | null {
  log.info('Scanning for installed browsers...');

  for (const candidate of WINDOWS_CANDIDATES) {
    for (const rawPath of candidate.paths) {
      const resolvedPath = expandEnvVars(rawPath);
      if (!resolvedPath) continue;

      const normalized = path.normalize(resolvedPath);

      if (fs.existsSync(normalized)) {
        log.info(`Found ${candidate.name}: ${normalized}`);
        return { name: candidate.name, executablePath: normalized };
      }
    }
  }

  log.error('No Chromium browser found on this system');
  return null;
}

/**
 * Discovers all installed Chromium browsers on this Windows system.
 * Useful for presenting choices to the user.
 */
export function discoverAllBrowsers(): DiscoveredBrowser[] {
  const found: DiscoveredBrowser[] = [];

  for (const candidate of WINDOWS_CANDIDATES) {
    for (const rawPath of candidate.paths) {
      const resolvedPath = expandEnvVars(rawPath);
      if (!resolvedPath) continue;

      const normalized = path.normalize(resolvedPath);

      if (fs.existsSync(normalized)) {
        found.push({ name: candidate.name, executablePath: normalized });
        break; // One match per browser is enough
      }
    }
  }

  return found;
}