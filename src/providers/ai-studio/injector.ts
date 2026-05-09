/**
 * Akkhar-Magic :: AI Studio Prompt Injector
 * ==========================================
 * Injects prompts into AI Studio's textarea and submits them.
 */

import type { Page } from 'puppeteer-core';
import type { InjectOptions } from '../../types/provider.js';
import {
  PROMPT_GUARD,
  RESPONSE_TAG_DIRECTIVE,
  TITLE_TAG_DIRECTIVE,
} from '../../constants/prompts.js';
import { TEXTAREA_WAIT_TIMEOUT } from '../../constants/timing.js';
import { AI_STUDIO_SELECTORS } from './selectors.js';
import { createLogger, humanDelay } from '../../utils/index.js';

const log = createLogger('AiStudioInjector');

export class AiStudioInjector {
  /** Whether the current chat has an active context (for follow-up detection) */
  private hasActiveContext: boolean = false;

  setHasActiveContext(value: boolean): void {
    this.hasActiveContext = value;
  }

  /** Injects a prompt into the textarea and clicks submit */
  async inject(page: Page, options: InjectOptions): Promise<void> {
    const { prompt, isFollowUp, fullPrompt } = options;

    log.info(`Waiting for textarea... (timeout: ${TEXTAREA_WAIT_TIMEOUT}ms)`);

    // Step 1: Wait for textarea
    await page.waitForSelector(AI_STUDIO_SELECTORS.promptTextarea, {
      visible: true,
      timeout: TEXTAREA_WAIT_TIMEOUT,
    });
    log.info('Textarea found');
    await humanDelay(200, 400);

    // Step 2: Focus
    await page.focus(AI_STUDIO_SELECTORS.promptTextarea);
    await humanDelay(100, 200);

    // Step 3: Prepare prompt
    let finalPrompt: string;
    let effectiveFollowUp = isFollowUp;

    if (isFollowUp && !this.hasActiveContext) {
      // Context lost — fall back to full prompt
      if (fullPrompt) {
        finalPrompt = fullPrompt;
        effectiveFollowUp = false;
        log.warn('Context lost — using full prompt fallback');
      } else {
        finalPrompt = prompt;
      }
    } else if (isFollowUp) {
      finalPrompt = prompt;
    } else {
      const hasIdeSystemPrompt = prompt.startsWith('[System Instructions]');
      if (hasIdeSystemPrompt) {
        finalPrompt = prompt;
        log.info('IDE system prompt detected — skipping prompt guard');
      } else {
        finalPrompt = PROMPT_GUARD + prompt;
      }
    }

    // Always append tag directive
    finalPrompt += RESPONSE_TAG_DIRECTIVE;

    // First turn only: ask the model to also generate a title
    if (!effectiveFollowUp) {
      finalPrompt += TITLE_TAG_DIRECTIVE;
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
      AI_STUDIO_SELECTORS.promptTextarea,
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
      await page.waitForSelector(AI_STUDIO_SELECTORS.submitButton, {
        timeout: 10_000,
        visible: true,
      });
      const button = await page.$(AI_STUDIO_SELECTORS.submitButton);

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
      const runBtn = await page.$(AI_STUDIO_SELECTORS.runButton);
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
