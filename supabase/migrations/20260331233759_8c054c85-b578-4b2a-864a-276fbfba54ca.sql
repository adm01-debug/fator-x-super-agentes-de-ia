-- Fix 1: Restrict workspace_members email visibility to owners only
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view own workspace members"
ON public.workspace_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR workspace_id IN (
    SELECT ws.id FROM workspaces ws WHERE ws.owner_id = auth.uid()
  )
);

-- Fix 2: Replace overly permissive template policy
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.agents;
CREATE POLICY "Authenticated users can view templates"
ON public.agents FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (is_template = true AND workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ))
);