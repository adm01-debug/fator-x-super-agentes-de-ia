
CREATE TABLE public.voice_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_in_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
  audio_out_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_sessions_user ON public.voice_sessions(user_id, started_at DESC);
CREATE INDEX idx_voice_sessions_workspace ON public.voice_sessions(workspace_id, started_at DESC);
CREATE INDEX idx_voice_sessions_agent ON public.voice_sessions(agent_id);

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_sessions_select_own" ON public.voice_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "voice_sessions_insert_own" ON public.voice_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "voice_sessions_update_own" ON public.voice_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "voice_sessions_delete_own" ON public.voice_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER voice_sessions_updated_at
  BEFORE UPDATE ON public.voice_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
