/**
 * Nexus Agents Studio — Workflow Templates Library
 * Pre-built workflow blueprints for common Promo Brindes scenarios.
 * Click a template → injected into the canvas via workflowStore.setWorkflow().
 */

interface TemplateNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface TemplateEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'support' | 'ops' | 'data' | 'compliance';
  emoji: string;
  estimated_minutes: number;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'lead-qualification',
    name: 'Qualificação de Lead',
    description: 'Recebe lead via webhook, enriquece com dados do CRM, classifica prioridade e atribui vendedor',
    category: 'sales',
    emoji: '🎯',
    estimated_minutes: 5,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 100 }, data: { type: 'trigger', label: 'Webhook Lead', description: 'Recebe POST com dados do lead' } },
      { id: 'n2', type: 'tool', position: { x: 280, y: 100 }, data: { type: 'tool', label: 'Buscar no CRM', description: 'Consulta histórico no Bitrix24' } },
      { id: 'n3', type: 'agent', position: { x: 510, y: 100 }, data: { type: 'agent', label: 'Classificar Prioridade', description: 'LLM classifica em hot/warm/cold' } },
      { id: 'n4', type: 'condition', position: { x: 740, y: 100 }, data: { type: 'condition', label: 'Hot lead?', description: 'Branch por prioridade' } },
      { id: 'n5', type: 'action', position: { x: 970, y: 30 }, data: { type: 'action', label: 'Atribuir Vendedor', description: 'Cria deal e atribui imediatamente' } },
      { id: 'n6', type: 'action', position: { x: 970, y: 170 }, data: { type: 'action', label: 'Enviar para Nurturing', description: 'Adiciona à cadência de email' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
    ],
  },
  {
    id: 'whatsapp-support',
    name: 'Atendimento WhatsApp',
    description: 'Recebe mensagem do cliente, identifica intenção, busca na KB e responde ou escalona',
    category: 'support',
    emoji: '💬',
    estimated_minutes: 3,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 100 }, data: { type: 'trigger', label: 'WhatsApp In', description: 'Mensagem recebida' } },
      { id: 'n2', type: 'agent', position: { x: 280, y: 100 }, data: { type: 'agent', label: 'Detectar Intenção', description: 'Classifica: orçamento/dúvida/reclamação' } },
      { id: 'n3', type: 'rag', position: { x: 510, y: 100 }, data: { type: 'rag', label: 'Buscar na KB', description: 'Consulta base de conhecimento' } },
      { id: 'n4', type: 'condition', position: { x: 740, y: 100 }, data: { type: 'condition', label: 'Confiança alta?', description: 'Score RAG > 0.75' } },
      { id: 'n5', type: 'action', position: { x: 970, y: 30 }, data: { type: 'action', label: 'Responder Cliente', description: 'Envia resposta automática' } },
      { id: 'n6', type: 'action', position: { x: 970, y: 170 }, data: { type: 'action', label: 'Escalar para Humano', description: 'Notifica equipe de atendimento' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
    ],
  },
  {
    id: 'order-processing',
    name: 'Processamento de Pedido',
    description: 'Pedido aprovado → checa estoque → cria nota fiscal → agenda entrega',
    category: 'ops',
    emoji: '📦',
    estimated_minutes: 8,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 100 }, data: { type: 'trigger', label: 'Pedido Aprovado', description: 'Webhook do CRM' } },
      { id: 'n2', type: 'tool', position: { x: 280, y: 100 }, data: { type: 'tool', label: 'Checar Estoque', description: 'Consulta supabase-fuchsia-kite' } },
      { id: 'n3', type: 'condition', position: { x: 510, y: 100 }, data: { type: 'condition', label: 'Tem estoque?', description: 'Se não, dispara compra' } },
      { id: 'n4', type: 'action', position: { x: 740, y: 30 }, data: { type: 'action', label: 'Emitir NF', description: 'Cria nota fiscal' } },
      { id: 'n5', type: 'action', position: { x: 740, y: 170 }, data: { type: 'action', label: 'Disparar Compra', description: 'Cria pedido ao fornecedor' } },
      { id: 'n6', type: 'action', position: { x: 970, y: 100 }, data: { type: 'action', label: 'Agendar Entrega', description: 'Integra Rodonaves' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
    ],
  },
  {
    id: 'monthly-report',
    name: 'Relatório Mensal',
    description: 'Cron mensal → coleta KPIs → gera relatório → envia para diretoria',
    category: 'data',
    emoji: '📊',
    estimated_minutes: 4,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 100 }, data: { type: 'trigger', label: 'Cron 1º do Mês', description: 'Schedule mensal' } },
      { id: 'n2', type: 'tool', position: { x: 280, y: 100 }, data: { type: 'tool', label: 'Coletar KPIs', description: 'Agrega dados dos 5 bancos' } },
      { id: 'n3', type: 'agent', position: { x: 510, y: 100 }, data: { type: 'agent', label: 'Gerar Insights', description: 'LLM analisa e narra' } },
      { id: 'n4', type: 'action', position: { x: 740, y: 100 }, data: { type: 'action', label: 'Gerar PDF', description: 'Cria documento formatado' } },
      { id: 'n5', type: 'action', position: { x: 970, y: 100 }, data: { type: 'action', label: 'Enviar Email', description: 'Para diretoria + arquivar' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },
  {
    id: 'lgpd-data-request',
    name: 'Solicitação LGPD',
    description: 'Cliente pede acesso aos dados → busca em todos os bancos → gera export → envia',
    category: 'compliance',
    emoji: '⚖️',
    estimated_minutes: 6,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 100 }, data: { type: 'trigger', label: 'Pedido LGPD', description: 'Email/formulário do titular' } },
      { id: 'n2', type: 'agent', position: { x: 280, y: 100 }, data: { type: 'agent', label: 'Validar Identidade', description: 'Confere CPF/RG' } },
      { id: 'n3', type: 'tool', position: { x: 510, y: 100 }, data: { type: 'tool', label: 'Identity Resolution', description: 'Busca em 5 bancos' } },
      { id: 'n4', type: 'action', position: { x: 740, y: 100 }, data: { type: 'action', label: 'Gerar Export JSON', description: 'Empacota todos os dados' } },
      { id: 'n5', type: 'action', position: { x: 970, y: 100 }, data: { type: 'action', label: 'Enviar ao Titular', description: 'Email com link seguro' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },
  {
    id: 'cotacao-rapida',
    name: 'Cotação Rápida',
    description: 'Cliente solicita cotação → busca produto → calcula com markup → envia',
    category: 'sales',
    emoji: '💰',
    estimated_minutes: 4,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 100 }, data: { type: 'trigger', label: 'Pedido Cotação', description: 'Form ou WhatsApp' } },
      { id: 'n2', type: 'tool', position: { x: 280, y: 100 }, data: { type: 'tool', label: 'Buscar Produto', description: 'No catálogo Promo' } },
      { id: 'n3', type: 'agent', position: { x: 510, y: 100 }, data: { type: 'agent', label: 'Calcular Preço', description: 'Aplica markup + descontos' } },
      { id: 'n4', type: 'action', position: { x: 740, y: 100 }, data: { type: 'action', label: 'Gerar Proposta', description: 'PDF com orçamento' } },
      { id: 'n5', type: 'action', position: { x: 970, y: 100 }, data: { type: 'action', label: 'Enviar ao Cliente', description: 'Email + cria oportunidade' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },
];

export const TEMPLATE_CATEGORIES = [
  { value: 'all', label: 'Todos', color: '#9ca3af' },
  { value: 'sales', label: 'Vendas', color: '#4D96FF' },
  { value: 'support', label: 'Atendimento', color: '#6BCB77' },
  { value: 'ops', label: 'Operações', color: '#E67E22' },
  { value: 'data', label: 'Dados', color: '#9B59B6' },
  { value: 'compliance', label: 'Compliance', color: '#FFD93D' },
] as const;

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  if (category === 'all') return WORKFLOW_TEMPLATES;
  return WORKFLOW_TEMPLATES.filter((t) => t.category === category);
}
