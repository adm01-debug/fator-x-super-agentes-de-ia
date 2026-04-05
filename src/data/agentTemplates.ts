/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Agent Templates
 * ═══════════════════════════════════════════════════════════════
 * 15 pre-built templates for common enterprise scenarios.
 * Each template includes: identity, model, tools, prompt, guardrails.
 * Reference: Sim Studio (11 templates), Dify, n8n
 */

export interface AgentTemplateRaw {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  config: {
    persona: string;
    model: string;
    temperature: number;
    system_prompt: string;
    tools: string[];
    guardrails: string[];
    memory_types: string[];
  };
}

export interface AgentTemplate extends AgentTemplateRaw {
  emoji: string;
  type: string;
  model: string;
  prompt: string;
  tools: string[];
  memory: string[];
}

function enrichTemplate(t: AgentTemplateRaw): AgentTemplate {
  return {
    ...t,
    emoji: t.icon,
    type: t.config.persona,
    model: t.config.model,
    prompt: t.config.system_prompt,
    tools: t.config.tools,
    memory: t.config.memory_types,
  };
}

const RAW_TEMPLATES: AgentTemplateRaw[] = [
  {
    id: 'customer_support',
    name: 'Atendimento ao Cliente',
    description: 'Chatbot FAQ com escalação automática para humano quando necessário.',
    icon: '💬',
    category: 'Vendas & Atendimento',
    tags: ['chat', 'faq', 'suporte', 'cliente'],
    config: {
      persona: 'assistant', model: 'claude-sonnet-4-6', temperature: 0.3,
      system_prompt: 'Você é um assistente de atendimento ao cliente da Promo Brindes. Seja cordial, objetivo e resolva problemas. Se não souber a resposta, escale para um humano.',
      tools: ['search_knowledge', 'create_ticket'], guardrails: ['toxicity', 'pii_detection'],
      memory_types: ['episodic', 'user_profile'],
    },
  },
  {
    id: 'lead_qualifier',
    name: 'Qualificador de Leads',
    description: 'Recebe lead → enriquece dados → classifica → roteia para vendedor.',
    icon: '🎯',
    category: 'Vendas & Atendimento',
    tags: ['leads', 'vendas', 'crm', 'qualificação'],
    config: {
      persona: 'analyst', model: 'claude-sonnet-4-6', temperature: 0.2,
      system_prompt: 'Você qualifica leads para a Promo Brindes. Analise o perfil, identifique potencial e classifique como: Hot, Warm, Cold.',
      tools: ['search_crm', 'enrich_company', 'notify_seller'], guardrails: ['pii_detection'],
      memory_types: ['semantic'],
    },
  },
  {
    id: 'quote_generator',
    name: 'Gerador de Cotações',
    description: 'Consulta catálogo → calcula preços → gera proposta PDF.',
    icon: '💰',
    category: 'Vendas & Atendimento',
    tags: ['cotação', 'preços', 'proposta', 'pdf'],
    config: {
      persona: 'assistant', model: 'claude-sonnet-4-6', temperature: 0.1,
      system_prompt: 'Você gera cotações para a Promo Brindes. Consulte o catálogo de produtos, calcule preços com descontos por volume e gere propostas formatadas.',
      tools: ['search_products', 'calculate_price', 'generate_pdf'], guardrails: ['pii_detection', 'secret_leakage'],
      memory_types: ['semantic', 'episodic'],
    },
  },
  {
    id: 'onboarding',
    name: 'Onboarding de Funcionário',
    description: 'Checklist automatizado para novos colaboradores.',
    icon: '🎓',
    category: 'RH & Gestão',
    tags: ['rh', 'onboarding', 'checklist', 'novo funcionário'],
    config: {
      persona: 'mentor', model: 'claude-haiku-4-5-20251001', temperature: 0.5,
      system_prompt: 'Você é o mentor de onboarding da Promo Brindes. Guie novos funcionários pelas etapas de integração.',
      tools: ['create_task', 'send_notification'], guardrails: ['toxicity'],
      memory_types: ['episodic'],
    },
  },
  {
    id: 'document_analyst',
    name: 'Analista de Documentos',
    description: 'Recebe PDF → extrai informações → resume → classifica.',
    icon: '📄',
    category: 'Produtividade',
    tags: ['pdf', 'ocr', 'análise', 'documentos'],
    config: {
      persona: 'analyst', model: 'claude-sonnet-4-6', temperature: 0.2,
      system_prompt: 'Você analisa documentos para a Promo Brindes. Extraia informações-chave, resuma conteúdo e classifique por tipo.',
      tools: ['ocr', 'extract_tables', 'classify_document'], guardrails: ['pii_detection', 'secret_leakage'],
      memory_types: ['semantic'],
    },
  },
  {
    id: 'sales_assistant',
    name: 'Assistente de Vendas',
    description: 'Consulta catálogo → sugere produtos → gera proposta.',
    icon: '🛒',
    category: 'Vendas & Atendimento',
    tags: ['vendas', 'catálogo', 'sugestão', 'produtos'],
    config: {
      persona: 'salesperson', model: 'claude-sonnet-4-6', temperature: 0.5,
      system_prompt: 'Você é um assistente de vendas da Promo Brindes. Ajude clientes a encontrar os melhores brindes promocionais.',
      tools: ['search_products', 'search_crm', 'calculate_price'], guardrails: ['toxicity', 'pii_detection'],
      memory_types: ['episodic', 'user_profile', 'semantic'],
    },
  },
  {
    id: 'report_generator',
    name: 'Gerador de Relatórios',
    description: 'Coleta dados → analisa → gera report semanal automatizado.',
    icon: '📊',
    category: 'Produtividade',
    tags: ['relatório', 'dados', 'análise', 'semanal'],
    config: {
      persona: 'analyst', model: 'claude-sonnet-4-6', temperature: 0.3,
      system_prompt: 'Você gera relatórios executivos para a Promo Brindes. Colete dados, identifique tendências e apresente insights acionáveis.',
      tools: ['query_datahub', 'generate_chart'], guardrails: ['secret_leakage'],
      memory_types: ['semantic'],
    },
  },
  {
    id: 'email_triage',
    name: 'Triagem de Email',
    description: 'Lê emails → classifica → roteia → responde automaticamente.',
    icon: '📧',
    category: 'Produtividade',
    tags: ['email', 'triagem', 'classificação', 'automação'],
    config: {
      persona: 'assistant', model: 'claude-haiku-4-5-20251001', temperature: 0.2,
      system_prompt: 'Classifique emails recebidos em: Urgente, Comercial, Suporte, Spam. Sugira resposta quando possível.',
      tools: ['read_email', 'classify_text', 'send_email'], guardrails: ['pii_detection', 'prompt_injection'],
      memory_types: ['episodic'],
    },
  },
  {
    id: 'market_researcher',
    name: 'Pesquisador de Mercado',
    description: 'Busca web → analisa tendências → gera relatório de mercado.',
    icon: '🔬',
    category: 'Estratégia',
    tags: ['pesquisa', 'mercado', 'tendências', 'competitivo'],
    config: {
      persona: 'researcher', model: 'claude-sonnet-4-6', temperature: 0.5,
      system_prompt: 'Você é um pesquisador de mercado. Pesquise tendências, analise concorrentes e gere insights para a Promo Brindes.',
      tools: ['web_search', 'consult_oracle'], guardrails: ['toxicity'],
      memory_types: ['semantic', 'episodic'],
    },
  },
  {
    id: 'hr_assistant',
    name: 'Assistente de RH',
    description: 'Responde perguntas de funcionários sobre políticas, benefícios e processos.',
    icon: '👥',
    category: 'RH & Gestão',
    tags: ['rh', 'políticas', 'benefícios', 'funcionários'],
    config: {
      persona: 'assistant', model: 'claude-haiku-4-5-20251001', temperature: 0.3,
      system_prompt: 'Você é o assistente de RH da Promo Brindes. Responda perguntas sobre políticas, benefícios, férias, etc.',
      tools: ['search_knowledge', 'query_datahub'], guardrails: ['pii_detection', 'toxicity'],
      memory_types: ['semantic'],
    },
  },
  {
    id: 'compliance_checker',
    name: 'Verificador de Compliance',
    description: 'Analisa documento → checa regras → reporta conformidade.',
    icon: '✅',
    category: 'Estratégia',
    tags: ['compliance', 'regras', 'conformidade', 'auditoria'],
    config: {
      persona: 'auditor', model: 'claude-sonnet-4-6', temperature: 0.1,
      system_prompt: 'Você verifica compliance de documentos contra regras e políticas da empresa. Identifique não-conformidades.',
      tools: ['search_knowledge', 'extract_rules'], guardrails: ['prompt_injection', 'pii_detection'],
      memory_types: ['semantic'],
    },
  },
  {
    id: 'quality_auditor',
    name: 'Auditor de Qualidade',
    description: 'Analisa métricas → identifica problemas → sugere melhorias Kaizen.',
    icon: '🔍',
    category: 'Estratégia',
    tags: ['qualidade', 'métricas', 'kaizen', 'melhoria'],
    config: {
      persona: 'analyst', model: 'claude-sonnet-4-6', temperature: 0.3,
      system_prompt: 'Você audita qualidade de processos da Promo Brindes. Identifique gargalos, sugira melhorias Kaizen com impacto mensurável.',
      tools: ['query_datahub', 'consult_oracle'], guardrails: ['toxicity'],
      memory_types: ['semantic', 'episodic'],
    },
  },
  {
    id: 'scheduler',
    name: 'Agendador de Reuniões',
    description: 'Consulta calendário → propõe horários → confirma participantes.',
    icon: '📅',
    category: 'Produtividade',
    tags: ['agenda', 'reuniões', 'calendário', 'horários'],
    config: {
      persona: 'assistant', model: 'claude-haiku-4-5-20251001', temperature: 0.3,
      system_prompt: 'Você agenda reuniões. Consulte disponibilidade, proponha horários e confirme com participantes.',
      tools: ['calendar_check', 'send_invite', 'send_notification'], guardrails: ['pii_detection'],
      memory_types: ['episodic'],
    },
  },
  {
    id: 'social_monitor',
    name: 'Monitor de Redes Sociais',
    description: 'Monitora menções → classifica sentimento → gera alertas.',
    icon: '📱',
    category: 'Marketing',
    tags: ['social', 'redes', 'monitoramento', 'sentimento'],
    config: {
      persona: 'analyst', model: 'claude-haiku-4-5-20251001', temperature: 0.3,
      system_prompt: 'Monitore menções à Promo Brindes nas redes sociais. Classifique sentimento e alerte sobre menções negativas.',
      tools: ['web_search', 'classify_sentiment', 'send_notification'], guardrails: ['toxicity'],
      memory_types: ['episodic', 'semantic'],
    },
  },
  {
    id: 'multi_agent_blank',
    name: 'Multi-Agente Personalizado',
    description: 'Template em branco com 3 sub-agentes configuráveis.',
    icon: '🎼',
    category: 'Avançado',
    tags: ['multi-agente', 'orquestração', 'personalizado'],
    config: {
      persona: 'orchestrator', model: 'claude-sonnet-4-6', temperature: 0.5,
      system_prompt: 'Você é um orquestrador que coordena sub-agentes para resolver tarefas complexas.',
      tools: ['delegate_to_agent'], guardrails: ['prompt_injection'],
      memory_types: ['episodic', 'semantic', 'procedural'],
    },
  },
];

export const AGENT_TEMPLATES: AgentTemplate[] = RAW_TEMPLATES.map(enrichTemplate);

export const TEMPLATE_CATEGORIES = [
  { id: 'vendas', label: 'Vendas & Atendimento', icon: '💼' },
  { id: 'rh', label: 'RH & Gestão', icon: '👥' },
  { id: 'produtividade', label: 'Produtividade', icon: '⚡' },
  { id: 'estrategia', label: 'Estratégia', icon: '🎯' },
  { id: 'marketing', label: 'Marketing', icon: '📱' },
  { id: 'avancado', label: 'Avançado', icon: '🔧' },
