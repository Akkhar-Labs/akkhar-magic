/**
 * Akkhar-Magic :: AKKHAR Tag Extractor
 * ======================================
 * Extracts content between Akkhar protocol tags:
 *   <AKKHAR_RESPONSE>  — the model's actual output (thinking stripped)
 *   <AKKHAR_TITLE>     — AI-generated conversation title (first turn only)
 */

import { createLogger } from '../utils/index.js';

const log = createLogger('TagExtractor');

const RESPONSE_START = '<AKKHAR_RESPONSE>';
const RESPONSE_END = '</AKKHAR_RESPONSE>';
const TITLE_START = '<AKKHAR_TITLE>';
const TITLE_END = '</AKKHAR_TITLE>';

/** Result of parsing all Akkhar tags from model output */
export interface TagExtractionResult {
  /** The clean response content (thinking stripped) */
  response: string;
  /** AI-generated title if present, null otherwise */
  title: string | null;
}

/**
 * Extracts content between AKKHAR_RESPONSE tags.
 * If tags are found, returns only the content inside (thinking stripped).
 * If tags are NOT found, returns the full text as-is (graceful fallback).
 */
export function extractTaggedResponse(fullText: string): string {
  // Use lastIndexOf — model thinking can "rehearse" tags before the real output
  const startIdx = fullText.lastIndexOf(RESPONSE_START);
  const endIdx = fullText.lastIndexOf(RESPONSE_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const extracted = fullText
      .slice(startIdx + RESPONSE_START.length, endIdx)
      .trim();
    log.info(
      `Extracted tagged response: ${extracted.length} chars (from ${fullText.length} total, thinking stripped)`,
    );
    return extracted;
  }

  log.info(
    `No AKKHAR_RESPONSE tags found — using full text (${fullText.length} chars)`,
  );
  return fullText;
}

/**
 * Extracts the AI-generated title from <AKKHAR_TITLE> tags.
 * Returns null if no title tag is present.
 */
export function extractTaggedTitle(fullText: string): string | null {
  // Use lastIndexOf — model thinking can "rehearse" tags before the real output
  const startIdx = fullText.lastIndexOf(TITLE_START);
  const endIdx = fullText.lastIndexOf(TITLE_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const title = fullText.slice(startIdx + TITLE_START.length, endIdx).trim();
    if (title.length > 0) {
      log.info(`Extracted title: "${title}"`);
      return title;
    }
  }

  return null;
}

/**
 * Extracts both response and title tags in a single pass.
 */
export function extractAllTags(fullText: string): TagExtractionResult {
  return {
    response: extractTaggedResponse(fullText),
    title: extractTaggedTitle(fullText),
  };
}
