-- ═══════════════════════════════════════════════════════════════
-- IP Restriction + Geo-Blocking schema
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ip_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_workspace ON public.ip_whitelist(workspace_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.geo_allowed_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (length(country_code) = 2),
  country_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_geo_workspace ON public.geo_allowed_countries(workspace_id);

CREATE TABLE IF NOT EXISTS public.access_blocked_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id uuid,
  ip_address text,
  country_code text,
  reason text NOT NULL,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_log_workspace_time ON public.access_blocked_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_log_ip ON public.access_blocked_log(ip_address);

-- Trigger updated_at on ip_whitelist
DROP TRIGGER IF EXISTS trg_ip_whitelist_updated ON public.ip_whitelist;
CREATE TRIGGER trg_ip_whitelist_updated
  BEFORE UPDATE ON public.ip_whitelist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ RLS ═══
ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_allowed_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_blocked_log ENABLE ROW LEVEL SECURITY;

-- ip_whitelist policies
DROP POLICY IF EXISTS "ws admins manage ip_whitelist" ON public.ip_whitelist;
CREATE POLICY "ws admins manage ip_whitelist"
  ON public.ip_whitelist
  FOR ALL
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- geo_allowed_countries policies
DROP POLICY IF EXISTS "ws admins manage geo countries" ON public.geo_allowed_countries;
CREATE POLICY "ws admins manage geo countries"
  ON public.geo_allowed_countries
  FOR ALL
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- access_blocked_log policies (read-only for admins)
DROP POLICY IF EXISTS "ws admins read blocked log" ON public.access_blocked_log;
CREATE POLICY "ws admins read blocked log"
  ON public.access_blocked_log
  FOR SELECT
  USING (workspace_id IS NULL OR public.is_workspace_admin(auth.uid(), workspace_id));

-- Inserts handled by service role from edge function — no client insert policy
