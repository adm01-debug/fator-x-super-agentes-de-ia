
DROP VIEW IF EXISTS public.workspace_members_safe;

CREATE VIEW public.workspace_members_safe AS
SELECT
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.name,
  CASE
    WHEN wm.user_id = auth.uid() THEN wm.email
    WHEN wm.email IS NULL THEN NULL
    ELSE
      LEFT(wm.email, 3) || '***@' || SPLIT_PART(wm.email, '@', 2)
  END AS email,
  wm.invited_at,
  wm.accepted_at
FROM public.workspace_members wm;
