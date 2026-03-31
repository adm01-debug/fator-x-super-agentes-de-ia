
-- Fix 1: Restrict workspace_secrets SELECT to owners only
DROP POLICY IF EXISTS "Members can view workspace secrets" ON public.workspace_secrets;
CREATE POLICY "Owners can view workspace secrets"
ON public.workspace_secrets FOR SELECT
TO authenticated
USING (workspace_id IN (
  SELECT ws.id FROM workspaces ws WHERE ws.owner_id = auth.uid()
));

-- Fix 2: Restrict agent templates to authenticated users only
DROP POLICY IF EXISTS "Anyone can view templates" ON public.agents;
CREATE POLICY "Authenticated users can view templates"
ON public.agents FOR SELECT
TO authenticated
USING (is_template = true);
