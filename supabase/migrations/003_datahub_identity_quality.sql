-- ═══════════════════════════════════════════════════
-- NEXUS DATAHUB: Correções da Auditoria (15 falhas)
-- Migration 003 — Identity Resolution + Data Quality
-- ═══════════════════════════════════════════════════

-- Funções de normalização (obrigatórias para cross-database matching)

CREATE OR REPLACE FUNCTION normalize_cnpj(raw TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(COALESCE(raw, ''), '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION cnpj_raiz(raw TEXT)
RETURNS TEXT AS $$
DECLARE clean TEXT;
BEGIN
  clean := REGEXP_REPLACE(COALESCE(raw, ''), '[^0-9]', '', 'g');
  IF LENGTH(clean) >= 8 THEN RETURN LEFT(clean, 8); END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalize_phone(raw TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(COALESCE(raw, ''), '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Identity Resolution Map (cross-database matching)
CREATE TABLE IF NOT EXISTS public.datahub_identity_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person','company','supplier','carrier')),
  canonical_name TEXT NOT NULL,
  crm_company_id UUID,
  crm_contact_id UUID,
  crm_user_id INTEGER,
  rh_colaborador_id UUID,
  catalogo_supplier_id UUID,
  whatsapp_contact_id UUID,
  financeiro_id UUID,
  email_normalizado TEXT,
  cnpj_raiz TEXT,
  cnpj_completo TEXT,
  telefone_normalizado TEXT,
  match_confidence NUMERIC DEFAULT 0,
  match_method TEXT,
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_email ON public.datahub_identity_map(email_normalizado) WHERE email_normalizado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_identity_cnpj_raiz ON public.datahub_identity_map(cnpj_raiz) WHERE cnpj_raiz IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_identity_phone ON public.datahub_identity_map(telefone_normalizado) WHERE telefone_normalizado IS NOT NULL;

-- Data Quality Issues (auto-detected)
CREATE TABLE IF NOT EXISTS public.datahub_quality_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  connection_id UUID REFERENCES public.datahub_connections(id),
  table_name TEXT NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'missing_required_field', 'invalid_format', 'orphan_record',
    'duplicate_record', 'stale_data', 'cross_db_mismatch',
    'no_flag_assigned', 'unresolvable_identity'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  description TEXT NOT NULL,
  affected_records INTEGER DEFAULT 0,
  suggested_fix TEXT,
  resolved BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.datahub_identity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_quality_issues ENABLE ROW LEVEL SECURITY;
