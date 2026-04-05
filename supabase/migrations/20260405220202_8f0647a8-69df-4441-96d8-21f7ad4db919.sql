-- Fix policies to use authenticated role instead of public

-- 1. agent_installed_skills UPDATE policy
DROP POLICY IF EXISTS "Users can update installed skills" ON public.agent_installed_skills;
CREATE POLICY "Users can update installed skills"
ON public.agent_installed_skills
FOR UPDATE
TO authenticated
USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()))
WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- 2. workspace_members SELECT policies
DROP POLICY IF EXISTS "Members can view own membership" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view workspace colleagues" ON public.workspace_members;

CREATE POLICY "Members can view own membership"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Members can view workspace colleagues"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  )
);

-- 3. Fix tool_policies for nullable agent_id
DROP POLICY IF EXISTS "tool_policies_all" ON public.tool_policies;
CREATE POLICY "tool_policies_all"
ON public.tool_policies
FOR ALL
TO authenticated
USING (
  agent_id IS NULL
  OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
)
WITH CHECK (
  agent_id IS NULL
  OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
);