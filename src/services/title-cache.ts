/**
 * Akkhar-Magic :: Title Cache
 * ============================
 * In-memory cache for AI-generated conversation titles.
 * Titles are produced by the model on first turn and cached here
 * until the IDE's title-generation request arrives.
 *
 * TTL-based: entries expire after 60 seconds.
 */

import { createLogger } from '../utils/index.js';

const log = createLogger('TitleCache');

const TITLE_TTL_MS = 60_000;

interface CachedTitle {
  title: string;
  createdAt: number;
}

export class TitleCache {
  private cache = new Map<string, CachedTitle>();

  /** Store a title keyed by conversation fingerprint */
  set(fingerprint: string, title: string): void {
    this.cache.set(fingerprint, { title, createdAt: Date.now() });
    log.info(`Cached title for fp=${fingerprint.slice(0, 8)}: "${title}"`);
    this.evictExpired();
  }

  /** Retrieve a cached title. Returns null if not found or expired. */
  get(fingerprint: string): string | null {
    const entry = this.cache.get(fingerprint);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > TITLE_TTL_MS) {
      this.cache.delete(fingerprint);
      return null;
    }

    log.info(`Title cache hit for fp=${fingerprint.slice(0, 8)}: "${entry.title}"`);
    return entry.title;
  }

  /** Get the most recently cached title (for requests without fingerprint context) */
  getLatest(): string | null {
    let latest: CachedTitle | null = null;
    const now = Date.now();

    for (const [fp, entry] of this.cache) {
      if (now - entry.createdAt > TITLE_TTL_MS) {
        this.cache.delete(fp);
        continue;
      }
      if (!latest || entry.createdAt > latest.createdAt) {
        latest = entry;
      }
    }

    if (latest) {
      log.info(`Title cache latest: "${latest.title}"`);
      return latest.title;
    }
    return null;
  }

  /** Remove expired entries */
  private evictExpired(): void {
    const now = Date.now();
    for (const [fp, entry] of this.cache) {
      if (now - entry.createdAt > TITLE_TTL_MS) {
        this.cache.delete(fp);
      }
    }
  }
}