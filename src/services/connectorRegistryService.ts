/**
 * Nexus Agents Studio — Connector Registry Service
 *
 * Manages integration connectors (API adapters) with health checks,
 * versioning, capability discovery, and usage tracking.
 *
 * Inspired by: n8n 400+ Integrations, Activepieces 594 Pieces,
 * Zapier App Directory, Make Modules.
 *
 * Gap 8/10 — automation topic analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ConnectorCategory =
  | 'crm'
  | 'communication'
  | 'payment'
  | 'storage'
  | 'database'
  | 'ai_ml'
  | 'productivity'
  | 'marketing'
  | 'logistics'
  | 'analytics'
  | 'social'
  | 'custom';

export type ConnectorStatus = 'available' | 'connected' | 'error' | 'deprecated' | 'beta';
export type ConnectorAuthType = 'none' | 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';

export interface ConnectorOperation {
  id: string;
  name: string;
  description: string;
  type: 'trigger' | 'action' | 'search';
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  category: ConnectorCategory;
  auth_type: ConnectorAuthType;
  auth_config_schema: Record<string, unknown>;
  base_url: string;
  api_version: string;
  operations: ConnectorOperation[];
  rate_limit_per_minute: number;
  supports_webhooks: boolean;
  supports_polling: boolean;
  health_check_endpoint: string | null;
  documentation_url: string;
  status: ConnectorStatus;
  version: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ConnectorInstance {
  id: string;
  connector_id: string;
  name: string;
  credential_id: string | null;
  config: Record<string, unknown>;
  status: ConnectorStatus;
  last_health_check: string | null;
  health_check_result: Record<string, unknown> | null;
  usage_count: number;
  last_used_at: string | null;
  error_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectorHealth {
  connector_id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  response_time_ms: number | null;
  last_check: string;
  error: string | null;
  uptime_pct: number;
}

/* ------------------------------------------------------------------ */
/*  Registry CRUD                                                      */
/* ------------------------------------------------------------------ */

export async function listConnectors(
  filters?: {
    category?: ConnectorCategory;
    status?: ConnectorStatus;
    auth_type?: ConnectorAuthType;
    search?: string;
    has_webhooks?: boolean;
  },
): Promise<ConnectorDefinition[]> {
  let query = fromTable('connector_registry')
    .select('*')
    .order('name', { ascending: true });

  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.auth_type) query = query.eq('auth_type', filters.auth_type);
  if (filters?.has_webhooks) query = query.eq('supports_webhooks', true);
  if (filters?.search) query = query.ilike('name', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ConnectorDefinition[];
}

export async function getConnector(id: string): Promise<ConnectorDefinition | null> {
  const { data, error } = await fromTable('connector_registry')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ConnectorDefinition | null;
}

export async function getConnectorBySlug(slug: string): Promise<ConnectorDefinition | null> {
  const { data, error } = await fromTable('connector_registry')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as ConnectorDefinition | null;
}

/* ------------------------------------------------------------------ */
/*  Instance Management                                                */
/* ------------------------------------------------------------------ */

export async function connectService(
  connectorId: string,
  name: string,
  credentialId?: string,
  config?: Record<string, unknown>,
): Promise<ConnectorInstance> {
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await fromTable('connector_instances')
    .insert({
      connector_id: connectorId,
      name,
      credential_id: credentialId ?? null,
      config: config ?? {},
      status: 'connected',
      created_by: userData?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConnectorInstance;
}

export async function disconnectService(instanceId: string): Promise<void> {
  const { error } = await fromTable('connector_instances')
    .delete()
    .eq('id', instanceId);
  if (error) throw error;
}

export async function listInstances(
  connectorId?: string,
): Promise<ConnectorInstance[]> {
  let query = fromTable('connector_instances')
    .select('*')
    .order('created_at', { ascending: false });

  if (connectorId) {
    query = query.eq('connector_id', connectorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ConnectorInstance[];
}

export async function updateInstanceStatus(
  instanceId: string,
  status: ConnectorStatus,
  healthResult?: Record<string, unknown>,
): Promise<void> {
  const { error } = await fromTable('connector_instances')
    .update({
      status,
      last_health_check: new Date().toISOString(),
      health_check_result: healthResult ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId);
  if (error) throw error;
}

export async function recordUsage(instanceId: string): Promise<void> {
  const { data: existing } = await fromTable('connector_instances')
    .select('usage_count')
    .eq('id', instanceId)
    .single();

  const count = (existing?.usage_count ?? 0) + 1;
  await fromTable('connector_instances')
    .update({ usage_count: count, last_used_at: new Date().toISOString() })
    .eq('id', instanceId);
}

/* ------------------------------------------------------------------ */
/*  Health Checks                                                      */
/* ------------------------------------------------------------------ */

export async function checkAllHealth(): Promise<ConnectorHealth[]> {
  const instances = await listInstances();
  const results: ConnectorHealth[] = [];

  for (const instance of instances) {
    const connector = await getConnector(instance.connector_id);
    if (!connector) continue;

    const health: ConnectorHealth = {
      connector_id: connector.id,
      name: `${connector.name} (${instance.name})`,
      status: 'unknown',
      response_time_ms: null,
      last_check: new Date().toISOString(),
      error: null,
      uptime_pct: 100,
    };

    if (connector.health_check_endpoint) {
      const start = Date.now();
      try {
        const resp = await fetch(connector.base_url + connector.health_check_endpoint, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        health.response_time_ms = Date.now() - start;
        health.status = resp.ok ? 'healthy' : 'degraded';
      } catch (e) {
        health.response_time_ms = Date.now() - start;
        health.status = 'down';
        health.error = e instanceof Error ? e.message : String(e);
      }
    } else {
      health.status = instance.status === 'connected' ? 'healthy' : 'unknown';
    }

    await updateInstanceStatus(
      instance.id,
      health.status === 'healthy' ? 'connected' : 'error',
      { response_time_ms: health.response_time_ms, status: health.status },
    );

    results.push(health);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Built-in Connectors (Promo Brindes ecosystem)                      */
/* ------------------------------------------------------------------ */

export const BUILTIN_CONNECTORS: Omit<
  ConnectorDefinition,
  'id' | 'created_at' | 'updated_at'
>[] = [
  {
    name: 'Bitrix24',
    slug: 'bitrix24',
    description: 'CRM completo — Deals, Contacts, Companies, Tasks, Activities',
    icon: '🏢',
    color: '#00AEEF',
    category: 'crm',
    auth_type: 'oauth2',
    auth_config_schema: { client_id: 'string', client_secret: 'string', domain: 'string' },
    base_url: 'https://{domain}.bitrix24.com.br/rest',
    api_version: 'v1',
    operations: [
      { id: 'deal-list', name: 'Listar Deals', description: 'Lista deals do CRM', type: 'action', input_schema: { filter: 'object' }, output_schema: { result: 'array' } },
      { id: 'deal-add', name: 'Criar Deal', description: 'Cria um novo deal', type: 'action', input_schema: { fields: 'object' }, output_schema: { result: 'number' } },
      { id: 'deal-update', name: 'Atualizar Deal', description: 'Atualiza deal existente', type: 'action', input_schema: { id: 'number', fields: 'object' }, output_schema: { result: 'boolean' } },
      { id: 'contact-add', name: 'Criar Contato', description: 'Cria contato no CRM', type: 'action', input_schema: { fields: 'object' }, output_schema: { result: 'number' } },
      { id: 'task-add', name: 'Criar Tarefa', description: 'Cria tarefa no Bitrix24', type: 'action', input_schema: { fields: 'object' }, output_schema: { result: 'object' } },
    ],
    rate_limit_per_minute: 60,
    supports_webhooks: true,
    supports_polling: true,
    health_check_endpoint: '/server.time',
    documentation_url: 'https://training.bitrix24.com/rest_help/',
    status: 'available',
    version: '1.0.0',
    tags: ['crm', 'vendas', 'tarefas'],
  },
  {
    name: 'WhatsApp (Evolution API)',
    slug: 'whatsapp',
    description: 'Mensagens, mídia, grupos, status — via Evolution API',
    icon: '💬',
    color: '#25D366',
    category: 'communication',
    auth_type: 'api_key',
    auth_config_schema: { api_key: 'string', instance_name: 'string', server_url: 'string' },
    base_url: '{server_url}',
    api_version: 'v2',
    operations: [
      { id: 'send-text', name: 'Enviar Texto', description: 'Envia mensagem de texto', type: 'action', input_schema: { number: 'string', text: 'string' }, output_schema: { key: 'object' } },
      { id: 'send-media', name: 'Enviar Mídia', description: 'Envia imagem/doc/áudio', type: 'action', input_schema: { number: 'string', mediaUrl: 'string' }, output_schema: { key: 'object' } },
      { id: 'message-received', name: 'Mensagem Recebida', description: 'Trigger ao receber mensagem', type: 'trigger', input_schema: {}, output_schema: { from: 'string', body: 'string' } },
    ],
    rate_limit_per_minute: 30,
    supports_webhooks: true,
    supports_polling: false,
    health_check_endpoint: '/instance/connectionState',
    documentation_url: 'https://doc.evolution-api.com/',
    status: 'available',
    version: '2.0.0',
    tags: ['whatsapp', 'mensagem', 'atendimento'],
  },
  {
    name: 'Supabase',
    slug: 'supabase',
    description: 'Database, Auth, Storage, Edge Functions, Realtime',
    icon: '⚡',
    color: '#3ECF8E',
    category: 'database',
    auth_type: 'api_key',
    auth_config_schema: { project_url: 'string', anon_key: 'string', service_role_key: 'string' },
    base_url: '{project_url}',
    api_version: 'v1',
    operations: [
      { id: 'query', name: 'Query Table', description: 'Consulta dados de uma tabela', type: 'action', input_schema: { table: 'string', select: 'string', filter: 'object' }, output_schema: { data: 'array' } },
      { id: 'insert', name: 'Insert Row', description: 'Insere registro na tabela', type: 'action', input_schema: { table: 'string', data: 'object' }, output_schema: { data: 'object' } },
      { id: 'update', name: 'Update Row', description: 'Atualiza registro', type: 'action', input_schema: { table: 'string', id: 'string', data: 'object' }, output_schema: { data: 'object' } },
      { id: 'rpc', name: 'Call Function', description: 'Chama uma database function', type: 'action', input_schema: { fn_name: 'string', args: 'object' }, output_schema: { data: 'unknown' } },
    ],
    rate_limit_per_minute: 120,
    supports_webhooks: true,
    supports_polling: false,
    health_check_endpoint: '/rest/v1/',
    documentation_url: 'https://supabase.com/docs',
    status: 'connected',
    version: '1.0.0',
    tags: ['database', 'storage', 'auth'],
  },
  {
    name: 'OpenRouter',
    slug: 'openrouter',
    description: 'Gateway universal para LLMs — Claude, GPT, Gemini, DeepSeek, Llama',
    icon: '🤖',
    color: '#6366F1',
    category: 'ai_ml',
    auth_type: 'bearer',
    auth_config_schema: { api_key: 'string' },
    base_url: 'https://openrouter.ai/api',
    api_version: 'v1',
    operations: [
      { id: 'chat', name: 'Chat Completion', description: 'Gera resposta de chat', type: 'action', input_schema: { model: 'string', messages: 'array' }, output_schema: { choices: 'array' } },
      { id: 'models', name: 'List Models', description: 'Lista modelos disponíveis', type: 'search', input_schema: {}, output_schema: { data: 'array' } },
    ],
    rate_limit_per_minute: 60,
    supports_webhooks: false,
    supports_polling: false,
    health_check_endpoint: '/v1/models',
    documentation_url: 'https://openrouter.ai/docs',
    status: 'available',
    version: '1.0.0',
    tags: ['llm', 'ai', 'chat'],
  },
  {
    name: 'Email (SMTP)',
    slug: 'email',
    description: 'Envio de emails via SMTP — transacional, marketing, alertas',
    icon: '📧',
    color: '#EA4335',
    category: 'communication',
    auth_type: 'basic',
    auth_config_schema: { host: 'string', port: 'number', username: 'string', password: 'string' },
    base_url: 'smtp://{host}:{port}',
    api_version: 'smtp',
    operations: [
      { id: 'send', name: 'Enviar Email', description: 'Envia email via SMTP', type: 'action', input_schema: { to: 'string', subject: 'string', body: 'string' }, output_schema: { messageId: 'string' } },
    ],
    rate_limit_per_minute: 30,
    supports_webhooks: false,
    supports_polling: false,
    health_check_endpoint: null,
    documentation_url: '',
    status: 'available',
    version: '1.0.0',
    tags: ['email', 'smtp', 'notificacao'],
  },
];

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export async function getConnectorStats(): Promise<{
  total_connectors: number;
  connected: number;
  by_category: Record<ConnectorCategory, number>;
  total_usage: number;
  most_used: Array<{ name: string; usage_count: number }>;
}> {
  const connectors = await listConnectors();
  const instances = await listInstances();

  const byCategory = {} as Record<ConnectorCategory, number>;
  for (const c of connectors) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  }

  const mostUsed = [...instances]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 5)
    .map((i) => ({ name: i.name, usage_count: i.usage_count }));

  return {
    total_connectors: connectors.length,
    connected: instances.filter((i) => i.status === 'connected').length,
    by_category: byCategory,
    total_usage: instances.reduce((s, i) => s + i.usage_count, 0),
    most_used: mostUsed,
  };
}
