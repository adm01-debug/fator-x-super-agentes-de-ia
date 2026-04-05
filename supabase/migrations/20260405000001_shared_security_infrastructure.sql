-- ═══════════════════════════════════════════════════════════════
-- Nexus Agents Studio — Security Infrastructure
-- ETAPA 01: Rate Limiting, Audit, CORS
-- ═══════════════════════════════════════════════════════════════

-- Rate limit logs for abuse detection and analysis
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,          -- user:xxx, key:xxx, ip:xxx
  endpoint TEXT NOT NULL,            -- Edge Function name
  limit_name TEXT NOT NULL,          -- standard, llm, heavy, oracle, etc.
  was_blocked BOOLEAN DEFAULT false,
  request_count INTEGER DEFAULT 1,
  window_ms INTEGER NOT NULL,
  max_requests INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying abuse patterns
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_identifier 
  ON public.rate_limit_logs(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_blocked 
  ON public.rate_limit_logs(was_blocked, created_at DESC) 
  WHERE was_blocked = true;
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_created 
  ON public.rate_limit_logs(created_at DESC);

-- Auto-cleanup: remove logs older than 30 days (via pg_cron or manual)
COMMENT ON TABLE public.rate_limit_logs IS 
  'Rate limit events for abuse detection. Auto-cleanup recommended after 30 days.';

-- RLS: Only admins can read rate limit logs
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate_limit_logs"
  ON public.rate_limit_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ═══ API Keys table for external access (widget, WhatsApp, etc.) ═══
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID,                     -- Optional: restrict to specific agent
  name TEXT NOT NULL,                -- Human-readable name
  key_hash TEXT NOT NULL UNIQUE,     -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL,          -- First 8 chars for identification (nxs_xxxx)
  scopes TEXT[] DEFAULT '{read,execute}',
  rate_limit_tier TEXT DEFAULT 'standard',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON public.api_keys(workspace_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workspace API keys"
  ON public.api_keys FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- ═══ Security events for audit trail ═══
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,          -- 'login', 'logout', 'api_key_created', 'rate_limited', 'cors_blocked', etc.
  severity TEXT DEFAULT 'info',      -- 'info', 'warning', 'critical'
  user_id UUID,
  workspace_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type 
  ON public.security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user 
  ON public.security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity 
  ON public.security_events(severity, created_at DESC)
  WHERE severity IN ('warning', 'critical');

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workspace security events"
  ON public.security_events FOR SELECT
  USING (
    user_id = auth.uid() OR
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage security events"
  ON public.security_events FOR ALL
  USING (auth.role() = 'service_role');
