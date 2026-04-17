DROP VIEW IF EXISTS public.workspace_members_safe;

CREATE VIEW public.workspace_members_safe
WITH (security_invoker = true)
AS
SELECT
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.name,
  CASE
    WHEN wm.user_id = auth.uid() THEN wm.email
    WHEN public.is_workspace_admin(auth.uid(), wm.workspace_id) THEN wm.email
    ELSE public.mask_email(wm.email)
  END AS email,
  wm.invited_at,
  wm.accepted_at
FROM public.workspace_members wm;

GRANT SELECT ON public.workspace_members_safe TO authenticated;

-- Re-adiciona policy para membros verem linhas dos colegas no mesmo workspace
-- (a coluna email permanece bloqueada via REVOKE column-level; a view mascara)
CREATE POLICY "Members can view workspace colleagues"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));