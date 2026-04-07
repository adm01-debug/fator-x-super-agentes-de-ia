// HuggingFace Provider — with free model fallback pool

import type { LLMCallParams, LLMResult } from "../types.ts";

const HF_FREE_MODELS = [
  'Qwen/Qwen3-30B-A3B',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'google/gemma-3-12b-it',
  'deepseek-ai/DeepSeek-V3',
  'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
];

interface HFAttemptResult {
  result?: LLMResult;
  retryable: boolean;
  status: number;
  errorMsg: string;
}

async function callHuggingFaceSingle(
  model: string,
  params: LLMCallParams,
  apiKey: string,
): Promise<HFAttemptResult> {
  const body: Record<string, unknown> = {
    model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
  };
  if (params.response_format) body.response_format = params.response_format;
  if (model.includes('Qwen3') || model.includes('DeepSeek')) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Title': 'Fator X',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    const status = response.status;

    if (status === 503) {
      const text = await response.text();
      const estimatedTime = text.match(/"estimated_time":\s*([\d.]+)/)?.[1];
      return {
        retryable: true,
        status,
        errorMsg: `Model loading (cold start)${estimatedTime ? `, ETA: ${estimatedTime}s` : ''}`,
      };
    }
    if (status === 429) {
      await response.text();
      return { retryable: true, status, errorMsg: 'Rate limit exceeded' };
    }
    if (status === 500 || status === 502) {
      await response.text();
      return { retryable: true, status, errorMsg: `Server error ${status}` };
    }
    if (!response.ok) {
      const text = await response.text();
      return {
        retryable: false,
        status,
        errorMsg: `HF API error ${status}: ${text.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    if (result.error) {
      const msg =
        typeof result.error === 'string'
          ? result.error
          : result.error?.message || JSON.stringify(result.error);
      if (
        msg.includes('currently loading') ||
        msg.includes('is currently') ||
        msg.includes('queue')
      ) {
        return { retryable: true, status: 503, errorMsg: msg };
      }
      return {
        retryable: false,
        status: 400,
        errorMsg: `HuggingFace API error: ${msg}`,
      };
    }
    return {
      result: normalizeResponse(result),
      retryable: false,
      status: 200,
      errorMsg: '',
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { retryable: true, status: 408, errorMsg: 'Request timeout (60s)' };
    }
    return {
      retryable: false,
      status: 0,
      errorMsg: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function callHuggingFace(
  params: LLMCallParams,
  apiKey: string,
): Promise<LLMResult> {
  const requestedModel = params.model.replace('huggingface/', '');
  const errors: string[] = [];

  const first = await callHuggingFaceSingle(requestedModel, params, apiKey);
  if (first.result) return first.result;
  errors.push(`[${requestedModel}] ${first.errorMsg}`);

  if (first.retryable) {
    const fallbacks = HF_FREE_MODELS.filter((m) => m !== requestedModel);
    for (const fallbackModel of fallbacks) {
      console.log(
        `HF fallback: trying ${fallbackModel} after ${requestedModel} failed (${first.errorMsg})`,
      );
      const attempt = await callHuggingFaceSingle(fallbackModel, params, apiKey);
      if (attempt.result) {
        console.log(`HF fallback success: ${fallbackModel}`);
        return attempt.result;
      }
      errors.push(`[${fallbackModel}] ${attempt.errorMsg}`);
      if (!attempt.retryable) break;
    }
  }

  throw new Error(`HuggingFace: all models failed — ${errors.join(' | ')}`);
}

function normalizeResponse(result: Record<string, unknown>): LLMResult {
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
