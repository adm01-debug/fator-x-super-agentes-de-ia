/**
 * Nexus — Guardrails ML Service
 * Connects to guardrails-ml edge function v2.2
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export interface GuardrailResult {
  passed: boolean;
  layer: string;
  score: number;
  details: string;
}

export interface GuardrailResponse {
  allowed: boolean;
  direction: 'input' | 'output';
  results: GuardrailResult[];
  blocked_count: number;
  version: string;
}

export async function checkInput(text: string): Promise<GuardrailResponse> {
  const { data, error } = await supabaseExternal.functions.invoke('guardrails-ml', {
    body: { text, direction: 'input' },
  });
  if (error) {
    logger.error('Guardrails ML input check failed', { error: error.message });
    throw new Error(`Guardrails error: ${error.message}`);
  }
  return data as GuardrailResponse;
}

export async function checkOutput(text: string): Promise<GuardrailResponse> {
  const { data, error } = await supabaseExternal.functions.invoke('guardrails-ml', {
    body: { text, direction: 'output' },
  });
  if (error) {
    logger.error('Guardrails ML output check failed', { error: error.message });
    throw new Error(`Guardrails error: ${error.message}`);
  }
  return data as GuardrailResponse;
}

export async function isTextSafe(text: string, direction: 'input' | 'output' = 'input'): Promise<boolean> {
  const result = direction === 'input' ? await checkInput(text) : await checkOutput(text);
  return result.allowed;
}
