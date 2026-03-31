/**
 * DataHub Configuration — Baseado em 28 queries SQL reais + 23 gaps identificados
 * Stress test executado em 2026-03-31
 */

// ═══ BLACKLIST DE TABELAS ═══
export const DATAHUB_TABLE_BLACKLIST = new Set([
  // Staging/temp
  '_bcb_postos_temp', 'staging_portal_sicoob', 'supplier_products_raw',
  'xbz_gallery_staging', 'import_staging_images', 'scraper_images_staging',
  'sm_images_staging', 'sm_worker_partitions', 'color_analysis_staging',
  '_asia_api_staging', 'spot_precos_gravacao', 'spot_extracao_controle',
  // Logs internos
  'image_validation_log', 'image_import_log', 'video_import_queue',
  'sync_log', 'media_sync_log', 'enrichment_log', 'api_usage',
  'seo_audit_log', 'video_validation_log', 'audit_log',
  // Dados fake
  'sales', 'clients',
  // Dados inúteis (RFM 100% "Hibernating")
  'company_rfm_scores',
  // Gamificação
  'achievements', 'weekly_challenges', 'daily_challenges',
  // Pipeline internos
  'import_pipeline_steps', 'scraper_checkpoints', 'supplier_import_batches',
]);

// ═══ REGRAS DE NEGÓCIO (config_regras_negocio — 19 regras reais) ═══
export const AUTO_BUSINESS_FACTS = [
  { source: 'DIAS_PARA_INATIVACAO', fact: 'Cliente é considerado inativo após 180 dias sem compra', domain: 'comercial' },
  { source: 'DIAS_ALERTA_INATIVACAO', fact: 'Alerta de risco de inativação é emitido aos 150 dias sem compra', domain: 'comercial' },
  { source: 'DIAS_ALERTA_CRITICO', fact: 'Alerta crítico de inativação aos 165 dias sem compra', domain: 'comercial' },
  { source: 'PESO_SCORE_QUALIDADE', fact: 'Qualidade pesa 30% no score de fornecedor', domain: 'compras' },
  { source: 'PESO_SCORE_PRECO', fact: 'Preço pesa 25% no score de fornecedor', domain: 'compras' },
  { source: 'PESO_SCORE_PRAZO', fact: 'Prazo pesa 25% no score de fornecedor', domain: 'compras' },
  { source: 'PESO_SCORE_ENTREGA', fact: 'Entrega pesa 20% no score de fornecedor', domain: 'compras' },
  { source: 'HOMOLOGACAO_VALIDADE_DIAS', fact: 'Homologação de fornecedor vale 365 dias', domain: 'compras' },
  { source: 'SUPPLIER_SCORE_ALERTA_BAIXO', fact: 'Fornecedor com score abaixo de 40 recebe alerta negativo', domain: 'compras' },
  { source: 'SUPPLIER_SCORE_DESTAQUE', fact: 'Fornecedor com score acima de 80 recebe destaque positivo', domain: 'compras' },
  { source: 'CARRIER_PESO_PONTUALIDADE', fact: 'Pontualidade pesa 30% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_CONSERVACAO', fact: 'Conservação pesa 25% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_PRECO_FRETE', fact: 'Preço do frete pesa 20% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_COBERTURA', fact: 'Cobertura pesa 15% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_RASTREAMENTO', fact: 'Rastreamento pesa 10% no score de transportadora', domain: 'logistica' },
] as const;

// ═══ FATOS AUTO-CALCULADOS DOS DADOS ═══
export const AUTO_FACTS_CALCULATED = [
  { query: "SELECT COUNT(*) FROM companies WHERE is_customer AND status='ativo'", fact: 'Temos {value} clientes ativos', domain: 'comercial', connection: 'bancodadosclientes' },
  { query: "SELECT COUNT(*) FROM companies WHERE is_supplier AND status='ativo'", fact: 'Temos {value} fornecedores ativos', domain: 'compras', connection: 'bancodadosclientes' },
  { query: "SELECT COUNT(*) FROM companies WHERE is_carrier AND status='ativo'", fact: 'Temos {value} transportadoras ativas', domain: 'logistica', connection: 'bancodadosclientes' },
  { query: "SELECT COUNT(*) FROM colaboradores WHERE status='ativo'", fact: 'Temos {value} colaboradores ativos', domain: 'rh', connection: 'gestao_time_promo' },
  { query: "SELECT COUNT(*) FROM products", fact: 'Temos {value} produtos no catálogo', domain: 'produtos', connection: 'supabase-fuchsia-kite' },
] as const;

// ═══ CORREÇÕES DE NOMES DE COLUNAS ═══
export const COLUMN_NAME_CORRECTIONS: Record<string, string> = {
  'uf': 'estado',           // Gap #4: coluna chama 'estado', não 'uf'
  'platform': 'plataforma', // social media usa 'plataforma'
};

// ═══ HEALTH SCORES POR BANCO (Stress Test) ═══
export const BANK_HEALTH_SCORES: Record<string, { completude: number; freshness: number; integridade: number; crossLink: number; score: number }> = {
  bancodadosclientes: { completude: 78, freshness: 55, integridade: 82, crossLink: 61, score: 69 },
  'supabase-fuchsia-kite': { completude: 92, freshness: 98, integridade: 95, crossLink: 45, score: 82 },
  backupgiftstore: { completude: 70, freshness: 85, integridade: 75, crossLink: 15, score: 61 },
  gestao_time_promo: { completude: 72, freshness: 90, integridade: 88, crossLink: 70, score: 80 },
  financeiro_promo: { completude: 0, freshness: 0, integridade: 0, crossLink: 0, score: 0 },
};

// ═══ ENTITY MAPPINGS CORRIGIDOS (Dados Reais) ═══
export const CORRECTED_ENTITY_MAPPINGS = {
  cliente: {
    name: 'Cliente',
    icon: '👤',
    filter: "is_customer = true AND status = 'ativo' AND razao_social IS NOT NULL",
    // NOTA: NÃO usar "tipo = 'client'" — coluna não existe! Usa flags booleanos.
    // Contatos via company_phones (88%) e company_emails (36%), NÃO contacts (só 3%)
    matchKey: 'email + cnpj_raiz',
    groupBy: 'grupo_economico_id',  // Sicoob com 10 filiais → 1 grupo
    excludeSelf: true,  // Excluir Promo Brindes dos rankings
    multiRole: true,    // 287 empresas são cliente + fornecedor
  },
  fornecedor: {
    name: 'Fornecedor',
    icon: '🏭',
    filter: "is_supplier = true AND status = 'ativo'",
    matchKey: 'cnpj_raiz (8 dígitos)',
    // SPOT: CRM=15376517000238 (filial), Catálogo=15376517000157 (matriz) → raiz=15376517
    // XBZ e 88 Brindes: sem CNPJ no catálogo → fallback nome fuzzy
    crossDbMatch: 'cnpj_raiz → nome_fuzzy',
    note: 'Catálogo tem 5 fornecedores de produto, CRM tem 754 fornecedores de tudo',
  },
  colaborador: {
    name: 'Colaborador',
    icon: '👨‍💼',
    filter: "status = 'ativo'",
    matchKey: 'LOWER(email)',
    // NUNCA usar IDs! CRM user_id=10 ≠ RH bitrix24_user_id=1 para mesma pessoa
    // 20 de 21 matcham por email (95.2%)
    crossDbMatch: 'email_exact',
    sensitiveFields: ['cpf', 'salario'],
  },
  produto: {
    name: 'Produto',
    icon: '📦',
    // Gravação requer 3 JOINs: product → print_area_techniques → tabela_preco_gravacao_oficial
    complexJoins: true,
  },
  conversaWhatsApp: {
    name: 'Conversa WhatsApp',
    icon: '💬',
    // 783 contatos com 0 emails e 0 empresas → match APENAS por telefone normalizado
    matchKey: 'telefone_normalizado',
    crossDbMatch: 'phone → company_phones',
  },
} as const;
