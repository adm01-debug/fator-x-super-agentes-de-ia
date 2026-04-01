
-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Workspace owners can add members" ON public.workspace_members;

-- Recreate INSERT: only workspace owners can add members, AND the inserted user_id cannot be the inserter themselves (prevent self-add to others' workspaces)
CREATE POLICY "Workspace owners can add members"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

-- Add UPDATE policy: members can update their own record (e.g. accept invitation)
DROP POLICY IF EXISTS "Members can update own record" ON public.workspace_members;
CREATE POLICY "Members can update own record"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
