-- Fix SELECT policies from public to authenticated role

-- agents
DROP POLICY IF EXISTS "Users can view own agents" ON public.agents;
CREATE POLICY "Users can view own agents"
ON public.agents FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- agent_usage
DROP POLICY IF EXISTS "Users can view own usage" ON public.agent_usage;
CREATE POLICY "Users can view own usage"
ON public.agent_usage FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- prompt_versions
DROP POLICY IF EXISTS "Users can view own prompt versions" ON public.prompt_versions;
CREATE POLICY "Users can view own prompt versions"
ON public.prompt_versions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- agent_traces
DROP POLICY IF EXISTS "Users can view own traces" ON public.agent_traces;
CREATE POLICY "Users can view own traces"
ON public.agent_traces FOR SELECT
TO authenticated
USING (user_id = auth.uid());