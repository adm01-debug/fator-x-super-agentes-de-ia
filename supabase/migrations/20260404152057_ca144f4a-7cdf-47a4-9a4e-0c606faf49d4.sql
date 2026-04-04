
-- ═══ deploy_connections: restrict write to workspace owners ═══
DROP POLICY IF EXISTS "deploy_connections_all" ON public.deploy_connections;

-- SELECT: any workspace member can read
CREATE POLICY "deploy_connections_select"
ON public.deploy_connections FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- INSERT: only workspace owners
CREATE POLICY "deploy_connections_insert"
ON public.deploy_connections FOR INSERT TO authenticated
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- UPDATE: only workspace owners
CREATE POLICY "deploy_connections_update"
ON public.deploy_connections FOR UPDATE TO authenticated
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- DELETE: only workspace owners
CREATE POLICY "deploy_connections_delete"
ON public.deploy_connections FOR DELETE TO authenticated
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- ═══ tool_integrations: restrict write to workspace owners ═══
DROP POLICY IF EXISTS "tool_integrations_all" ON public.tool_integrations;

-- SELECT: any workspace member can read
CREATE POLICY "tool_integrations_select"
ON public.tool_integrations FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- INSERT: only workspace owners
CREATE POLICY "tool_integrations_insert"
ON public.tool_integrations FOR INSERT TO authenticated
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- UPDATE: only workspace owners
CREATE POLICY "tool_integrations_update"
ON public.tool_integrations FOR UPDATE TO authenticated
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- DELETE: only workspace owners
CREATE POLICY "tool_integrations_delete"
ON public.tool_integrations FOR DELETE TO authenticated
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));
