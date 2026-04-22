/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Tool Catalog
 * ═══════════════════════════════════════════════════════════════
 * Catálogo central que liga cada tool_id usado pelos templates de agentes
 * a uma Edge Function real do Supabase (ou a um MCP externo), junto com
 * schema de entrada/saída, categoria, nível de permissão e política de uso.
 *
 * Uso:
 *   import { resolveTool, toAgentTool } from '@/data/toolCatalog';
 *   const def = resolveTool('search_knowledge');        // ToolDefinition | null
 *   const cfg = toAgentTool('search_knowledge');        // AgentTool pronto para AgentConfig.tools[]
 */
import { z } from 'zod';
import type { AgentTool } from '@/types/agentTypes';

export type ToolCategory = 'data' | 'action' | 'compute' | 'integration';
export type ToolPermissionLevel = 'read_only' | 'read_write' | 'admin';
export type ToolOutputValidation = 'none' | 'schema' | 'llm_review';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  permission_level: ToolPermissionLevel;
  /** Edge function do Supabase que implementa a tool (quando aplicável). */
  edge_function?: string;
  /** Nome do MCP server (registrado em agent.json / public.mcp_servers) quando a tool é via MCP. */
  mcp_server?: string;
  /** Nome exato do método MCP (ex.: 'b24_deal_create'). Só quando mcp_server está setado. */
  mcp_method?: string;
  input_schema: z.ZodTypeAny;
  output_schema: z.ZodTypeAny;
  requires_approval: boolean;
  max_calls_per_session: number;
  max_calls_per_day: number;
  /** Custo aproximado em USD por chamada (para orçamento do agente). */
  cost_per_call_usd: number;
  /** Restrição de role (RBAC), se aplicável. */
  required_role?: string;
  /** Validação do output: 'schema' aplica o output_schema, 'llm_review' roda um juiz. */
  output_validation: ToolOutputValidation;
}

// ─── helpers de schema comuns ───────────────────────────────────
const OkResponse = z.object({ ok: z.boolean(), message: z.string().optional() });

// ─── Catálogo ───────────────────────────────────────────────────
export const TOOL_CATALOG: Record<string, ToolDefinition> = {
  // ═══ Dados ═════════════════════════════════════════════════════
  search_knowledge: {
    id: 'search_knowledge',
    name: 'Buscar Conhecimento (RAG)',
    description:
      'Busca semântica na base de conhecimento do workspace (manuais, políticas, catálogo).',
    category: 'data',
    permission_level: 'read_only',
    edge_function: 'semantic-search',
    input_schema: z.object({
      query: z.string().min(1).max(2000),
      top_k: z.number().int().min(1).max(20).default(5),
      knowledge_base_id: z.string().uuid().optional(),
    }),
    output_schema: z.object({
      results: z.array(
        z.object({
          content: z.string(),
          source: z.string(),
          score: z.number(),
        }),
      ),
    }),
    requires_approval: false,
    max_calls_per_session: 30,
    max_calls_per_day: 500,
    cost_per_call_usd: 0.001,
    output_validation: 'schema',
  },

  query_datahub: {
    id: 'query_datahub',
    name: 'Consultar DataHub',
    description: 'Executa consulta estruturada no DataHub interno (ERP, financeiro, produção).',
    category: 'data',
    permission_level: 'read_only',
    edge_function: 'datahub-query',
    input_schema: z.object({
      dataset: z.string().min(1),
      filters: z.record(z.unknown()).optional(),
      limit: z.number().int().min(1).max(1000).default(100),
    }),
    output_schema: z.object({
      rows: z.array(z.record(z.unknown())),
      total: z.number(),
    }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 300,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  search_crm: {
    id: 'search_crm',
    name: 'Buscar no CRM (Bitrix24)',
    description: 'Procura contatos, empresas e deals no Bitrix24.',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'bitrix24',
    mcp_method: 'b24_contact_search',
    input_schema: z.object({
      query: z.string().min(1),
      entity: z.enum(['contact', 'company', 'deal', 'lead']).default('contact'),
    }),
    output_schema: z.object({
      items: z.array(z.record(z.unknown())),
    }),
    requires_approval: false,
    max_calls_per_session: 40,
    max_calls_per_day: 800,
    cost_per_call_usd: 0.0,
    output_validation: 'none',
  },

  search_products: {
    id: 'search_products',
    name: 'Buscar Produtos',
    description:
      'Consulta o catálogo de produtos da Promo Brindes (SKU, categoria, estoque, preço).',
    category: 'data',
    permission_level: 'read_only',
    edge_function: 'datahub-query',
    input_schema: z.object({
      query: z.string().min(1),
      category: z.string().optional(),
      min_stock: z.number().int().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
    output_schema: z.object({
      products: z.array(
        z.object({
          sku: z.string(),
          name: z.string(),
          category: z.string(),
          base_price: z.number(),
          stock: z.number(),
        }),
      ),
    }),
    requires_approval: false,
    max_calls_per_session: 30,
    max_calls_per_day: 600,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  enrich_company: {
    id: 'enrich_company',
    name: 'Enriquecer Empresa',
    description:
      'Enriquece dados de uma empresa (CNPJ, setor, porte, contatos) combinando Bitrix24 + web.',
    category: 'data',
    permission_level: 'read_only',
    edge_function: 'bitrix24-api',
    input_schema: z
      .object({
        cnpj: z.string().optional(),
        company_name: z.string().optional(),
        website: z.string().url().optional(),
      })
      .refine((v) => v.cnpj || v.company_name || v.website, {
        message: 'Informe cnpj, company_name ou website',
      }),
    output_schema: z.object({
      company: z.record(z.unknown()),
      contacts: z.array(z.record(z.unknown())),
      sources: z.array(z.string()),
    }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.01,
    output_validation: 'schema',
  },

  classify_document: {
    id: 'classify_document',
    name: 'Classificar Documento',
    description: 'OCR + classificação de documento (NF, orçamento, contrato, arte final).',
    category: 'data',
    permission_level: 'read_only',
    edge_function: 'doc-ocr',
    input_schema: z.object({
      file_url: z.string().url(),
      expected_type: z.string().optional(),
    }),
    output_schema: z.object({
      doc_type: z.string(),
      confidence: z.number(),
      fields: z.record(z.unknown()),
      text: z.string(),
    }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.02,
    output_validation: 'schema',
  },

  web_search: {
    id: 'web_search',
    name: 'Pesquisa Web',
    description: 'Busca na web via MCP (headless browser / DDG).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'chrome',
    mcp_method: 'ddg_web_search',
    input_schema: z.object({
      query: z.string().min(1).max(500),
      max_results: z.number().int().min(1).max(20).default(5),
    }),
    output_schema: z.object({
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          snippet: z.string(),
        }),
      ),
    }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.002,
    output_validation: 'schema',
  },

  // ═══ Ação ══════════════════════════════════════════════════════
  create_ticket: {
    id: 'create_ticket',
    name: 'Criar Ticket (Bitrix24)',
    description: 'Abre um deal ou task no Bitrix24 para acompanhamento humano.',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'bitrix24',
    mcp_method: 'b24_deal_create',
    input_schema: z.object({
      title: z.string().min(3),
      description: z.string(),
      contact_id: z.string().optional(),
      company_id: z.string().optional(),
      responsible_id: z.string().optional(),
    }),
    output_schema: z.object({
      deal_id: z.string(),
      url: z.string().url().optional(),
    }),
    requires_approval: true,
    max_calls_per_session: 10,
    max_calls_per_day: 100,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  create_task: {
    id: 'create_task',
    name: 'Criar Tarefa (Bitrix24)',
    description: 'Cria uma task no Bitrix24 atribuída a um responsável.',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'bitrix24',
    mcp_method: 'b24_task_create',
    input_schema: z.object({
      title: z.string().min(3),
      description: z.string().optional(),
      responsible_id: z.string(),
      deadline: z.string().optional(),
    }),
    output_schema: z.object({ task_id: z.string() }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  send_email: {
    id: 'send_email',
    name: 'Enviar E-mail',
    description: 'Envia e-mail transacional (usa templates quando possível).',
    category: 'action',
    permission_level: 'read_write',
    edge_function: 'notification-sender',
    input_schema: z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1),
      template_id: z.string().optional(),
      variables: z.record(z.string()).optional(),
    }),
    output_schema: OkResponse.extend({ message_id: z.string().optional() }),
    requires_approval: true,
    max_calls_per_session: 10,
    max_calls_per_day: 100,
    cost_per_call_usd: 0.001,
    output_validation: 'schema',
  },

  send_notification: {
    id: 'send_notification',
    name: 'Notificar Usuário',
    description: 'Envia notificação in-app ou push para um usuário ou canal.',
    category: 'action',
    permission_level: 'read_write',
    edge_function: 'notification-sender',
    input_schema: z.object({
      user_id: z.string().optional(),
      channel: z.enum(['in_app', 'push', 'slack', 'whatsapp']).default('in_app'),
      title: z.string().min(1),
      body: z.string().min(1),
    }),
    output_schema: OkResponse,
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 300,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  notify_seller: {
    id: 'notify_seller',
    name: 'Notificar Vendedor',
    description: 'Alerta o vendedor responsável sobre lead quente / nova oportunidade.',
    category: 'action',
    permission_level: 'read_write',
    edge_function: 'notification-sender',
    input_schema: z.object({
      seller_id: z.string().optional(),
      lead_id: z.string(),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      reason: z.string(),
    }),
    output_schema: OkResponse,
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  generate_pdf: {
    id: 'generate_pdf',
    name: 'Gerar PDF',
    description: 'Monta um PDF (proposta, cotação, mockup) a partir de template + dados.',
    category: 'action',
    permission_level: 'read_write',
    edge_function: 'product-mockup',
    input_schema: z.object({
      template: z.string().min(1),
      data: z.record(z.unknown()),
      filename: z.string().optional(),
    }),
    output_schema: z.object({ pdf_url: z.string().url(), pages: z.number().int() }),
    requires_approval: false,
    max_calls_per_session: 10,
    max_calls_per_day: 100,
    cost_per_call_usd: 0.01,
    output_validation: 'schema',
  },

  generate_image: {
    id: 'generate_image',
    name: 'Gerar Imagem / Mockup',
    description: 'Gera mockup de produto ou imagem promocional.',
    category: 'action',
    permission_level: 'read_write',
    edge_function: 'product-mockup',
    input_schema: z.object({
      prompt: z.string().min(1),
      product_sku: z.string().optional(),
      style: z.string().optional(),
    }),
    output_schema: z.object({ image_url: z.string().url() }),
    requires_approval: false,
    max_calls_per_session: 10,
    max_calls_per_day: 50,
    cost_per_call_usd: 0.04,
    output_validation: 'schema',
  },

  generate_chart: {
    id: 'generate_chart',
    name: 'Gerar Gráfico',
    description: 'Produz gráfico analítico (linha/barra/pizza) a partir de rows estruturados.',
    category: 'compute',
    permission_level: 'read_only',
    edge_function: 'datahub-query',
    input_schema: z.object({
      rows: z.array(z.record(z.unknown())),
      chart_type: z.enum(['line', 'bar', 'pie', 'scatter']).default('bar'),
      x: z.string(),
      y: z.string(),
      title: z.string().optional(),
    }),
    output_schema: z.object({ chart_url: z.string().url() }),
    requires_approval: false,
    max_calls_per_session: 10,
    max_calls_per_day: 100,
    cost_per_call_usd: 0.002,
    output_validation: 'schema',
  },

  // ═══ Compute / IA ══════════════════════════════════════════════
  consult_oracle: {
    id: 'consult_oracle',
    name: 'Consultar Oráculo (Multi-LLM)',
    description: 'Chama painel de modelos (Claude + Gemini + GPT) para decisões críticas.',
    category: 'compute',
    permission_level: 'read_only',
    edge_function: 'oracle-council',
    input_schema: z.object({
      question: z.string().min(10),
      context: z.string().optional(),
      models: z.array(z.string()).optional(),
    }),
    output_schema: z.object({
      consensus: z.string(),
      opinions: z.array(z.object({ model: z.string(), opinion: z.string() })),
      confidence: z.number(),
    }),
    requires_approval: false,
    max_calls_per_session: 5,
    max_calls_per_day: 30,
    cost_per_call_usd: 0.05,
    output_validation: 'schema',
  },

  calculate_price: {
    id: 'calculate_price',
    name: 'Calcular Preço',
    description:
      'Calcula preço de venda com base em SKU, quantidade, técnica de gravação e descontos por volume.',
    category: 'compute',
    permission_level: 'read_only',
    edge_function: 'datahub-query',
    input_schema: z.object({
      sku: z.string().min(1),
      quantity: z.number().int().min(1),
      engraving_technique: z.string().optional(),
      discount_percent: z.number().min(0).max(100).optional(),
    }),
    output_schema: z.object({
      unit_price: z.number(),
      total: z.number(),
      breakdown: z.record(z.number()),
    }),
    requires_approval: false,
    max_calls_per_session: 40,
    max_calls_per_day: 500,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  classify_sentiment: {
    id: 'classify_sentiment',
    name: 'Classificar Sentimento',
    description: 'Analisa sentimento (positivo/negativo/neutro) de texto livre.',
    category: 'compute',
    permission_level: 'read_only',
    edge_function: 'nlp-pipeline',
    input_schema: z.object({ text: z.string().min(1).max(4000) }),
    output_schema: z.object({
      label: z.enum(['positive', 'neutral', 'negative']),
      score: z.number(),
    }),
    requires_approval: false,
    max_calls_per_session: 30,
    max_calls_per_day: 500,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  extract_rules: {
    id: 'extract_rules',
    name: 'Extrair Regras de Documento',
    description: 'Extrai regras de negócio / cláusulas de um documento via NLP.',
    category: 'compute',
    permission_level: 'read_only',
    edge_function: 'nlp-pipeline',
    input_schema: z.object({
      text: z.string().min(20),
      rule_types: z.array(z.string()).optional(),
    }),
    output_schema: z.object({
      rules: z.array(
        z.object({
          type: z.string(),
          text: z.string(),
          confidence: z.number(),
        }),
      ),
    }),
    requires_approval: false,
    max_calls_per_session: 10,
    max_calls_per_day: 100,
    cost_per_call_usd: 0.005,
    output_validation: 'schema',
  },

  // ═══ Integração ════════════════════════════════════════════════
  delegate_to_agent: {
    id: 'delegate_to_agent',
    name: 'Delegar a Sub-Agente',
    description: 'Invoca outro agente (sub-agente) para executar uma sub-tarefa.',
    category: 'integration',
    permission_level: 'read_write',
    edge_function: 'smolagent-runtime',
    input_schema: z.object({
      agent_id: z.string(),
      task: z.string().min(1),
      context: z.record(z.unknown()).optional(),
    }),
    output_schema: z.object({
      output: z.string(),
      trace_id: z.string().optional(),
    }),
    requires_approval: false,
    max_calls_per_session: 10,
    max_calls_per_day: 100,
    cost_per_call_usd: 0.02,
    output_validation: 'schema',
  },

  // ═══ WhatsApp (Evolution MCP) ══════════════════════════════════
  send_whatsapp: {
    id: 'send_whatsapp',
    name: 'Enviar WhatsApp (texto)',
    description: 'Envia mensagem de texto via Evolution API (WhatsApp Business).',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'evolution',
    mcp_method: 'evo_send_text',
    input_schema: z.object({
      instance: z.string(),
      number: z.string().min(10),
      text: z.string().min(1).max(4096),
    }),
    output_schema: OkResponse.extend({ message_id: z.string().optional() }),
    requires_approval: true,
    max_calls_per_session: 20,
    max_calls_per_day: 500,
    cost_per_call_usd: 0.005,
    output_validation: 'schema',
  },

  send_whatsapp_media: {
    id: 'send_whatsapp_media',
    name: 'Enviar WhatsApp (mídia)',
    description: 'Envia imagem/PDF/documento via WhatsApp (mockup, cotação).',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'evolution',
    mcp_method: 'evo_send_media',
    input_schema: z.object({
      instance: z.string(),
      number: z.string().min(10),
      media_url: z.string().url(),
      caption: z.string().optional(),
    }),
    output_schema: OkResponse,
    requires_approval: true,
    max_calls_per_session: 10,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.01,
    output_validation: 'schema',
  },

  check_whatsapp_number: {
    id: 'check_whatsapp_number',
    name: 'Validar Número WhatsApp',
    description: 'Verifica se um número é um contato WhatsApp ativo.',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'evolution',
    mcp_method: 'evo_check_number',
    input_schema: z.object({
      instance: z.string(),
      numbers: z.array(z.string()).min(1).max(100),
    }),
    output_schema: z.object({
      results: z.array(z.object({ number: z.string(), exists: z.boolean() })),
    }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 300,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  // ═══ Shipping (múltiplas transportadoras) ══════════════════════
  calculate_shipping: {
    id: 'calculate_shipping',
    name: 'Calcular Frete (Frenet)',
    description: 'Cotação de frete multi-transportadora via Frenet (Sedex, JadLog, Loggi, etc.).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'frenet',
    mcp_method: 'frenet_cotar_frete',
    input_schema: z.object({
      cep_origem: z.string().length(8),
      cep_destino: z.string().length(8),
      peso_kg: z.number().positive(),
      valor_declarado: z.number().optional(),
    }),
    output_schema: z.object({
      options: z.array(
        z.object({
          transportadora: z.string(),
          servico: z.string(),
          prazo_dias: z.number(),
          valor: z.number(),
        }),
      ),
    }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 300,
    cost_per_call_usd: 0.001,
    output_validation: 'schema',
  },

  calculate_shipping_braspress: {
    id: 'calculate_shipping_braspress',
    name: 'Cotar Frete Braspress',
    description: 'Cotação rápida pela Braspress (especializada em carga industrial).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'braspress',
    mcp_method: 'braspress_cotacao_rapida',
    input_schema: z.object({
      cnpj_remetente: z.string(),
      cep_origem: z.string(),
      cep_destino: z.string(),
      peso_kg: z.number().positive(),
      valor_mercadoria: z.number().positive(),
    }),
    output_schema: z.object({ valor: z.number(), prazo_dias: z.number() }),
    requires_approval: false,
    max_calls_per_session: 15,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.001,
    output_validation: 'schema',
  },

  calculate_shipping_totalexpress: {
    id: 'calculate_shipping_totalexpress',
    name: 'Cotar Frete Total Express',
    description: 'Cotação Total Express (especializada em e-commerce e última milha).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'totalexpress',
    mcp_method: 'totalexpress_cotacao_completa',
    input_schema: z.object({
      cep_destino: z.string(),
      peso_kg: z.number().positive(),
      valor_mercadoria: z.number().positive(),
    }),
    output_schema: z.object({
      valor: z.number(),
      prazo_dias: z.number(),
      modalidade: z.string(),
    }),
    requires_approval: false,
    max_calls_per_session: 15,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.001,
    output_validation: 'schema',
  },

  track_delivery: {
    id: 'track_delivery',
    name: 'Rastrear Entrega',
    description: 'Rastreia pedido em andamento via Frenet (multi-transportadora).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'frenet',
    mcp_method: 'frenet_rastrear',
    input_schema: z.object({
      codigo_rastreio: z.string().min(5),
      transportadora: z.string().optional(),
    }),
    output_schema: z.object({
      status_atual: z.string(),
      eventos: z.array(z.object({ data: z.string(), descricao: z.string(), local: z.string() })),
      previsao_entrega: z.string().optional(),
    }),
    requires_approval: false,
    max_calls_per_session: 30,
    max_calls_per_day: 500,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  // ═══ Web scraping / browser ═════════════════════════════════════
  scrape_web_page: {
    id: 'scrape_web_page',
    name: 'Scrape de Página Web',
    description:
      'Baixa HTML limpo (ou markdown) de uma página web. Útil para enriquecer empresa via site oficial.',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'chrome',
    mcp_method: 'chrome_markdown',
    input_schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
    }),
    output_schema: z.object({ content: z.string(), title: z.string().optional() }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.003,
    output_validation: 'schema',
  },

  screenshot_page: {
    id: 'screenshot_page',
    name: 'Screenshot de Página',
    description: 'Captura screenshot de página web (para anexar em proposta/relatório).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'chrome',
    mcp_method: 'chrome_screenshot',
    input_schema: z.object({ url: z.string().url(), full_page: z.boolean().default(false) }),
    output_schema: z.object({ image_url: z.string().url() }),
    requires_approval: false,
    max_calls_per_session: 10,
    max_calls_per_day: 100,
    cost_per_call_usd: 0.005,
    output_validation: 'schema',
  },

  // ═══ Bitrix24 — métodos estendidos ═════════════════════════════
  update_deal: {
    id: 'update_deal',
    name: 'Atualizar Deal (Bitrix24)',
    description: 'Move deal entre estágios, atualiza valor/fechamento estimado, muda responsável.',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'bitrix24',
    mcp_method: 'b24_deal_update',
    input_schema: z.object({
      deal_id: z.string(),
      fields: z.record(z.unknown()),
    }),
    output_schema: OkResponse,
    requires_approval: true,
    max_calls_per_session: 20,
    max_calls_per_day: 300,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  add_timeline_event: {
    id: 'add_timeline_event',
    name: 'Adicionar Evento na Timeline (Bitrix24)',
    description: 'Registra comentário / ação executada na timeline de um deal ou contato.',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'bitrix24',
    mcp_method: 'b24_timeline_add',
    input_schema: z.object({
      entity_type: z.enum(['deal', 'contact', 'company', 'lead']),
      entity_id: z.string(),
      comment: z.string().min(1),
    }),
    output_schema: OkResponse,
    requires_approval: false,
    max_calls_per_session: 30,
    max_calls_per_day: 500,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  list_tasks: {
    id: 'list_tasks',
    name: 'Listar Tarefas (Bitrix24)',
    description:
      'Lista tarefas de um responsável/projeto (para SDR/closer saberem o que está pendente).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'bitrix24',
    mcp_method: 'b24_task_list',
    input_schema: z.object({
      responsible_id: z.string().optional(),
      filter: z.record(z.unknown()).optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
    output_schema: z.object({ tasks: z.array(z.record(z.unknown())) }),
    requires_approval: false,
    max_calls_per_session: 20,
    max_calls_per_day: 300,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  // ═══ E-mail (Gmail MCP) ══════════════════════════════════════════
  create_email_draft: {
    id: 'create_email_draft',
    name: 'Criar Rascunho de E-mail (Gmail)',
    description: 'Cria rascunho no Gmail para aprovação humana antes do envio (SDR outbound).',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'gmail',
    mcp_method: 'create_draft',
    input_schema: z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1),
      cc: z.array(z.string().email()).optional(),
    }),
    output_schema: z.object({ draft_id: z.string(), thread_id: z.string().optional() }),
    requires_approval: true,
    max_calls_per_session: 15,
    max_calls_per_day: 150,
    cost_per_call_usd: 0.001,
    output_validation: 'schema',
  },

  search_email_threads: {
    id: 'search_email_threads',
    name: 'Buscar Threads de E-mail',
    description: 'Pesquisa threads no Gmail (histórico de contato com lead/cliente).',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'gmail',
    mcp_method: 'search_threads',
    input_schema: z.object({
      query: z.string().min(1),
      max_results: z.number().int().min(1).max(50).default(10),
    }),
    output_schema: z.object({
      threads: z.array(z.object({ id: z.string(), subject: z.string(), snippet: z.string() })),
    }),
    requires_approval: false,
    max_calls_per_session: 15,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.0005,
    output_validation: 'schema',
  },

  // ═══ Cache / persistência distribuída (Cloudflare KV) ══════════
  cache_get: {
    id: 'cache_get',
    name: 'Cache — Ler',
    description:
      'Lê valor do cache distribuído (Cloudflare KV). Útil para snapshots de dashboard, rate-limit por cliente.',
    category: 'data',
    permission_level: 'read_only',
    mcp_server: 'cloudflare',
    mcp_method: 'cf_kv_get',
    input_schema: z.object({
      namespace: z.string(),
      key: z.string().min(1),
    }),
    output_schema: z.object({ value: z.unknown().nullable(), hit: z.boolean() }),
    requires_approval: false,
    max_calls_per_session: 50,
    max_calls_per_day: 5000,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  cache_put: {
    id: 'cache_put',
    name: 'Cache — Gravar',
    description:
      'Grava valor no cache distribuído com TTL (para evitar recomputar forecast/análise idênticas).',
    category: 'action',
    permission_level: 'read_write',
    mcp_server: 'cloudflare',
    mcp_method: 'cf_kv_put',
    input_schema: z.object({
      namespace: z.string(),
      key: z.string().min(1),
      value: z.unknown(),
      ttl_seconds: z
        .number()
        .int()
        .min(60)
        .max(86400 * 30)
        .default(3600),
    }),
    output_schema: OkResponse,
    requires_approval: false,
    max_calls_per_session: 30,
    max_calls_per_day: 2000,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  request_human_approval: {
    id: 'request_human_approval',
    name: 'HITL — Solicitar aprovação humana',
    description:
      'Enfileira um pedido de aprovação humana (workflow_runs.status = awaiting_approval) quando o agente dispara um trigger crítico (desconto > X, pedido > Y, cláusula contratual nova). A retomada do fluxo é orquestrada por `workflow-engine-v2`.',
    category: 'action',
    permission_level: 'read_write',
    edge_function: 'workflow-engine-v2',
    input_schema: z.object({
      agent_id: z.string().uuid(),
      trigger_key: z.string().min(1),
      reason: z.string().min(1).max(500),
      context: z.record(z.unknown()).optional(),
      workflow_id: z.string().uuid().optional(),
    }),
    output_schema: z.object({
      id: z.string().uuid(),
      status: z.literal('awaiting_approval'),
      reason: z.string(),
    }),
    requires_approval: false, // a própria tool *cria* aprovação; não exige aprovação prévia
    max_calls_per_session: 5,
    max_calls_per_day: 200,
    cost_per_call_usd: 0.0,
    output_validation: 'schema',
  },

  guard_input: {
    id: 'guard_input',
    name: 'Guardrail — Checar entrada do usuário',
    description:
      'Passa o texto do usuário pelo guardrails-engine (NeMo-style) para detectar prompt injection, PII e tentativas de exfiltração antes de entregar ao LLM.',
    category: 'compute',
    permission_level: 'read_only',
    edge_function: 'guardrails-engine',
    input_schema: z.object({
      text: z.string().min(1).max(50_000),
      agent_id: z.string().uuid().optional(),
    }),
    output_schema: z.object({
      action: z.enum(['allow', 'warn', 'block', 'modify']),
      rails: z.array(
        z.object({
          rail: z.string(),
          layer: z.enum(['input', 'dialog', 'output', 'runtime']),
          action: z.enum(['allow', 'warn', 'block', 'modify']),
          confidence: z.number().min(0).max(1),
          reason: z.string(),
        }),
      ),
    }),
    requires_approval: false,
    max_calls_per_session: 200,
    max_calls_per_day: 20_000,
    cost_per_call_usd: 0.0002,
    output_validation: 'schema',
  },
};

// ─── API do catálogo ────────────────────────────────────────────
export function resolveTool(id: string): ToolDefinition | null {
  return TOOL_CATALOG[id] ?? null;
}

export function listTools(): ToolDefinition[] {
  return Object.values(TOOL_CATALOG);
}

/**
 * Converte um `tool_id` (string usada nos templates) em `AgentTool`
 * pronto para ser plugado em `AgentConfig.tools[]`.
 * Retorna `null` quando o id não existe no catálogo.
 */
export function toAgentTool(id: string): AgentTool | null {
  const def = TOOL_CATALOG[id];
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    enabled: true,
    permission_level: def.permission_level,
    requires_approval: def.requires_approval,
    max_calls_per_session: def.max_calls_per_session,
    max_calls_per_day: def.max_calls_per_day,
    allowed_conditions: '',
    output_validation: def.output_validation,
    cost_per_call: def.cost_per_call_usd,
    audit_log: true,
  };
}

/** Resolve múltiplos ids para AgentTool[], filtrando os inválidos e retornando a lista de ids desconhecidos. */
export function toAgentTools(ids: string[]): { tools: AgentTool[]; unknown: string[] } {
  const tools: AgentTool[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const t = toAgentTool(id);
    if (t) tools.push(t);
    else unknown.push(id);
  }
  return { tools, unknown };
}
