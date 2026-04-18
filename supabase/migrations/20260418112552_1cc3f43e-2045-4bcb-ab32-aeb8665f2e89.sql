-- ============================================================
-- Sprint 33: Incident Response Automation
-- ============================================================

-- 1. incident_playbooks
CREATE TABLE public.incident_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('slo_breach','synthetic_fail','cost_anomaly','budget_block','manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  last_triggered_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_playbooks_workspace ON public.incident_playbooks(workspace_id);
CREATE INDEX idx_incident_playbooks_trigger ON public.incident_playbooks(trigger_type, enabled) WHERE enabled = true;

ALTER TABLE public.incident_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view playbooks"
  ON public.incident_playbooks FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Admins insert playbooks"
  ON public.incident_playbooks FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins update playbooks"
  ON public.incident_playbooks FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins delete playbooks"
  ON public.incident_playbooks FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_incident_playbooks_updated_at
  BEFORE UPDATE ON public.incident_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. incident_runs
CREATE TABLE public.incident_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.incident_playbooks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  triggered_by TEXT,
  trigger_event JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  action_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  triggered_by_user UUID
);

CREATE INDEX idx_incident_runs_playbook ON public.incident_runs(playbook_id, started_at DESC);
CREATE INDEX idx_incident_runs_workspace ON public.incident_runs(workspace_id, started_at DESC);

ALTER TABLE public.incident_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view runs"
  ON public.incident_runs FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- INSERT/UPDATE only via security definer functions (no policies needed for service role / definer)

-- 3. oncall_schedule
CREATE TABLE public.oncall_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  user_email TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  escalation_order INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oncall_valid_range CHECK (ends_at > starts_at)
);

CREATE INDEX idx_oncall_workspace_range ON public.oncall_schedule(workspace_id, starts_at, ends_at);

ALTER TABLE public.oncall_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view oncall"
  ON public.oncall_schedule FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Admins manage oncall"
  ON public.oncall_schedule FOR ALL
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

-- 4. Helper function: get current on-call user
CREATE OR REPLACE FUNCTION public.get_current_oncall(p_workspace_id UUID)
RETURNS TABLE(user_id UUID, user_name TEXT, user_email TEXT, escalation_order INT, ends_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_id, user_name, user_email, escalation_order, ends_at
  FROM public.oncall_schedule
  WHERE workspace_id = p_workspace_id
    AND starts_at <= now()
    AND ends_at > now()
  ORDER BY escalation_order ASC
  LIMIT 5;
$$;

-- 5. Trigger incident playbook (security definer for inserts from triggers)
CREATE OR REPLACE FUNCTION public.create_incident_run(
  p_playbook_id UUID,
  p_triggered_by TEXT,
  p_trigger_event JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pb public.incident_playbooks%ROWTYPE;
  v_run_id UUID;
BEGIN
  SELECT * INTO v_pb FROM public.incident_playbooks WHERE id = p_playbook_id;
  IF NOT FOUND OR NOT v_pb.enabled THEN
    RETURN NULL;
  END IF;

  -- Cooldown check
  IF v_pb.last_triggered_at IS NOT NULL
     AND v_pb.last_triggered_at > now() - (v_pb.cooldown_minutes || ' minutes')::interval THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.incident_runs(playbook_id, workspace_id, triggered_by, trigger_event, triggered_by_user)
  VALUES (p_playbook_id, v_pb.workspace_id, p_triggered_by, p_trigger_event, auth.uid())
  RETURNING id INTO v_run_id;

  UPDATE public.incident_playbooks
    SET last_triggered_at = now(), run_count = run_count + 1
    WHERE id = p_playbook_id;

  RETURN v_run_id;
END;
$$;

-- 6. Update incident run status (called by orchestrator)
CREATE OR REPLACE FUNCTION public.update_incident_run(
  p_run_id UUID,
  p_status TEXT,
  p_action_results JSONB,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.incident_runs
    SET status = p_status,
        action_results = p_action_results,
        notes = COALESCE(p_notes, notes),
        ended_at = CASE WHEN p_status IN ('succeeded','failed','partial') THEN now() ELSE ended_at END
    WHERE id = p_run_id;
END;
$$;

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_playbooks;