-- ═══════════════════════════════════════════════════════════════
-- Migration 008: Add missing indexes, fix constraints, add columns
--
-- This migration addresses several performance and integrity issues:
--   1. Missing indexes on foreign key columns (causes slow JOINs/deletes)
--   2. Missing composite indexes for common query patterns
--   3. brain_facts.superseded_by FK lacks ON DELETE SET NULL
--   4. datahub_sync_log.entity_mapping_id FK lacks ON DELETE CASCADE
--   5. Missing updated_at columns on brain_decay_alerts and oracle_member_responses
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Missing indexes on foreign keys
-- ─────────────────────────────────────────────────────────────

-- datahub tables
CREATE INDEX IF NOT EXISTS idx_datahub_table_schemas_connection ON public.datahub_table_schemas(connection_id);
CREATE INDEX IF NOT EXISTS idx_datahub_entity_primary_conn ON public.datahub_entity_mappings(primary_connection_id);

-- brain/knowledge graph
CREATE INDEX IF NOT EXISTS idx_brain_relationships_source ON public.brain_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_brain_relationships_target ON public.brain_relationships(target_entity_id);

-- agent feedback and tests
CREATE INDEX IF NOT EXISTS idx_agent_feedback_trace ON public.agent_feedback(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_results_agent ON public.agent_test_results(agent_id, created_at DESC);

-- oracle
CREATE INDEX IF NOT EXISTS idx_oracle_member_responses_query ON public.oracle_member_responses(query_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Composite indexes for common queries
-- ─────────────────────────────────────────────────────────────

-- Agent listing by workspace + status (most common query)
CREATE INDEX IF NOT EXISTS idx_agents_ws_status ON public.agents(workspace_id, status) WHERE deleted_at IS NULL;

-- Execution traces by agent over time
CREATE INDEX IF NOT EXISTS idx_exec_traces_agent_time ON public.agent_execution_traces(agent_id, created_at DESC);

-- DataHub query log filtering
CREATE INDEX IF NOT EXISTS idx_datahub_query_log_src ON public.datahub_query_log(connection_id, query_source, created_at DESC);

-- Evaluation runs by workspace
CREATE INDEX IF NOT EXISTS idx_eval_ws_status ON public.evaluation_runs(workspace_id, status, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. Missing cascade delete on brain_facts self-reference
-- ─────────────────────────────────────────────────────────────

-- Fix cascade on brain_facts superseded_by
ALTER TABLE public.brain_facts
DROP CONSTRAINT IF EXISTS brain_facts_superseded_by_fkey;
ALTER TABLE public.brain_facts
ADD CONSTRAINT brain_facts_superseded_by_fkey
FOREIGN KEY (superseded_by) REFERENCES public.brain_facts(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. Missing cascade on datahub_sync_log
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.datahub_sync_log
DROP CONSTRAINT IF EXISTS datahub_sync_log_entity_mapping_id_fkey;
ALTER TABLE public.datahub_sync_log
ADD CONSTRAINT datahub_sync_log_entity_mapping_id_fkey
FOREIGN KEY (entity_mapping_id) REFERENCES public.datahub_entity_mappings(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 5. Add updated_at columns where missing
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.brain_decay_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.oracle_member_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
