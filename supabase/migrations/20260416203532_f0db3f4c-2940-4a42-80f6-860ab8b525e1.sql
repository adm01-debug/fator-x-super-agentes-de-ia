-- Fix UPDATE escalation path
DROP POLICY IF EXISTS "Workspace admins can update roles" ON public.user_roles;
CREATE POLICY "Workspace admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (
    public.is_workspace_admin(auth.uid(), workspace_id)
    AND role_key <> 'workspace_admin'
    AND EXISTS (SELECT 1 FROM public.roles WHERE key = role_key AND is_active = true)
  );

-- Scope public→authenticated for admin-only tables
DROP POLICY IF EXISTS "ws admins manage ip_whitelist" ON public.ip_whitelist;
CREATE POLICY "ws admins manage ip_whitelist"
  ON public.ip_whitelist
  FOR ALL
  TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "ws admins manage geo countries" ON public.geo_allowed_countries;
CREATE POLICY "ws admins manage geo countries"
  ON public.geo_allowed_countries
  FOR ALL
  TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));