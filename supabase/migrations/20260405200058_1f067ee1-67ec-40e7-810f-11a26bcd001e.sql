
-- Fix: use SECURITY INVOKER (default, but explicit) instead of SECURITY DEFINER
ALTER VIEW public.workspace_members_safe SET (security_invoker = on);
