CREATE TABLE public.code_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID,
  runtime TEXT NOT NULL CHECK (runtime IN ('python', 'node', 'deno')),
  code TEXT NOT NULL,
  stdout TEXT DEFAULT '',
  stderr TEXT DEFAULT '',
  exit_code INTEGER,
  files JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER DEFAULT 0,
  memory_mb NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','timeout')),
  simulated BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_code_executions_user_created ON public.code_executions(user_id, created_at DESC);

ALTER TABLE public.code_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own code executions" ON public.code_executions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own code executions" ON public.code_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own code executions" ON public.code_executions
  FOR DELETE USING (auth.uid() = user_id);