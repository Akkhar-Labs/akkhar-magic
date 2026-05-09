/**
 * Akkhar-Magic :: Completion Service
 * ====================================
 * The main orchestrator. Provider-agnostic business logic that coordinates:
 *   prompt preparation → browser → provider → response delivery
 *
 * This is the single entry point that api/ routes call.
 */

import type { IProvider } from '../types/provider.js';
import type { BrowserLauncher } from '../browser/launcher.js';
import type { CdpMonitor } from '../browser/cdp-monitor.js';
import type { ChatCompletionRequest, ServerConfig } from '../types/index.js';
import { PromptService } from './prompt.service.js';
import { SessionService } from './session.service.js';
import { TitleCache } from './title-cache.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('CompletionService');

export interface CompletionCallbacks {
  onChunk: (delta: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export class CompletionService {
  private promptService = new PromptService();
  private titleCache = new TitleCache();

  /** Expose the title cache for the completions route interceptor */
  getTitleCache(): TitleCache {
    return this.titleCache;
  }

  constructor(
    private config: ServerConfig,
    private launcher: BrowserLauncher,
    private cdpMonitor: CdpMonitor,
    private provider: IProvider,
    private sessionService: SessionService,
  ) {
    // Wire browser disconnect to provider state reset
    this.launcher.setOnDisconnect(() => {
      this.provider.resetState();
    });
  }

  /**
   * Handles a full completion request:
   *   1. Ensure browser is connected
   *   2. Prepare prompt (follow-up detection, normalization)
   *   3. Navigate (smart reuse or new chat)
   *   4. Inject prompt
   *   5. Extract response
   */
  async handleCompletion(
    request: ChatCompletionRequest,
    sessionId: string,
    callbacks: CompletionCallbacks,
  ): Promise<void> {
    // 1. Ensure browser
    if (!this.launcher.isConnected()) {
      log.info('Browser not connected, launching...');
      const profileDir = this.sessionService.getActiveProfileDir();
      const page = await this.launcher.launch(profileDir);

      // Attach CDP monitor
      if (this.config.extractionMode !== 'dom') {
        try {
          await this.cdpMonitor.attach(page);
          // Configure provider-specific endpoint patterns
          if ('configureCdp' in this.provider) {
            (this.provider as any).configureCdp(this.cdpMonitor);
          }
          log.info('CDP monitor attached');
        } catch (err) {
          log.warn('CDP attachment failed — will use DOM', err);
        }
      }
    }

    const page = this.launcher.getPage();

    // 2. Prepare prompt
    const prepared = this.promptService.prepare(request);

    log.info(
      `Completion: messages=${request.messages.length}, followUp=${prepared.isFollowUp}, fingerprint=${prepared.conversationFingerprint.slice(0, 8)}`,
    );

    if (!prepared.prompt) {
      callbacks.onError(new Error('No user message found in request'));
      return;
    }

    // 3. Navigate
    await this.provider.navigate(page, {
      sessionId,
      conversationFingerprint: prepared.conversationFingerprint,
      isFollowUp: prepared.isFollowUp,
    });

    // 4. Inject
    await this.provider.inject(page, {
      prompt: prepared.prompt,
      isFollowUp: prepared.isFollowUp,
      fullPrompt: prepared.fullPrompt,
    });

    // 5. Extract
    const fingerprint = prepared.conversationFingerprint;

    await this.provider.extract(
      page,
      this.cdpMonitor,
      {
        onChunk: callbacks.onChunk,
        onComplete: fullText => {
          // Update session URL
          this.sessionService.updateChatUrl(sessionId, page.url());
          callbacks.onComplete(fullText);
        },
        onError: callbacks.onError,
        onTitle: (title) => {
          this.titleCache.set(fingerprint, title);
        },
      },
      this.config.generationTimeout,
    );
  }
}
