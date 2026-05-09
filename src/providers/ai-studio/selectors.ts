/**
 * Akkhar-Magic :: AI Studio DOM Selectors
 * =========================================
 * Single source of truth for all Google AI Studio DOM selectors.
 * Based on forensic audit (May 2026). If Google updates their UI,
 * only this file needs to change.
 */

export const AI_STUDIO_SELECTORS = {
  /** The prompt textarea */
  promptTextarea: 'textarea[aria-label="Enter a prompt"]',

  /** The submit/run button */
  submitButton: 'button.ctrl-enter-submits',

  /** The response output container */
  responseText: '.model-response-text',

  /** Fallback response selectors (ordered by specificity) */
  responseFallbacks: [
    '.model-response-text',
    '.model-response-text-inner',
    '[class*="response-text"]',
    '.response-container .markdown',
    '.model-response .markdown-content',
    'model-response .text-content',
  ],

  /** Structured output / Function calling containers */
  structuredOutputSelectors: [
    'ms-structured-output',
    '[data-test-id="structured-output"]',
    '.structured-output-container',
    '[class*="structured-output"]',
    '[class*="function-call"]',
    '.tool-call-output',
    'ms-function-call',
    '[class*="tool-response"]',
  ],

  /** Function call / Tool input waiting state */
  toolInputIndicators: [
    '[class*="tool-input"]',
    '[class*="function-call-pending"]',
    '[class*="awaiting-tool"]',
    'ms-tool-input',
    '.pending-function-call',
  ],

  /** The Stop button — visible only while generating */
  stopButton: 'button[aria-label="Stop"]',

  /** The Run button — re-enabled after generation completes */
  runButton: 'button.run-button',

  /** Rate limit / error banners */
  limitBanner:
    '[class*="limit"], [class*="error-banner"], [class*="quota"], [class*="rate-limit"]',
} as const;