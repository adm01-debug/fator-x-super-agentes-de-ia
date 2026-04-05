/**
 * Nexus Agents Studio — Automation Template Library
 *
 * Pre-built automation recipes covering common business scenarios.
 * Templates include trigger, steps, integrations, and can be
 * installed as ready-to-run workflows.
 *
 * Inspired by: n8n Template Library, Activepieces Templates,
 * Zapier Zap Templates, Make Scenarios.
 *
 * Gap 6/10 — automation topic analysis
 */

import { fromTable } from '@/lib/supabaseExtended';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {
  automationTemplates: () => fromTable('automation_templates') as any,
  installedTemplates: () => fromTable('installed_templates') as any,
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TemplateCategory =
  | 'vendas'
  | 'compras'
  | 'logistica'
  | 'financeiro'
  | 'arte'
  | 'atendimento'
  | 'rh'
  | 'marketing'
  | 'integracao'
  | 'monitoramento';

export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface AutomationStep {
  order: number;
  name: string;
  type: 'trigger' | 'action' | 'condition' | 'loop' | 'delay' | 'notification';
  service: string;
  operation: string;
  config: Record<string, unknown>;
  on_error: 'stop' | 'continue' | 'retry';
}

export interface AutomationTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  long_description: string;
  category: TemplateCategory;
  difficulty: TemplateDifficulty;
  tags: string[];
  icon: string;
  color: string;
  trigger_type: string;
  steps: AutomationStep[];
  required_integrations: string[];
  required_credentials: string[];
  estimated_setup_minutes: number;
  installs: number;
  rating: number;
  is_featured: boolean;
  is_active: boolean;
  author: string;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface InstalledTemplate {
  id: string;
  template_id: string;
  workflow_id: string | null;
  config_overrides: Record<string, unknown>;
  status: 'installed' | 'configured' | 'running' | 'paused' | 'error';
  installed_at: string;
  installed_by: string | null;
}

/* ------------------------------------------------------------------ */
/*  CRUD Operations                                                    */
/* ------------------------------------------------------------------ */

export async function listTemplates(
  filters?: {
    category?: TemplateCategory;
    difficulty?: TemplateDifficulty;
    tag?: string;
    featured?: boolean;
    search?: string;
  },
): Promise<AutomationTemplate[]> {
  let query = supabase.from('automation_templates')
    .select('*')
    .eq('is_active', true)
    .order('installs', { ascending: false });

  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.difficulty) query = query.eq('difficulty', filters.difficulty);
  if (filters?.tag) query = query.contains('tags', [filters.tag]);
  if (filters?.featured) query = query.eq('is_featured', true);
  if (filters?.search) query = query.ilike('name', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AutomationTemplate[];
}

export async function getTemplate(id: string): Promise<AutomationTemplate | null> {
  const { data, error } = await supabase.from('automation_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as AutomationTemplate | null;
}

export async function getTemplateBySlug(slug: string): Promise<AutomationTemplate | null> {
  const { data, error } = await supabase.from('automation_templates')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as AutomationTemplate | null;
}

export async function installTemplate(
  templateId: string,
  configOverrides?: Record<string, unknown>,
): Promise<InstalledTemplate> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const { data, error } = await supabase.from('installed_templates')
    .insert({
      template_id: templateId,
      config_overrides: configOverrides ?? {},
      status: 'installed',
      installed_by: userId,
    })
    .select()
    .single();
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('increment_template_installs', { template_uuid: templateId });

  return data as InstalledTemplate;
}

export async function listInstalledTemplates(): Promise<InstalledTemplate[]> {
  const { data, error } = await supabase.from('installed_templates')
    .select('*')
    .order('installed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstalledTemplate[];
}

export async function uninstallTemplate(installId: string): Promise<void> {
  const { error } = await supabase.from('installed_templates').delete().eq('id', installId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Built-in Templates (Promo Brindes)                                 */
/* ------------------------------------------------------------------ */

export const BUILTIN_TEMPLATES: Omit<
  AutomationTemplate,
  'id' | 'installs' | 'rating' | 'created_at' | 'updated_at'
>[] = [
  {
    name: 'Lead → Orçamento Automático',
    slug: 'lead-to-quote',
    description: 'Quando um lead entra pelo WhatsApp, cria oportunidade no Bitrix24 e envia orçamento automático.',
    long_description: 'Automação completa do funil de vendas: captura o lead via WhatsApp, identifica o produto desejado, busca preço no catálogo, gera orçamento em PDF e envia para o cliente. Cria deal no Bitrix24 com todos os dados.',
    category: 'vendas',
    difficulty: 'intermediate',
    tags: ['whatsapp', 'bitrix24', 'orcamento', 'lead'],
    icon: '💰',
    color: '#4D96FF',
    trigger_type: 'webhook:whatsapp_message',
    steps: [
      { order: 1, name: 'Receber mensagem WhatsApp', type: 'trigger', service: 'whatsapp', operation: 'message.received', config: {}, on_error: 'stop' },
      { order: 2, name: 'Identificar intenção com IA', type: 'action', service: 'llm', operation: 'classify', config: { model: 'claude-sonnet', prompt: 'Classifique a mensagem como: orcamento, duvida, reclamacao, outro' }, on_error: 'continue' },
      { order: 3, name: 'Verificar se é orçamento', type: 'condition', service: 'logic', operation: 'equals', config: { field: 'intent', value: 'orcamento' }, on_error: 'stop' },
      { order: 4, name: 'Buscar produto no catálogo', type: 'action', service: 'supabase', operation: 'query', config: { table: 'products', match: 'name' }, on_error: 'retry' },
      { order: 5, name: 'Criar deal no Bitrix24', type: 'action', service: 'bitrix24', operation: 'deal.add', config: { stage: 'NEW' }, on_error: 'retry' },
      { order: 6, name: 'Enviar orçamento via WhatsApp', type: 'notification', service: 'whatsapp', operation: 'send_message', config: { template: 'orcamento_v1' }, on_error: 'retry' },
    ],
    required_integrations: ['whatsapp', 'bitrix24', 'llm'],
    required_credentials: ['whatsapp_evolution', 'bitrix24', 'anthropic'],
    estimated_setup_minutes: 15,
    is_featured: true,
    is_active: true,
    author: 'Nexus AI',
    version: '1.0.0',
  },
  {
    name: 'Pedido Aprovado → Compras',
    slug: 'deal-approved-to-purchase',
    description: 'Quando o cliente aprova o orçamento, cria automaticamente o pedido de compra para o setor de Compras.',
    long_description: 'Monitora mudanças de stage no Bitrix24. Quando um deal muda para "Aprovado pelo Cliente", extrai os itens, verifica estoque, seleciona fornecedores e cria o pedido de compra com notificação ao comprador.',
    category: 'compras',
    difficulty: 'intermediate',
    tags: ['bitrix24', 'compras', 'pedido', 'fornecedor'],
    icon: '📦',
    color: '#9B59B6',
    trigger_type: 'webhook:bitrix24_deal_update',
    steps: [
      { order: 1, name: 'Deal atualizado no Bitrix24', type: 'trigger', service: 'bitrix24', operation: 'deal.updated', config: { stage: 'WON' }, on_error: 'stop' },
      { order: 2, name: 'Buscar itens do deal', type: 'action', service: 'bitrix24', operation: 'deal.productrows.get', config: {}, on_error: 'retry' },
      { order: 3, name: 'Verificar estoque', type: 'action', service: 'supabase', operation: 'query', config: { table: 'inventory' }, on_error: 'continue' },
      { order: 4, name: 'Selecionar fornecedor', type: 'action', service: 'supabase', operation: 'query', config: { table: 'suppliers', order_by: 'price' }, on_error: 'retry' },
      { order: 5, name: 'Criar pedido de compra', type: 'action', service: 'supabase', operation: 'insert', config: { table: 'purchase_orders' }, on_error: 'stop' },
      { order: 6, name: 'Notificar comprador', type: 'notification', service: 'notification', operation: 'send', config: { channel: 'whatsapp', template: 'purchase_order' }, on_error: 'continue' },
    ],
    required_integrations: ['bitrix24', 'supabase'],
    required_credentials: ['bitrix24', 'supabase_project'],
    estimated_setup_minutes: 10,
    is_featured: true,
    is_active: true,
    author: 'Nexus AI',
    version: '1.0.0',
  },
  {
    name: 'Rastreamento → Notificação Cliente',
    slug: 'tracking-to-notification',
    description: 'Monitora atualizações de rastreamento e notifica o cliente via WhatsApp a cada mudança de status.',
    long_description: 'Recebe webhooks de transportadoras, cruza com pedidos no banco, e envia mensagem personalizada ao cliente informando a posição da entrega. Alerta o time de logística em caso de atraso.',
    category: 'logistica',
    difficulty: 'beginner',
    tags: ['logistica', 'rastreamento', 'whatsapp', 'cliente'],
    icon: '🚚',
    color: '#6BCB77',
    trigger_type: 'webhook:delivery_tracking',
    steps: [
      { order: 1, name: 'Webhook de rastreamento', type: 'trigger', service: 'webhook', operation: 'receive', config: {}, on_error: 'stop' },
      { order: 2, name: 'Buscar pedido e cliente', type: 'action', service: 'supabase', operation: 'query', config: { table: 'orders', join: 'clients' }, on_error: 'retry' },
      { order: 3, name: 'Verificar atraso', type: 'condition', service: 'logic', operation: 'date_compare', config: { field: 'estimated_delivery', operator: 'before', value: 'now' }, on_error: 'continue' },
      { order: 4, name: 'Notificar cliente', type: 'notification', service: 'whatsapp', operation: 'send_message', config: { template: 'delivery_update' }, on_error: 'retry' },
    ],
    required_integrations: ['whatsapp', 'supabase'],
    required_credentials: ['whatsapp_evolution', 'supabase_project'],
    estimated_setup_minutes: 5,
    is_featured: true,
    is_active: true,
    author: 'Nexus AI',
    version: '1.0.0',
  },
  {
    name: 'Briefing Arte → Aprovação',
    slug: 'art-briefing-to-approval',
    description: 'Recebe briefing do comercial, cria tarefa para o time de Arte, e gerencia o ciclo de aprovação com o cliente.',
    long_description: 'Fluxo completo: recebe briefing via formulário, cria tarefa no Bitrix24 para o designer, notifica quando arte está pronta, envia link de preview ao cliente, gerencia aprovação/rejeição.',
    category: 'arte',
    difficulty: 'intermediate',
    tags: ['arte', 'briefing', 'aprovacao', 'bitrix24'],
    icon: '🎨',
    color: '#E67E22',
    trigger_type: 'webhook:form_submission',
    steps: [
      { order: 1, name: 'Formulário de briefing', type: 'trigger', service: 'webhook', operation: 'form_received', config: {}, on_error: 'stop' },
      { order: 2, name: 'Criar tarefa no Bitrix24', type: 'action', service: 'bitrix24', operation: 'task.add', config: { responsible: 'designer', priority: 'high' }, on_error: 'retry' },
      { order: 3, name: 'Notificar designer', type: 'notification', service: 'notification', operation: 'send', config: { channel: 'in_app' }, on_error: 'continue' },
      { order: 4, name: 'Aguardar conclusão', type: 'delay', service: 'scheduler', operation: 'wait_for_event', config: { event: 'task.completed', timeout: '48h' }, on_error: 'continue' },
      { order: 5, name: 'Enviar para aprovação do cliente', type: 'notification', service: 'whatsapp', operation: 'send_message', config: { template: 'art_approval' }, on_error: 'retry' },
    ],
    required_integrations: ['bitrix24', 'whatsapp'],
    required_credentials: ['bitrix24', 'whatsapp_evolution'],
    estimated_setup_minutes: 12,
    is_featured: false,
    is_active: true,
    author: 'Nexus AI',
    version: '1.0.0',
  },
  {
    name: 'Fechamento Financeiro Diário',
    slug: 'daily-financial-close',
    description: 'Todo dia às 18h, consolida contas a pagar/receber, calcula fluxo de caixa e envia relatório.',
    long_description: 'Automação financeira: roda query no banco de dados para consolidar movimentações do dia, calcula saldo, identifica faturas vencidas, gera relatório resumido e envia para o diretor financeiro.',
    category: 'financeiro',
    difficulty: 'advanced',
    tags: ['financeiro', 'relatorio', 'diario', 'fluxo-caixa'],
    icon: '💰',
    color: '#FFD93D',
    trigger_type: 'cron:0 18 * * 1-5',
    steps: [
      { order: 1, name: 'Trigger diário 18h (Seg-Sex)', type: 'trigger', service: 'scheduler', operation: 'cron', config: { expression: '0 18 * * 1-5' }, on_error: 'stop' },
      { order: 2, name: 'Consultar contas a pagar', type: 'action', service: 'supabase', operation: 'query', config: { table: 'accounts_payable', filter: 'today' }, on_error: 'retry' },
      { order: 3, name: 'Consultar contas a receber', type: 'action', service: 'supabase', operation: 'query', config: { table: 'accounts_receivable', filter: 'today' }, on_error: 'retry' },
      { order: 4, name: 'Calcular fluxo de caixa', type: 'action', service: 'logic', operation: 'calculate', config: { formula: 'receivable - payable' }, on_error: 'stop' },
      { order: 5, name: 'Gerar relatório com IA', type: 'action', service: 'llm', operation: 'generate', config: { model: 'claude-sonnet', template: 'financial_report' }, on_error: 'retry' },
      { order: 6, name: 'Enviar relatório', type: 'notification', service: 'notification', operation: 'send', config: { channels: ['email', 'slack'] }, on_error: 'retry' },
    ],
    required_integrations: ['supabase', 'llm', 'email'],
    required_credentials: ['supabase_project', 'anthropic', 'smtp_email'],
    estimated_setup_minutes: 20,
    is_featured: true,
    is_active: true,
    author: 'Nexus AI',
    version: '1.0.0',
  },
  {
    name: 'Monitoramento de Saúde dos Agentes',
    slug: 'agent-health-monitor',
    description: 'Monitora a cada 5 minutos os agentes ativos, verifica erros, latência, e alerta se algo estiver fora do normal.',
    long_description: 'Health check automatizado: verifica status de cada agente ativo, mede tempo de resposta, detecta erros consecutivos, e envia alerta quando um agente precisa de atenção.',
    category: 'monitoramento',
    difficulty: 'beginner',
    tags: ['monitoramento', 'health-check', 'agentes', 'alerta'],
    icon: '🏥',
    color: '#FF6B6B',
    trigger_type: 'cron:*/5 * * * *',
    steps: [
      { order: 1, name: 'Trigger a cada 5 min', type: 'trigger', service: 'scheduler', operation: 'cron', config: { expression: '*/5 * * * *' }, on_error: 'stop' },
      { order: 2, name: 'Listar agentes ativos', type: 'action', service: 'supabase', operation: 'query', config: { table: 'agents', filter: 'status=active' }, on_error: 'retry' },
      { order: 3, name: 'Verificar saúde de cada um', type: 'loop', service: 'logic', operation: 'foreach', config: { check: 'health_endpoint' }, on_error: 'continue' },
      { order: 4, name: 'Detectar anomalias', type: 'condition', service: 'logic', operation: 'threshold', config: { error_rate: 0.1, latency_ms: 5000 }, on_error: 'continue' },
      { order: 5, name: 'Alertar equipe', type: 'notification', service: 'notification', operation: 'send', config: { channel: 'slack', priority: 'urgent' }, on_error: 'retry' },
    ],
    required_integrations: ['supabase', 'slack'],
    required_credentials: ['supabase_project'],
    estimated_setup_minutes: 5,
    is_featured: false,
    is_active: true,
    author: 'Nexus AI',
    version: '1.0.0',
  },
];

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export async function getTemplateStats(): Promise<{
  total_templates: number;
  total_installs: number;
  by_category: Record<TemplateCategory, number>;
  most_installed: Array<{ name: string; installs: number }>;
  avg_setup_minutes: number;
}> {
  const templates = await listTemplates();
  const byCategory = {} as Record<TemplateCategory, number>;
  let totalInstalls = 0;
  let totalSetup = 0;

  for (const t of templates) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    totalInstalls += t.installs;
    totalSetup += t.estimated_setup_minutes;
  }

  const mostInstalled = [...templates]
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 5)
    .map((t) => ({ name: t.name, installs: t.installs }));

  return {
    total_templates: templates.length,
    total_installs: totalInstalls,
    by_category: byCategory,
    most_installed: mostInstalled,
    avg_setup_minutes: templates.length > 0 ? totalSetup / templates.length : 0,
  };
}
