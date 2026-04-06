/**
 * Nexus Agents Studio — LLM Gateway Service
 * Centralized access to Edge Functions via supabase.functions.invoke().
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

async function invokeEdgeFunction(fnName: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) {
    logger.error(`Edge function ${fnName} failed`, { error: error.message, body: Object.keys(body) });
    throw new Error(`${fnName}: ${error.message}`);
  }
  return data;
}

export async function invokeLLMGateway(body: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  return invokeEdgeFunction('llm-gateway', body);
}

export async function invokeGuardrailsEngine(body: Record<string, unknown>) {
  return invokeEdgeFunction('guardrails-engine', body);
}

export async function invokeOracleResearch(body: Record<string, unknown>) {
  return invokeEdgeFunction('oracle-research', body);
}

export async function invokeA2AServer(body: Record<string, unknown>) {
  return invokeEdgeFunction('a2a-server', body);
}

export async function invokeBitrix24OAuth(body: Record<string, unknown>) {
  return invokeEdgeFunction('bitrix24-oauth', body);
}

export async function invokeBitrix24Api(body: Record<string, unknown>) {
  return invokeEdgeFunction('bitrix24-api', body);
}

export async function invokeTestRunner(body: Record<string, unknown>) {
  return invokeEdgeFunction('test-runner', body);
}

export async function saveWorkspaceSecret(wsId: string, keyName: string, value: string, isUpdate: boolean) {
  try {
    if (isUpdate) {
      const { error } = await supabase.from('workspace_secrets').update({ key_value: value, updated_at: new Date().toISOString() })
        .eq('workspace_id', wsId).eq('key_name', keyName);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('workspace_secrets').insert({ workspace_id: wsId, key_name: keyName, key_value: value });
      if (error) throw error;
    }
  } catch (err) {
    logger.error('Failed to save workspace secret', { keyName, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function getMaskedSecrets(wsId: string) {
  const { data, error } = await supabase.rpc('get_masked_secrets', { p_workspace_id: wsId });
  if (error) {
    logger.error('Failed to get masked secrets', { error: error.message });
    throw error;
  }
  return data ?? [];
}
