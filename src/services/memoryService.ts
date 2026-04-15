/**
import { supabase } from '@/integrations/supabase/client';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
 * Nexus Agents Studio — Memory Service
 * Persistent memory management (MemGPT/Letta-style via memory-tools edge function).
 */

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
  const { data, error } = await supabaseExternal
    .from('agent_memories')
    .select('*')
    .eq('memory_type', type)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MemoryEntry[];
}

// ============================================================================
// EDGE FUNCTION INVOKERS — wires the memory-manager Edge Function to the UI
// ============================================================================

export type MemoryManagerAction =
  | 'add'
  | 'search'
  | 'list'
  | 'forget'
  | 'forget_all'
  | 'promote_to_fact';

export interface MemoryManagerInvokeInput {
  action: MemoryManagerAction;
  content?: string;
  query?: string;
  memory_id?: string;
  memory_type?: 'episodic' | 'semantic' | 'procedural';
  scope?: MemoryScope;
  scope_id?: string;
  importance?: number;
  limit?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryManagerInvokeResult {
  ok?: boolean;
  data?: unknown;
  memories?: MemoryEntry[];
  error?: string;
}

/**
 * Invokes the `memory-manager` Edge Function (Mem0-style memory).
 * Distinct from memory-tools (the agent runtime helper) — memory-manager is
 * the operator/admin interface used by the MemoryPage for promote-to-fact,
 * forget-all, and scoped operations.
 */
export async function invokeMemoryManager(
  input: MemoryManagerInvokeInput
): Promise<MemoryManagerInvokeResult> {
  const { data, error } = await supabase.functions.invoke('memory-manager', {
    body: {
      action: input.action,
      content: input.content,
      query: input.query,
      memory_id: input.memory_id,
      memory_type: input.memory_type ?? 'episodic',
      scope: input.scope ?? 'user',
      scope_id: input.scope_id,
      importance: input.importance ?? 0.5,
      limit: input.limit ?? 10,
      metadata: input.metadata,
    },
  });

  if (error) {
    throw new Error(error.message || 'memory-manager invocation failed');
  }

  return (data as MemoryManagerInvokeResult) ?? { ok: true };
}

/** Promotes an episodic memory to a long-lived fact via memory-manager. */
export async function promoteMemoryToFact(
  memoryId: string,
  importance = 0.9
): Promise<MemoryManagerInvokeResult> {
  return invokeMemoryManager({
    action: 'promote_to_fact',
    memory_id: memoryId,
    importance,
  });
}
