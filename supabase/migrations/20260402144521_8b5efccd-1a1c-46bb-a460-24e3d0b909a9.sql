
-- Create agent_memories table for the Memory Engine
CREATE TABLE public.agent_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL DEFAULT 'semantic',
  content TEXT NOT NULL,
  source TEXT DEFAULT 'Manual',
  relevance_score NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage memories in their workspace"
  ON public.agent_memories FOR ALL TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Create model_pricing table for billing
CREATE TABLE public.model_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_pattern TEXT NOT NULL,
  input_cost_per_1k NUMERIC NOT NULL DEFAULT 0,
  output_cost_per_1k NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pricing"
  ON public.model_pricing FOR SELECT TO authenticated
  USING (true);
