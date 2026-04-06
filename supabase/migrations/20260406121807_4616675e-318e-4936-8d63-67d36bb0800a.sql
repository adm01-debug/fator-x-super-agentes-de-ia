
-- Drop the current permissive policy
DROP POLICY IF EXISTS "Members can view workspace colleagues safely" ON public.workspace_members;

-- Own row: full access including email
CREATE POLICY "Members can view own membership full"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Colleagues: only non-sensitive columns via the secure view
-- The base table policy for colleagues allows SELECT but email is masked at view level
CREATE POLICY "Members can view colleague basics"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
);
