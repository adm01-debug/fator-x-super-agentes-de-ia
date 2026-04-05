-- Fix tool_integrations: allow all workspace members to SELECT (not just owner)
DROP POLICY IF EXISTS "tool_integrations_select" ON public.tool_integrations;
CREATE POLICY "tool_integrations_select" ON public.tool_integrations
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- Clean duplicate workspace_secrets policies (keep the "Admins can ..." versions, drop "Owners can ...")
DROP POLICY IF EXISTS "Owners can delete secrets" ON public.workspace_secrets;
DROP POLICY IF EXISTS "Owners can insert secrets" ON public.workspace_secrets;
DROP POLICY IF EXISTS "Owners can update secrets" ON public.workspace_secrets;

-- Clean duplicate audit_log SELECT policy
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;