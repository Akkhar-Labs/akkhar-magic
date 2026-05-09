/**
 * Akkhar-Magic :: Prompt Constants
 * =================================
 * Prompt guards and directives shared across providers.
 */

/** Prepended to prompts when NO IDE system prompt is present.
 *  Prevents Gemini from triggering function calls in AI Studio UI. */
export const PROMPT_GUARD = `[System: You are a helpful coding assistant. Output only raw markdown text. Do not trigger function calls, tool use, or structured responses. Never wrap your response in JSON tool_call format. Respond directly with natural language and code blocks only.]

`;

/** Appended to EVERY prompt (first turn + follow-ups) to make the model
 *  tag its actual output, allowing us to separate it from thinking blocks.
 *  Google's API sends thinking/reasoning through a separate channel — the model
 *  doesn't need to know about thinking filtering. */
export const RESPONSE_TAG_DIRECTIVE = `\n\n[OUTPUT FORMAT RULE: Wrap your final answer inside <AKKHAR_RESPONSE> and </AKKHAR_RESPONSE> tags. Your final answer includes: the direct response you want to deliver, any XML tool tags (like <read_file>, <write_to_file>, <attempt_completion>, <ask_followup_question>, etc.), code blocks, explanations — everything that is your actual reply. Do NOT put your internal reasoning, planning thoughts, or meta-commentary about how you will respond inside these tags. Only your actual deliverable answer goes inside the tags. Example: <AKKHAR_RESPONSE>your complete answer here including any tool XML tags</AKKHAR_RESPONSE>]`;

/** Appended to first-turn prompts ONLY to generate a chat title alongside the response.
 *  The title gets cached locally and served to the IDE's title-generation request. */
export const TITLE_TAG_DIRECTIVE = `\n\n[TITLE RULE: Also generate a short 3-4 word title for this conversation. Wrap it in <AKKHAR_TITLE> and </AKKHAR_TITLE> tags. Place it BEFORE the <AKKHAR_RESPONSE> tags. The title should be directly related to the content of the user's message. No punctuation. Example: <AKKHAR_TITLE>React Component Setup</AKKHAR_TITLE>]`;
