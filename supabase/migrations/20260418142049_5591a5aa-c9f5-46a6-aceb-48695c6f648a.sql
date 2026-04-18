-- ENUMS
CREATE TYPE public.bcp_category AS ENUM ('core','supporting','analytical','external');
CREATE TYPE public.bcp_criticality AS ENUM ('tier_1','tier_2','tier_3','tier_4');
CREATE TYPE public.bcp_system_status AS ENUM ('operational','degraded','down','retired');
CREATE TYPE public.bcp_test_type AS ENUM ('tabletop','walkthrough','simulation','full_failover');

-- business_systems
CREATE TABLE public.business_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category public.bcp_category NOT NULL DEFAULT 'core',
  criticality public.bcp_criticality NOT NULL DEFAULT 'tier_3',
  rto_minutes INTEGER NOT NULL DEFAULT 240,
  rpo_minutes INTEGER NOT NULL DEFAULT 60,
  mtpd_hours INTEGER NOT NULL DEFAULT 24,
  dependencies TEXT[] NOT NULL DEFAULT '{}',
  owner_id UUID,
  recovery_strategy TEXT,
  status public.bcp_system_status NOT NULL DEFAULT 'operational',
  last_tested_at TIMESTAMPTZ,
  next_test_due TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_systems_workspace ON public.business_systems(workspace_id);
CREATE INDEX idx_business_systems_criticality ON public.business_systems(criticality);
CREATE INDEX idx_business_systems_next_test ON public.business_systems(next_test_due);

ALTER TABLE public.business_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_business_systems" ON public.business_systems
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "admins_insert_business_systems" ON public.business_systems
  FOR INSERT WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "admins_update_business_systems" ON public.business_systems
  FOR UPDATE USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "admins_delete_business_systems" ON public.business_systems
  FOR DELETE USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER trg_business_systems_updated
  BEFORE UPDATE ON public.business_systems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- bcp_test_runs
CREATE TABLE public.bcp_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES public.business_systems(id) ON DELETE CASCADE,
  test_type public.bcp_test_type NOT NULL DEFAULT 'tabletop',
  executed_by UUID NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scenario TEXT NOT NULL,
  actual_rto_minutes INTEGER,
  actual_rpo_minutes INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  gaps TEXT[] NOT NULL DEFAULT '{}',
  action_items TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bcp_test_runs_system ON public.bcp_test_runs(system_id);
CREATE INDEX idx_bcp_test_runs_executed ON public.bcp_test_runs(executed_at DESC);

ALTER TABLE public.bcp_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_bcp_tests" ON public.bcp_test_runs
  FOR SELECT USING (
    system_id IN (SELECT id FROM public.business_systems
                  WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
  );

CREATE POLICY "admins_insert_bcp_tests" ON public.bcp_test_runs
  FOR INSERT WITH CHECK (
    executed_by = auth.uid()
    AND system_id IN (SELECT id FROM public.business_systems
                      WHERE public.is_workspace_admin(auth.uid(), workspace_id))
  );

-- trigger: recalcula next_test_due
CREATE OR REPLACE FUNCTION public.handle_bcp_test_run()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_crit public.bcp_criticality; v_days INTEGER;
BEGIN
  SELECT criticality INTO v_crit FROM public.business_systems WHERE id = NEW.system_id;
  v_days := CASE v_crit WHEN 'tier_1' THEN 90 WHEN 'tier_2' THEN 180 WHEN 'tier_3' THEN 365 ELSE 730 END;
  UPDATE public.business_systems
    SET last_tested_at = NEW.executed_at,
        next_test_due = NEW.executed_at + (v_days || ' days')::INTERVAL,
        updated_at = now()
    WHERE id = NEW.system_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bcp_test_run_after_insert
  AFTER INSERT ON public.bcp_test_runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_bcp_test_run();

-- RPC: register_business_system
CREATE OR REPLACE FUNCTION public.register_business_system(
  p_workspace_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL,
  p_category public.bcp_category DEFAULT 'core',
  p_criticality public.bcp_criticality DEFAULT 'tier_3',
  p_rto_minutes INTEGER DEFAULT 240, p_rpo_minutes INTEGER DEFAULT 60,
  p_mtpd_hours INTEGER DEFAULT 24, p_dependencies TEXT[] DEFAULT '{}',
  p_owner_id UUID DEFAULT NULL, p_recovery_strategy TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_days INTEGER;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  v_days := CASE p_criticality WHEN 'tier_1' THEN 90 WHEN 'tier_2' THEN 180 WHEN 'tier_3' THEN 365 ELSE 730 END;
  INSERT INTO public.business_systems (
    workspace_id, name, description, category, criticality, rto_minutes, rpo_minutes,
    mtpd_hours, dependencies, owner_id, recovery_strategy, next_test_due, created_by
  ) VALUES (
    p_workspace_id, p_name, p_description, p_category, p_criticality, p_rto_minutes, p_rpo_minutes,
    p_mtpd_hours, p_dependencies, p_owner_id, p_recovery_strategy,
    now() + (v_days || ' days')::INTERVAL, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- RPC: record_bcp_test
CREATE OR REPLACE FUNCTION public.record_bcp_test(
  p_system_id UUID, p_test_type public.bcp_test_type, p_scenario TEXT,
  p_actual_rto_minutes INTEGER DEFAULT NULL, p_actual_rpo_minutes INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT true, p_gaps TEXT[] DEFAULT '{}',
  p_action_items TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.business_systems WHERE id = p_system_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'system not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  INSERT INTO public.bcp_test_runs (
    system_id, test_type, executed_by, scenario, actual_rto_minutes,
    actual_rpo_minutes, success, gaps, action_items, notes
  ) VALUES (
    p_system_id, p_test_type, auth.uid(), p_scenario, p_actual_rto_minutes,
    p_actual_rpo_minutes, p_success, p_gaps, p_action_items, p_notes
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- RPC: get_bcp_summary
CREATE OR REPLACE FUNCTION public.get_bcp_summary(p_workspace_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  IF p_workspace_id NOT IN (SELECT public.get_user_workspace_ids(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'total', COUNT(*) FILTER (WHERE status <> 'retired'),
    'tier_1', COUNT(*) FILTER (WHERE criticality = 'tier_1' AND status <> 'retired'),
    'tier_2', COUNT(*) FILTER (WHERE criticality = 'tier_2' AND status <> 'retired'),
    'tier_3', COUNT(*) FILTER (WHERE criticality = 'tier_3' AND status <> 'retired'),
    'tier_4', COUNT(*) FILTER (WHERE criticality = 'tier_4' AND status <> 'retired'),
    'down', COUNT(*) FILTER (WHERE status = 'down'),
    'degraded', COUNT(*) FILTER (WHERE status = 'degraded'),
    'tests_overdue', COUNT(*) FILTER (WHERE next_test_due IS NOT NULL AND next_test_due < now() AND status <> 'retired'),
    'never_tested', COUNT(*) FILTER (WHERE last_tested_at IS NULL AND status <> 'retired'),
    'rto_breaches', (
      SELECT COUNT(DISTINCT bs.id) FROM public.business_systems bs
      JOIN public.bcp_test_runs tr ON tr.system_id = bs.id
      WHERE bs.workspace_id = p_workspace_id
        AND tr.actual_rto_minutes IS NOT NULL
        AND tr.actual_rto_minutes > bs.rto_minutes
        AND tr.executed_at > now() - INTERVAL '365 days'
    )
  ) INTO v_result FROM public.business_systems WHERE workspace_id = p_workspace_id;
  RETURN v_result;
END;
$$;