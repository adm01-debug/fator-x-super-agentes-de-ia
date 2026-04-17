-- Chaos Engineering experiments table
CREATE TABLE public.chaos_experiments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('llm-gateway', 'agent-workflow-runner')),
  fault_type TEXT NOT NULL CHECK (fault_type IN ('latency', 'error_500', 'error_429', 'timeout')),
  probability NUMERIC(4,3) NOT NULL DEFAULT 0.05 CHECK (probability >= 0 AND probability <= 0.5),
  latency_ms INTEGER DEFAULT 500 CHECK (latency_ms >= 0 AND latency_ms <= 10000),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 hour')
);

CREATE INDEX idx_chaos_active ON public.chaos_experiments(target, enabled, expires_at)
  WHERE enabled = true;
CREATE INDEX idx_chaos_workspace ON public.chaos_experiments(workspace_id, created_at DESC);

ALTER TABLE public.chaos_experiments ENABLE ROW LEVEL SECURITY;

-- Workspace members can view
CREATE POLICY "Members can view chaos experiments"
ON public.chaos_experiments FOR SELECT
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- Only workspace admins can create
CREATE POLICY "Admins can create chaos experiments"
ON public.chaos_experiments FOR INSERT
WITH CHECK (
  public.is_workspace_admin(auth.uid(), workspace_id)
  AND created_by = auth.uid()
);

-- Only workspace admins can update (for disable)
CREATE POLICY "Admins can update chaos experiments"
ON public.chaos_experiments FOR UPDATE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Only workspace admins can delete
CREATE POLICY "Admins can delete chaos experiments"
ON public.chaos_experiments FOR DELETE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- RPC: panic kill switch — disable all active experiments in a workspace
CREATE OR REPLACE FUNCTION public.disable_all_chaos(p_workspace_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  UPDATE public.chaos_experiments
  SET enabled = false
  WHERE workspace_id = p_workspace_id AND enabled = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- RPC: list active faults for a target (used by edge functions via service role)
CREATE OR REPLACE FUNCTION public.get_active_chaos_faults(p_target TEXT)
RETURNS TABLE (
  id UUID,
  fault_type TEXT,
  probability NUMERIC,
  latency_ms INTEGER
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, fault_type, probability, latency_ms
  FROM public.chaos_experiments
  WHERE target = p_target
    AND enabled = true
    AND expires_at > now();
$$;