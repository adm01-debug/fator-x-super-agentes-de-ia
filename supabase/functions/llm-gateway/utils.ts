// Shared utilities for the LLM Gateway

import type { LLMResult } from "./types.ts";

export function normalizeOpenAIResponse(
  result: Record<string, unknown>,
): LLMResult {
  const choices = result.choices as
    | Array<{ message?: { content?: string }; finish_reason?: string }>
    | undefined;
  const usage = result.usage as
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;
  const error = result.error as { message?: string } | undefined;

  let content = choices?.[0]?.message?.content || error?.message || '';
  content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();

  return {
    content,
    usage: {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens:
        usage?.total_tokens ||
        (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0),
    },
    finish_reason: choices?.[0]?.finish_reason || 'stop',
  };
}
