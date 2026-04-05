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
