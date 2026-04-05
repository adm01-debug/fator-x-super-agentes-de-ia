
-- Fix: Change view to SECURITY INVOKER (default, safe)
DROP VIEW IF EXISTS public.audit_log_safe;

CREATE VIEW public.audit_log_safe 
WITH (security_invoker = true)
AS
SELECT id, user_id, action, entity_type, entity_id, metadata, created_at
FROM public.audit_log;

GRANT SELECT ON public.audit_log_safe TO authenticated;
