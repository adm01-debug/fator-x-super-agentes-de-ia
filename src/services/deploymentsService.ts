/**
 * Nexus Agents Studio — Deployments Service
 * Multi-channel deploy: Widget, WhatsApp, Slack, API, Bitrix24
 */
import { supabase } from '@/integrations/supabase/client';

export type DeployChannel = 'widget' | 'api' | 'whatsapp' | 'slack' | 'bitrix24' | 'telegram';

export interface DeployConnection {
  id: string;
  agent_id: string;
  channel: DeployChannel;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, unknown>;
  api_key_hash?: string;
  created_at: string;
}

export async function listDeployments(agentId: string): Promise<DeployConnection[]> {
  const { data, error } = await supabase
    .from('deploy_connections')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as DeployConnection[];
}

export async function createDeployment(agentId: string, channel: DeployChannel, config: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('deploy_connections')
    .insert({
      agent_id: agentId,
      channel,
      config,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleDeployment(id: string, active: boolean) {
  const { error } = await supabase
    .from('deploy_connections')
    .update({ status: active ? 'active' : 'inactive' })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteDeployment(id: string) {
  const { error } = await supabase.from('deploy_connections').delete().eq('id', id);
  if (error) throw error;
}

export function getWidgetSnippet(_agentId: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `<script src="${baseUrl}/functions/v1/widget-proxy/widget/${agentId}.js" async></script>`;
}

export function getApiEndpoint(_agentId: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-proxy/chat`;
}
