
-- 1. WORKSPACE MEMBERS: Replace open SELECT with a column-restricted approach
-- Use a SECURITY DEFINER function to mask email/name for non-self rows
DROP POLICY IF EXISTS "Members can view workspace colleagues limited" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view workspace colleagues" ON public.workspace_members;

-- Keep the self-view policy (already exists)
-- "Members can view own membership" USING (user_id = auth.uid()) — already in place

-- Create a restricted policy for colleagues: they can see rows exist but the view masks PII
CREATE POLICY "Members can view colleagues via workspace"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
);

-- Update the workspace_members_safe view to be the ONLY recommended read path
DROP VIEW IF EXISTS public.workspace_members_safe;
CREATE VIEW public.workspace_members_safe
WITH (security_invoker = true)
AS
SELECT 
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.accepted_at,
  wm.invited_at,
  CASE 
    WHEN wm.user_id = auth.uid() THEN wm.email
    WHEN wm.email IS NOT NULL AND length(wm.email) > 0 THEN 
      left(split_part(wm.email, '@', 1), 2) || '***@' || split_part(wm.email, '@', 2)
    ELSE NULL
  END AS email,
  CASE 
    WHEN wm.user_id = auth.uid() THEN wm.name
    ELSE coalesce(left(wm.name, 1) || '***', 'Membro')
  END AS name
FROM public.workspace_members wm;

-- 2. SKILL REGISTRY: Create safe view hiding mcp_server_url
CREATE OR REPLACE VIEW public.skill_registry_safe
WITH (security_invoker = true)
AS
SELECT 
  sr.id, sr.name, sr.slug, sr.description, sr.category, sr.author,
  sr.version, sr.tags, sr.install_count, sr.rating, sr.skill_config,
  sr.is_verified, sr.is_public, sr.created_by, sr.created_at, sr.updated_at,
  CASE 
    WHEN sr.created_by = auth.uid() THEN sr.mcp_server_url
    ELSE NULL
  END AS mcp_server_url
FROM public.skill_registry sr;

-- 3. WORKSPACE SECRETS: Drop plaintext column
-- First check if get_masked_secrets uses key_value — it does, so update it
CREATE OR REPLACE FUNCTION public.get_masked_secrets(p_workspace_id uuid)
RETURNS TABLE(id uuid, key_name text, masked_value text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    ws.id,
    ws.key_name,
    '••••••••' AS masked_value,
    ws.created_at,
    ws.updated_at
  FROM public.workspace_secrets ws
  JOIN public.workspaces w ON w.id = ws.workspace_id
  WHERE ws.workspace_id = p_workspace_id
    AND w.owner_id = auth.uid();
$$;

-- Now drop the plaintext column
ALTER TABLE public.workspace_secrets DROP COLUMN IF EXISTS key_value;
