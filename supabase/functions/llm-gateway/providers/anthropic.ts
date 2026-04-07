// Anthropic Provider

import type { LLMCallParams, LLMResult } from "../types.ts";

export async function callAnthropic(
  params: LLMCallParams,
  apiKey: string,
): Promise<LLMResult> {
  const systemMsg = params.messages.find((m) => m.role === 'system');
  const nonSystemMsgs = params.messages.filter((m) => m.role !== 'system');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model.replace('anthropic/', ''),
      system: systemMsg?.content || '',
      messages: nonSystemMsgs,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
    }),
  });
  const anthropicResult = await response.json();
  return {
    content: anthropicResult.content?.[0]?.text || '',
    usage: {
      prompt_tokens: anthropicResult.usage?.input_tokens || 0,
      completion_tokens: anthropicResult.usage?.output_tokens || 0,
      total_tokens:
        (anthropicResult.usage?.input_tokens || 0) +
        (anthropicResult.usage?.output_tokens || 0),
    },
    finish_reason: 'stop',
  };
}
