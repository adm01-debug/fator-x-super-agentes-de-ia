
CREATE TABLE IF NOT EXISTS public.replay_forks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Fork sem nome',
  parent_execution_id TEXT NOT NULL,
  parent_agent_id TEXT,
  fork_step_index INTEGER NOT NULL DEFAULT 0,
  parent_chain_hash TEXT,
  override_input JSONB,
  state_snapshot JSONB,
  deterministic_seed TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  new_execution_id TEXT,
  total_steps INTEGER DEFAULT 0,
  duration_ms INTEGER,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_replay_forks_user ON public.replay_forks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_forks_parent ON public.replay_forks(parent_execution_id);
CREATE INDEX IF NOT EXISTS idx_replay_forks_workspace ON public.replay_forks(workspace_id);

ALTER TABLE public.replay_forks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own forks"
  ON public.replay_forks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own forks"
  ON public.replay_forks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forks"
  ON public.replay_forks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forks"
  ON public.replay_forks FOR DELETE
  USING (auth.uid() = user_id);
