-- ════════════════════════════════════════════════════════════════════
-- WhatsApp Webhook Bidirectional — Migration (next-frontier sprint #2)
-- ════════════════════════════════════════════════════════════════════
-- Companion to bitrix24_webhook_events. Receives inbound WhatsApp
-- messages from a provider (Twilio / Meta Cloud API / Z-API / Evolution),
-- routes to the right agent via agent_routing_config (source='whatsapp'),
-- and persists an audit log per event.
--
-- agent_routing_config table already exists from
-- 20260408140000_bitrix24_webhook_routing.sql — we just register a new
-- 'source' value: 'whatsapp'.

CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  provider text NOT NULL DEFAULT 'unknown',
  message_id text,
  from_phone text,
  to_phone text,
  body_preview text,
  raw_payload jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  routed_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  routing_status text NOT NULL DEFAULT 'pending',
  routing_error text,
  trace_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT wa_routing_status_check CHECK (
    routing_status IN ('pending', 'routed', 'no_route', 'failed', 'invalid_signature', 'duplicate')
  )
);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_workspace_received
  ON public.whatsapp_webhook_events (workspace_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_event_type
  ON public.whatsapp_webhook_events (event_type);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_status
  ON public.whatsapp_webhook_events (routing_status) WHERE routing_status != 'routed';
CREATE INDEX IF NOT EXISTS idx_wa_webhook_message_id
  ON public.whatsapp_webhook_events (message_id) WHERE message_id IS NOT NULL;
-- Dedup index — same provider+message_id should never be processed twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_webhook_dedup
  ON public.whatsapp_webhook_events (provider, message_id)
  WHERE message_id IS NOT NULL;

ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view whatsapp webhook events"
  ON public.whatsapp_webhook_events FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- Service role only writes (Edge Function uses service_role key)
CREATE POLICY "Service role inserts whatsapp webhook events"
  ON public.whatsapp_webhook_events FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.whatsapp_webhook_events IS
  'Append-only audit log of every WhatsApp webhook received, with provider, message id, signature validation result, and routing outcome. Reuses agent_routing_config with source=whatsapp.';
