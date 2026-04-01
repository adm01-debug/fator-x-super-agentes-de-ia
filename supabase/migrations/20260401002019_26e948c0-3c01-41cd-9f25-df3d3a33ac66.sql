
-- Remove the insecure client-side INSERT policy
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_log;

-- Create a SECURITY DEFINER function for audit logging
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$;
