/**
 * Nexus Agents Studio — Memory Service
 * Persistent memory management (Mem0-style).
 */
import { supabase } from '@/integrations/supabase/client';

export type MemoryType = 'episodic' | 'semantic' | 'procedural';
export type MemoryScope = 'session' | 'user' | 'agent' | 'org';

export async function addMemory(content: string, type: MemoryType = 'episodic', scope: MemoryScope = 'user') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action: 'add', content, memory_type: type, scope }),
  });

  if (!resp.ok) throw new Error('Memory add failed');
  return resp.json();
}

export async function searchMemory(query: string, type?: MemoryType, limit = 10) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action: 'search', query, memory_type: type, limit }),
  });

  if (!resp.ok) throw new Error('Memory search failed');
  return resp.json();
}

export async function forgetMemory(memoryId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action: 'forget', memory_id: memoryId }),
  });

  if (!resp.ok) throw new Error('Memory forget failed');
  return resp.json();
}

export async function listMemories(type?: MemoryType, limit = 50) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action: 'list', memory_type: type, limit }),
  });

  if (!resp.ok) throw new Error('Memory list failed');
  return resp.json();
}
