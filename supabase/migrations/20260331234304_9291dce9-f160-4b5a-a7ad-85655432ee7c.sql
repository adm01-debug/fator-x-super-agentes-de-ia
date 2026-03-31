-- Fix 1: Agents - change write policies from public to authenticated
DROP POLICY IF EXISTS "Users can delete own agents" ON public.agents;
CREATE POLICY "Users can delete own agents"
ON public.agents FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own agents" ON public.agents;
CREATE POLICY "Users can insert own agents"
ON public.agents FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own agents" ON public.agents;
CREATE POLICY "Users can update own agents"
ON public.agents FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix 2: agent_traces - change write policies from public to authenticated
DROP POLICY IF EXISTS "Users can insert own traces" ON public.agent_traces;
CREATE POLICY "Users can insert own traces"
ON public.agent_traces FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own traces" ON public.agent_traces;
CREATE POLICY "Users can update own traces"
ON public.agent_traces FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own traces" ON public.agent_traces;
CREATE POLICY "Users can delete own traces"
ON public.agent_traces FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Fix 3: prompt_versions - change write policies from public to authenticated
DROP POLICY IF EXISTS "Users can insert own prompt versions" ON public.prompt_versions;
CREATE POLICY "Users can insert own prompt versions"
ON public.prompt_versions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own prompt versions" ON public.prompt_versions;
CREATE POLICY "Users can update own prompt versions"
ON public.prompt_versions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own prompt versions" ON public.prompt_versions;
CREATE POLICY "Users can delete own prompt versions"
ON public.prompt_versions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Fix 4: agent_usage - change write policies from public to authenticated
DROP POLICY IF EXISTS "Users can insert own usage" ON public.agent_usage;
CREATE POLICY "Users can insert own usage"
ON public.agent_usage FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own usage" ON public.agent_usage;
CREATE POLICY "Users can update own usage"
ON public.agent_usage FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own usage" ON public.agent_usage;
CREATE POLICY "Users can delete own usage"
ON public.agent_usage FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Fix 5: workspace_members - restrict SELECT to owner-only for full data, members see only their own row
DROP POLICY IF EXISTS "Members see workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view own workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
ON public.workspace_members FOR SELECT
TO authenticated
USING (
  -- Owners can see all members in their workspace
  workspace_id IN (
    SELECT ws.id FROM workspaces ws WHERE ws.owner_id = auth.uid()
  )
  -- Members can only see their own record
  OR user_id = auth.uid()
);