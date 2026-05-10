/**
 * Akkhar-Magic :: Google AI Studio Constants
 * =============================================
 * Endpoint patterns, timing, and provider-specific configuration.
 */

/** Endpoint URL patterns that contain MODEL OUTPUT.
 *  ONLY these endpoints return actual Gemini-generated text.
 *  All other MakerSuiteService endpoints are metadata and must be excluded. */
export const GOOGLE_AI_STUDIO_ENDPOINTS = [
  'MakerSuiteService/GenerateContent',
  'MakerSuiteService/StreamGenerateContent',
  'MakerSuiteService/CreatePrompt',
] as const;

/** Base URL for Google AI Studio */
export const GOOGLE_AI_STUDIO_BASE_URL = 'https://aistudio.google.com';

/** URL for creating a new chat */
export const GOOGLE_AI_STUDIO_NEW_CHAT_URL = `${GOOGLE_AI_STUDIO_BASE_URL}/prompts/new_chat`;
