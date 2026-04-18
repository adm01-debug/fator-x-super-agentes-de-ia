-- Enums
CREATE TYPE public.ir_incident_type AS ENUM ('data_breach','ddos','ransomware','account_takeover','insider_threat','service_outage','supply_chain','other');
CREATE TYPE public.ir_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.ir_playbook_status AS ENUM ('draft','active','archived');
CREATE TYPE public.ir_phase AS ENUM ('detect','contain','eradicate','recover','postmortem');
CREATE TYPE public.ir_tabletop_outcome AS ENUM ('pass','partial','fail','scheduled');

-- ir_playbooks
CREATE TABLE public.ir_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  incident_type public.ir_incident_type NOT NULL DEFAULT 'other',
  severity_default public.ir_severity NOT NULL DEFAULT 'medium',
  description TEXT,
  owner_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  status public.ir_playbook_status NOT NULL DEFAULT 'draft',
  last_reviewed_at TIMESTAMPTZ,
  next_review_due TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ir_playbooks_workspace ON public.ir_playbooks(workspace_id);
CREATE INDEX idx_ir_playbooks_status ON public.ir_playbooks(workspace_id, status);

-- ir_playbook_steps
CREATE TABLE public.ir_playbook_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.ir_playbooks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  phase public.ir_phase NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  expected_duration_minutes INTEGER,
  responsible_role TEXT,
  automation_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ir_playbook_steps_playbook ON public.ir_playbook_steps(playbook_id, step_order);

-- ir_tabletop_exercises
CREATE TABLE public.ir_tabletop_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.ir_playbooks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  scenario TEXT NOT NULL,
  participants TEXT[] NOT NULL DEFAULT '{}',
  facilitator_id UUID,
  outcome public.ir_tabletop_outcome NOT NULL DEFAULT 'scheduled',
  gaps TEXT[] NOT NULL DEFAULT '{}',
  action_items TEXT,
  mttr_actual_minutes INTEGER,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ir_tabletop_playbook ON public.ir_tabletop_exercises(playbook_id);
CREATE INDEX idx_ir_tabletop_workspace ON public.ir_tabletop_exercises(workspace_id, executed_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_ir_playbooks_updated
BEFORE UPDATE ON public.ir_playbooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: ao registrar tabletop, atualiza prazos do playbook
CREATE OR REPLACE FUNCTION public.handle_ir_tabletop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sev public.ir_severity;
  v_days INTEGER;
  v_when TIMESTAMPTZ;
BEGIN
  v_when := COALESCE(NEW.executed_at, NEW.scheduled_for);
  IF NEW.outcome = 'scheduled' THEN
    RETURN NEW;
  END IF;
  SELECT severity_default INTO v_sev FROM public.ir_playbooks WHERE id = NEW.playbook_id;
  v_days := CASE v_sev WHEN 'critical' THEN 90 WHEN 'high' THEN 180 ELSE 365 END;
  UPDATE public.ir_playbooks
    SET last_reviewed_at = v_when,
        next_review_due = v_when + (v_days || ' days')::INTERVAL,
        updated_at = now()
    WHERE id = NEW.playbook_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ir_tabletop_after_insert
AFTER INSERT ON public.ir_tabletop_exercises
FOR EACH ROW EXECUTE FUNCTION public.handle_ir_tabletop();

-- RLS
ALTER TABLE public.ir_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ir_playbook_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ir_tabletop_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ir_playbooks_select" ON public.ir_playbooks FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "ir_playbooks_admin_write" ON public.ir_playbooks FOR ALL
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "ir_steps_select" ON public.ir_playbook_steps FOR SELECT
  USING (playbook_id IN (SELECT id FROM public.ir_playbooks WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));
CREATE POLICY "ir_steps_admin_write" ON public.ir_playbook_steps FOR ALL
  USING (playbook_id IN (SELECT id FROM public.ir_playbooks p WHERE public.is_workspace_admin(auth.uid(), p.workspace_id)))
  WITH CHECK (playbook_id IN (SELECT id FROM public.ir_playbooks p WHERE public.is_workspace_admin(auth.uid(), p.workspace_id)));

CREATE POLICY "ir_tabletop_select" ON public.ir_tabletop_exercises FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "ir_tabletop_admin_write" ON public.ir_tabletop_exercises FOR ALL
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- RPC: activate_ir_playbook
CREATE OR REPLACE FUNCTION public.activate_ir_playbook(p_playbook_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.ir_playbooks WHERE id = p_playbook_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'playbook not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  UPDATE public.ir_playbooks
    SET status = 'active', version = version + 1, updated_at = now()
    WHERE id = p_playbook_id;
END $$;

-- RPC: get_ir_summary
CREATE OR REPLACE FUNCTION public.get_ir_summary(p_workspace_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active INTEGER;
  v_overdue INTEGER;
  v_mttr NUMERIC;
  v_gaps INTEGER;
  v_by_type JSONB;
BEGIN
  IF NOT (p_workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COUNT(*) INTO v_active FROM public.ir_playbooks
    WHERE workspace_id = p_workspace_id AND status = 'active';
  SELECT COUNT(*) INTO v_overdue FROM public.ir_playbooks
    WHERE workspace_id = p_workspace_id AND status = 'active'
      AND next_review_due IS NOT NULL AND next_review_due < now();
  SELECT COALESCE(AVG(mttr_actual_minutes), 0)::NUMERIC INTO v_mttr
    FROM public.ir_tabletop_exercises
    WHERE workspace_id = p_workspace_id
      AND outcome != 'scheduled'
      AND executed_at >= now() - interval '90 days';
  SELECT COALESCE(SUM(array_length(gaps, 1)), 0) INTO v_gaps
    FROM public.ir_tabletop_exercises
    WHERE workspace_id = p_workspace_id
      AND outcome != 'scheduled'
      AND executed_at >= now() - interval '180 days';
  SELECT COALESCE(jsonb_object_agg(incident_type, c), '{}'::jsonb) INTO v_by_type
  FROM (
    SELECT incident_type::text, COUNT(*) AS c
    FROM public.ir_playbooks
    WHERE workspace_id = p_workspace_id AND status = 'active'
    GROUP BY incident_type
  ) t;
  RETURN jsonb_build_object(
    'active_playbooks', v_active,
    'reviews_overdue', v_overdue,
    'avg_mttr_minutes', v_mttr,
    'open_gaps', v_gaps,
    'by_type', v_by_type
  );
END $$;