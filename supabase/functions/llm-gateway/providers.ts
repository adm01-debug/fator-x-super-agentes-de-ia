// Provider-specific API call handlers for the LLM Gateway

export interface LLMCallParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
  response_format?: { type: string; json_schema?: Record<string, unknown> }; // #41 Structured Output
}

export interface LLMResult {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  finish_reason: string;
}

export async function callHuggingFace(params: LLMCallParams, apiKey: string): Promise<LLMResult> {
  const model = params.model.replace('huggingface/', '');
  const body: Record<string, unknown> = {
    model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
  };
  // #41 — Structured Output: pass response_format if provided
  if (params.response_format) {
    body.response_format = params.response_format;
  }
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Title': 'Fator X',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (result.error) {
    throw new Error(`HuggingFace API error: ${typeof result.error === 'string' ? result.error : result.error?.message || JSON.stringify(result.error)}`);
  }
  return normalizeOpenAIResponse(result);
}

export async function callLovable(params: LLMCallParams, apiKey: string): Promise<LLMResult> {
  const lovableModel = mapToLovableModel(params.model);
  const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: lovableModel, messages: params.messages, temperature: params.temperature, max_tokens: params.max_tokens }),
  });
  const result = await response.json();
  return normalizeOpenAIResponse(result);
}

export async function callOpenRouter(params: LLMCallParams, apiKey: string, referer: string): Promise<LLMResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': referer,
      'X-Title': 'Fator X',
    },
    body: JSON.stringify({ model: params.model, messages: params.messages, temperature: params.temperature, max_tokens: params.max_tokens }),
  });
  const result = await response.json();
  return normalizeOpenAIResponse(result);
}

export async function callAnthropic(params: LLMCallParams, apiKey: string): Promise<LLMResult> {
  const systemMsg = params.messages.find(m => m.role === 'system');
  const nonSystemMsgs = params.messages.filter(m => m.role !== 'system');
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
      total_tokens: (anthropicResult.usage?.input_tokens || 0) + (anthropicResult.usage?.output_tokens || 0),
    },
    finish_reason: 'stop',
  };
}

export async function callOpenAICompatible(params: LLMCallParams, apiKey: string, provider: string): Promise<LLMResult> {
  const url = provider === 'google'
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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

function normalizeOpenAIResponse(result: Record<string, unknown>): LLMResult {
  const choices = result.choices as Array<{ message?: { content?: string }; finish_reason?: string }> | undefined;
  const usage = result.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  const error = result.error as { message?: string } | undefined;

  return {
    content: choices?.[0]?.message?.content || error?.message || '',
    usage: {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0),
    },
    finish_reason: choices?.[0]?.finish_reason || 'stop',
  };
}

function mapToLovableModel(model: string): string {
  if (model.includes('gemini-2.5-flash')) return 'google/gemini-2.5-flash';
  if (model.includes('gemini-2.5-pro')) return 'google/gemini-2.5-pro';
  if (model.includes('gemini-3')) return 'google/gemini-3-flash-preview';
  if (model.includes('gpt-5')) return 'openai/gpt-5';
  if (model.includes('gpt-4o')) return 'openai/gpt-5-mini';
  return 'google/gemini-2.5-flash';
}
