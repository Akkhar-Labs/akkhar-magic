/**
 * Integration tests for Archivist profile Gmail capture (Phase 2).
 * Mirrors: src/persistence/archivist.ts
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { Archivist } from '../../../src/persistence/archivist.js';
import { withTmpDir } from '../../helpers/tmp-dir.js';
import type { ServerConfig } from '../../../src/types/index.js';

function makeConfig(rootDir: string): ServerConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    modelName: 'gemini-3-flash-preview',
    executablePath: '',
    googleAiStudioBaseUrl: 'https://aistudio.google.com',
    dataDir: path.join(rootDir, '.akkhar'),
    profilesDir: path.join(rootDir, 'profiles'),
    headless: true,
    typingDelayMin: 0,
    typingDelayMax: 0,
    extractionPollInterval: 100,
    generationTimeout: 1000,
    extractionMode: 'dom',
  };
}

describe('Archivist :: Gmail capture', () => {
  it('starts with no gmail bound to a profile', async () => {
    await withTmpDir('akkhar-archivist-gmail-init', async dir => {
      const archivist = new Archivist(makeConfig(dir));
      await archivist.initialize();

      expect(archivist.getProfileGmail('default')).toBeNull();
    });
  });

  it('persists a captured gmail and reloads it after restart', async () => {
    await withTmpDir('akkhar-archivist-gmail-persist', async dir => {
      const config = makeConfig(dir);

      const a = new Archivist(config);
      await a.initialize();
      await a.setProfileGmail('default', 'rahat@gmail.com');
      expect(a.getProfileGmail('default')).toBe('rahat@gmail.com');

      // Simulate process restart: brand-new archivist, same data dir.
      const b = new Archivist(config);
      await b.initialize();
      expect(b.getProfileGmail('default')).toBe('rahat@gmail.com');
    });
  });

  it('overwrites the gmail when the user re-logs with a different account', async () => {
    await withTmpDir('akkhar-archivist-gmail-rebind', async dir => {
      const archivist = new Archivist(makeConfig(dir));
      await archivist.initialize();

      await archivist.setProfileGmail('default', 'old@gmail.com');
      await archivist.setProfileGmail('default', 'new@gmail.com');

      expect(archivist.getProfileGmail('default')).toBe('new@gmail.com');
    });
  });

  it('throws when binding gmail to a non-existent profile', async () => {
    await withTmpDir('akkhar-archivist-gmail-missing', async dir => {
      const archivist = new Archivist(makeConfig(dir));
      await archivist.initialize();

      await expect(
        archivist.setProfileGmail('does-not-exist', 'x@y.com'),
      ).rejects.toThrow(/does not exist/);
    });
  });

  it('keeps the gmail field optional on listProfiles()', async () => {
    await withTmpDir('akkhar-archivist-gmail-list', async dir => {
      const archivist = new Archivist(makeConfig(dir));
      await archivist.initialize();

      const before = archivist.listProfiles();
      expect(before[0].gmail).toBeUndefined();

      await archivist.setProfileGmail('default', 'rahat@gmail.com');
      const after = archivist.listProfiles();
      expect(after[0].gmail).toBe('rahat@gmail.com');
    });
  });
});
