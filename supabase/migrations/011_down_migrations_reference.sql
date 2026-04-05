-- ═══════════════════════════════════════════════════════════════
-- REFERENCE: Down migrations for rollback (migrations 001-009)
-- Execute ONLY the section needed for the specific migration to rollback.
-- Sections must be rolled back in REVERSE order (009 first, then 008, etc.)
-- WARNING: This file is NOT executed automatically.
-- ═══════════════════════════════════════════════════════════════


-- === DOWN 009: knowledge_chunks_vector ===

DROP POLICY IF EXISTS "kb_chunks_workspace" ON public.knowledge_base_chunks;
DROP INDEX IF EXISTS idx_kb_chunks_embedding;
DROP INDEX IF EXISTS idx_kb_chunks_kb;
DROP TABLE IF EXISTS public.knowledge_base_chunks CASCADE;
-- Note: DROP EXTENSION vector is omitted to avoid breaking other dependents


-- === DOWN 008: add_indexes_and_constraints ===

-- Remove added columns
ALTER TABLE public.oracle_member_responses DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.brain_decay_alerts DROP COLUMN IF EXISTS updated_at;

-- Restore original FK on datahub_sync_log (no CASCADE)
ALTER TABLE public.datahub_sync_log DROP CONSTRAINT IF EXISTS datahub_sync_log_entity_mapping_id_fkey;
ALTER TABLE public.datahub_sync_log
  ADD CONSTRAINT datahub_sync_log_entity_mapping_id_fkey
  FOREIGN KEY (entity_mapping_id) REFERENCES public.datahub_entity_mappings(id);

-- Restore original FK on brain_facts (no ON DELETE SET NULL)
ALTER TABLE public.brain_facts DROP CONSTRAINT IF EXISTS brain_facts_superseded_by_fkey;
ALTER TABLE public.brain_facts
  ADD CONSTRAINT brain_facts_superseded_by_fkey
  FOREIGN KEY (superseded_by) REFERENCES public.brain_facts(id);

-- Drop composite indexes
DROP INDEX IF EXISTS idx_eval_ws_status;
DROP INDEX IF EXISTS idx_datahub_query_log_src;
DROP INDEX IF EXISTS idx_exec_traces_agent_time;
DROP INDEX IF EXISTS idx_agents_ws_status;

-- Drop FK indexes
DROP INDEX IF EXISTS idx_oracle_member_responses_query;
DROP INDEX IF EXISTS idx_agent_test_results_agent;
DROP INDEX IF EXISTS idx_agent_feedback_trace;
DROP INDEX IF EXISTS idx_brain_relationships_target;
DROP INDEX IF EXISTS idx_brain_relationships_source;
DROP INDEX IF EXISTS idx_datahub_entity_primary_conn;
DROP INDEX IF EXISTS idx_datahub_table_schemas_connection;


-- === DOWN 007: fix_rls_policies ===

-- Drop datahub_access_policies policies
DROP POLICY IF EXISTS "datahub_access_policies_delete" ON public.datahub_access_policies;
DROP POLICY IF EXISTS "datahub_access_policies_update" ON public.datahub_access_policies;
DROP POLICY IF EXISTS "datahub_access_policies_insert" ON public.datahub_access_policies;
DROP POLICY IF EXISTS "datahub_access_policies_select" ON public.datahub_access_policies;

-- Drop datahub_sync_log policies
DROP POLICY IF EXISTS "datahub_sync_log_insert" ON public.datahub_sync_log;
DROP POLICY IF EXISTS "datahub_sync_log_select" ON public.datahub_sync_log;

-- Drop datahub_query_log policies
DROP POLICY IF EXISTS "datahub_query_log_insert" ON public.datahub_query_log;
DROP POLICY IF EXISTS "datahub_query_log_select" ON public.datahub_query_log;

-- Drop datahub_table_schemas policies
DROP POLICY IF EXISTS "datahub_table_schemas_delete" ON public.datahub_table_schemas;
DROP POLICY IF EXISTS "datahub_table_schemas_update" ON public.datahub_table_schemas;
DROP POLICY IF EXISTS "datahub_table_schemas_insert" ON public.datahub_table_schemas;
DROP POLICY IF EXISTS "datahub_table_schemas_select" ON public.datahub_table_schemas;

-- Drop datahub_identity_map policies
DROP POLICY IF EXISTS "datahub_identity_map_delete" ON public.datahub_identity_map;
DROP POLICY IF EXISTS "datahub_identity_map_update" ON public.datahub_identity_map;
DROP POLICY IF EXISTS "datahub_identity_map_insert" ON public.datahub_identity_map;
DROP POLICY IF EXISTS "datahub_identity_map_select" ON public.datahub_identity_map;

-- Drop datahub_quality_issues policies
DROP POLICY IF EXISTS "datahub_quality_issues_delete" ON public.datahub_quality_issues;
DROP POLICY IF EXISTS "datahub_quality_issues_update" ON public.datahub_quality_issues;
DROP POLICY IF EXISTS "datahub_quality_issues_insert" ON public.datahub_quality_issues;
DROP POLICY IF EXISTS "datahub_quality_issues_select" ON public.datahub_quality_issues;

-- Drop datahub_saved_queries policies
DROP POLICY IF EXISTS "datahub_saved_queries_delete" ON public.datahub_saved_queries;
DROP POLICY IF EXISTS "datahub_saved_queries_update" ON public.datahub_saved_queries;
DROP POLICY IF EXISTS "datahub_saved_queries_insert" ON public.datahub_saved_queries;
DROP POLICY IF EXISTS "datahub_saved_queries_select" ON public.datahub_saved_queries;

-- Drop datahub_entity_mappings policies
DROP POLICY IF EXISTS "datahub_entity_mappings_delete" ON public.datahub_entity_mappings;
DROP POLICY IF EXISTS "datahub_entity_mappings_update" ON public.datahub_entity_mappings;
DROP POLICY IF EXISTS "datahub_entity_mappings_insert" ON public.datahub_entity_mappings;
DROP POLICY IF EXISTS "datahub_entity_mappings_select" ON public.datahub_entity_mappings;

-- Drop datahub_connections policies
DROP POLICY IF EXISTS "datahub_connections_delete" ON public.datahub_connections;
DROP POLICY IF EXISTS "datahub_connections_update" ON public.datahub_connections;
DROP POLICY IF EXISTS "datahub_connections_insert" ON public.datahub_connections;
DROP POLICY IF EXISTS "datahub_connections_select" ON public.datahub_connections;

-- Drop replacement workspace_secrets policies and restore original
DROP POLICY IF EXISTS "ws_secrets_delete" ON public.workspace_secrets;
DROP POLICY IF EXISTS "ws_secrets_update" ON public.workspace_secrets;
DROP POLICY IF EXISTS "ws_secrets_insert" ON public.workspace_secrets;
DROP POLICY IF EXISTS "ws_secrets_select" ON public.workspace_secrets;
-- Restore original from 005:
-- CREATE POLICY "secrets_admin" ON public.workspace_secrets FOR ALL USING (
--   workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'admin')
-- );

-- Drop replacement agents_select and restore 005 version
DROP POLICY IF EXISTS "agents_select" ON public.agents;
-- Restore from 005:
-- CREATE POLICY "agents_select" ON public.agents FOR SELECT USING (
--   deleted_at IS NULL AND (user_id = auth.uid() OR workspace_id IN (
--     SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
--   ))
-- );


-- === DOWN 006: database_manager ===

DROP POLICY IF EXISTS "db_op_log_ws" ON public.db_operation_log;
DROP POLICY IF EXISTS "discovered_functions_ws" ON public.db_discovered_functions;
DROP POLICY IF EXISTS "discovered_tables_ws" ON public.db_discovered_tables;
DROP POLICY IF EXISTS "connected_dbs_ws" ON public.connected_databases;

DROP INDEX IF EXISTS idx_db_op_log;
DROP INDEX IF EXISTS idx_discovered_tables_db;
DROP INDEX IF EXISTS idx_connected_dbs_ws;

DROP TRIGGER IF EXISTS connected_dbs_updated ON public.connected_databases;

DROP TABLE IF EXISTS public.db_operation_log CASCADE;
DROP TABLE IF EXISTS public.db_discovered_functions CASCADE;
DROP TABLE IF EXISTS public.db_discovered_tables CASCADE;
DROP TABLE IF EXISTS public.connected_databases CASCADE;


-- === DOWN 005: workspaces_secrets_kb ===

-- Drop view
DROP VIEW IF EXISTS public.workspace_secrets_safe;

-- Drop policies for new tables
DROP POLICY IF EXISTS "eval_ws" ON public.evaluation_runs;
DROP POLICY IF EXISTS "kb_ws" ON public.knowledge_bases;
DROP POLICY IF EXISTS "secrets_admin" ON public.workspace_secrets;

-- Drop indexes
DROP INDEX IF EXISTS idx_kb_workspace;
DROP INDEX IF EXISTS idx_eval_agent;

-- Drop new tables
DROP TRIGGER IF EXISTS kb_updated_at ON public.knowledge_bases;
DROP TRIGGER IF EXISTS secrets_updated_at ON public.workspace_secrets;
DROP TABLE IF EXISTS public.evaluation_runs CASCADE;
DROP TABLE IF EXISTS public.knowledge_bases CASCADE;
DROP TABLE IF EXISTS public.workspace_secrets CASCADE;

-- Revert agents columns
ALTER TABLE public.agents DROP COLUMN IF EXISTS config_version;
ALTER TABLE public.agents DROP COLUMN IF EXISTS deleted_at;
-- Note: workspace_id column added here references workspaces; dropping column:
-- ALTER TABLE public.agents DROP COLUMN IF EXISTS workspace_id;
-- (careful: column existed before but as untyped; 005 adds FK to workspaces)

-- Drop unique active prompt index
DROP INDEX IF EXISTS idx_one_active_prompt;

-- Drop trace/usage workspace columns
ALTER TABLE public.agent_usage DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.agent_traces DROP COLUMN IF EXISTS workspace_id;

-- Drop agents policies added in 005
DROP POLICY IF EXISTS "agents_delete" ON public.agents;
DROP POLICY IF EXISTS "agents_update" ON public.agents;
DROP POLICY IF EXISTS "agents_insert" ON public.agents;
DROP POLICY IF EXISTS "agents_select" ON public.agents;
-- Restore original 001 policies:
-- CREATE POLICY "Users see own agents" ON public.agents FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users create own agents" ON public.agents FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users update own agents" ON public.agents FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users delete own agents" ON public.agents FOR DELETE USING (auth.uid() = user_id);

-- Drop workspace member policies and indexes
DROP POLICY IF EXISTS "wm_admin_manage" ON public.workspace_members;
DROP POLICY IF EXISTS "wm_colleagues" ON public.workspace_members;
DROP POLICY IF EXISTS "wm_self" ON public.workspace_members;
DROP INDEX IF EXISTS idx_wm_workspace;
DROP INDEX IF EXISTS idx_wm_user;

-- Drop workspace policies
DROP POLICY IF EXISTS "ws_member_select" ON public.workspaces;
DROP POLICY IF EXISTS "ws_owner_all" ON public.workspaces;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS agents_updated_at ON public.agents;
DROP INDEX IF EXISTS idx_agents_not_deleted;

-- Drop workspaces table
DROP TABLE IF EXISTS public.workspaces CASCADE;

-- Drop utility function
DROP FUNCTION IF EXISTS public.get_user_workspace_id();
-- Note: update_updated_at was redefined in 005 but originally created in 001


-- === DOWN 004: super_cerebro_oraculo ===

-- Drop indexes
DROP INDEX IF EXISTS idx_oracle_queries_ws;
DROP INDEX IF EXISTS idx_brain_entities_type;
DROP INDEX IF EXISTS idx_brain_facts_confidence;
DROP INDEX IF EXISTS idx_brain_facts_domain;

-- Drop oracle tables (leaf first)
DROP TABLE IF EXISTS public.oracle_member_responses CASCADE;
DROP TABLE IF EXISTS public.oracle_queries CASCADE;
DROP TABLE IF EXISTS public.oracle_presets CASCADE;
DROP TABLE IF EXISTS public.oracle_configs CASCADE;

-- Drop brain tables (leaf first)
DROP TABLE IF EXISTS public.brain_sandbox_tests CASCADE;
DROP TABLE IF EXISTS public.brain_decay_alerts CASCADE;
DROP TABLE IF EXISTS public.brain_relationships CASCADE;
DROP TABLE IF EXISTS public.brain_entities CASCADE;
DROP TABLE IF EXISTS public.brain_facts CASCADE;
DROP TABLE IF EXISTS public.brain_collections CASCADE;


-- === DOWN 003: datahub_identity_quality ===

DROP TABLE IF EXISTS public.datahub_quality_issues CASCADE;

DROP INDEX IF EXISTS idx_identity_phone;
DROP INDEX IF EXISTS idx_identity_cnpj_raiz;
DROP INDEX IF EXISTS idx_identity_email;
DROP TABLE IF EXISTS public.datahub_identity_map CASCADE;

DROP FUNCTION IF EXISTS normalize_phone(TEXT);
DROP FUNCTION IF EXISTS cnpj_raiz(TEXT);
DROP FUNCTION IF EXISTS normalize_cnpj(TEXT);


-- === DOWN 002: datahub_tables ===

-- Drop indexes
DROP INDEX IF EXISTS idx_datahub_table_schemas_conn;
DROP INDEX IF EXISTS idx_datahub_query_log_ts;
DROP INDEX IF EXISTS idx_datahub_connections_ws;

-- Drop tables (leaf first, respecting FK order)
DROP TABLE IF EXISTS public.datahub_access_policies CASCADE;
DROP TABLE IF EXISTS public.datahub_sync_log CASCADE;
DROP TABLE IF EXISTS public.datahub_query_log CASCADE;
DROP TABLE IF EXISTS public.datahub_saved_queries CASCADE;
DROP TABLE IF EXISTS public.datahub_entity_mappings CASCADE;
DROP TABLE IF EXISTS public.datahub_table_schemas CASCADE;
DROP TABLE IF EXISTS public.datahub_connections CASCADE;


-- === DOWN 001: initial_schema ===

-- Drop triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.agents;
DROP FUNCTION IF EXISTS update_updated_at();

-- Drop policies
DROP POLICY IF EXISTS "Users see own permissions" ON public.agent_permissions;
DROP POLICY IF EXISTS "Members see own workspace" ON public.workspace_members;
DROP POLICY IF EXISTS "Users manage own feedback" ON public.agent_feedback;
DROP POLICY IF EXISTS "Users see own execution traces" ON public.agent_execution_traces;
DROP POLICY IF EXISTS "Users manage own test results" ON public.agent_test_results;
DROP POLICY IF EXISTS "Public templates" ON public.agent_templates;
DROP POLICY IF EXISTS "Users see own usage" ON public.agent_usage;
DROP POLICY IF EXISTS "Users see own traces" ON public.agent_traces;
DROP POLICY IF EXISTS "Users manage own prompt versions" ON public.prompt_versions;
DROP POLICY IF EXISTS "Users delete own agents" ON public.agents;
DROP POLICY IF EXISTS "Users update own agents" ON public.agents;
DROP POLICY IF EXISTS "Users create own agents" ON public.agents;
DROP POLICY IF EXISTS "Users see own agents" ON public.agents;

-- Drop indexes
DROP INDEX IF EXISTS idx_exec_traces_created;
DROP INDEX IF EXISTS idx_exec_traces_session;
DROP INDEX IF EXISTS idx_exec_traces_agent;
DROP INDEX IF EXISTS idx_usage_agent_date;
DROP INDEX IF EXISTS idx_traces_created;
DROP INDEX IF EXISTS idx_traces_session;
DROP INDEX IF EXISTS idx_traces_agent;
DROP INDEX IF EXISTS idx_prompt_versions_agent;
DROP INDEX IF EXISTS idx_agents_template;
DROP INDEX IF EXISTS idx_agents_status;
DROP INDEX IF EXISTS idx_agents_workspace;
DROP INDEX IF EXISTS idx_agents_user;

-- Drop tables (leaf first, respecting FK order)
DROP TABLE IF EXISTS public.agent_execution_traces CASCADE;
DROP TABLE IF EXISTS public.agent_feedback CASCADE;
DROP TABLE IF EXISTS public.agent_permissions CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.agent_test_results CASCADE;
DROP TABLE IF EXISTS public.agent_templates CASCADE;
DROP TABLE IF EXISTS public.agent_usage CASCADE;
DROP TABLE IF EXISTS public.agent_traces CASCADE;
DROP TABLE IF EXISTS public.prompt_versions CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;

-- Drop enums
DROP TYPE IF EXISTS trace_level;
DROP TYPE IF EXISTS agent_status;

-- Drop extensions (use caution — may affect other schemas)
-- DROP EXTENSION IF EXISTS "pg_trgm";
-- DROP EXTENSION IF EXISTS "pgvector";
