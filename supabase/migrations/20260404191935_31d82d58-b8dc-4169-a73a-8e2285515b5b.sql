-- Fix tool_integrations SELECT: restrict to workspace owners only (matches INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "tool_integrations_select" ON public.tool_integrations;
CREATE POLICY "tool_integrations_select" ON public.tool_integrations
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  ));

-- Fix deploy_connections SELECT: restrict to workspace owners only (matches INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "deploy_connections_select" ON public.deploy_connections;
CREATE POLICY "deploy_connections_select" ON public.deploy_connections
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  ));