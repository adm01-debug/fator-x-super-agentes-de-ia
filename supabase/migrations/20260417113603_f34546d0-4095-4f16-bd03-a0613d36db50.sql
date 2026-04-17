CREATE OR REPLACE FUNCTION public.mask_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR position('@' in p_email) = 0 THEN p_email
    ELSE left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
  END;
$$;

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