
-- Drop any existing INSERT/UPDATE/DELETE policies on audit_log
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "insert_own_audit" ON public.audit_log;
DROP POLICY IF EXISTS "Allow insert via service" ON public.audit_log;

-- Ensure no UPDATE or DELETE policies exist
DROP POLICY IF EXISTS "update_audit" ON public.audit_log;
DROP POLICY IF EXISTS "delete_audit" ON public.audit_log;

-- Create explicit DENY-style: no INSERT/UPDATE/DELETE policy means RLS blocks those ops
-- The log_audit_entry() function uses SECURITY DEFINER so it bypasses RLS

-- Ensure SELECT policy exists for own records only
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
CREATE POLICY "Users can view own audit logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
