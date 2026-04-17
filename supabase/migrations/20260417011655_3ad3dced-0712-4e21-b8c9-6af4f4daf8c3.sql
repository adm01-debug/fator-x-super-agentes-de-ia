CREATE TABLE public.browser_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  goal TEXT NOT NULL,
  start_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_result TEXT,
  steps_count INTEGER NOT NULL DEFAULT 0,
  max_steps INTEGER NOT NULL DEFAULT 15,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_browser_sessions_user ON public.browser_sessions(user_id, created_at DESC);
CREATE INDEX idx_browser_sessions_workspace ON public.browser_sessions(workspace_id, created_at DESC);
CREATE INDEX idx_browser_sessions_status ON public.browser_sessions(status);

ALTER TABLE public.browser_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own browser sessions"
  ON public.browser_sessions FOR SELECT
  USING (auth.uid() = user_id OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Users create own browser sessions"
  ON public.browser_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own browser sessions"
  ON public.browser_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own browser sessions"
  ON public.browser_sessions FOR DELETE
  USING (auth.uid() = user_id);