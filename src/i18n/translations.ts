/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — i18n Translations
 * ═══════════════════════════════════════════════════════════════
 * pt-BR and en-US translations for the entire UI.
 * Usage: const { t } = useI18n(); t('agents.create')
 */

type TranslationKeys = Record<string, string>;

export const translations: Record<string, TranslationKeys> = {
  'pt-BR': {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.agents': 'Agentes',
    'nav.workflows': 'Workflows',
    'nav.knowledge': 'Conhecimento',
    'nav.oracle': 'Oráculo',
    'nav.datahub': 'DataHub',
    'nav.monitoring': 'Monitoramento',
    'nav.team': 'Equipe',
    'nav.settings': 'Configurações',
    'nav.cerebro': 'Super Cérebro',

    // Actions
    'action.save': 'Salvar',
    'action.cancel': 'Cancelar',
    'action.delete': 'Deletar',
    'action.edit': 'Editar',
    'action.create': 'Criar',
    'action.search': 'Buscar',
    'action.filter': 'Filtrar',
    'action.export': 'Exportar',
    'action.import': 'Importar',
    'action.test': 'Testar',
    'action.deploy': 'Deploy',
    'action.duplicate': 'Duplicar',
    'action.archive': 'Arquivar',

    // Agents
    'agents.title': 'Agentes',
    'agents.create': 'Novo Agente',
    'agents.empty': 'Nenhum agente criado ainda',
    'agents.status.draft': 'Rascunho',
    'agents.status.testing': 'Em Testes',
    'agents.status.production': 'Produção',
    'agents.status.archived': 'Arquivado',

    // Builder tabs
    'builder.identity': 'Identidade',
    'builder.brain': 'Cérebro (LLM)',
    'builder.memory': 'Memória',
    'builder.rag': 'RAG & Conhecimento',
    'builder.tools': 'Ferramentas & MCP',
    'builder.prompt': 'Prompts',
    'builder.orchestration': 'Orquestração',
    'builder.guardrails': 'Guardrails',
    'builder.testing': 'Avaliação',
    'builder.observability': 'Observabilidade',
    'builder.deploy': 'Deploy',
    'builder.billing': 'Custos',
    'builder.readiness': 'Prontidão',
    'builder.blueprint': 'Blueprint',

    // Common
    'common.loading': 'Carregando...',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.confirm': 'Confirmar',
    'common.no_data': 'Sem dados',
    'common.unauthorized': 'Acesso não autorizado',

    // Automation Center
    'automation.title': 'Central de Automação',
    'automation.schedules': 'Agendamentos',
    'automation.webhooks': 'Webhooks',
    'automation.notifications': 'Notificações',
    'automation.templates': 'Templates',
    'automation.history': 'Histórico',
    'automation.connectors': 'Conectores',
    'automation.queues': 'Filas',
    'automation.credentials': 'Credenciais',
    'automation.batch': 'Processamento em Lote',
    'automation.active': 'Ativo',
    'automation.paused': 'Pausado',
    'automation.success_rate': 'Taxa de Sucesso',
    'automation.no_data': 'Nenhum dado ainda',
  },

  'en-US': {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.agents': 'Agents',
    'nav.workflows': 'Workflows',
    'nav.knowledge': 'Knowledge',
    'nav.oracle': 'Oracle',
    'nav.datahub': 'DataHub',
    'nav.monitoring': 'Monitoring',
    'nav.team': 'Team',
    'nav.settings': 'Settings',
    'nav.cerebro': 'Super Brain',

    // Actions
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.create': 'Create',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.test': 'Test',
    'action.deploy': 'Deploy',
    'action.duplicate': 'Duplicate',
    'action.archive': 'Archive',

    // Agents
    'agents.title': 'Agents',
    'agents.create': 'New Agent',
    'agents.empty': 'No agents created yet',
    'agents.status.draft': 'Draft',
    'agents.status.testing': 'Testing',
    'agents.status.production': 'Production',
    'agents.status.archived': 'Archived',

    // Builder tabs
    'builder.identity': 'Identity',
    'builder.brain': 'Brain (LLM)',
    'builder.memory': 'Memory',
    'builder.rag': 'RAG & Knowledge',
    'builder.tools': 'Tools & MCP',
    'builder.prompt': 'Prompts',
    'builder.orchestration': 'Orchestration',
    'builder.guardrails': 'Guardrails',
    'builder.testing': 'Evaluation',
    'builder.observability': 'Observability',
    'builder.deploy': 'Deploy',
    'builder.billing': 'Billing',
    'builder.readiness': 'Readiness',
    'builder.blueprint': 'Blueprint',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.no_data': 'No data',
    'common.unauthorized': 'Unauthorized access',

    // Automation Center
    'automation.title': 'Automation Center',
    'automation.schedules': 'Schedules',
    'automation.webhooks': 'Webhooks',
    'automation.notifications': 'Notifications',
    'automation.templates': 'Templates',
    'automation.history': 'History',
    'automation.connectors': 'Connectors',
    'automation.queues': 'Queues',
    'automation.credentials': 'Credentials',
    'automation.batch': 'Batch',
    'automation.active': 'Active',
    'automation.paused': 'Paused',
    'automation.success_rate': 'Success Rate',
    'automation.no_data': 'No data yet',
  },
};

export type Locale = keyof typeof translations;
export const DEFAULT_LOCALE: Locale = 'pt-BR';
export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en-US'];
