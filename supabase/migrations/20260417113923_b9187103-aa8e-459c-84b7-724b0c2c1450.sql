-- 1) Remove policy que expunha colegas (com email) a qualquer membro
DROP POLICY IF EXISTS "Members can view workspace colleagues" ON public.workspace_members;

-- 2) Adiciona policy só para admins/donos verem todos os membros
CREATE POLICY "Admins can view all workspace members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- "Members can view own membership" continua existindo

-- 3) Recria view como SECURITY DEFINER (bypass RLS) — emails mascarados protegem PII
DROP VIEW IF EXISTS public.workspace_members_safe;

CREATE VIEW public.workspace_members_safe
WITH (security_invoker = false)
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
FROM public.workspace_members wm
WHERE wm.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()));

GRANT SELECT ON public.workspace_members_safe TO authenticated;