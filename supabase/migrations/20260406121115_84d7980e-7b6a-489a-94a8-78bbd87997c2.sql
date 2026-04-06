
-- Recreate view with SECURITY INVOKER (safe default)
CREATE OR REPLACE VIEW public.workspace_members_directory
WITH (security_invoker = true) AS
SELECT
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.name,
  CASE
    WHEN wm.user_id = auth.uid() THEN wm.email
    ELSE NULL
  END AS email,
  wm.accepted_at
FROM public.workspace_members wm
WHERE wm.workspace_id IN (
  SELECT get_user_workspace_ids(auth.uid())
);
