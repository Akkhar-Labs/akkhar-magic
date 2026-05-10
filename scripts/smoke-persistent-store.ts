/**
 * Smoke test: PersistentSessionStore round-trip.
 * Run: npx tsx scripts/smoke-persistent-store.ts
 * Cleans up after itself.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PersistentSessionStore } from '../src/persistence/session-store.js';
import type { PersistentSession } from '../src/types/index.js';

async function main() {
  const tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'akkhar-store-smoke-'),
  );
  console.log(`[smoke] tmp dir: ${tmpRoot}`);

  try {
    const store = new PersistentSessionStore(tmpRoot);
    await store.initialize();

    const sample: PersistentSession = {
      sessionId: 'AKID_1715234567890_f7a3b2',
      chatUrl: 'https://aistudio.google.com/prompts/abc123',
      ide: 'continue',
      firstMessage: 'Hello, world.',
      createdAt: '2026-05-09T06:00:00.000Z',
      lastActivityAt: '2026-05-09T06:00:00.000Z',
      gmail: 'rahat@gmail.com',
      profileName: 'default',
      title: 'Friendly Greeting',
      isDeleted: false,
      turnCount: 1,
      model: 'gemini-3-flash-preview',
    };

    // CREATE
    await store.create(sample);
    console.log('[smoke] create OK');

    // GET
    const got = await store.get(sample.sessionId);
    if (!got || got.chatUrl !== sample.chatUrl) {
      throw new Error('get mismatch');
    }
    console.log('[smoke] get OK');

    // UPDATE
    const updated = await store.update(sample.sessionId, {
      turnCount: 2,
      lastActivityAt: '2026-05-09T07:00:00.000Z',
    });
    if (updated.turnCount !== 2) throw new Error('update did not apply');
    console.log('[smoke] update OK');

    // MARK DELETED
    await store.markDeleted(sample.sessionId);
    const after = await store.get(sample.sessionId);
    if (!after?.isDeleted) throw new Error('markDeleted did not apply');
    console.log('[smoke] markDeleted OK');

    // LIST
    const list = await store.list();
    if (list.length !== 1) throw new Error(`list length = ${list.length}`);
    console.log('[smoke] list OK');

    // INDEX shape sanity
    const idx = store.listIndex();
    if (idx[0].sessionId !== sample.sessionId)
      throw new Error('index sessionId mismatch');
    console.log('[smoke] listIndex OK');

    // INVALID ID rejection
    let threw = false;
    try {
      await store.create({ ...sample, sessionId: 'nope' });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('invalid id should have thrown');
    console.log('[smoke] invalid-id rejection OK');

    // DUPLICATE rejection
    threw = false;
    try {
      await store.create(sample);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('duplicate create should have thrown');
    console.log('[smoke] duplicate rejection OK');

    // RELOAD persistence
    const store2 = new PersistentSessionStore(tmpRoot);
    await store2.initialize();
    const reloaded = await store2.get(sample.sessionId);
    if (!reloaded?.isDeleted) throw new Error('persistence across reload failed');
    console.log('[smoke] reload persistence OK');

    console.log('\n[smoke] ALL CHECKS PASSED');
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    console.log(`[smoke] cleaned up ${tmpRoot}`);
  }
}

main().catch(err => {
  console.error('[smoke] FAILED:', err);
  process.exit(1);
});
