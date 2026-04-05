
-- 1. Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Owners can view workspace secrets" ON public.workspace_secrets;
DROP POLICY IF EXISTS "Members can view workspace secrets" ON public.workspace_secrets;

-- 2. Create a view that masks the key_value
CREATE OR REPLACE FUNCTION public.get_masked_secrets(p_workspace_id uuid)
RETURNS TABLE(id uuid, key_name text, masked_value text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ws.id,
    ws.key_name,
    CASE 
      WHEN length(ws.key_value) > 4 THEN '••••••••' || right(ws.key_value, 4)
      ELSE '••••••••'
    END AS masked_value,
    ws.created_at,
    ws.updated_at
  FROM public.workspace_secrets ws
  JOIN public.workspaces w ON w.id = ws.workspace_id
  WHERE ws.workspace_id = p_workspace_id
    AND w.owner_id = auth.uid();
$$;

-- 3. Restrictive SELECT: owner can see rows but key_value is still technically accessible
-- So instead, we remove SELECT entirely and force use of the RPC
CREATE POLICY "No direct SELECT on secrets"
ON public.workspace_secrets
FOR SELECT
TO authenticated
USING (false);

-- Keep INSERT/UPDATE/DELETE for owners
DROP POLICY IF EXISTS "Owners can manage workspace secrets" ON public.workspace_secrets;
DROP POLICY IF EXISTS "Owners can create workspace secrets" ON public.workspace_secrets;
DROP POLICY IF EXISTS "Owners can update workspace secrets" ON public.workspace_secrets;
DROP POLICY IF EXISTS "Owners can delete workspace secrets" ON public.workspace_secrets;

CREATE POLICY "Owners can insert secrets"
ON public.workspace_secrets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
);

CREATE POLICY "Owners can update secrets"
ON public.workspace_secrets
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
);

CREATE POLICY "Owners can delete secrets"
ON public.workspace_secrets
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
);
