/**
 * Tabelas que NÃO devem ser sincronizadas para o Super Cérebro.
 * Baseado no stress test de 28 queries SQL reais (2026-03-31).
 */
export const DATAHUB_TABLE_BLACKLIST = [
  // Staging/temp
  '_bcb_postos_temp', 'staging_portal_sicoob', 'supplier_products_raw',
  'xbz_gallery_staging', 'import_staging_images', 'scraper_images_staging',
  'sm_images_staging', 'sm_worker_partitions', 'color_analysis_staging',
  '_asia_api_staging', 'spot_precos_gravacao', 'spot_extracao_controle',
  // Logs internos
  'image_validation_log', 'image_import_log', 'video_import_queue',
  'sync_log', 'media_sync_log', 'enrichment_log', 'api_usage',
  // Dados fake/inúteis
  'sales', // dados fake (João Silva, Plano Premium)
  'company_rfm_scores', // 100% "Hibernating" — scores inúteis, recalcular primeiro
  // Gamificação (não é dado de negócio)
  'achievements', 'weekly_challenges', 'daily_challenges',
] as const;

/**
 * Regras de negócio reais extraídas de config_regras_negocio (19 regras).
 * Devem ser ingeridas como Fatos Institucionais no Super Cérebro.
 */
export const AUTO_BUSINESS_FACTS = [
  'Cliente é inativado após 180 dias sem interação (DIAS_PARA_INATIVACAO=180)',
  'Alerta de inativação é emitido aos 150 dias (DIAS_ALERTA_INATIVACAO=150)',
  'Alerta crítico de inativação aos 165 dias (DIAS_ALERTA_CRITICO=165)',
  'Score de fornecedor: Qualidade 30%, Preço 25%, Prazo 25%, Entrega 20%',
  'Homologação de fornecedor vale 365 dias (HOMOLOGACAO_VALIDADE_DIAS=365)',
  'Alerta de score baixo de fornecedor: threshold 40/100',
  'Score de transportadora: Pontualidade 30% do peso total',
] as const;

/**
 * Correções de nomes de colunas (stress test gap #4, #10).
 * O CRM usa nomes em português que diferem do esperado.
 */
export const COLUMN_NAME_CORRECTIONS: Record<string, string> = {
  'uf': 'estado',           // Gap #4: coluna chama 'estado', não 'uf'
  'platform': 'plataforma', // Gap #10: social media usa 'plataforma'
  'nome_crm': 'nome_crm',  // Não é 'name'
};

/**
 * Health scores por banco (stress test results).
 */
export const BANK_HEALTH_SCORES: Record<string, { completude: number; freshness: number; integridade: number; crossLink: number; score: number }> = {
  bancodadosclientes: { completude: 78, freshness: 55, integridade: 82, crossLink: 61, score: 69 },
  'supabase-fuchsia-kite': { completude: 92, freshness: 98, integridade: 95, crossLink: 45, score: 82 },
  backupgiftstore: { completude: 70, freshness: 85, integridade: 75, crossLink: 15, score: 61 },
  gestao_time_promo: { completude: 72, freshness: 90, integridade: 88, crossLink: 70, score: 80 },
  financeiro_promo: { completude: 0, freshness: 0, integridade: 0, crossLink: 0, score: 0 },
};
