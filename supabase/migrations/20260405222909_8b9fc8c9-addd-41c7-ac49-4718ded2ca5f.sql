
-- Fix tool_integrations: restrict SELECT to workspace owners only (matches INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "tool_integrations_select" ON public.tool_integrations;
CREATE POLICY "tool_integrations_select" ON public.tool_integrations
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  ));

-- Fix workspace_members: restrict colleague email visibility
-- Drop the old permissive policy and create a tighter one
DROP POLICY IF EXISTS "Members can view workspace colleagues" ON public.workspace_members;
CREATE POLICY "Members can view workspace colleagues" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  );
