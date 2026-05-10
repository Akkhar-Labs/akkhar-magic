/**
 * Akkhar-Magic :: Google AI Studio Prompt Injector
 * ===================================================
 * Injects prompts into Google AI Studio's textarea and submits them.
 */

import type { Page } from 'puppeteer-core';
import type { InjectOptions } from '../../types/provider.js';
import { TEXTAREA_WAIT_TIMEOUT } from '../../constants/timing.js';
import { GOOGLE_AI_STUDIO_SELECTORS } from './selectors.js';
import { buildFinalPrompt } from './prompt-builder.js';
import { createLogger, humanDelay } from '../../utils/index.js';

const log = createLogger('GoogleAiStudioInjector');

export class GoogleAiStudioInjector {
  /** Whether the current chat has an active context (for follow-up detection) */
  private hasActiveContext: boolean = false;

  setHasActiveContext(value: boolean): void {
    this.hasActiveContext = value;
  }

  /** Injects a prompt into the textarea and clicks submit */
  async inject(page: Page, options: InjectOptions): Promise<void> {
    const { prompt, isFollowUp, fullPrompt, sessionId } = options;

    log.info(`Waiting for textarea... (timeout: ${TEXTAREA_WAIT_TIMEOUT}ms)`);

    // Step 1: Wait for textarea
    await page.waitForSelector(GOOGLE_AI_STUDIO_SELECTORS.promptTextarea, {
      visible: true,
      timeout: TEXTAREA_WAIT_TIMEOUT,
    });
    log.info('Textarea found');
    await humanDelay(200, 400);

    // Step 2: Focus
    await page.focus(GOOGLE_AI_STUDIO_SELECTORS.promptTextarea);
    await humanDelay(100, 200);

    // Step 3: Compose final prompt via the pure builder.
    const { finalPrompt, effectiveFollowUp, guardApplied, akkharIdTagApplied } =
      buildFinalPrompt({
        prompt,
        isFollowUp,
        fullPrompt,
        hasActiveContext: this.hasActiveContext,
        sessionId,
      });

    if (isFollowUp && !this.hasActiveContext && fullPrompt) {
      log.warn('Context lost — using full prompt fallback');
    }
    if (guardApplied) {
      log.info('Applied PROMPT_GUARD (no IDE system prompt detected)');
    }
    if (akkharIdTagApplied && sessionId) {
      log.info(`Embedded Akkhar identity tag: ${sessionId}`);
    }

    log.info(
      `${effectiveFollowUp ? 'Follow-up' : 'Full prompt'}. Length: ${finalPrompt.length} chars`,
    );

    // Step 4: Set value via evaluate
    await page.evaluate(
      (selector: string, text: string) => {
        const textarea = document.querySelector(
          selector,
        ) as HTMLTextAreaElement | null;
        if (!textarea) throw new Error('Textarea not found');

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(textarea, text);
        } else {
          textarea.value = text;
        }

        textarea.dispatchEvent(
          new Event('input', { bubbles: true, cancelable: true }),
        );
        textarea.dispatchEvent(
          new Event('change', { bubbles: true, cancelable: true }),
        );
        textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      },
      GOOGLE_AI_STUDIO_SELECTORS.promptTextarea,
      finalPrompt,
    );

    log.info(`Prompt injected (${finalPrompt.length} chars)`);
    await humanDelay(300, 500);

    // Step 5: Click submit
    await this.clickSubmit(page);
    log.info('Prompt submitted');
  }

  /** Clicks the submit button with fallbacks */
  private async clickSubmit(page: Page): Promise<void> {
    try {
      await page.waitForSelector(GOOGLE_AI_STUDIO_SELECTORS.submitButton, {
        timeout: 10_000,
        visible: true,
      });
      const button = await page.$(GOOGLE_AI_STUDIO_SELECTORS.submitButton);

      if (button) {
        const box = await button.boundingBox();
        if (box) {
          const x = box.x + box.width / 2 + (Math.random() * 4 - 2);
          const y = box.y + box.height / 2 + (Math.random() * 4 - 2);
          await page.mouse.click(x, y);
          log.info('Clicked submit button');
        } else {
          await button.click();
        }
        return;
      }
    } catch {
      log.warn('Submit button not found');
    }

    // Fallback: run button
    try {
      const runBtn = await page.$(GOOGLE_AI_STUDIO_SELECTORS.runButton);
      if (runBtn) {
        await runBtn.click();
        log.info('Clicked fallback run button');
        return;
      }
    } catch {
      log.warn('Run button fallback failed');
    }

    // Fallback: Ctrl+Enter
    log.info('Using Ctrl+Enter keystroke');
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
  }
}
