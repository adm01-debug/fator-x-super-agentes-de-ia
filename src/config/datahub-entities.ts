/**
 * Entity Mapping CORRIGIDO com dados reais da auditoria.
 *
 * REGRAS CRÍTICAS:
 * - Filtros usam flags booleanos (is_customer, is_supplier), NÃO coluna "tipo"
 * - Cross-database match por EMAIL (não ID) para colaboradores
 * - CNPJ matching por RAIZ (8 dígitos), não CNPJ completo
 * - Contatos via company_phones, NÃO contacts (97% não tem contacts)
 */

export interface SecondaryMapping {
  table: string;
  join: string;
  fields?: string[];
  aggregate?: 'array' | 'count';
  limit?: number;
  note?: string;
}

export interface CrossDbMapping {
  connection: string;
  table: string;
  match_by: string;
  match_with: string;
  fallback?: string;
  enrich?: string[];
}

export interface EntityMapping {
  name: string;
  icon: string;
  primary: {
    connection: string;
    table: string;
    id_column?: string;
    display_column?: string;
    filter?: string;
  };
  secondary?: SecondaryMapping[];
  cross_db?: CrossDbMapping[];
  group_by?: string;
  exclude_self?: boolean;
  sensitive_fields?: string[];
  note?: string;
}

export const ENTITY_MAPPINGS: Record<string, EntityMapping> = {
  cliente: {
    name: 'Cliente',
    icon: '👤',
    primary: {
      connection: 'bancodadosclientes',
      table: 'companies',
      id_column: 'id',
      display_column: 'razao_social',
      filter: "is_customer = true AND status = 'ativo' AND razao_social IS NOT NULL AND razao_social != ''",
    },
    secondary: [
      { table: 'customers', join: 'company_id = id', fields: ['vendedor_id', 'vendedor_nome'] },
      { table: 'company_addresses', join: 'company_id = id AND is_primary = true', fields: ['cidade', 'estado', 'cep'] },
      { table: 'company_phones', join: 'company_id = id', fields: ['phone'], aggregate: 'array' },
      { table: 'company_emails', join: 'company_id = id', fields: ['email'], aggregate: 'array' },
      { table: 'contacts', join: 'company_id = id', fields: ['nome', 'cargo'], note: 'Apenas 3% têm contacts' },
      { table: 'company_social_media', join: 'company_id = id', fields: ['plataforma', 'url'] },
      { table: 'interactions', join: 'company_id = id', fields: ['type', 'created_at'], limit: 10 },
    ],
    group_by: 'grupo_economico_id',
    cross_db: [
      { connection: 'backupgiftstore', table: 'contacts', match_by: 'phone', match_with: 'company_phones.phone' },
    ],
    exclude_self: true,
  },

  fornecedor: {
    name: 'Fornecedor',
    icon: '🏭',
    primary: {
      connection: 'bancodadosclientes',
      table: 'companies',
      id_column: 'id',
      display_column: 'razao_social',
      filter: "is_supplier = true AND status = 'ativo'",
    },
    secondary: [
      { table: 'suppliers', join: 'company_id = id', fields: ['homologado', 'score_geral', 'data_homologacao'] },
      { table: 'supplier_scores', join: 'supplier_id = suppliers.id', fields: ['score_geral'] },
      { table: 'company_addresses', join: 'company_id = id AND is_primary = true', fields: ['cidade', 'estado'] },
    ],
    cross_db: [
      {
        connection: 'supabase-fuchsia-kite',
        table: 'suppliers',
        match_by: 'cnpj_raiz',
        match_with: 'cnpj_raiz(companies.cnpj)',
        fallback: 'name_fuzzy',
        enrich: ['variant_supplier_sources.quantity', 'variant_supplier_sources.cost_price'],
      },
    ],
    note: '287 empresas são fornecedor E cliente ao mesmo tempo — tratar multi-role',
  },

  transportadora: {
    name: 'Transportadora',
    icon: '🚚',
    primary: {
      connection: 'bancodadosclientes',
      table: 'companies',
      id_column: 'id',
      display_column: 'razao_social',
      filter: "is_carrier = true AND status = 'ativo'",
    },
    secondary: [
      { table: 'carriers', join: 'company_id = id', fields: ['score_geral', 'cobertura_estados'] },
      { table: 'company_addresses', join: 'company_id = id AND is_primary = true', fields: ['cidade', 'estado'] },
    ],
  },

  produto: {
    name: 'Produto',
    icon: '📦',
    primary: {
      connection: 'supabase-fuchsia-kite',
      table: 'products',
      id_column: 'id',
      display_column: 'name',
    },
    secondary: [
      { table: 'product_variants', join: 'product_id = id', fields: ['sku', 'color_name'] },
      { table: 'variant_supplier_sources', join: 'variant_id = product_variants.id', fields: ['quantity', 'cost_price', 'is_preferred'] },
      { table: 'product_images', join: 'product_id = id', fields: ['url', 'type'], limit: 5 },
      { table: 'product_category_assignments', join: 'product_id = id' },
      { table: 'categories', join: 'via product_category_assignments', fields: ['name'] },
      { table: 'print_area_techniques', join: 'product_id = id', fields: ['location_name', 'tabela_preco_id'] },
      { table: 'tabela_preco_gravacao_oficial', join: 'id = print_area_techniques.tabela_preco_id', fields: ['nome', 'cobra_por_cor', 'custo_setup'] },
      { table: 'product_tags', join: 'product_id = id' },
      { table: 'tags', join: 'via product_tags', fields: ['name'] },
    ],
  },

  colaborador: {
    name: 'Colaborador',
    icon: '👨‍💼',
    primary: {
      connection: 'gestao_time_promo',
      table: 'colaboradores',
      id_column: 'id',
      display_column: 'nome_completo',
      filter: "status = 'ativo'",
    },
    secondary: [
      { table: 'departamentos', join: 'id = colaboradores.departamento_id', fields: ['nome'] },
      { table: 'cargos', join: 'id = colaboradores.cargo_id', fields: ['nome', 'nivel'] },
      { table: 'controle_ponto', join: 'colaborador_id = id', fields: ['data', 'total_horas'], limit: 30 },
    ],
    cross_db: [
      {
        connection: 'bancodadosclientes',
        table: 'users',
        match_by: 'email',
        match_with: 'LOWER(colaboradores.email) = LOWER(users.email)',
        enrich: ['users.cargo', 'users.departamento', 'users.is_vendedor'],
      },
    ],
    sensitive_fields: ['cpf', 'salario', 'conta_bancaria', 'pix'],
  },

  conversa_whatsapp: {
    name: 'Conversa WhatsApp',
    icon: '💬',
    primary: {
      connection: 'backupgiftstore',
      table: 'contacts',
      id_column: 'id',
      display_column: 'name',
    },
    secondary: [
      { table: 'messages', join: 'contact_id = id', fields: ['body', 'type', 'timestamp'], limit: 50 },
    ],
    cross_db: [
      {
        connection: 'bancodadosclientes',
        table: 'company_phones',
        match_by: 'phone',
        match_with: 'contacts.phone',
      },
    ],
  },
};

/**
 * Lista de todas as entidades mapeadas.
 */
export const ENTITY_LIST = Object.entries(ENTITY_MAPPINGS).map(([key, mapping]) => ({
  id: key,
  ...mapping,
}));
