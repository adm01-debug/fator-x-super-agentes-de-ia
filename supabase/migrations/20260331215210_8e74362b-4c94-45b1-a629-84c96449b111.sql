
-- Knowledge bases: allow workspace members to update and delete
CREATE POLICY "kb_workspace_update" ON public.knowledge_bases
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "kb_workspace_delete" ON public.knowledge_bases
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Evaluation runs: allow workspace members to update and delete
CREATE POLICY "evals_workspace_update" ON public.evaluation_runs
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "evals_workspace_delete" ON public.evaluation_runs
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Workspace members: admins can update and delete
CREATE POLICY "Admins can update members" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can delete members" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

-- Agent templates: creators can update and delete their own
CREATE POLICY "templates_update" ON public.agent_templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "templates_delete" ON public.agent_templates
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
