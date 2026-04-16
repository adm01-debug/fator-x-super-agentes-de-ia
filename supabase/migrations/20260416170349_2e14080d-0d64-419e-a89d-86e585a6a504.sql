DELETE FROM public.agent_templates 
WHERE is_public = true 
AND category IN ('creative', 'analysis', 'data', 'automation')
AND name LIKE 'Especialista%';