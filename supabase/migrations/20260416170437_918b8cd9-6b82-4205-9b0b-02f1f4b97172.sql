CREATE INDEX IF NOT EXISTS idx_agent_templates_public_category 
  ON public.agent_templates (is_public, category) 
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_agent_templates_name_lower 
  ON public.agent_templates (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_agent_templates_created_by 
  ON public.agent_templates (created_by) 
  WHERE created_by IS NOT NULL;