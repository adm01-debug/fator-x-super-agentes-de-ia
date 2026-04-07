// OpenRouter Provider

import type { LLMCallParams, LLMResult } from "../types.ts";
import { normalizeOpenAIResponse } from "../utils.ts";

export async function callOpenRouter(
  params: LLMCallParams,
  apiKey: string,
  referer: string,
): Promise<LLMResult> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': 'Fator X',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
      }),
    },
  );
  const result = await response.json();
  return normalizeOpenAIResponse(result);
}
