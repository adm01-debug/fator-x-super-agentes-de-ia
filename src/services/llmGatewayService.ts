/**
 * Nexus Agents Studio — LLM Gateway Service
 * Centralized access to llm-gateway edge function.
 */
import { supabase } from '@/integrations/supabase/client';

export async function invokeLLMGateway(body: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  const { data, error } = await supabase.functions.invoke('llm-gateway', { body });
  if (error) throw error;
  return data;
}


export async function invokeGuardrailsEngine(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('guardrails-engine', { body });
  if (error) throw error;
  return data;
}

export async function invokeOracleResearch(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('oracle-research', { body });
  if (error) throw error;
  return data;
}

export async function invokeA2AServer(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('a2a-server', { body });
  if (error) throw error;
  return data;
}

export async function invokeBitrix24OAuth(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('bitrix24-oauth', { body });
  if (error) throw error;
  return data;
}

export async function invokeBitrix24Api(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('bitrix24-api', { body });
  if (error) throw error;
  return data;
}

export async function invokeTestRunner(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('test-runner', { body });
  if (error) throw error;
  return data;
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