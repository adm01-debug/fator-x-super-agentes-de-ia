-- ════════════════════════════════════════════════════════════════════
-- Bitrix24 Webhook Bidirectional — Migration (next-frontier #3)
-- ════════════════════════════════════════════════════════════════════
-- Two new tables:
--   1. agent_routing_config — maps Bitrix24 event types to agents
--   2. bitrix24_webhook_events — append-only audit log of received events
--
-- Both tables are workspace-scoped with full RLS.

-- ─── 1. agent_routing_config ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_routing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source text NOT NULL,
  event_type text NOT NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  filter_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_routing_unique UNIQUE (workspace_id, source, event_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_routing_workspace_source
  ON public.agent_routing_config (workspace_id, source);
CREATE INDEX IF NOT EXISTS idx_agent_routing_enabled
  ON public.agent_routing_config (is_enabled) WHERE is_enabled = true;

ALTER TABLE public.agent_routing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view routing config"
  ON public.agent_routing_config FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can manage routing config"
  ON public.agent_routing_config FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- ─── 2. bitrix24_webhook_events ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bitrix24_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  bitrix_event_id text,
  raw_payload jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  routed_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  routing_status text NOT NULL DEFAULT 'pending',
  routing_error text,
  trace_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT routing_status_check CHECK (
    routing_status IN ('pending', 'routed', 'no_route', 'failed', 'invalid_signature')
  )
);

CREATE INDEX IF NOT EXISTS idx_b24_webhook_workspace_received
  ON public.bitrix24_webhook_events (workspace_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_b24_webhook_event_type
  ON public.bitrix24_webhook_events (event_type);
CREATE INDEX IF NOT EXISTS idx_b24_webhook_status
  ON public.bitrix24_webhook_events (routing_status) WHERE routing_status != 'routed';

ALTER TABLE public.bitrix24_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view webhook events"
  ON public.bitrix24_webhook_events FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- Service role only writes (Edge Function uses service_role key)
CREATE POLICY "Service role inserts webhook events"
  ON public.bitrix24_webhook_events FOR INSERT
  WITH CHECK (true);

-- Trigger to keep updated_at fresh on agent_routing_config
CREATE OR REPLACE FUNCTION public.touch_agent_routing_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_routing_updated_at ON public.agent_routing_config;
CREATE TRIGGER trg_agent_routing_updated_at
  BEFORE UPDATE ON public.agent_routing_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_agent_routing_updated_at();

COMMENT ON TABLE public.agent_routing_config IS
  'Maps external event sources (bitrix24, slack, gmail, ...) and event types to agents that should handle them.';
COMMENT ON TABLE public.bitrix24_webhook_events IS
  'Append-only audit log of every Bitrix24 webhook received, with HMAC validation result and routing outcome.';
