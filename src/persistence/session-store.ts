/**
 * Akkhar-Magic :: Persistent Session Store
 * ==========================================
 * File-based CRUD for `PersistentSession` records. Plain JSON for now;
 * encryption arrives in Phase 10.
 *
 * Layout (under `.akkhar/persistent-sessions/`):
 *
 *   index.json                      ← slim metadata, fast lookups
 *   sessions/
 *     AKID_1715234567890_f7a3b2.json
 *     AKID_1715234999123_0c9d4e.json
 *     ...
 *
 * Design notes:
 *   - Atomic writes: every file write goes to `<file>.tmp` then `rename()`.
 *     `fs.rename` on Node ≥14 (libuv) is atomic on POSIX and overwrites on
 *     Windows, so partially-written files cannot survive a crash.
 *   - `sessionId` doubles as the filename. The format `AKID_<ts>_<hex>` is
 *     filesystem-safe by construction (no slashes, dots, or unicode).
 *   - The index is the source of truth for *fast* lookups; full session
 *     payloads (including `firstMessage`) live only in their own files.
 *
 * See: LocalDocs/BLUEPRINT_PERSISTENT_SESSIONS.md §4
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  PersistentSession,
  PersistentSessionIndexEntry,
  PersistentSessionIndexFile,
} from '../types/index.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('PersistentSessionStore');

const INDEX_FILENAME = 'index.json';
const SESSIONS_DIRNAME = 'sessions';
const INDEX_VERSION = '1' as const;

/** Validates that a sessionId is safe to use as a filename. */
const SESSION_ID_REGEX = /^AKID_\d+_[a-f0-9]{6}$/;

export class PersistentSessionStore {
  private readonly indexPath: string;
  private readonly sessionsDir: string;
  private index: PersistentSessionIndexFile | null = null;

  /**
   * @param rootDir Absolute path to `.akkhar/persistent-sessions/`.
   */
  constructor(rootDir: string) {
    this.indexPath = path.join(rootDir, INDEX_FILENAME);
    this.sessionsDir = path.join(rootDir, SESSIONS_DIRNAME);
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  /** Create directory structure and load (or create) the index. */
  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    this.index = await this.loadOrCreateIndex();
    log.info(
      `Initialized with ${Object.keys(this.index.sessions).length} persistent session(s)`,
    );
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  /**
   * Create a new persistent session. Throws if `sessionId` already exists
   * (collision is mathematically impossible — see blueprint §3 — so this
   * indicates a bug or manual tampering).
   */
  async create(session: PersistentSession): Promise<void> {
    this.ensureLoaded();
    this.assertValidSessionId(session.sessionId);

    if (this.index!.sessions[session.sessionId]) {
      throw new Error(
        `PersistentSessionStore: session "${session.sessionId}" already exists`,
      );
    }

    await this.writeSessionFile(session);
    this.index!.sessions[session.sessionId] = this.toIndexEntry(session);
    await this.persistIndex();

    log.info(`Created session ${session.sessionId} (gmail=${session.gmail})`);
  }

  /**
   * Load a full session by ID. Returns `null` if not found.
   * Reads from disk; the index is consulted only to short-circuit misses.
   */
  async get(sessionId: string): Promise<PersistentSession | null> {
    this.ensureLoaded();

    if (!this.index!.sessions[sessionId]) return null;

    try {
      const raw = await fs.readFile(this.sessionFilePath(sessionId), 'utf-8');
      return JSON.parse(raw) as PersistentSession;
    } catch (err) {
      log.warn(
        `Index references session ${sessionId} but file is missing/corrupt: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Patch an existing session. Returns the updated record.
   * Throws if the session does not exist.
   */
  async update(
    sessionId: string,
    patch: Partial<Omit<PersistentSession, 'sessionId'>>,
  ): Promise<PersistentSession> {
    this.ensureLoaded();

    const current = await this.get(sessionId);
    if (!current) {
      throw new Error(
        `PersistentSessionStore: cannot update unknown session "${sessionId}"`,
      );
    }

    const updated: PersistentSession = { ...current, ...patch, sessionId };
    await this.writeSessionFile(updated);
    this.index!.sessions[sessionId] = this.toIndexEntry(updated);
    await this.persistIndex();

    return updated;
  }

  /**
   * Mark a session as deleted (in AI Studio). The record is retained for
   * historical reference; future resumption attempts surface a polite error.
   */
  async markDeleted(sessionId: string): Promise<void> {
    await this.update(sessionId, { isDeleted: true });
    log.info(`Marked session ${sessionId} as deleted`);
  }

  /**
   * List all sessions (full payloads). Intended for debugging / CLI use.
   * For production hot paths, use the index directly via `listIndex()`.
   */
  async list(): Promise<PersistentSession[]> {
    this.ensureLoaded();
    const ids = Object.keys(this.index!.sessions);
    const sessions: PersistentSession[] = [];
    for (const id of ids) {
      const s = await this.get(id);
      if (s) sessions.push(s);
    }
    return sessions;
  }

  /** Return the slim index entries — cheap, no per-file reads. */
  listIndex(): Array<PersistentSessionIndexEntry & { sessionId: string }> {
    this.ensureLoaded();
    return Object.entries(this.index!.sessions).map(([sessionId, entry]) => ({
      sessionId,
      ...entry,
    }));
  }

  // ─── Internal ─────────────────────────────────────────────────

  private ensureLoaded(): void {
    if (!this.index) {
      throw new Error(
        'PersistentSessionStore not initialized. Call initialize() first.',
      );
    }
  }

  private assertValidSessionId(sessionId: string): void {
    if (!SESSION_ID_REGEX.test(sessionId)) {
      throw new Error(
        `PersistentSessionStore: invalid sessionId "${sessionId}" ` +
          `(expected AKID_<timestamp>_<6-hex>)`,
      );
    }
  }

  private sessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  private toIndexEntry(s: PersistentSession): PersistentSessionIndexEntry {
    return {
      chatUrl: s.chatUrl,
      gmail: s.gmail,
      profileName: s.profileName,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
      isDeleted: s.isDeleted,
      title: s.title,
      ide: s.ide,
    };
  }

  private async loadOrCreateIndex(): Promise<PersistentSessionIndexFile> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(raw) as PersistentSessionIndexFile;
      if (parsed.version !== INDEX_VERSION) {
        log.warn(
          `Index version mismatch (file=${parsed.version}, expected=${INDEX_VERSION}). Treating as empty.`,
        );
        return { version: INDEX_VERSION, sessions: {} };
      }
      return parsed;
    } catch {
      const fresh: PersistentSessionIndexFile = {
        version: INDEX_VERSION,
        sessions: {},
      };
      await this.atomicWriteJson(this.indexPath, fresh);
      return fresh;
    }
  }

  private async writeSessionFile(s: PersistentSession): Promise<void> {
    await this.atomicWriteJson(this.sessionFilePath(s.sessionId), s);
  }

  private async persistIndex(): Promise<void> {
    if (this.index) await this.atomicWriteJson(this.indexPath, this.index);
  }

  /**
   * Atomic write: serialize to `<file>.tmp` then `rename()`.
   * `rename()` is atomic on POSIX and replaces existing files on Windows
   * (Node ≥14, via libuv). A crash mid-write leaves either the old file
   * intact or the new file fully written — never a partial.
   */
  private async atomicWriteJson(
    filePath: string,
    data: unknown,
  ): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(tmpPath, json, 'utf-8');
    await fs.rename(tmpPath, filePath);
  }
}
