import { supabase } from '@/integrations/supabase/client';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import type { Json } from '@/integrations/supabase/types';

interface ExportedAgent {
  _format: 'nexus-agent-v1';
  name: string;
  mission: string | null;
  persona: string | null;
  model: string | null;
  avatar_emoji: string | null;
  reasoning: string | null;
  tags: string[] | null;
  config: Record<string, unknown>;
  exported_at: string;
}

export function exportAgentToJSON(agent: {
  name: string;
  mission: string | null;
  persona: string | null;
  model: string | null;
  avatar_emoji: string | null;
  reasoning: string | null;
  tags: string[] | null;
  config: Json;
}): string {
  const exported: ExportedAgent = {
    _format: 'nexus-agent-v1',
    name: agent.name,
    mission: agent.mission,
    persona: agent.persona,
    model: agent.model,
    avatar_emoji: agent.avatar_emoji,
    reasoning: agent.reasoning,
    tags: agent.tags,
    config: (agent.config ?? {}) as Record<string, unknown>,
    exported_at: new Date().toISOString(),
  };
  return JSON.stringify(exported, null, 2);
}

export function downloadJSON(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateImportedAgent(data: unknown): ExportedAgent | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d._format !== 'nexus-agent-v1') return null;
  if (typeof d.name !== 'string' || !d.name.trim()) return null;
  return d as unknown as ExportedAgent;
}

export async function importAgentFromJSON(json: string): Promise<string> {
  const parsed = JSON.parse(json);
  const agent = validateImportedAgent(parsed);
  if (!agent) throw new Error('Formato de arquivo inválido. Use um arquivo exportado pelo Nexus.');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Get workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabaseExternal.from('agents').insert({
    user_id: user.id,
    workspace_id: member?.workspace_id ?? null,
    name: `${agent.name} (importado)`,
    mission: agent.mission,
    persona: agent.persona,
    model: agent.model,
    avatar_emoji: agent.avatar_emoji,
    reasoning: agent.reasoning,
    tags: agent.tags,
    config: agent.config as unknown as Json,
    status: 'draft',
    version: 1,
  }).select('id').single();

  if (error) throw error;
  return data.id;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
}
