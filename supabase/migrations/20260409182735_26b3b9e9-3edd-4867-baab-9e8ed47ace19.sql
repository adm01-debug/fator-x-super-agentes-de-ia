
-- Fix 1: Remove the permissive colleague policy (the own-membership policy already exists)
DROP POLICY IF EXISTS "Members can view colleague basics" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view own membership full" ON public.workspace_members;

-- Ensure own-membership policy exists (it does, but safe to recreate)
DROP POLICY IF EXISTS "Members can view own membership" ON public.workspace_members;
CREATE POLICY "Members can view own membership"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Recreate workspace_members_directory with SECURITY BARRIER
DROP VIEW IF EXISTS public.workspace_members_directory;
CREATE VIEW public.workspace_members_directory
WITH (security_barrier = true)
AS
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
WHERE wm.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()));

GRANT SELECT ON public.workspace_members_directory TO authenticated;

-- Fix 2: Restrict tool_integrations to owners only
DROP POLICY IF EXISTS "workspace_tool_integrations_select" ON public.tool_integrations;
DROP POLICY IF EXISTS "workspace_tool_integrations_update" ON public.tool_integrations;
DROP POLICY IF EXISTS "workspace_tool_integrations_insert" ON public.tool_integrations;
DROP POLICY IF EXISTS "workspace_tool_integrations_delete" ON public.tool_integrations;

CREATE POLICY "Owners can view tool integrations"
ON public.tool_integrations FOR SELECT TO authenticated
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can insert tool integrations"
ON public.tool_integrations FOR INSERT TO authenticated
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can update tool integrations"
ON public.tool_integrations FOR UPDATE TO authenticated
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can delete tool integrations"
ON public.tool_integrations FOR DELETE TO authenticated
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));
