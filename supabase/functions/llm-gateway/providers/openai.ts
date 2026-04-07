// OpenAI & Google (OpenAI-compatible) Provider

import type { LLMCallParams, LLMResult } from "../types.ts";
import { normalizeOpenAIResponse } from "../utils.ts";

export async function callOpenAICompatible(
  params: LLMCallParams,
  apiKey: string,
  provider: string,
): Promise<LLMResult> {
  const url =
    provider === 'google'
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: params.model.replace('openai/', '').replace('google/', ''),
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
    }),
  });
  const result = await response.json();
  return normalizeOpenAIResponse(result);
}
