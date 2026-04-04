-- ═══════════════════════════════════════════════════
-- FIX: RLS Policy corrections
-- Migration 007 — Workspace isolation + missing policies
-- ═══════════════════════════════════════════════════

-- ───────────────────────────────────────────────────
-- FIX 1: Workspace isolation breach in agents table
-- The old SELECT policy used OR logic (user_id = auth.uid() OR workspace_id IN ...)
-- which allowed users to see agents they created even after leaving the workspace.
-- Fix: only workspace membership controls visibility.
-- ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "agents_select" ON public.agents;

CREATE POLICY "agents_select" ON public.agents FOR SELECT USING (
  deleted_at IS NULL AND workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- ───────────────────────────────────────────────────
-- FIX 2: Replace overly broad workspace_secrets policy
-- Old policy: single FOR ALL restricted to admin only.
-- New: granular per-operation policies with appropriate role checks.
-- ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "secrets_admin" ON public.workspace_secrets;

-- All workspace members can read secrets (needed for agent execution)
CREATE POLICY "ws_secrets_select" ON public.workspace_secrets FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Admins and editors can create secrets
CREATE POLICY "ws_secrets_insert" ON public.workspace_secrets FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);

-- Only admins can update secrets
CREATE POLICY "ws_secrets_update" ON public.workspace_secrets FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete secrets
CREATE POLICY "ws_secrets_delete" ON public.workspace_secrets FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ───────────────────────────────────────────────────
-- FIX 3: Missing RLS policies on datahub tables
-- RLS was enabled in migrations 002 and 003 but no policies were created,
-- meaning default-deny blocks all non-service-role access.
-- ───────────────────────────────────────────────────

-- datahub_connections (has workspace_id)
CREATE POLICY "datahub_connections_select" ON public.datahub_connections FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "datahub_connections_insert" ON public.datahub_connections FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_connections_update" ON public.datahub_connections FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_connections_delete" ON public.datahub_connections FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- datahub_entity_mappings (has workspace_id)
CREATE POLICY "datahub_entity_mappings_select" ON public.datahub_entity_mappings FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "datahub_entity_mappings_insert" ON public.datahub_entity_mappings FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_entity_mappings_update" ON public.datahub_entity_mappings FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_entity_mappings_delete" ON public.datahub_entity_mappings FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- datahub_saved_queries (has workspace_id)
CREATE POLICY "datahub_saved_queries_select" ON public.datahub_saved_queries FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "datahub_saved_queries_insert" ON public.datahub_saved_queries FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_saved_queries_update" ON public.datahub_saved_queries FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_saved_queries_delete" ON public.datahub_saved_queries FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- datahub_quality_issues (has workspace_id — from migration 003)
CREATE POLICY "datahub_quality_issues_select" ON public.datahub_quality_issues FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "datahub_quality_issues_insert" ON public.datahub_quality_issues FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_quality_issues_update" ON public.datahub_quality_issues FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_quality_issues_delete" ON public.datahub_quality_issues FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- datahub_identity_map (has workspace_id — from migration 003)
CREATE POLICY "datahub_identity_map_select" ON public.datahub_identity_map FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "datahub_identity_map_insert" ON public.datahub_identity_map FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_identity_map_update" ON public.datahub_identity_map FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_identity_map_delete" ON public.datahub_identity_map FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- datahub_table_schemas (no workspace_id — scoped via connection_id join)
CREATE POLICY "datahub_table_schemas_select" ON public.datahub_table_schemas FOR SELECT USING (
  connection_id IN (
    SELECT c.id FROM public.datahub_connections c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
  )
);
CREATE POLICY "datahub_table_schemas_insert" ON public.datahub_table_schemas FOR INSERT WITH CHECK (
  connection_id IN (
    SELECT c.id FROM public.datahub_connections c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_table_schemas_update" ON public.datahub_table_schemas FOR UPDATE USING (
  connection_id IN (
    SELECT c.id FROM public.datahub_connections c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'editor')
  )
);
CREATE POLICY "datahub_table_schemas_delete" ON public.datahub_table_schemas FOR DELETE USING (
  connection_id IN (
    SELECT c.id FROM public.datahub_connections c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
  )
);

-- datahub_query_log (no workspace_id — scoped via connection_id join)
CREATE POLICY "datahub_query_log_select" ON public.datahub_query_log FOR SELECT USING (
  connection_id IN (
    SELECT c.id FROM public.datahub_connections c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
  )
);
CREATE POLICY "datahub_query_log_insert" ON public.datahub_query_log FOR INSERT WITH CHECK (
  connection_id IN (
    SELECT c.id FROM public.datahub_connections c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
  )
);

-- datahub_sync_log (no workspace_id — scoped via entity_mapping_id join)
CREATE POLICY "datahub_sync_log_select" ON public.datahub_sync_log FOR SELECT USING (
  entity_mapping_id IN (
    SELECT em.id FROM public.datahub_entity_mappings em
    JOIN public.workspace_members wm ON wm.workspace_id = em.workspace_id
    WHERE wm.user_id = auth.uid()
  )
);
CREATE POLICY "datahub_sync_log_insert" ON public.datahub_sync_log FOR INSERT WITH CHECK (
  entity_mapping_id IN (
    SELECT em.id FROM public.datahub_entity_mappings em
    JOIN public.workspace_members wm ON wm.workspace_id = em.workspace_id
    WHERE wm.user_id = auth.uid()
  )
);

-- datahub_access_policies (has workspace_id)
CREATE POLICY "datahub_access_policies_select" ON public.datahub_access_policies FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "datahub_access_policies_insert" ON public.datahub_access_policies FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "datahub_access_policies_update" ON public.datahub_access_policies FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "datahub_access_policies_delete" ON public.datahub_access_policies FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
