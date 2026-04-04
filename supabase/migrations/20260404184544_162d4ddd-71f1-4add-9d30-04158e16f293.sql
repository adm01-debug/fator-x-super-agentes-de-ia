-- Fix agent_versions INSERT policy: change from public to authenticated
DROP POLICY IF EXISTS "Users can create agent versions" ON public.agent_versions;

CREATE POLICY "Users can create agent versions"
ON public.agent_versions FOR INSERT TO authenticated
WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

-- Fix agent_versions SELECT policy: also restrict to authenticated
DROP POLICY IF EXISTS "Users can view agent versions" ON public.agent_versions;

CREATE POLICY "Users can view agent versions"
ON public.agent_versions FOR SELECT TO authenticated
USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));