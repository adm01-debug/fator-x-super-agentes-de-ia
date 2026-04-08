/**
 * Nexus Agents Studio — LLM Gateway Service
 * Centralized access to llm-gateway edge function.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export async function invokeLLMGateway(body: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  const { data, error } = await supabase.functions.invoke('llm-gateway', { body });
  if (error) { logger.error('llm-gateway failed', { error: error.message }); throw error; }
  return data;
}


export async function invokeGuardrailsEngine(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('guardrails-engine', { body });
  if (error) { logger.error('guardrails-engine failed', { error: error.message }); throw error; }
  return data;
}

export async function invokeOracleResearch(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('oracle-research', { body });
  if (error) { logger.error('oracle-research failed', { error: error.message }); throw error; }
  return data;
}

export async function invokeA2AServer(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('a2a-server', { body });
  if (error) { logger.error('a2a-server failed', { error: error.message }); throw error; }
  return data;
}

export async function invokeBitrix24OAuth(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('bitrix24-oauth', { body });
  if (error) { logger.error('bitrix24-oauth failed', { error: error.message }); throw error; }
  return data;
}

export async function invokeBitrix24Api(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('bitrix24-api', { body });
  if (error) { logger.error('bitrix24-api failed', { error: error.message }); throw error; }
  return data;
}

export async function invokeTestRunner(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('test-runner', { body });
  if (error) { logger.error('test-runner failed', { error: error.message }); throw error; }
  return data;
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
    logger.error('saveWorkspaceSecret failed', { keyName, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function getMaskedSecrets(wsId: string) {
  const { data, error } = await supabase.rpc('get_masked_secrets', { p_workspace_id: wsId });
  if (error) { logger.error('getMaskedSecrets failed', { error: error.message }); throw error; }
  return data ?? [];
}