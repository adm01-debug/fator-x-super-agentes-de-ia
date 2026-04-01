/**
 * Tabelas que NÃO devem ser sincronizadas pelo DataHub.
 * Baseado na auditoria de 28 queries SQL e 23 gaps identificados.
 */
export const DATAHUB_TABLE_BLACKLIST = new Set([
  // Staging/temporárias
  '_bcb_postos_temp',
  'staging_portal_sicoob',
  'supplier_products_raw',
  'xbz_gallery_staging',
  'import_staging_images',
  'scraper_images_staging',
  'sm_images_staging',
  'sm_worker_partitions',
  'color_analysis_staging',
  '_asia_api_staging',
  'spot_precos_gravacao',
  'spot_extracao_controle',

  // Logs internos
  'image_validation_log',
  'image_import_log',
  'video_import_queue',
  'sync_log',
  'media_sync_log',
  'enrichment_log',
  'api_usage',
  'seo_audit_log',
  'video_validation_log',
  'audit_log',

  // Dados fake
  'sales',
  'clients',

  // Dados inúteis (RFM 100% Hibernating)
  'company_rfm_scores',

  // Gamificação
  'achievements',
  'weekly_challenges',
  'daily_challenges',

  // Pipeline internos
  'import_pipeline_steps',
  'scraper_checkpoints',
  'supplier_import_batches',
]);

/**
 * Verifica se uma tabela está na blacklist.
 */
export function isBlacklisted(tableName: string): boolean {
  return DATAHUB_TABLE_BLACKLIST.has(tableName);
}
