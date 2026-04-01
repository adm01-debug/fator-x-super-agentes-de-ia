/**
 * Catálogo completo de funções PostgreSQL/Supabase disponíveis
 * Organizadas por categoria para referência rápida no Database Manager
 */

export interface PgFunction {
  name: string;
  syntax: string;
  description: string;
  example: string;
  category: string;
}

export const PG_FUNCTION_CATEGORIES = [
  { id: 'uuid', label: '🔑 UUID & Identificadores', color: '#4D96FF' },
  { id: 'date', label: '📅 Data e Hora', color: '#6BCB77' },
  { id: 'text', label: '📝 Texto e Strings', color: '#FFD93D' },
  { id: 'math', label: '🔢 Matemática', color: '#FF6B6B' },
  { id: 'json', label: '📦 JSON/JSONB', color: '#9B59B6' },
  { id: 'aggregate', label: '📊 Agregação', color: '#E67E22' },
  { id: 'array', label: '📋 Arrays', color: '#2EC4B6' },
  { id: 'conditional', label: '🔀 Condicionais', color: '#D4A574' },
  { id: 'crypto', label: '🔒 Criptografia', color: '#FF6B6B' },
  { id: 'supabase', label: '⚡ Supabase Específicas', color: '#4D96FF' },
  { id: 'trigger', label: '⚙️ Triggers', color: '#888888' },
  { id: 'rls', label: '🛡️ Row Level Security', color: '#6BCB77' },
] as const;

export const PG_FUNCTIONS_CATALOG: PgFunction[] = [
  // ═══ UUID & IDENTIFICADORES ═══
  { category: 'uuid', name: 'gen_random_uuid()', syntax: 'gen_random_uuid()', description: 'Gera UUID v4 aleatório', example: "DEFAULT gen_random_uuid()" },
  { category: 'uuid', name: 'uuid_generate_v4()', syntax: 'uuid_generate_v4()', description: 'Gera UUID v4 (requer extensão uuid-ossp)', example: "SELECT uuid_generate_v4()" },

  // ═══ DATA E HORA ═══
  { category: 'date', name: 'NOW()', syntax: 'NOW()', description: 'Data/hora atual com timezone', example: "DEFAULT NOW()" },
  { category: 'date', name: 'CURRENT_DATE', syntax: 'CURRENT_DATE', description: 'Data atual (sem hora)', example: "WHERE date = CURRENT_DATE" },
  { category: 'date', name: 'CURRENT_TIMESTAMP', syntax: 'CURRENT_TIMESTAMP', description: 'Timestamp atual', example: "DEFAULT CURRENT_TIMESTAMP" },
  { category: 'date', name: 'AGE()', syntax: 'AGE(timestamp, timestamp)', description: 'Diferença entre duas datas', example: "SELECT AGE(NOW(), created_at)" },
  { category: 'date', name: 'DATE_TRUNC()', syntax: "DATE_TRUNC('month', timestamp)", description: 'Trunca data para precisão', example: "DATE_TRUNC('day', created_at)" },
  { category: 'date', name: 'EXTRACT()', syntax: "EXTRACT(field FROM timestamp)", description: 'Extrai campo de data (year, month, day, hour)', example: "EXTRACT(YEAR FROM created_at)" },
  { category: 'date', name: 'TO_CHAR()', syntax: "TO_CHAR(timestamp, 'format')", description: 'Formata data como texto', example: "TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI')" },
  { category: 'date', name: 'INTERVAL', syntax: "INTERVAL '30 days'", description: 'Intervalo de tempo para cálculos', example: "WHERE created_at > NOW() - INTERVAL '30 days'" },

  // ═══ TEXTO E STRINGS ═══
  { category: 'text', name: 'LOWER()', syntax: 'LOWER(text)', description: 'Converte para minúsculas', example: "WHERE LOWER(email) = 'admin@test.com'" },
  { category: 'text', name: 'UPPER()', syntax: 'UPPER(text)', description: 'Converte para maiúsculas', example: "SELECT UPPER(name)" },
  { category: 'text', name: 'TRIM()', syntax: 'TRIM(text)', description: 'Remove espaços das pontas', example: "UPDATE t SET name = TRIM(name)" },
  { category: 'text', name: 'LENGTH()', syntax: 'LENGTH(text)', description: 'Comprimento da string', example: "WHERE LENGTH(cnpj) = 14" },
  { category: 'text', name: 'SUBSTRING()', syntax: 'SUBSTRING(text FROM start FOR length)', description: 'Extrai parte da string', example: "SUBSTRING(cnpj FROM 1 FOR 8)" },
  { category: 'text', name: 'REPLACE()', syntax: "REPLACE(text, 'from', 'to')", description: 'Substitui texto', example: "REPLACE(phone, '-', '')" },
  { category: 'text', name: 'CONCAT()', syntax: "CONCAT(str1, str2, ...)", description: 'Concatena strings', example: "CONCAT(first_name, ' ', last_name)" },
  { category: 'text', name: 'SPLIT_PART()', syntax: "SPLIT_PART(string, delimiter, position)", description: 'Divide string e pega parte', example: "SPLIT_PART(email, '@', 2)" },
  { category: 'text', name: 'REGEXP_REPLACE()', syntax: "REGEXP_REPLACE(text, pattern, replacement)", description: 'Substitui com regex', example: "REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g')" },
  { category: 'text', name: 'LEFT()', syntax: 'LEFT(text, n)', description: 'Primeiros N caracteres', example: "LEFT(cnpj_normalizado, 8)" },
  { category: 'text', name: 'RIGHT()', syntax: 'RIGHT(text, n)', description: 'Últimos N caracteres', example: "RIGHT(api_key, 4)" },
  { category: 'text', name: 'ILIKE', syntax: "column ILIKE '%pattern%'", description: 'Busca case-insensitive', example: "WHERE cidade ILIKE '%rio verde%'" },
  { category: 'text', name: 'SIMILARITY()', syntax: 'SIMILARITY(str1, str2)', description: 'Similaridade entre strings (0-1, requer pg_trgm)', example: "WHERE SIMILARITY(name, 'Promo') > 0.3" },

  // ═══ MATEMÁTICA ═══
  { category: 'math', name: 'ROUND()', syntax: 'ROUND(numeric, decimals)', description: 'Arredonda número', example: "ROUND(price * 1.1, 2)" },
  { category: 'math', name: 'CEIL()', syntax: 'CEIL(numeric)', description: 'Arredonda para cima', example: "CEIL(quantity / 10.0)" },
  { category: 'math', name: 'FLOOR()', syntax: 'FLOOR(numeric)', description: 'Arredonda para baixo', example: "FLOOR(discount_pct)" },
  { category: 'math', name: 'ABS()', syntax: 'ABS(numeric)', description: 'Valor absoluto', example: "ABS(balance)" },
  { category: 'math', name: 'RANDOM()', syntax: 'RANDOM()', description: 'Número aleatório 0-1', example: "ORDER BY RANDOM() LIMIT 10" },
  { category: 'math', name: 'GREATEST()', syntax: 'GREATEST(val1, val2, ...)', description: 'Maior valor entre vários', example: "GREATEST(score_a, score_b, score_c)" },
  { category: 'math', name: 'LEAST()', syntax: 'LEAST(val1, val2, ...)', description: 'Menor valor entre vários', example: "LEAST(price, max_price)" },

  // ═══ JSON/JSONB ═══
  { category: 'json', name: "->", syntax: "jsonb_col -> 'key'", description: 'Acessa chave JSON (retorna JSON)', example: "config -> 'memory'" },
  { category: 'json', name: "->>", syntax: "jsonb_col ->> 'key'", description: 'Acessa chave JSON (retorna TEXT)', example: "config ->> 'name'" },
  { category: 'json', name: "jsonb_build_object()", syntax: "jsonb_build_object('key', value)", description: 'Cria objeto JSON', example: "jsonb_build_object('name', 'test', 'active', true)" },
  { category: 'json', name: "jsonb_array_elements()", syntax: "jsonb_array_elements(jsonb)", description: 'Expande array JSON em rows', example: "SELECT jsonb_array_elements(config -> 'tools')" },
  { category: 'json', name: "jsonb_typeof()", syntax: "jsonb_typeof(jsonb)", description: 'Tipo do valor JSON', example: "CHECK (jsonb_typeof(config) = 'object')" },
  { category: 'json', name: "jsonb_set()", syntax: "jsonb_set(jsonb, path, new_value)", description: 'Atualiza valor dentro de JSON', example: "jsonb_set(config, '{model}', '\"gpt-4o\"')" },
  { category: 'json', name: "||", syntax: "jsonb1 || jsonb2", description: 'Merge dois JSONBs', example: "config || '{\"version\": 2}'::jsonb" },

  // ═══ AGREGAÇÃO ═══
  { category: 'aggregate', name: 'COUNT()', syntax: 'COUNT(*) ou COUNT(column)', description: 'Conta registros', example: "SELECT COUNT(*) FROM agents WHERE status = 'active'" },
  { category: 'aggregate', name: 'SUM()', syntax: 'SUM(column)', description: 'Soma valores', example: "SELECT SUM(total_cost) FROM agent_usage" },
  { category: 'aggregate', name: 'AVG()', syntax: 'AVG(column)', description: 'Média dos valores', example: "SELECT AVG(latency_ms) FROM agent_traces" },
  { category: 'aggregate', name: 'MIN() / MAX()', syntax: 'MIN(col) / MAX(col)', description: 'Menor/maior valor', example: "SELECT MIN(created_at), MAX(created_at) FROM agents" },
  { category: 'aggregate', name: 'STRING_AGG()', syntax: "STRING_AGG(column, ', ')", description: 'Concatena valores com separador', example: "SELECT STRING_AGG(tag, ', ') FROM unnest(tags) tag" },
  { category: 'aggregate', name: 'ARRAY_AGG()', syntax: 'ARRAY_AGG(column)', description: 'Agrega em array', example: "SELECT ARRAY_AGG(DISTINCT status) FROM agents" },

  // ═══ ARRAYS ═══
  { category: 'array', name: 'ARRAY[]', syntax: "ARRAY['a', 'b', 'c']", description: 'Cria array literal', example: "DEFAULT ARRAY[]::TEXT[]" },
  { category: 'array', name: 'ANY()', syntax: "value = ANY(array_column)", description: 'Valor está no array?', example: "WHERE 'admin' = ANY(roles)" },
  { category: 'array', name: 'array_length()', syntax: 'array_length(array, 1)', description: 'Tamanho do array', example: "WHERE array_length(tags, 1) > 3" },
  { category: 'array', name: 'unnest()', syntax: 'unnest(array)', description: 'Expande array em rows', example: "SELECT unnest(tags) AS tag FROM agents" },
  { category: 'array', name: 'array_append()', syntax: 'array_append(array, value)', description: 'Adiciona ao array', example: "UPDATE agents SET tags = array_append(tags, 'new_tag')" },

  // ═══ CONDICIONAIS ═══
  { category: 'conditional', name: 'CASE', syntax: "CASE WHEN cond THEN val ELSE val END", description: 'Condicional (if/else)', example: "CASE WHEN status = 'active' THEN 'Ativo' ELSE 'Inativo' END" },
  { category: 'conditional', name: 'COALESCE()', syntax: 'COALESCE(val1, val2, ...)', description: 'Primeiro valor não-NULL', example: "COALESCE(name, email, 'Sem nome')" },
  { category: 'conditional', name: 'NULLIF()', syntax: 'NULLIF(val1, val2)', description: 'Retorna NULL se iguais', example: "NULLIF(status, 'draft')" },

  // ═══ CRIPTOGRAFIA ═══
  { category: 'crypto', name: 'crypt()', syntax: "crypt('password', gen_salt('bf'))", description: 'Hash de senha bcrypt (requer pgcrypto)', example: "crypt(password, gen_salt('bf', 10))" },
  { category: 'crypto', name: 'digest()', syntax: "digest('data', 'sha256')", description: 'Hash SHA-256 (requer pgcrypto)', example: "encode(digest(content, 'sha256'), 'hex')" },
  { category: 'crypto', name: 'gen_salt()', syntax: "gen_salt('bf')", description: 'Gera salt para bcrypt', example: "gen_salt('bf', 12)" },

  // ═══ SUPABASE ESPECÍFICAS ═══
  { category: 'supabase', name: 'auth.uid()', syntax: 'auth.uid()', description: 'ID do usuário logado (para RLS)', example: "WHERE user_id = auth.uid()" },
  { category: 'supabase', name: 'auth.jwt()', syntax: 'auth.jwt()', description: 'JWT completo do usuário logado', example: "auth.jwt() ->> 'email'" },
  { category: 'supabase', name: 'auth.role()', syntax: 'auth.role()', description: 'Role do usuário (anon, authenticated)', example: "USING (auth.role() = 'authenticated')" },
  { category: 'supabase', name: 'storage.foldername()', syntax: 'storage.foldername(name)', description: 'Extrai pasta de caminho no Storage', example: "storage.foldername(name)" },
  { category: 'supabase', name: 'extensions.vector', syntax: "column vector(1536)", description: 'Tipo vetor para embeddings (pgvector)', example: "embedding vector(1536)" },
  { category: 'supabase', name: 'extensions.http', syntax: "http_get(url)", description: 'Chamada HTTP (requer pg_net)', example: "SELECT http_get('https://api.example.com')" },

  // ═══ TRIGGERS ═══
  { category: 'trigger', name: 'CREATE TRIGGER', syntax: "CREATE TRIGGER name BEFORE|AFTER INSERT|UPDATE|DELETE ON table FOR EACH ROW EXECUTE FUNCTION func()", description: 'Cria trigger automático', example: "CREATE TRIGGER updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at()" },
  { category: 'trigger', name: 'NEW / OLD', syntax: 'NEW.column / OLD.column', description: 'Referência ao registro novo/antigo dentro de trigger', example: "NEW.updated_at = NOW(); RETURN NEW;" },

  // ═══ RLS ═══
  { category: 'rls', name: 'ENABLE RLS', syntax: 'ALTER TABLE t ENABLE ROW LEVEL SECURITY', description: 'Ativa RLS na tabela', example: "ALTER TABLE agents ENABLE ROW LEVEL SECURITY" },
  { category: 'rls', name: 'CREATE POLICY', syntax: "CREATE POLICY name ON table FOR SELECT USING (condition)", description: 'Cria política de acesso', example: "CREATE POLICY 'users_own' ON agents FOR ALL USING (user_id = auth.uid())" },
  { category: 'rls', name: 'FORCE RLS', syntax: 'ALTER TABLE t FORCE ROW LEVEL SECURITY', description: 'Força RLS mesmo para table owners', example: "ALTER TABLE agents FORCE ROW LEVEL SECURITY" },
];
