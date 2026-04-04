
-- ============================================================
-- Replace all inline workspace_members subqueries with get_user_workspace_ids()
-- ============================================================

-- === agent_memories ===
DROP POLICY IF EXISTS "Users can manage memories in their workspace" ON public.agent_memories;
CREATE POLICY "Users can manage memories in their workspace" ON public.agent_memories FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === alerts ===
DROP POLICY IF EXISTS "alerts_all" ON public.alerts;
CREATE POLICY "alerts_all" ON public.alerts FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === budgets ===
DROP POLICY IF EXISTS "budgets_all" ON public.budgets;
CREATE POLICY "budgets_all" ON public.budgets FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === environments ===
DROP POLICY IF EXISTS "environments_all" ON public.environments;
CREATE POLICY "environments_all" ON public.environments FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === evaluation_datasets ===
DROP POLICY IF EXISTS "evaluation_datasets_all" ON public.evaluation_datasets;
CREATE POLICY "evaluation_datasets_all" ON public.evaluation_datasets FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === evaluation_runs ===
DROP POLICY IF EXISTS "evals_workspace_select" ON public.evaluation_runs;
DROP POLICY IF EXISTS "evals_workspace_insert" ON public.evaluation_runs;
DROP POLICY IF EXISTS "evals_workspace_update" ON public.evaluation_runs;
DROP POLICY IF EXISTS "evals_workspace_delete" ON public.evaluation_runs;
CREATE POLICY "evals_workspace_all" ON public.evaluation_runs FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === guardrail_policies ===
DROP POLICY IF EXISTS "guardrail_policies_all" ON public.guardrail_policies;
CREATE POLICY "guardrail_policies_all" ON public.guardrail_policies FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === knowledge_bases ===
DROP POLICY IF EXISTS "kb_workspace_select" ON public.knowledge_bases;
DROP POLICY IF EXISTS "kb_workspace_insert" ON public.knowledge_bases;
DROP POLICY IF EXISTS "kb_workspace_update" ON public.knowledge_bases;
DROP POLICY IF EXISTS "kb_workspace_delete" ON public.knowledge_bases;
CREATE POLICY "kb_workspace_all" ON public.knowledge_bases FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === tool_integrations ===
DROP POLICY IF EXISTS "tool_integrations_all" ON public.tool_integrations;
CREATE POLICY "tool_integrations_all" ON public.tool_integrations FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === usage_records ===
DROP POLICY IF EXISTS "usage_records_all" ON public.usage_records;
CREATE POLICY "usage_records_all" ON public.usage_records FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === workflows ===
DROP POLICY IF EXISTS "workflows_all" ON public.workflows;
CREATE POLICY "workflows_all" ON public.workflows FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === workflow_steps (nested via workflows) ===
DROP POLICY IF EXISTS "workflow_steps_all" ON public.workflow_steps;
CREATE POLICY "workflow_steps_all" ON public.workflow_steps FOR ALL TO authenticated
  USING (workflow_id IN (SELECT w.id FROM workflows w WHERE w.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))
  WITH CHECK (workflow_id IN (SELECT w.id FROM workflows w WHERE w.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- === workflow_runs (nested via workflows) ===
DROP POLICY IF EXISTS "Members can manage workflow runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Members can view workflow runs" ON public.workflow_runs;
CREATE POLICY "workflow_runs_all" ON public.workflow_runs FOR ALL TO authenticated
  USING (workflow_id IN (SELECT w.id FROM workflows w WHERE w.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))
  WITH CHECK (workflow_id IN (SELECT w.id FROM workflows w WHERE w.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- === collections (nested via knowledge_bases) ===
DROP POLICY IF EXISTS "collections_all" ON public.collections;
CREATE POLICY "collections_all" ON public.collections FOR ALL TO authenticated
  USING (knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))
  WITH CHECK (knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- === documents (nested via collections → knowledge_bases) ===
DROP POLICY IF EXISTS "documents_all" ON public.documents;
CREATE POLICY "documents_all" ON public.documents FOR ALL TO authenticated
  USING (collection_id IN (SELECT col.id FROM collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))))
  WITH CHECK (collection_id IN (SELECT col.id FROM collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))));

-- === chunks (nested via documents → collections → knowledge_bases) ===
DROP POLICY IF EXISTS "chunks_all" ON public.chunks;
CREATE POLICY "chunks_all" ON public.chunks FOR ALL TO authenticated
  USING (document_id IN (SELECT doc.id FROM documents doc WHERE doc.collection_id IN (SELECT col.id FROM collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))))
  WITH CHECK (document_id IN (SELECT doc.id FROM documents doc WHERE doc.collection_id IN (SELECT col.id FROM collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))));

-- === vector_indexes (nested via knowledge_bases) ===
DROP POLICY IF EXISTS "vector_indexes_all" ON public.vector_indexes;
CREATE POLICY "vector_indexes_all" ON public.vector_indexes FOR ALL TO authenticated
  USING (knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))
  WITH CHECK (knowledge_base_id IN (SELECT kb.id FROM knowledge_bases kb WHERE kb.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- === test_cases (nested via evaluation_datasets) ===
DROP POLICY IF EXISTS "test_cases_all" ON public.test_cases;
CREATE POLICY "test_cases_all" ON public.test_cases FOR ALL TO authenticated
  USING (dataset_id IN (SELECT ed.id FROM evaluation_datasets ed WHERE ed.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))
  WITH CHECK (dataset_id IN (SELECT ed.id FROM evaluation_datasets ed WHERE ed.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- === deploy_connections ===
DROP POLICY IF EXISTS "Members can manage deploy connections" ON public.deploy_connections;
DROP POLICY IF EXISTS "Members can view deploy connections" ON public.deploy_connections;
CREATE POLICY "deploy_connections_all" ON public.deploy_connections FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- === tool_policies (via agents → workspace_members) ===
DROP POLICY IF EXISTS "Users can manage tool policies for their agents" ON public.tool_policies;
DROP POLICY IF EXISTS "tool_policies_all" ON public.tool_policies;
CREATE POLICY "tool_policies_all" ON public.tool_policies FOR ALL TO authenticated
  USING (agent_id IN (SELECT a.id FROM agents a WHERE a.user_id = auth.uid() OR a.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))))
  WITH CHECK (agent_id IN (SELECT a.id FROM agents a WHERE a.user_id = auth.uid() OR a.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- === agents (SELECT policy that references workspace_members) ===
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.agents;
CREATE POLICY "Authenticated users can view templates" ON public.agents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (is_template = true AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- === workspaces (SELECT policy references workspace_members) ===
DROP POLICY IF EXISTS "Users see own workspaces" ON public.workspaces;
CREATE POLICY "Users see own workspaces" ON public.workspaces FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id IN (SELECT public.get_user_workspace_ids(auth.uid())));
