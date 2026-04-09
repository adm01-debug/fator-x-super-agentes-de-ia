
-- Re-add the colleague visibility policy (needed for the directory view to work)
CREATE POLICY "Members can view workspace colleagues"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

-- The directory view with security_invoker=true will now work since users
-- can see colleagues via the policy above, but email is masked in the view.
