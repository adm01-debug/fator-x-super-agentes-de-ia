
-- Remove any orphaned tool_policies with NULL agent_id
DELETE FROM public.tool_policies WHERE agent_id IS NULL;

-- Add NOT NULL constraint to prevent future orphans
ALTER TABLE public.tool_policies ALTER COLUMN agent_id SET NOT NULL;
