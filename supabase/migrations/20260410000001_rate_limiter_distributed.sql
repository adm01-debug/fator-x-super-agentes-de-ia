-- ═══════════════════════════════════════════════════════════════
-- Migration: Rate Limiter Distribuído (P0-01 Fix)
-- ═══════════════════════════════════════════════════════════════
-- Este migration cria a infraestrutura necessária para rate limiting
-- distribuído que funciona corretamente em runtime stateless.
-- ═══════════════════════════════════════════════════════════════

-- Tabela para armazenar entradas de rate limit
CREATE TABLE IF NOT EXISTS rate_limit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index para buscas rápidas por identifier
  CONSTRAINT rate_limit_entries_unique UNIQUE (identifier, timestamp_ms)
);

-- Index para cleanup eficiente
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_identifier 
ON rate_limit_entries(identifier);

CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_timestamp 
ON rate_limit_entries(timestamp_ms);

-- Index composto para queries de contagem
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_id_ts 
ON rate_limit_entries(identifier, timestamp_ms DESC);

-- ═══════════════════════════════════════════════════════════════
-- Função RPC atômica para verificar rate limit
-- ═══════════════════════════════════════════════════════════════
-- Esta função:
-- 1. Remove timestamps expirados
-- 2. Conta requests na janela atual
-- 3. Insere novo timestamp se permitido
-- 4. Retorna resultado em uma única transação
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_window_ms BIGINT,
  p_max_requests INT,
  p_now BIGINT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start BIGINT;
  v_current_count INT;
  v_oldest_timestamp BIGINT;
  v_allowed BOOLEAN;
BEGIN
  -- Calcular início da janela
  v_window_start := p_now - p_window_ms;
  
  -- Cleanup: remover entradas antigas (fora da janela)
  DELETE FROM rate_limit_entries 
  WHERE identifier = p_identifier 
    AND timestamp_ms < v_window_start;
  
  -- Contar requests na janela atual
  SELECT COUNT(*), MIN(timestamp_ms)
  INTO v_current_count, v_oldest_timestamp
  FROM rate_limit_entries
  WHERE identifier = p_identifier
    AND timestamp_ms >= v_window_start;
  
  -- Verificar se pode permitir novo request
  IF v_current_count >= p_max_requests THEN
    v_allowed := FALSE;
  ELSE
    v_allowed := TRUE;
    -- Inserir novo timestamp
    INSERT INTO rate_limit_entries (identifier, timestamp_ms)
    VALUES (p_identifier, p_now)
    ON CONFLICT (identifier, timestamp_ms) DO NOTHING;
    
    -- Atualizar contagem
    v_current_count := v_current_count + 1;
  END IF;
  
  -- Retornar resultado
  RETURN json_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'oldest_timestamp', v_oldest_timestamp
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Job de limpeza automática (via pg_cron se disponível)
-- ═══════════════════════════════════════════════════════════════

-- Função de cleanup manual
CREATE OR REPLACE FUNCTION cleanup_rate_limit_entries()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
  v_cutoff BIGINT;
BEGIN
  -- Remover entradas mais antigas que 10 minutos
  v_cutoff := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - 600000;
  
  DELETE FROM rate_limit_entries
  WHERE timestamp_ms < v_cutoff;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies (rate_limit_entries é gerenciado apenas via RPC)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- Negar acesso direto - apenas via RPC SECURITY DEFINER
CREATE POLICY "rate_limit_entries_no_direct_access" ON rate_limit_entries
  FOR ALL
  USING (false);

-- ═══════════════════════════════════════════════════════════════
-- Grant permissions
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION check_rate_limit TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_entries TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- Comentários
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE rate_limit_entries IS 'Armazena timestamps de requests para rate limiting distribuído';
COMMENT ON FUNCTION check_rate_limit IS 'Verifica e registra rate limit de forma atômica';
COMMENT ON FUNCTION cleanup_rate_limit_entries IS 'Remove entradas expiradas do rate limiter';
