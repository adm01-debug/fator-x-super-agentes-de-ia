// Shared types for the LLM Gateway

export interface LLMCallParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
  response_format?: { type: string; json_schema?: Record<string, unknown> };
}

export interface LLMResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: string;
}
