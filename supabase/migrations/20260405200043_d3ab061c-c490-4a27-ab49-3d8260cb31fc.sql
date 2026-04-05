
-- Create a secure view that masks emails for non-owners
CREATE OR REPLACE VIEW public.workspace_members_safe AS
SELECT 
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.name,
  wm.invited_at,
  wm.accepted_at,
  CASE 
    WHEN wm.user_id = auth.uid() THEN wm.email
    WHEN EXISTS (
      SELECT 1 FROM public.workspaces w 
      WHERE w.id = wm.workspace_id AND w.owner_id = auth.uid()
    ) THEN wm.email
    ELSE CONCAT(LEFT(wm.email, 2), '***@', SPLIT_PART(wm.email, '@', 2))
  END AS email
FROM public.workspace_members wm;

-- Grant access
GRANT SELECT ON public.workspace_members_safe TO authenticated;
