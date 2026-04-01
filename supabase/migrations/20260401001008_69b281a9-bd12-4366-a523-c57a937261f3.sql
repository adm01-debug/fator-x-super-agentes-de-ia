
-- Fix 1: Add DELETE policy for workspaces (owner only)
CREATE POLICY "Owner can delete workspace"
ON public.workspaces
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Fix 2: Remove duplicate INSERT policy on workspace_members
DROP POLICY IF EXISTS "Admins can insert members" ON public.workspace_members;

-- Fix 3: Add audit_log table for tracking sensitive actions
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own audit logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix 4: Add index on audit_log for fast lookups
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
