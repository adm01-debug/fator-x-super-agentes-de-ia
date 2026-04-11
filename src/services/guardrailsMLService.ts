/**
 * Nexus — Guardrails ML Service
 * Connects to guardrails-ml edge function v2.2
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const TIMEOUT_MS = 30_000;

async function invokeGuardrails(body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke('guardrails-ml', { body, signal: controller.signal as AbortSignal });
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error(`guardrails-ml timeout after ${TIMEOUT_MS}ms`);
    throw e;
  } finally { clearTimeout(timer); }
}

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
  try {
    return await invokeGuardrails({ text, direction: 'input' }) as GuardrailResponse;
  } catch (e) { logger.error('Guardrails input failed', e); throw e; }
}

export async function checkOutput(text: string): Promise<GuardrailResponse> {
  try {
    return await invokeGuardrails({ text, direction: 'output' }) as GuardrailResponse;
  } catch (e) { logger.error('Guardrails output failed', e); throw e; }
}

export async function isTextSafe(text: string, direction: 'input' | 'output' = 'input'): Promise<boolean> {
  const result = direction === 'input' ? await checkInput(text) : await checkOutput(text);
  return result.allowed;
}
