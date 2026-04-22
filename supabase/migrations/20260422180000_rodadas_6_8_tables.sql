-- Migration: tabelas para as Rodadas 6-8 (durable execution + outcome billing + voice telephony)
-- Ver: src/services/checkpointStore.ts, src/services/outcomePricing.ts, src/services/voiceTelephony.ts

-- ═══════════════════════════════════════════════════════════════
-- agent_checkpoints — durable execution state (LangGraph-style)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agent_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  checkpoint_id text NOT NULL,
  parent_checkpoint_id text,
  step_index int NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread ON public.agent_checkpoints (thread_id, step_index);
CREATE INDEX IF NOT EXISTS idx_checkpoints_agent ON public.agent_checkpoints (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent ON public.agent_checkpoints (parent_checkpoint_id);

ALTER TABLE public.agent_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkpoints_ws_read" ON public.agent_checkpoints
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "checkpoints_ws_write" ON public.agent_checkpoints
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- outcome_events — outcome-based billing (Sierra/Fin pattern)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.outcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'quote_qualified','order_closed','support_resolution',
    'lead_qualified','meeting_booked','handoff_avoided','escalation'
  )),
  reference_id text,
  metadata jsonb,
  unit_price_usd numeric(10, 4) NOT NULL DEFAULT 0,
  billable boolean NOT NULL DEFAULT true,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_workspace_period
  ON public.outcome_events (workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_agent ON public.outcome_events (agent_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_kind ON public.outcome_events (kind, billable);

ALTER TABLE public.outcome_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outcomes_ws_read" ON public.outcome_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- voice_calls — telefonia (Twilio/Vonage via edge voice-session)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  provider_sid text,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_phone text NOT NULL,
  to_phone text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'queued','ringing','in_progress','completed','busy','no_answer','failed'
  )),
  transcript text,
  recording_url text,
  duration_s int,
  cost_usd numeric(10, 4),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voicecalls_agent ON public.voice_calls (agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voicecalls_status ON public.voice_calls (status, started_at DESC);

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voicecalls_ws_read" ON public.voice_calls
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- agent_red_team_runs — breakage_rate histórico (Rodada 7 redTeamDataset)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agent_red_team_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  total int NOT NULL,
  compromised int NOT NULL,
  breakage_rate numeric(5, 4) NOT NULL,
  by_category jsonb NOT NULL,
  critical_compromises jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redteam_agent ON public.agent_red_team_runs (agent_id, created_at DESC);

ALTER TABLE public.agent_red_team_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redteam_ws_read" ON public.agent_red_team_runs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.agent_checkpoints IS
  'Durable execution state para runs de agentes (LangGraph-style PostgresSaver). Ver src/services/checkpointStore.ts';
COMMENT ON TABLE public.outcome_events IS
  'Eventos faturáveis para outcome-based billing (Sierra/Fin pattern). Ver src/services/outcomePricing.ts';
COMMENT ON TABLE public.voice_calls IS
  'Chamadas de voz via telefonia (Twilio/Vonage). Ver src/services/voiceTelephony.ts';
COMMENT ON TABLE public.agent_red_team_runs IS
  'Resultados de red-team adversarial semanal. Ver src/data/redTeamDataset.ts';
