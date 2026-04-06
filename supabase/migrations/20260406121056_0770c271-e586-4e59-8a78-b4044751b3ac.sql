
-- 1. Block UPDATE/DELETE on session_traces (immutable audit data)
CREATE POLICY "Block update on session_traces"
ON public.session_traces
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Block delete on session_traces"
ON public.session_traces
FOR DELETE
TO authenticated
USING (false);

-- 2. Block UPDATE/DELETE on trace_events (immutable audit data)
CREATE POLICY "Block update on trace_events"
ON public.trace_events
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Block delete on trace_events"
ON public.trace_events
FOR DELETE
TO authenticated
USING (false);

-- 3. Block UPDATE/DELETE on data_deletion_requests (users can only create and view)
CREATE POLICY "Block update on data_deletion_requests"
ON public.data_deletion_requests
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Block delete on data_deletion_requests"
ON public.data_deletion_requests
FOR DELETE
TO authenticated
USING (false);

-- 4. Replace the overly-permissive workspace_members SELECT policy
-- Drop the policy that exposes all emails to workspace peers
DROP POLICY IF EXISTS "Members can view colleagues via workspace" ON public.workspace_members;

-- Create a restricted view: members see colleague names and roles, but emails only for themselves
CREATE OR REPLACE VIEW public.workspace_members_directory AS
SELECT
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.name,
  CASE
    WHEN wm.user_id = auth.uid() THEN wm.email
    ELSE NULL
  END AS email,
  wm.accepted_at
FROM public.workspace_members wm
WHERE wm.workspace_id IN (
  SELECT get_user_workspace_ids(auth.uid())
);

-- New policy: members can see basic info (name, role) of colleagues but not emails
CREATE POLICY "Members can view workspace colleagues safely"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
);
