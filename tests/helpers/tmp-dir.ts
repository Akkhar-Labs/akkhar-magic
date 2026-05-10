/**
 * Shared tmp-dir helper for integration tests.
 * Guarantees cleanup even if the test throws.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Run `fn` inside a freshly-created temp directory, then remove the
 * directory regardless of whether `fn` resolved or rejected.
 *
 * @example
 *   await withTmpDir('akkhar-store', async (dir) => {
 *     const store = new PersistentSessionStore(dir);
 *     // ...
 *   });
 */
export async function withTmpDir<T>(
  prefix: string,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
