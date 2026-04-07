/**
 * Nexus Agents Studio — LLM Gateway Service
 * Centralized access to llm-gateway edge function.
 */
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_TIMEOUT_MS = 60_000;
const LLM_TIMEOUT_MS = 120_000;

async function invokeWithTimeout(
  fnName: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await supabase.functions.invoke(fnName, {
      body,
      signal: controller.signal as AbortSignal,
    });
    if (error) throw error;
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`${fnName} timeout after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function invokeLLMGateway(body: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  return invokeWithTimeout('llm-gateway', body, LLM_TIMEOUT_MS);
}

export async function invokeGuardrailsEngine(body: Record<string, unknown>) {
  return invokeWithTimeout('guardrails-engine', body);
}

export async function invokeOracleResearch(body: Record<string, unknown>) {
  return invokeWithTimeout('oracle-research', body, LLM_TIMEOUT_MS);
}

export async function invokeA2AServer(body: Record<string, unknown>) {
  return invokeWithTimeout('a2a-server', body);
}

export async function invokeBitrix24OAuth(body: Record<string, unknown>) {
  return invokeWithTimeout('bitrix24-oauth', body);
}

export async function invokeBitrix24Api(body: Record<string, unknown>) {
  return invokeWithTimeout('bitrix24-api', body);
}

export async function invokeTestRunner(body: Record<string, unknown>) {
  return invokeWithTimeout('test-runner', body, LLM_TIMEOUT_MS);
}

export async function saveWorkspaceSecret(wsId: string, keyName: string, value: string, isUpdate: boolean) {
  if (isUpdate) {
    await supabase.from('workspace_secrets').update({ key_value: value, updated_at: new Date().toISOString() })
      .eq('workspace_id', wsId).eq('key_name', keyName);
  } else {
    await supabase.from('workspace_secrets').insert({ workspace_id: wsId, key_name: keyName, key_value: value });
  }
}

export async function getMaskedSecrets(wsId: string) {
  const { data } = await supabase.rpc('get_masked_secrets', { p_workspace_id: wsId });
  return data ?? [];
}