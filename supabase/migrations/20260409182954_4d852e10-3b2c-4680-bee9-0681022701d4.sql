
-- First, clean up any orphaned rows with NULL workspace_id
DELETE FROM public.agent_memories WHERE workspace_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE public.agent_memories ALTER COLUMN workspace_id SET NOT NULL;
