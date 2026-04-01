/**
 * Fatos Institucionais auto-gerados para o Super Cérebro.
 * Baseado nas 19 regras de config_regras_negocio + queries calculadas.
 */

export interface AutoFactFromConfig {
  source: string;
  fact: string;
  domain: string;
}

export interface AutoFactCalculated {
  query: string;
  fact: string;
  domain: string;
  connection?: string;
}

/**
 * Fatos derivados de config_regras_negocio (bancodadosclientes).
 * O placeholder {value} é substituído pelo valor real da configuração.
 */
export const AUTO_FACTS_FROM_CONFIG: AutoFactFromConfig[] = [
  { source: 'DIAS_PARA_INATIVACAO', fact: 'Cliente é considerado inativo após {value} dias sem compra', domain: 'comercial' },
  { source: 'DIAS_ALERTA_INATIVACAO', fact: 'Alerta de risco de inativação é emitido aos {value} dias sem compra', domain: 'comercial' },
  { source: 'DIAS_ALERTA_CRITICO', fact: 'Alerta crítico de inativação aos {value} dias sem compra', domain: 'comercial' },
  { source: 'PESO_SCORE_QUALIDADE', fact: 'Qualidade pesa {value}% no score de fornecedor', domain: 'compras' },
  { source: 'PESO_SCORE_PRECO', fact: 'Preço pesa {value}% no score de fornecedor', domain: 'compras' },
  { source: 'PESO_SCORE_PRAZO', fact: 'Prazo pesa {value}% no score de fornecedor', domain: 'compras' },
  { source: 'PESO_SCORE_ENTREGA', fact: 'Entrega pesa {value}% no score de fornecedor', domain: 'compras' },
  { source: 'HOMOLOGACAO_VALIDADE_DIAS', fact: 'Homologação de fornecedor vale {value} dias', domain: 'compras' },
  { source: 'SUPPLIER_SCORE_ALERTA_BAIXO', fact: 'Fornecedor com score abaixo de {value} recebe alerta negativo', domain: 'compras' },
  { source: 'SUPPLIER_SCORE_DESTAQUE', fact: 'Fornecedor com score acima de {value} recebe destaque positivo', domain: 'compras' },
  { source: 'CARRIER_PESO_PONTUALIDADE', fact: 'Pontualidade pesa {value}% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_CONSERVACAO', fact: 'Conservação pesa {value}% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_PRECO_FRETE', fact: 'Preço do frete pesa {value}% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_COBERTURA', fact: 'Cobertura pesa {value}% no score de transportadora', domain: 'logistica' },
  { source: 'CARRIER_PESO_RASTREAMENTO', fact: 'Rastreamento pesa {value}% no score de transportadora', domain: 'logistica' },
];

/**
 * Fatos calculados automaticamente via queries nos bancos externos.
 * Executados periodicamente para manter o Super Cérebro atualizado.
 */
export const AUTO_FACTS_CALCULATED: AutoFactCalculated[] = [
  { query: "SELECT COUNT(*) FROM companies WHERE is_customer AND status='ativo'", fact: 'Temos {value} clientes ativos', domain: 'comercial' },
  { query: "SELECT COUNT(*) FROM companies WHERE is_supplier AND status='ativo'", fact: 'Temos {value} fornecedores ativos', domain: 'compras' },
  { query: "SELECT COUNT(*) FROM companies WHERE is_carrier AND status='ativo'", fact: 'Temos {value} transportadoras ativas', domain: 'logistica' },
  { query: "SELECT COUNT(*) FROM colaboradores WHERE status='ativo'", fact: 'Temos {value} colaboradores ativos', domain: 'rh', connection: 'gestao_time_promo' },
  { query: 'SELECT COUNT(*) FROM products', fact: 'Temos {value} produtos no catálogo', domain: 'produtos', connection: 'supabase-fuchsia-kite' },
  {
    query: "SELECT COUNT(*) FROM product_variants WHERE EXISTS(SELECT 1 FROM variant_supplier_sources vss WHERE vss.variant_id = product_variants.id AND vss.quantity > 0)",
    fact: '{value} variantes de produto com estoque disponível',
    domain: 'produtos',
    connection: 'supabase-fuchsia-kite',
  },
];

/**
 * Todos os domínios de conhecimento mapeados.
 */
export const KNOWLEDGE_DOMAINS = ['comercial', 'compras', 'logistica', 'rh', 'produtos', 'financeiro'] as const;

export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number];
