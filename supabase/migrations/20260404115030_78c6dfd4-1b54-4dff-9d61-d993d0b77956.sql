
-- 1. Create SECURITY DEFINER function to get workspace IDs without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = _user_id
  UNION
  SELECT id
  FROM public.workspaces
  WHERE owner_id = _user_id
$$;

-- Revoke public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_workspace_ids TO authenticated;

-- 2. Drop the recursive SELECT policy
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;

-- 3. Create new non-recursive SELECT policy
CREATE POLICY "Members can view workspace members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);
