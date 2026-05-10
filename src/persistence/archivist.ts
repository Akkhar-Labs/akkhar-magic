/**
 * Akkhar-Magic :: The Archivist (Session Manager)
 * =================================================
 * Manages the .akkhar header mapping system for URL persistence.
 * Maps IDE session IDs to specific AI Studio Chat URLs, enabling
 * context recovery across IDE restarts.
 *
 * Data Sovereignty: All session data stays local in .akkhar/ directory.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  AkkharHeaderFile,
  SessionEntry,
  BrowserProfile,
  ProfileRegistry,
  ServerConfig,
} from '../types/index.js';
import { createLogger } from '../utils/index.js';
import { PersistentSessionStore } from './session-store.js';

const log = createLogger('Archivist');

const HEADER_FILENAME = 'sessions.json';
const PROFILES_FILENAME = 'profiles.json';
const PERSISTENT_SESSIONS_DIRNAME = 'persistent-sessions';
const HEADER_VERSION = '0.0.1';

export class Archivist {
  private config: ServerConfig;
  private headerPath: string;
  private profilesPath: string;
  private header: AkkharHeaderFile | null = null;
  private profileRegistry: ProfileRegistry | null = null;
  private readonly persistentSessions: PersistentSessionStore;

  constructor(config: ServerConfig) {
    this.config = config;
    this.headerPath = path.join(config.dataDir, HEADER_FILENAME);
    this.profilesPath = path.join(config.dataDir, PROFILES_FILENAME);
    this.persistentSessions = new PersistentSessionStore(
      path.join(config.dataDir, PERSISTENT_SESSIONS_DIRNAME),
    );
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.config.dataDir, { recursive: true });
    await fs.mkdir(this.config.profilesDir, { recursive: true });
    this.header = await this.loadOrCreateHeader();
    this.profileRegistry = await this.loadOrCreateProfiles();
    await this.persistentSessions.initialize();
    log.info(
      `Initialized with ${Object.keys(this.header.sessions).length} session(s)`,
    );
    log.info(`Active profile: "${this.profileRegistry.activeProfile}"`);
  }

  /**
   * Access the persistent session store (Phase 1+ of persistent sessions).
   * Distinct from the legacy in-memory `SessionEntry` map managed above.
   */
  getPersistentSessions(): PersistentSessionStore {
    return this.persistentSessions;
  }

  // ─── Session Operations ──────────────────────────────────────

  async resolveSession(sessionId?: string): Promise<SessionEntry> {
    this.ensureLoaded();
    const id = sessionId || uuidv4();

    if (this.header!.sessions[id]) {
      const session = this.header!.sessions[id];
      session.updatedAt = new Date().toISOString();
      await this.persistHeader();
      return session;
    }

    const session: SessionEntry = {
      sessionId: id,
      chatUrl: null,
      profileName: this.getActiveProfileName(),
      model: this.config.modelName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.header!.sessions[id] = session;
    await this.persistHeader();
    log.info(`Created new session: ${id}`);
    return session;
  }

  async updateChatUrl(sessionId: string, chatUrl: string): Promise<void> {
    this.ensureLoaded();
    const session = this.header!.sessions[sessionId];
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.chatUrl = chatUrl;
    session.updatedAt = new Date().toISOString();
    await this.persistHeader();
  }

  getChatUrl(sessionId: string): string | null {
    this.ensureLoaded();
    return this.header!.sessions[sessionId]?.chatUrl ?? null;
  }

  listSessions(): SessionEntry[] {
    this.ensureLoaded();
    return Object.values(this.header!.sessions);
  }

  async removeSession(sessionId: string): Promise<boolean> {
    this.ensureLoaded();
    if (!this.header!.sessions[sessionId]) return false;
    delete this.header!.sessions[sessionId];
    await this.persistHeader();
    return true;
  }

  // ─── Profile Operations ──────────────────────────────────────

  getActiveProfileName(): string {
    this.ensureLoaded();
    return this.profileRegistry!.activeProfile;
  }

  getActiveProfileDir(): string {
    this.ensureLoaded();
    const profile = this.profileRegistry!.profiles.find(
      p => p.name === this.profileRegistry!.activeProfile,
    );
    if (!profile) {
      throw new Error(
        `Active profile "${this.profileRegistry!.activeProfile}" not found`,
      );
    }
    return profile.userDataDir;
  }

  async switchProfile(profileName: string): Promise<BrowserProfile> {
    this.ensureLoaded();
    const profile = this.profileRegistry!.profiles.find(
      p => p.name === profileName,
    );
    if (!profile) {
      throw new Error(`Profile "${profileName}" does not exist.`);
    }
    this.profileRegistry!.activeProfile = profileName;
    this.header!.activeProfile = profileName;
    profile.lastUsed = new Date().toISOString();
    await this.persistProfiles();
    await this.persistHeader();
    return profile;
  }

  async createProfile(name: string): Promise<BrowserProfile> {
    this.ensureLoaded();
    if (this.profileRegistry!.profiles.find(p => p.name === name)) {
      throw new Error(`Profile "${name}" already exists.`);
    }
    const userDataDir = path.join(this.config.profilesDir, name);
    await fs.mkdir(userDataDir, { recursive: true });
    const profile: BrowserProfile = {
      name,
      userDataDir,
      authenticated: false,
      lastUsed: new Date().toISOString(),
    };
    this.profileRegistry!.profiles.push(profile);
    await this.persistProfiles();
    return profile;
  }

  async markAuthenticated(profileName: string): Promise<void> {
    this.ensureLoaded();
    const profile = this.profileRegistry!.profiles.find(
      p => p.name === profileName,
    );
    if (profile) {
      profile.authenticated = true;
      await this.persistProfiles();
    }
  }

  listProfiles(): BrowserProfile[] {
    this.ensureLoaded();
    return [...this.profileRegistry!.profiles];
  }

  // ─── Internal ────────────────────────────────────────────────

  private ensureLoaded(): void {
    if (!this.header || !this.profileRegistry) {
      throw new Error('Archivist not initialized. Call initialize() first.');
    }
  }

  private async loadOrCreateHeader(): Promise<AkkharHeaderFile> {
    try {
      const raw = await fs.readFile(this.headerPath, 'utf-8');
      return JSON.parse(raw) as AkkharHeaderFile;
    } catch {
      const header: AkkharHeaderFile = {
        version: HEADER_VERSION,
        activeProfile: 'default',
        sessions: {},
      };
      await this.writeJson(this.headerPath, header);
      return header;
    }
  }

  private async loadOrCreateProfiles(): Promise<ProfileRegistry> {
    try {
      const raw = await fs.readFile(this.profilesPath, 'utf-8');
      return JSON.parse(raw) as ProfileRegistry;
    } catch {
      const defaultDir = path.join(this.config.profilesDir, 'default');
      await fs.mkdir(defaultDir, { recursive: true });
      const registry: ProfileRegistry = {
        activeProfile: 'default',
        profiles: [
          {
            name: 'default',
            userDataDir: defaultDir,
            authenticated: false,
            lastUsed: new Date().toISOString(),
          },
        ],
      };
      await this.writeJson(this.profilesPath, registry);
      return registry;
    }
  }

  private async persistHeader(): Promise<void> {
    if (this.header) await this.writeJson(this.headerPath, this.header);
  }

  private async persistProfiles(): Promise<void> {
    if (this.profileRegistry)
      await this.writeJson(this.profilesPath, this.profileRegistry);
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
