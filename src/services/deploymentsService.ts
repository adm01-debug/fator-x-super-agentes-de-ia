/**
 * Nexus Agents Studio — Deployments Service
 * Multi-channel deploy: Widget, WhatsApp, Slack, API, Bitrix24
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';

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

  const insertData = {
    agent_id: agentId,
    channel,
    config,
    status: 'active',
  };
  const { data, error } = await (supabaseExternal.from('deploy_connections').insert as Function)(insertData)
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
  const { error } = await supabaseExternal.from('deploy_connections').delete().eq('id', id);
  if (error) throw error;
}

export function getWidgetSnippet(agentId: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `<script src="${baseUrl}/functions/v1/widget-proxy/widget/${agentId}.js" async></script>`;
}

export function getApiEndpoint(_agentId: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-proxy/chat`;
}

export async function listDeployedAgents() {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, avatar_emoji, status, config, version, updated_at')
    .in('status', ['production', 'staging', 'monitoring']);
  if (error) throw error;
  if (!data) return [];

  const agentIds = data.map(a => a.id);
  const { data: connections } = await supabase
    .from('deploy_connections')
    .select('agent_id, channel, status, message_count, last_message_at, error_message')
    .in('agent_id', agentIds);

  const connMap = new Map<string, Array<Record<string, unknown>>>();
  for (const c of (connections || [])) {
    if (!connMap.has(c.agent_id)) connMap.set(c.agent_id, []);
    connMap.get(c.agent_id)!.push(c);
  }

  return data.map(a => {
    const config = a.config as Record<string, unknown> | null;
    const configChannels = ((config?.deploy_channels || []) as Array<{ channel: string; name: string; enabled: boolean }>);
    const liveConns = connMap.get(a.id) || [];
    return {
      id: a.id,
      name: a.name,
      emoji: a.avatar_emoji,
      status: a.status,
      version: `v${a.version}`,
      channels: configChannels.filter(c => c.enabled).map(c => {
        const live = liveConns.find((lc) => lc.channel === c.channel);
        return {
          name: c.name || c.channel,
          status: (live?.status as string) || 'inactive',
          messages: (live?.message_count as number) || 0,
          lastMsg: live?.last_message_at as string | undefined,
          error: live?.error_message as string | undefined,
        };
      }),
      environment: (config?.deploy_environment as string) || 'production',
      updated: a.updated_at,
    };
  });
}
