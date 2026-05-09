/**
 * Akkhar-Magic :: AI Studio Response Parser
 * ============================================
 * Parses Google's internal RPC nested array format.
 * AI Studio does NOT use the public Gemini API JSON format.
 * The response is a deeply nested array with model text at varying depths.
 */

/**
 * Extracts text content from AI Studio's raw response data.
 * Handles both Google Internal RPC (nested arrays) and public Gemini API JSON.
 */
export function parseAiStudioResponse(rawData: string): string[] {
  const texts: string[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    // Data may be streamed in multiple JSON chunks separated by newlines
    const lines = rawData.split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
      try {
        const lineParsed = JSON.parse(
          line.startsWith('data: ') ? line.slice(6) : line,
        );
        texts.push(...extractTextsFromParsed(lineParsed));
      } catch {
        // Skip unparseable lines
      }
    }
    if (texts.length === 0 && rawData.trim().length > 0) {
      texts.push(rawData);
    }
    return texts;
  }

  texts.push(...extractTextsFromParsed(parsed));
  return texts;
}

function extractTextsFromParsed(parsed: any): string[] {
  const texts: string[] = [];

  // Format 1: Public Gemini API (candidates array)
  if (parsed?.candidates) {
    for (const candidate of parsed.candidates) {
      const text = candidate?.content?.parts?.[0]?.text;
      if (typeof text === 'string' && text.length > 0) {
        texts.push(text);
      }
    }
    if (texts.length > 0) return texts;
  }

  // Format 2: Google Internal RPC (nested arrays)
  extractTextsFromNestedArrays(parsed, texts);
  return texts;
}

function extractTextsFromNestedArrays(data: any, results: string[]): void {
  if (!Array.isArray(data)) return;

  const hasModelRole = data.includes('model');
  const hasUserRole = data.includes('user');

  if (hasUserRole && !hasModelRole) return;

  if (hasModelRole) {
    extractTextsFromModelSubtree(data, results);
    return;
  }

  for (const element of data) {
    if (Array.isArray(element)) {
      extractTextsFromNestedArrays(element, results);
    }
  }
}

function extractTextsFromModelSubtree(data: any, results: string[]): void {
  if (!Array.isArray(data)) return;

  if (
    data.length >= 2 &&
    data[0] === null &&
    typeof data[1] === 'string' &&
    data[1].length > 0
  ) {
    const text = data[1];

    // Filter out base64 encoded data
    const looksLikeBase64 =
      text.length > 100 &&
      !text.includes(' ') &&
      /^[A-Za-z0-9+/=]+$/.test(text);
    if (looksLikeBase64) return;

    results.push(text);
    return;
  }

  for (const element of data) {
    if (Array.isArray(element)) {
      extractTextsFromModelSubtree(element, results);
    }
  }
}
