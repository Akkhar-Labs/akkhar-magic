/**
 * Akkhar-Magic :: Provider Registry
 * ==================================
 * Central registry for all AI platform providers.
 * To add a new provider, import it here and add to the registry.
 */

import type { IProvider } from '../types/provider.js';
import { GoogleAiStudioProvider } from './google-ai-studio/index.js';

export type { IProvider } from '../types/provider.js';
export { GoogleAiStudioProvider } from './google-ai-studio/index.js';

/** All available providers, keyed by name */
const PROVIDER_REGISTRY: Record<string, () => IProvider> = {
  'google-ai-studio': () => new GoogleAiStudioProvider(),
};

/**
 * Creates a provider instance by name.
 * Throws if the provider is not registered.
 */
export function createProvider(name: string): IProvider {
  const factory = PROVIDER_REGISTRY[name];
  if (!factory) {
    const available = Object.keys(PROVIDER_REGISTRY).join(', ');
    throw new Error(`Unknown provider "${name}". Available: ${available}`);
  }
  return factory();
}
