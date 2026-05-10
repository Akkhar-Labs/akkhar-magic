/**
 * Akkhar-Magic :: Google Account Email Scraper (AI Studio)
 * ==========================================================
 * Best-effort extraction of the logged-in Google account email from a
 * page on aistudio.google.com.
 *
 * NOTE: This is provider-specific. It works on any Google property
 * (because it targets Google's account UI markup) but it will NOT work
 * for any other AI provider. If/when other providers are added
 * (Anthropic Console, OpenAI Platform, etc.), each provider gets its
 * own account-scraper.
 *
 * Strategy:
 *   Google's account UI (avatar button, account chooser, settings link)
 *   embeds the user's email in `aria-label` or `data-email` attributes
 *   like:
 *     <a aria-label="Google Account: Rahat Hasan (rahat@gmail.com)" ...>
 *
 *   We scan the DOM for any element with such an attribute and pull the
 *   first email-shaped substring.
 *
 * Best-effort by design: if Google changes their markup, the scraper
 * silently returns `null` and the calling code falls back gracefully
 * (the `gmail` field is optional on `BrowserProfile`).
 *
 * See: LocalDocs/BLUEPRINT_PERSISTENT_SESSIONS.md §6 (Option A)
 */

import type { Page } from 'puppeteer-core';
import { createLogger } from '../../utils/index.js';

const log = createLogger('GoogleAccountScraper');

/**
 * Permissive email regex — matches the local-part + domain we care about.
 * We do NOT restrict to gmail.com; Workspace accounts (rahat@akkhar-labs.com)
 * are valid Google logins and should be captured too.
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Try to extract the logged-in Google account email from the current page.
 * Returns `null` if no email-shaped string is found.
 *
 * Safe to call repeatedly while the user is signing in — returns `null`
 * until the account UI hydrates with the user's identity.
 */
export async function scrapeAccountEmail(page: Page): Promise<string | null> {
  try {
    const email = await page.evaluate(() => {
      const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

      // 1. Direct data-email attributes (some Google widgets expose this).
      const dataEmailEl = document.querySelector('[data-email]');
      const dataEmail = dataEmailEl?.getAttribute('data-email');
      if (dataEmail && re.test(dataEmail)) {
        return re.exec(dataEmail)?.[0] ?? null;
      }

      // 2. aria-label attributes — primary Google account UI signal.
      //    Examples seen in the wild:
      //      "Google Account: Rahat Hasan\n(rahat@gmail.com)"
      //      "Account: rahat@gmail.com"
      const ariaEls = document.querySelectorAll('[aria-label]');
      for (const el of Array.from(ariaEls)) {
        const label = el.getAttribute('aria-label') ?? '';
        const match = re.exec(label);
        if (match) return match[0];
      }

      // 3. Last resort: scan visible text of common account-chip selectors.
      const textEls = document.querySelectorAll(
        'a[href*="accounts.google.com"], [role="button"]',
      );
      for (const el of Array.from(textEls)) {
        const text = (el as HTMLElement).innerText ?? '';
        const match = re.exec(text);
        if (match) return match[0];
      }

      return null;
    });

    if (email && EMAIL_REGEX.test(email)) {
      return email;
    }
    return null;
  } catch (err) {
    log.debug(`scrapeAccountEmail evaluation failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Poll the page until a Google account email is detected or `timeoutMs`
 * elapses. Returns the address, or `null` on timeout.
 *
 * Useful during the login flow: the user is signing in, the account UI
 * isn't ready yet, and we don't know exactly when it will be. Polling
 * lets us capture as soon as the identity hydrates.
 */
export async function waitForAccountEmail(
  page: Page,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? 120_000; // 2 minutes default
  const intervalMs = options.intervalMs ?? 1_500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const email = await scrapeAccountEmail(page);
    if (email) {
      log.info(`Captured Google account email: ${email}`);
      return email;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  log.warn(`Google account email capture timed out after ${timeoutMs}ms`);
  return null;
}
