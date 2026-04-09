
-- Remove old permissive policies that conflict with the new owner-only ones
DROP POLICY IF EXISTS "tool_integrations_insert" ON public.tool_integrations;
DROP POLICY IF EXISTS "tool_integrations_select" ON public.tool_integrations;
DROP POLICY IF EXISTS "tool_integrations_update" ON public.tool_integrations;
DROP POLICY IF EXISTS "tool_integrations_delete" ON public.tool_integrations;
DROP POLICY IF EXISTS "tool_integrations_all" ON public.tool_integrations;
