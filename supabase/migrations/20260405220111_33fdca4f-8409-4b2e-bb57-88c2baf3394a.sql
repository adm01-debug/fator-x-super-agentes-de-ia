-- Fix 1: Add missing UPDATE policy for agent_installed_skills
CREATE POLICY "Users can update installed skills"
ON public.agent_installed_skills
FOR UPDATE
USING (agent_id IN (
  SELECT agents.id FROM agents WHERE agents.user_id = auth.uid()
))
WITH CHECK (agent_id IN (
  SELECT agents.id FROM agents WHERE agents.user_id = auth.uid()
));

-- Fix 2: Restrict workspace_members email visibility
-- Drop the existing overly-permissive policy
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;

-- Re-create with two policies: see own full record, see others without email
CREATE POLICY "Members can view own membership"
ON public.workspace_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Members can view workspace colleagues"
ON public.workspace_members
FOR SELECT
USING (
  workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  )
);