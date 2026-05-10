/**
 * Integration tests for PersistentSessionStore.
 * Touches the real filesystem (in a temp dir); no network, no browser.
 *
 * Mirrors: src/persistence/session-store.ts
 */

import { describe, it, expect } from 'vitest';
import { PersistentSessionStore } from '../../../src/persistence/session-store.js';
import { withTmpDir } from '../../helpers/tmp-dir.js';
import { makePersistentSession } from '../../helpers/fixtures.js';

describe('PersistentSessionStore', () => {
  describe('initialize()', () => {
    it('creates the directory layout and an empty index on first run', async () => {
      await withTmpDir('akkhar-store-init', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        expect(store.listIndex()).toEqual([]);
      });
    });

    it('is idempotent — re-initializing preserves existing data', async () => {
      await withTmpDir('akkhar-store-reinit', async dir => {
        const a = new PersistentSessionStore(dir);
        await a.initialize();
        await a.create(makePersistentSession());

        const b = new PersistentSessionStore(dir);
        await b.initialize();
        expect(b.listIndex()).toHaveLength(1);
      });
    });
  });

  describe('create()', () => {
    it('persists a session and indexes it', async () => {
      await withTmpDir('akkhar-store-create', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        const session = makePersistentSession();

        await store.create(session);

        const got = await store.get(session.sessionId);
        expect(got).toEqual(session);
      });
    });

    it('rejects malformed sessionIds', async () => {
      await withTmpDir('akkhar-store-bad-id', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();

        await expect(
          store.create(makePersistentSession({ sessionId: 'nope' })),
        ).rejects.toThrow(/invalid sessionId/);
      });
    });

    it('rejects duplicate sessionIds', async () => {
      await withTmpDir('akkhar-store-dup', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        const session = makePersistentSession();

        await store.create(session);
        await expect(store.create(session)).rejects.toThrow(/already exists/);
      });
    });
  });

  describe('get()', () => {
    it('returns null for unknown sessionIds', async () => {
      await withTmpDir('akkhar-store-miss', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        expect(await store.get('AKID_0_000000')).toBeNull();
      });
    });
  });

  describe('update()', () => {
    it('patches existing fields without dropping others', async () => {
      await withTmpDir('akkhar-store-update', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        const session = makePersistentSession();
        await store.create(session);

        const updated = await store.update(session.sessionId, {
          turnCount: 5,
          lastActivityAt: '2026-05-09T07:00:00.000Z',
        });

        expect(updated.turnCount).toBe(5);
        expect(updated.lastActivityAt).toBe('2026-05-09T07:00:00.000Z');
        expect(updated.gmail).toBe(session.gmail); // unchanged
        expect(updated.chatUrl).toBe(session.chatUrl); // unchanged
      });
    });

    it('throws when updating an unknown session', async () => {
      await withTmpDir('akkhar-store-update-miss', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();

        await expect(
          store.update('AKID_0_000000', { turnCount: 2 }),
        ).rejects.toThrow(/unknown session/);
      });
    });
  });

  describe('markDeleted()', () => {
    it('flips isDeleted to true and persists it', async () => {
      await withTmpDir('akkhar-store-del', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        const session = makePersistentSession();
        await store.create(session);

        await store.markDeleted(session.sessionId);

        const after = await store.get(session.sessionId);
        expect(after?.isDeleted).toBe(true);
      });
    });
  });

  describe('list() / listIndex()', () => {
    it('list() returns full payloads for all sessions', async () => {
      await withTmpDir('akkhar-store-list', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        await store.create(makePersistentSession({ sessionId: 'AKID_1_aaaaaa' }));
        await store.create(makePersistentSession({ sessionId: 'AKID_2_bbbbbb' }));

        const all = await store.list();
        expect(all).toHaveLength(2);
        expect(all.map(s => s.sessionId).sort()).toEqual([
          'AKID_1_aaaaaa',
          'AKID_2_bbbbbb',
        ]);
      });
    });

    it('listIndex() returns slim metadata without reading per-session files', async () => {
      await withTmpDir('akkhar-store-idx', async dir => {
        const store = new PersistentSessionStore(dir);
        await store.initialize();
        await store.create(
          makePersistentSession({ sessionId: 'AKID_1_aaaaaa' }),
        );

        const idx = store.listIndex();
        expect(idx).toHaveLength(1);
        expect(idx[0].sessionId).toBe('AKID_1_aaaaaa');
        expect(idx[0]).toHaveProperty('chatUrl');
        expect(idx[0]).toHaveProperty('gmail');
        expect(idx[0]).not.toHaveProperty('firstMessage'); // slim, by design
      });
    });
  });

  describe('persistence across restarts', () => {
    it('reloads sessions and their state from disk', async () => {
      await withTmpDir('akkhar-store-reload', async dir => {
        const a = new PersistentSessionStore(dir);
        await a.initialize();
        const session = makePersistentSession();
        await a.create(session);
        await a.markDeleted(session.sessionId);

        const b = new PersistentSessionStore(dir);
        await b.initialize();
        const reloaded = await b.get(session.sessionId);

        expect(reloaded?.isDeleted).toBe(true);
        expect(reloaded?.chatUrl).toBe(session.chatUrl);
      });
    });
  });
});
