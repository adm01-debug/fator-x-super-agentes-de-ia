// ===== MOCK DATA FOR NEXUS AGENTS STUDIO =====

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: string;
  model: string;
  status: 'active' | 'draft' | 'paused' | 'error';
  owner: string;
  tags: string[];
  sessions24h: number;
  avgLatency: number;
  costToday: number;
  successRate: number;
  satisfaction: number;
  tokensIn: number;
  tokensOut: number;
  toolCalls: number;
  maturity: 'prototype' | 'tested' | 'production';
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  agentName?: string;
  timestamp: string;
}

export interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: number;
  chunks: number;
  lastSync: string;
  status: 'synced' | 'syncing' | 'error' | 'pending';
  vectorDb: string;
  embeddingModel: string;
  owner: string;
}

export interface ToolIntegration {
  id: string;
  name: string;
  category: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  rateLimit: string;
  lastUsed: string;
  callsToday: number;
}

export interface EvaluationRun {
  id: string;
  name: string;
  agent: string;
  status: 'completed' | 'running' | 'failed' | 'queued';
  factuality: number;
  groundedness: number;
  taskSuccess: number;
  hallucinationRisk: number;
  latencyAvg: number;
  costTotal: number;
  testCases: number;
  passRate: number;
  createdAt: string;
}

export interface SessionTrace {
  id: string;
  sessionId: string;
  agent: string;
  user: string;
  status: 'success' | 'error' | 'timeout';
  duration: number;
  tokens: number;
  cost: number;
  toolCalls: number;
  timestamp: string;
  steps: TraceStep[];
}

export interface TraceStep {
  id: string;
  type: 'input' | 'retrieval' | 'tool_call' | 'model' | 'guardrail' | 'output';
  label: string;
  duration: number;
  status: 'success' | 'error';
  detail?: string;
}

export interface Deployment {
  id: string;
  agent: string;
  channel: string;
  environment: 'development' | 'staging' | 'production';
  status: 'active' | 'inactive' | 'deploying';
  version: string;
  traffic: number;
  lastDeployed: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'engineer' | 'analyst' | 'viewer';
  avatar: string;
  lastActive: string;
  status: 'active' | 'invited' | 'disabled';
}

export interface GuardrailPolicy {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'testing';
  description: string;
  triggersToday: number;
  blockRate: number;
}

// ===== DATA =====

export const agents: Agent[] = [
  { id: '1', name: 'Atlas — Atendimento Premium', description: 'Agente de suporte L1/L2 com acesso a base de conhecimento técnica e CRM', type: 'Suporte', model: 'GPT-4o', status: 'active', owner: 'Marina Costa', tags: ['suporte', 'CRM', 'RAG'], sessions24h: 1247, avgLatency: 1.8, costToday: 42.30, successRate: 94.2, satisfaction: 4.7, tokensIn: 580000, tokensOut: 320000, toolCalls: 890, maturity: 'production', createdAt: '2025-11-15', updatedAt: '2026-03-28' },
  { id: '2', name: 'Scout — Pesquisador de Mercado', description: 'Agente de pesquisa com web search, browser e análise de documentos', type: 'Pesquisador', model: 'Claude 3.5 Sonnet', status: 'active', owner: 'Rafael Mendes', tags: ['pesquisa', 'web', 'análise'], sessions24h: 342, avgLatency: 3.2, costToday: 28.50, successRate: 89.5, satisfaction: 4.5, tokensIn: 420000, tokensOut: 280000, toolCalls: 560, maturity: 'tested', createdAt: '2026-01-08', updatedAt: '2026-03-29' },
  { id: '3', name: 'Cleo — SDR Inteligente', description: 'Agente de prospecção outbound com integração a CRM, email e calendário', type: 'SDR', model: 'GPT-4o', status: 'active', owner: 'Juliana Santos', tags: ['vendas', 'email', 'CRM'], sessions24h: 523, avgLatency: 2.1, costToday: 35.80, successRate: 78.3, satisfaction: 4.2, tokensIn: 310000, tokensOut: 190000, toolCalls: 1240, maturity: 'production', createdAt: '2025-12-01', updatedAt: '2026-03-30' },
  { id: '4', name: 'Sentinel — Compliance Analyst', description: 'Agente de análise regulatória e due diligence com RAG jurídico', type: 'Analista', model: 'Claude 3.5 Sonnet', status: 'active', owner: 'Bruno Almeida', tags: ['compliance', 'legal', 'RAG'], sessions24h: 89, avgLatency: 4.5, costToday: 18.90, successRate: 96.1, satisfaction: 4.8, tokensIn: 290000, tokensOut: 180000, toolCalls: 120, maturity: 'tested', createdAt: '2026-02-14', updatedAt: '2026-03-27' },
  { id: '5', name: 'Orchestrator — Multiagente Hub', description: 'Orquestrador que coordena sub-agentes para tarefas complexas', type: 'Orquestrador', model: 'GPT-4o', status: 'draft', owner: 'Marina Costa', tags: ['multiagent', 'workflow', 'orquestração'], sessions24h: 0, avgLatency: 0, costToday: 0, successRate: 0, satisfaction: 0, tokensIn: 0, tokensOut: 0, toolCalls: 0, maturity: 'prototype', createdAt: '2026-03-25', updatedAt: '2026-03-29' },
  { id: '6', name: 'Iris — BI Analyst', description: 'Agente de análise de dados com SQL, visualizações e relatórios automatizados', type: 'Analista', model: 'Gemini 1.5 Pro', status: 'paused', owner: 'Carlos Ferreira', tags: ['BI', 'SQL', 'dados'], sessions24h: 0, avgLatency: 2.8, costToday: 0, successRate: 85.7, satisfaction: 4.3, tokensIn: 0, tokensOut: 0, toolCalls: 0, maturity: 'tested', createdAt: '2026-01-20', updatedAt: '2026-03-15' },
  { id: '7', name: 'Nova — Copiloto Dev', description: 'Assistente de desenvolvimento com code execution, documentação e debugging', type: 'Copiloto', model: 'Claude 3.5 Sonnet', status: 'error', owner: 'Rafael Mendes', tags: ['dev', 'código', 'debugging'], sessions24h: 15, avgLatency: 5.1, costToday: 8.20, successRate: 62.0, satisfaction: 3.8, tokensIn: 95000, tokensOut: 75000, toolCalls: 340, maturity: 'prototype', createdAt: '2026-03-10', updatedAt: '2026-03-30' },
];

export const alerts: Alert[] = [
  { id: '1', type: 'error', title: 'Falha em tool calling', description: 'Nova — Copiloto Dev falhou ao executar code_execution 12 vezes nos últimos 30 min', agentName: 'Nova', timestamp: '2 min atrás' },
  { id: '2', type: 'warning', title: 'Custo anômalo detectado', description: 'Cleo — SDR gastou 40% acima da média diária. Verificar loop de chamadas.', agentName: 'Cleo', timestamp: '15 min atrás' },
  { id: '3', type: 'warning', title: 'Contexto excedido', description: 'Scout — Pesquisador atingiu 95% do limite de contexto em 3 sessões', agentName: 'Scout', timestamp: '1h atrás' },
  { id: '4', type: 'info', title: 'Ingestão concluída', description: 'Base "Políticas Internas 2026" indexou 142 documentos com sucesso', timestamp: '2h atrás' },
  { id: '5', type: 'error', title: 'Embedding pipeline falhou', description: 'Erro ao processar lote de 28 arquivos PDF na base "Contratos Q1"', timestamp: '3h atrás' },
];

export const activities: Activity[] = [
  { id: '1', user: 'Marina Costa', action: 'publicou nova versão do', target: 'Atlas — Atendimento Premium v2.4', timestamp: '5 min atrás' },
  { id: '2', user: 'Rafael Mendes', action: 'criou avaliação para', target: 'Scout — Pesquisador de Mercado', timestamp: '22 min atrás' },
  { id: '3', user: 'Juliana Santos', action: 'atualizou prompt do', target: 'Cleo — SDR Inteligente', timestamp: '1h atrás' },
  { id: '4', user: 'Bruno Almeida', action: 'adicionou guardrail PII no', target: 'Sentinel — Compliance Analyst', timestamp: '2h atrás' },
  { id: '5', user: 'Carlos Ferreira', action: 'pausou o agente', target: 'Iris — BI Analyst', timestamp: '3h atrás' },
  { id: '6', user: 'Marina Costa', action: 'conectou ferramenta Slack ao', target: 'Atlas — Atendimento Premium', timestamp: '4h atrás' },
];

export const knowledgeBases: KnowledgeBase[] = [
  { id: '1', name: 'Documentação Técnica', description: 'Manuais de produto, APIs e guias de integração', documents: 342, chunks: 8450, lastSync: '2026-03-30 08:15', status: 'synced', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-large', owner: 'Marina Costa' },
  { id: '2', name: 'Políticas Internas 2026', description: 'RH, compliance, segurança da informação e processos', documents: 142, chunks: 3890, lastSync: '2026-03-30 07:00', status: 'synced', vectorDb: 'Pinecone', embeddingModel: 'text-embedding-3-small', owner: 'Bruno Almeida' },
  { id: '3', name: 'Base Jurídica', description: 'Contratos, regulamentos, jurisprudência e pareceres', documents: 89, chunks: 4210, lastSync: '2026-03-29 22:30', status: 'syncing', vectorDb: 'Weaviate', embeddingModel: 'text-embedding-3-large', owner: 'Bruno Almeida' },
  { id: '4', name: 'Contratos Q1 2026', description: 'Contratos comerciais do primeiro trimestre', documents: 56, chunks: 0, lastSync: 'Nunca', status: 'error', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-small', owner: 'Juliana Santos' },
  { id: '5', name: 'FAQ Suporte', description: 'Perguntas frequentes e resoluções de tickets', documents: 1240, chunks: 15600, lastSync: '2026-03-30 09:00', status: 'synced', vectorDb: 'Qdrant', embeddingModel: 'text-embedding-3-small', owner: 'Marina Costa' },
];

export const tools: ToolIntegration[] = [
  { id: '1', name: 'Web Search', category: 'Pesquisa', icon: 'Search', status: 'connected', rateLimit: '100/min', lastUsed: '1 min atrás', callsToday: 2340 },
  { id: '2', name: 'Browser', category: 'Pesquisa', icon: 'Globe', status: 'connected', rateLimit: '30/min', lastUsed: '5 min atrás', callsToday: 456 },
  { id: '3', name: 'Code Execution', category: 'Desenvolvimento', icon: 'Code', status: 'error', rateLimit: '50/min', lastUsed: '2 min atrás', callsToday: 890 },
  { id: '4', name: 'SQL Query', category: 'Dados', icon: 'Database', status: 'connected', rateLimit: '200/min', lastUsed: '8 min atrás', callsToday: 1560 },
  { id: '5', name: 'Salesforce CRM', category: 'CRM', icon: 'Users', status: 'connected', rateLimit: '60/min', lastUsed: '3 min atrás', callsToday: 780 },
  { id: '6', name: 'Gmail', category: 'Comunicação', icon: 'Mail', status: 'connected', rateLimit: '50/min', lastUsed: '12 min atrás', callsToday: 234 },
  { id: '7', name: 'Google Calendar', category: 'Produtividade', icon: 'Calendar', status: 'connected', rateLimit: '30/min', lastUsed: '25 min atrás', callsToday: 89 },
  { id: '8', name: 'Slack', category: 'Comunicação', icon: 'MessageSquare', status: 'connected', rateLimit: '40/min', lastUsed: '1 min atrás', callsToday: 1120 },
  { id: '9', name: 'Notion', category: 'Produtividade', icon: 'FileText', status: 'disconnected', rateLimit: '—', lastUsed: 'Nunca', callsToday: 0 },
  { id: '10', name: 'Webhook', category: 'Custom', icon: 'Webhook', status: 'connected', rateLimit: '100/min', lastUsed: '15 min atrás', callsToday: 345 },
  { id: '11', name: 'Custom API', category: 'Custom', icon: 'Plug', status: 'disconnected', rateLimit: '—', lastUsed: 'Nunca', callsToday: 0 },
  { id: '12', name: 'Human Handoff', category: 'Operações', icon: 'UserCheck', status: 'connected', rateLimit: '—', lastUsed: '45 min atrás', callsToday: 23 },
];

export const evaluations: EvaluationRun[] = [
  { id: '1', name: 'Atlas v2.4 — Regressão Completa', agent: 'Atlas — Atendimento Premium', status: 'completed', factuality: 94.2, groundedness: 91.8, taskSuccess: 88.5, hallucinationRisk: 3.2, latencyAvg: 1.9, costTotal: 12.40, testCases: 250, passRate: 92.4, createdAt: '2026-03-30 06:00' },
  { id: '2', name: 'Scout — Benchmark Q1', agent: 'Scout — Pesquisador de Mercado', status: 'completed', factuality: 87.5, groundedness: 85.2, taskSuccess: 82.0, hallucinationRisk: 8.1, latencyAvg: 3.4, costTotal: 8.90, testCases: 120, passRate: 85.0, createdAt: '2026-03-29 14:00' },
  { id: '3', name: 'Cleo — Adversarial Test', agent: 'Cleo — SDR Inteligente', status: 'running', factuality: 0, groundedness: 0, taskSuccess: 0, hallucinationRisk: 0, latencyAvg: 0, costTotal: 0, testCases: 80, passRate: 0, createdAt: '2026-03-30 09:30' },
  { id: '4', name: 'Sentinel — Compliance Audit', agent: 'Sentinel — Compliance Analyst', status: 'completed', factuality: 97.1, groundedness: 96.5, taskSuccess: 94.0, hallucinationRisk: 1.5, latencyAvg: 4.8, costTotal: 15.20, testCases: 180, passRate: 96.1, createdAt: '2026-03-28 10:00' },
];

export const traces: SessionTrace[] = [
  { id: '1', sessionId: 'sess_a1b2c3', agent: 'Atlas — Atendimento Premium', user: 'cliente@empresa.com', status: 'success', duration: 2400, tokens: 3200, cost: 0.034, toolCalls: 2, timestamp: '2026-03-30 10:42', steps: [
    { id: 's1', type: 'input', label: 'Mensagem do usuário', duration: 0, status: 'success', detail: '"Como faço para integrar a API de pagamentos?"' },
    { id: 's2', type: 'retrieval', label: 'Busca na base técnica', duration: 180, status: 'success', detail: '5 chunks recuperados, score médio 0.89' },
    { id: 's3', type: 'model', label: 'GPT-4o — geração', duration: 1800, status: 'success', detail: '1,240 tokens gerados' },
    { id: 's4', type: 'guardrail', label: 'PII check', duration: 45, status: 'success', detail: 'Nenhum dado sensível detectado' },
    { id: 's5', type: 'output', label: 'Resposta final', duration: 10, status: 'success', detail: 'Guia passo a passo com link da doc' },
  ]},
  { id: '2', sessionId: 'sess_d4e5f6', agent: 'Cleo — SDR Inteligente', user: 'lead@prospect.io', status: 'success', duration: 5200, tokens: 4800, cost: 0.052, toolCalls: 4, timestamp: '2026-03-30 10:38', steps: [
    { id: 's1', type: 'input', label: 'Trigger: novo lead', duration: 0, status: 'success' },
    { id: 's2', type: 'tool_call', label: 'CRM — buscar perfil', duration: 320, status: 'success' },
    { id: 's3', type: 'tool_call', label: 'Web Search — empresa', duration: 890, status: 'success' },
    { id: 's4', type: 'model', label: 'GPT-4o — gerar email', duration: 2100, status: 'success' },
    { id: 's5', type: 'tool_call', label: 'Gmail — enviar', duration: 450, status: 'success' },
    { id: 's6', type: 'tool_call', label: 'CRM — registrar atividade', duration: 280, status: 'success' },
    { id: 's7', type: 'output', label: 'Email enviado', duration: 10, status: 'success' },
  ]},
  { id: '3', sessionId: 'sess_g7h8i9', agent: 'Nova — Copiloto Dev', user: 'dev@team.com', status: 'error', duration: 8500, tokens: 6200, cost: 0.089, toolCalls: 3, timestamp: '2026-03-30 10:35', steps: [
    { id: 's1', type: 'input', label: 'Pedido de debug', duration: 0, status: 'success' },
    { id: 's2', type: 'retrieval', label: 'Busca na doc de código', duration: 220, status: 'success' },
    { id: 's3', type: 'tool_call', label: 'Code execution — análise', duration: 3200, status: 'error', detail: 'Timeout após 30s' },
    { id: 's4', type: 'model', label: 'Claude 3.5 — retry', duration: 2800, status: 'success' },
    { id: 's5', type: 'tool_call', label: 'Code execution — retry', duration: 0, status: 'error', detail: 'Sandbox indisponível' },
  ]},
];

export const deployments: Deployment[] = [
  { id: '1', agent: 'Atlas — Atendimento Premium', channel: 'Widget de Chat', environment: 'production', status: 'active', version: 'v2.4', traffic: 100, lastDeployed: '2026-03-28 14:00' },
  { id: '2', agent: 'Atlas — Atendimento Premium', channel: 'API Endpoint', environment: 'production', status: 'active', version: 'v2.4', traffic: 100, lastDeployed: '2026-03-28 14:00' },
  { id: '3', agent: 'Cleo — SDR Inteligente', channel: 'API Endpoint', environment: 'production', status: 'active', version: 'v1.8', traffic: 80, lastDeployed: '2026-03-25 10:00' },
  { id: '4', agent: 'Cleo — SDR Inteligente', channel: 'Slack Bot', environment: 'staging', status: 'active', version: 'v1.9-beta', traffic: 20, lastDeployed: '2026-03-29 16:00' },
  { id: '5', agent: 'Scout — Pesquisador de Mercado', channel: 'Web App Embed', environment: 'production', status: 'active', version: 'v1.2', traffic: 100, lastDeployed: '2026-03-20 09:00' },
  { id: '6', agent: 'Sentinel — Compliance Analyst', channel: 'Internal Assistant', environment: 'staging', status: 'deploying', version: 'v0.9', traffic: 0, lastDeployed: '2026-03-30 09:45' },
];

export const teamMembers: TeamMember[] = [
  { id: '1', name: 'Marina Costa', email: 'marina@nexus.ai', role: 'owner', avatar: 'MC', lastActive: 'Agora', status: 'active' },
  { id: '2', name: 'Rafael Mendes', email: 'rafael@nexus.ai', role: 'admin', avatar: 'RM', lastActive: '5 min atrás', status: 'active' },
  { id: '3', name: 'Juliana Santos', email: 'juliana@nexus.ai', role: 'engineer', avatar: 'JS', lastActive: '1h atrás', status: 'active' },
  { id: '4', name: 'Bruno Almeida', email: 'bruno@nexus.ai', role: 'engineer', avatar: 'BA', lastActive: '2h atrás', status: 'active' },
  { id: '5', name: 'Carlos Ferreira', email: 'carlos@nexus.ai', role: 'analyst', avatar: 'CF', lastActive: '3h atrás', status: 'active' },
  { id: '6', name: 'Ana Oliveira', email: 'ana@nexus.ai', role: 'viewer', avatar: 'AO', lastActive: '1 dia atrás', status: 'invited' },
];

export const guardrails: GuardrailPolicy[] = [
  { id: '1', name: 'PII Masking', type: 'Privacidade', status: 'active', description: 'Detecta e mascara CPF, email, telefone e endereço nas respostas', triggersToday: 145, blockRate: 99.2 },
  { id: '2', name: 'Content Moderation', type: 'Segurança', status: 'active', description: 'Filtra conteúdo ofensivo, violento ou discriminatório', triggersToday: 23, blockRate: 97.8 },
  { id: '3', name: 'Jailbreak Detection', type: 'Segurança', status: 'active', description: 'Identifica tentativas de prompt injection e jailbreak', triggersToday: 8, blockRate: 95.5 },
  { id: '4', name: 'Cost Limiter', type: 'Custo', status: 'active', description: 'Bloqueia execuções que excedam R$ 5,00 por sessão', triggersToday: 3, blockRate: 100 },
  { id: '5', name: 'Token Limit', type: 'Custo', status: 'active', description: 'Limita output a 4.096 tokens por resposta', triggersToday: 67, blockRate: 100 },
  { id: '6', name: 'JSON Schema Validation', type: 'Qualidade', status: 'active', description: 'Valida saída estruturada contra schema definido', triggersToday: 12, blockRate: 100 },
  { id: '7', name: 'Human Approval Gate', type: 'Governança', status: 'testing', description: 'Requer aprovação humana para ações críticas (envio de email, alteração de dados)', triggersToday: 5, blockRate: 100 },
  { id: '8', name: 'Allow/Deny Tool List', type: 'Segurança', status: 'active', description: 'Controla quais ferramentas cada agente pode utilizar', triggersToday: 0, blockRate: 100 },
];

// Chart data
export const costByModelData = [
  { name: 'GPT-4o', cost: 78.10, color: 'hsl(250, 80%, 65%)' },
  { name: 'Claude 3.5', cost: 47.40, color: 'hsl(185, 80%, 60%)' },
  { name: 'Gemini 1.5', cost: 12.80, color: 'hsl(160, 70%, 50%)' },
  { name: 'Embeddings', cost: 8.50, color: 'hsl(38, 92%, 60%)' },
];

export const sessionsPerDayData = [
  { day: 'Seg', sessions: 1850 },
  { day: 'Ter', sessions: 2100 },
  { day: 'Qua', sessions: 1920 },
  { day: 'Qui', sessions: 2340 },
  { day: 'Sex', sessions: 2580 },
  { day: 'Sáb', sessions: 980 },
  { day: 'Dom', sessions: 720 },
];

export const latencyByAgentData = [
  { agent: 'Atlas', p50: 1.2, p95: 2.8, p99: 4.1 },
  { agent: 'Scout', p50: 2.1, p95: 4.5, p99: 7.2 },
  { agent: 'Cleo', p50: 1.5, p95: 3.2, p99: 5.0 },
  { agent: 'Sentinel', p50: 3.0, p95: 6.1, p99: 9.8 },
  { agent: 'Nova', p50: 3.5, p95: 7.0, p99: 12.0 },
];

export const errorRateData = [
  { hour: '00h', rate: 1.2 }, { hour: '02h', rate: 0.8 }, { hour: '04h', rate: 0.5 },
  { hour: '06h', rate: 1.0 }, { hour: '08h', rate: 2.1 }, { hour: '10h', rate: 3.8 },
  { hour: '12h', rate: 2.5 }, { hour: '14h', rate: 1.8 }, { hour: '16h', rate: 2.2 },
  { hour: '18h', rate: 1.5 }, { hour: '20h', rate: 1.1 }, { hour: '22h', rate: 0.9 },
];

export const usageBreakdown = {
  totalCost: 146.80,
  tokens: { input: 1695000, output: 1045000, cost: 98.50 },
  embeddings: { vectors: 32150, cost: 8.50 },
  storage: { gb: 12.4, cost: 6.20 },
  toolCalls: { count: 5243, cost: 26.10 },
  compute: { hours: 3.2, cost: 7.50 },
};
