
-- agent_versions: add UPDATE and DELETE policies
CREATE POLICY "Users can update agent versions"
ON public.agent_versions FOR UPDATE TO authenticated
USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()))
WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete agent versions"
ON public.agent_versions FOR DELETE TO authenticated
USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
