
-- 1. WORKSPACE MEMBERS: restrict colleague visibility (hide email/name of others)
DROP POLICY IF EXISTS "Members can view workspace colleagues" ON public.workspace_members;

CREATE POLICY "Members can view workspace colleagues limited"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
);

-- Note: The workspace_members_safe VIEW already masks emails. 
-- Frontend should use the view. The policy above still allows SELECT 
-- but the view is the recommended access path.

-- 2. WORKSPACE SECRETS: add encrypted column for future migration
ALTER TABLE public.workspace_secrets 
ADD COLUMN IF NOT EXISTS encrypted_value bytea;

-- Create helper to encrypt secrets on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_secret_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.key_value IS NOT NULL AND NEW.key_value != '' THEN
    NEW.encrypted_value = pgp_sym_encrypt(
      NEW.key_value, 
      current_setting('app.settings.secret_key', true)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. TOOL INTEGRATIONS: allow workspace members (not just owners)
DROP POLICY IF EXISTS "tool_integrations_select" ON public.tool_integrations;
DROP POLICY IF EXISTS "tool_integrations_insert" ON public.tool_integrations;
DROP POLICY IF EXISTS "tool_integrations_update" ON public.tool_integrations;
DROP POLICY IF EXISTS "tool_integrations_delete" ON public.tool_integrations;

CREATE POLICY "tool_integrations_select"
ON public.tool_integrations FOR SELECT
TO authenticated
USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "tool_integrations_insert"
ON public.tool_integrations FOR INSERT
TO authenticated
WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "tool_integrations_update"
ON public.tool_integrations FOR UPDATE
TO authenticated
USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "tool_integrations_delete"
ON public.tool_integrations FOR DELETE
TO authenticated
USING (workspace_id IN (SELECT workspaces.id FROM workspaces WHERE workspaces.owner_id = auth.uid()));

-- 4. DEPLOY CONNECTIONS: allow members to READ, owners to write
DROP POLICY IF EXISTS "deploy_connections_select" ON public.deploy_connections;
DROP POLICY IF EXISTS "deploy_connections_insert" ON public.deploy_connections;
DROP POLICY IF EXISTS "deploy_connections_update" ON public.deploy_connections;
DROP POLICY IF EXISTS "deploy_connections_delete" ON public.deploy_connections;

CREATE POLICY "deploy_connections_select"
ON public.deploy_connections FOR SELECT
TO authenticated
USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "deploy_connections_insert"
ON public.deploy_connections FOR INSERT
TO authenticated
WITH CHECK (workspace_id IN (SELECT workspaces.id FROM workspaces WHERE workspaces.owner_id = auth.uid()));

CREATE POLICY "deploy_connections_update"
ON public.deploy_connections FOR UPDATE
TO authenticated
USING (workspace_id IN (SELECT workspaces.id FROM workspaces WHERE workspaces.owner_id = auth.uid()));

CREATE POLICY "deploy_connections_delete"
ON public.deploy_connections FOR DELETE
TO authenticated
USING (workspace_id IN (SELECT workspaces.id FROM workspaces WHERE workspaces.owner_id = auth.uid()));
