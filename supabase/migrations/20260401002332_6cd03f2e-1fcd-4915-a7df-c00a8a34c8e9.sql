
-- Fix workspace_members: drop the overly permissive self-update policy
DROP POLICY IF EXISTS "Members can update own record" ON public.workspace_members;

-- Recreate with column restriction via a function
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.workspace_members
  SET accepted_at = now()
  WHERE id = p_member_id
    AND user_id = auth.uid()
    AND accepted_at IS NULL;
END;
$$;

-- Verify audit_log has RLS enabled (it should already)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- With only SELECT policy and no INSERT/UPDATE/DELETE policies, 
-- RLS will block those operations for regular users.
-- The log_audit_entry() SECURITY DEFINER function bypasses RLS.
