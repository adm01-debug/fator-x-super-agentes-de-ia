
-- Remove duplicate INSERT policy
DROP POLICY IF EXISTS "Owners can add workspace members" ON public.workspace_members;

-- Tighten SELECT: members see co-members of their workspaces
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
  )
);
