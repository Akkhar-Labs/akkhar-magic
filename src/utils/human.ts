/**
 * Akkhar-Magic :: Human Simulation Utilities
 * ============================================
 * Anti-detection primitives: variable delays, typing simulation,
 * mouse jitter, and randomized behavioral patterns.
 */

/**
 * Sleep for a specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random float between min and max.
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Sleeps for a random duration between min and max milliseconds.
 * Simulates natural human hesitation.
 */
export function humanDelay(minMs: number, maxMs: number): Promise<void> {
  return sleep(randomInt(minMs, maxMs));
}

/**
 * Types text into a Puppeteer page element character-by-character
 * with variable per-keystroke delays to simulate human typing.
 */
export async function humanType(
  page: { keyboard: { type: (text: string, opts?: { delay: number }) => Promise<void> } },
  text: string,
  minDelay: number = 30,
  maxDelay: number = 90,
): Promise<void> {
  // Break into chunks to add natural pauses (like thinking mid-sentence)
  const avgDelay = (minDelay + maxDelay) / 2;

  // Type character by character with variable delay
  for (const char of text) {
    const delay = randomInt(minDelay, maxDelay);
    await page.keyboard.type(char, { delay });

    // Occasional longer pause (5% chance) to simulate thinking
    if (Math.random() < 0.05) {
      await sleep(randomInt(avgDelay * 3, avgDelay * 6));
    }
  }
}

/**
 * Generates small random offsets for mouse movements to avoid
 * perfectly linear (bot-like) cursor paths.
 */
export function mouseJitter(): { x: number; y: number } {
  return {
    x: randomFloat(-3, 3),
    y: randomFloat(-3, 3),
  };
}

/**
 * Simulates a human-like click with slight offset and pre-click hover delay.
 */
export async function humanClick(
  page: {
    mouse: {
      move: (x: number, y: number) => Promise<void>;
      click: (x: number, y: number) => Promise<void>;
    };
  },
  x: number,
  y: number,
): Promise<void> {
  const jitter = mouseJitter();
  const targetX = x + jitter.x;
  const targetY = y + jitter.y;

  // Move to target with slight overshoot
  await page.mouse.move(targetX + randomFloat(-2, 2), targetY + randomFloat(-2, 2));
  await humanDelay(50, 150);
  await page.mouse.move(targetX, targetY);
  await humanDelay(30, 80);
  await page.mouse.click(targetX, targetY);
}
