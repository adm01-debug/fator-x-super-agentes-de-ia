
DROP POLICY IF EXISTS "Workspace admins can update roles (no self)" ON public.user_roles;
CREATE POLICY "Workspace admins can update roles (no self)"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_workspace_admin(auth.uid(), workspace_id)
  AND user_id <> auth.uid()
  AND role_key <> 'workspace_admin'
)
WITH CHECK (
  public.is_workspace_admin(auth.uid(), workspace_id)
  AND user_id <> auth.uid()
  AND role_key <> 'workspace_admin'
);

DROP POLICY IF EXISTS "Workspace admins can remove roles" ON public.user_roles;
CREATE POLICY "Workspace admins can remove roles (no admin rows)"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_workspace_admin(auth.uid(), workspace_id)
  AND role_key <> 'workspace_admin'
);
