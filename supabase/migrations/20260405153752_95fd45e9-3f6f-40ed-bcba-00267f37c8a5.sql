
-- Create a user-facing view of audit_log that excludes ip_address
CREATE VIEW public.audit_log_safe AS
SELECT id, user_id, action, entity_type, entity_id, metadata, created_at
FROM public.audit_log;

-- Grant access to the view
GRANT SELECT ON public.audit_log_safe TO authenticated;

-- Update RLS: restrict audit_log direct SELECT to only the user's own entries (already exists, just ensuring)
-- Drop existing permissive policy if too broad
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Users can read own audit log') THEN
    DROP POLICY "Users can read own audit log" ON public.audit_log;
  END IF;
END
$$;

-- Recreate with strict scope
CREATE POLICY "Users can read own audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
