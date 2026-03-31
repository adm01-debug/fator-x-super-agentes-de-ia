
CREATE TABLE public.oracle_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  mode TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  preset_name TEXT,
  chairman_model TEXT,
  enable_thinking BOOLEAN DEFAULT false,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC,
  consensus_degree NUMERIC,
  total_cost_usd NUMERIC,
  total_latency_ms INTEGER,
  total_tokens INTEGER,
  models_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.oracle_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own oracle history"
  ON public.oracle_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own oracle history"
  ON public.oracle_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own oracle history"
  ON public.oracle_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_oracle_history_user_id ON public.oracle_history(user_id);
CREATE INDEX idx_oracle_history_mode ON public.oracle_history(mode);
CREATE INDEX idx_oracle_history_preset ON public.oracle_history(preset_id);
CREATE INDEX idx_oracle_history_created ON public.oracle_history(created_at DESC);
