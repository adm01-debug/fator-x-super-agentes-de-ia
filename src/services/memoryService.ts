/**
 * Nexus Agents Studio — Memory Service
 * Persistent memory management (MemGPT/Letta-style via memory-tools edge function).
 */
import { supabase } from '@/integrations/supabase/client';

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'short_term' | 'user_profile' | 'team' | 'external';
export type MemoryScope = 'session' | 'user' | 'agent' | 'org';

export interface MemoryEntry {
  id: string;
  content: string;
  source: string;
  created_at: string;
  relevance_score: number | null;
  memory_type?: string;
}

/** Invoke memory-tools edge function */
async function invokeMemoryTool(tool: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('memory-tools', {
    body: { tool, params },
  });
  if (error) throw new Error(error.message || 'Erro ao chamar memory-tools');
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Add a memory via memory-tools edge function */
export async function addMemory(content: string, type: string = 'semantic', source: string = 'Manual') {
  return invokeMemoryTool('memory_save', {
    content,
    memory_type: type,
    source,
  });
}

/** Search memories via memory-tools edge function */
export async function searchMemory(query: string, type?: string, limit = 50): Promise<MemoryEntry[]> {
  const result = await invokeMemoryTool('memory_search', {
    query,
    memory_type: type,
    limit,
  });
  return (result?.memories ?? []) as MemoryEntry[];
}

/** Forget (delete) a memory */
export async function forgetMemory(memoryId: string) {
  return invokeMemoryTool('memory_forget', { memory_id: memoryId });
}

/** Compact memories of a given type */
export async function compactMemories(memoryType: string) {
  return invokeMemoryTool('memory_compact', { memory_type: memoryType });
}

/** List memories directly from the database (fallback) */
export async function listMemories(type: string, limit = 100): Promise<MemoryEntry[]> {
  const { data, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('memory_type', type)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MemoryEntry[];
}
