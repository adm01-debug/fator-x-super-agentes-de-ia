-- ============================================
-- GAME DAYS — Incident Drills
-- ============================================

CREATE TABLE public.game_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scenario TEXT NOT NULL CHECK (scenario IN ('provider_outage','cost_spike','db_slowdown','auth_failure','custom')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','running','completed','aborted')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  facilitator_id UUID NOT NULL,
  participants UUID[] NOT NULL DEFAULT '{}',
  runbook_section TEXT,
  chaos_experiment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_days_workspace ON public.game_days(workspace_id, scheduled_at DESC);
CREATE INDEX idx_game_days_status ON public.game_days(status) WHERE status IN ('scheduled','running');

CREATE TABLE public.game_day_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_day_id UUID NOT NULL REFERENCES public.game_days(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('fault_injected','detection','mitigation','resolution','note')),
  actor_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_game_day_events_drill ON public.game_day_events(game_day_id, occurred_at);

CREATE TABLE public.game_day_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_day_id UUID NOT NULL UNIQUE REFERENCES public.game_days(id) ON DELETE CASCADE,
  mttr_seconds INTEGER,
  mttd_seconds INTEGER,
  runbook_followed BOOLEAN NOT NULL DEFAULT true,
  gaps_found TEXT[] NOT NULL DEFAULT '{}',
  score INTEGER CHECK (score BETWEEN 1 AND 10),
  retrospective_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.game_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_day_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_day_scorecards ENABLE ROW LEVEL SECURITY;

-- game_days policies
CREATE POLICY "members can view game days"
ON public.game_days FOR SELECT TO authenticated
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "admins can schedule game days"
ON public.game_days FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND facilitator_id = auth.uid());

CREATE POLICY "facilitator or admin can update"
ON public.game_days FOR UPDATE TO authenticated
USING (facilitator_id = auth.uid() OR public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "admins can delete game days"
ON public.game_days FOR DELETE TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- game_day_events policies
CREATE POLICY "members can view events"
ON public.game_day_events FOR SELECT TO authenticated
USING (game_day_id IN (
  SELECT id FROM public.game_days
  WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
));

CREATE POLICY "participants can record events"
ON public.game_day_events FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND game_day_id IN (
    SELECT id FROM public.game_days
    WHERE status = 'running'
      AND (facilitator_id = auth.uid() OR auth.uid() = ANY(participants) OR public.is_workspace_admin(auth.uid(), workspace_id))
  )
);

-- game_day_scorecards policies
CREATE POLICY "members can view scorecards"
ON public.game_day_scorecards FOR SELECT TO authenticated
USING (game_day_id IN (
  SELECT id FROM public.game_days
  WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
));

CREATE POLICY "facilitator or admin can create scorecard"
ON public.game_day_scorecards FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND game_day_id IN (
    SELECT id FROM public.game_days
    WHERE facilitator_id = auth.uid() OR public.is_workspace_admin(auth.uid(), workspace_id)
  )
);

-- Trigger for updated_at
CREATE TRIGGER game_days_updated_at
BEFORE UPDATE ON public.game_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RPCs
-- ============================================

CREATE OR REPLACE FUNCTION public.start_game_day(p_game_day_id UUID, p_inject_chaos BOOLEAN DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gd public.game_days%ROWTYPE;
  v_chaos_id UUID;
  v_target TEXT;
  v_fault TEXT;
BEGIN
  SELECT * INTO gd FROM public.game_days WHERE id = p_game_day_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'game day not found'; END IF;
  IF gd.facilitator_id <> auth.uid() AND NOT public.is_workspace_admin(auth.uid(), gd.workspace_id) THEN
    RAISE EXCEPTION 'forbidden: only facilitator or admin can start';
  END IF;
  IF gd.status <> 'scheduled' THEN
    RAISE EXCEPTION 'game day is not in scheduled state';
  END IF;

  UPDATE public.game_days
    SET status = 'running', started_at = now()
    WHERE id = p_game_day_id;

  -- Optional chaos injection mapped from scenario
  IF p_inject_chaos THEN
    v_target := CASE gd.scenario
      WHEN 'provider_outage' THEN 'llm-gateway'
      WHEN 'db_slowdown' THEN 'agent-workflow-runner'
      ELSE 'llm-gateway'
    END;
    v_fault := CASE gd.scenario
      WHEN 'provider_outage' THEN 'error_500'
      WHEN 'db_slowdown' THEN 'latency'
      WHEN 'auth_failure' THEN 'error_429'
      ELSE 'error_500'
    END;
    INSERT INTO public.chaos_experiments (workspace_id, name, target, fault_type, probability, latency_ms, expires_at, enabled, created_by)
    VALUES (gd.workspace_id, 'Game Day: ' || gd.title, v_target, v_fault, 0.5, 2000, now() + interval '2 hours', true, auth.uid())
    RETURNING id INTO v_chaos_id;
    UPDATE public.game_days SET chaos_experiment_id = v_chaos_id WHERE id = p_game_day_id;
  END IF;

  INSERT INTO public.game_day_events(game_day_id, event_type, actor_id, description, metadata)
  VALUES (p_game_day_id, 'fault_injected', auth.uid(),
          'Game day started — scenario: ' || gd.scenario,
          jsonb_build_object('chaos_experiment_id', v_chaos_id, 'auto_injected', p_inject_chaos));

  RETURN jsonb_build_object('status','running','started_at',now(),'chaos_experiment_id',v_chaos_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_game_day_event(p_game_day_id UUID, p_event_type TEXT, p_description TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.game_day_events(game_day_id, event_type, actor_id, description, metadata)
  VALUES (p_game_day_id, p_event_type, auth.uid(), p_description, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_game_day(
  p_game_day_id UUID,
  p_runbook_followed BOOLEAN DEFAULT true,
  p_gaps_found TEXT[] DEFAULT '{}',
  p_score INTEGER DEFAULT NULL,
  p_retrospective TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gd public.game_days%ROWTYPE;
  v_fault_at TIMESTAMPTZ;
  v_detect_at TIMESTAMPTZ;
  v_resolved_at TIMESTAMPTZ;
  v_mttr INTEGER;
  v_mttd INTEGER;
  v_scorecard_id UUID;
BEGIN
  SELECT * INTO gd FROM public.game_days WHERE id = p_game_day_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'game day not found'; END IF;
  IF gd.facilitator_id <> auth.uid() AND NOT public.is_workspace_admin(auth.uid(), gd.workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT MIN(occurred_at) INTO v_fault_at FROM public.game_day_events WHERE game_day_id = p_game_day_id AND event_type = 'fault_injected';
  SELECT MIN(occurred_at) INTO v_detect_at FROM public.game_day_events WHERE game_day_id = p_game_day_id AND event_type = 'detection';
  SELECT MAX(occurred_at) INTO v_resolved_at FROM public.game_day_events WHERE game_day_id = p_game_day_id AND event_type = 'resolution';

  IF v_fault_at IS NOT NULL AND v_resolved_at IS NOT NULL THEN
    v_mttr := EXTRACT(EPOCH FROM (v_resolved_at - v_fault_at))::int;
  END IF;
  IF v_fault_at IS NOT NULL AND v_detect_at IS NOT NULL THEN
    v_mttd := EXTRACT(EPOCH FROM (v_detect_at - v_fault_at))::int;
  END IF;

  UPDATE public.game_days SET status = 'completed', ended_at = now() WHERE id = p_game_day_id;

  -- Disable chaos experiment if any
  IF gd.chaos_experiment_id IS NOT NULL THEN
    UPDATE public.chaos_experiments SET enabled = false WHERE id = gd.chaos_experiment_id;
  END IF;

  INSERT INTO public.game_day_scorecards(game_day_id, mttr_seconds, mttd_seconds, runbook_followed, gaps_found, score, retrospective_notes, created_by)
  VALUES (p_game_day_id, v_mttr, v_mttd, p_runbook_followed, p_gaps_found, p_score, p_retrospective, auth.uid())
  RETURNING id INTO v_scorecard_id;

  RETURN jsonb_build_object('scorecard_id', v_scorecard_id, 'mttr_seconds', v_mttr, 'mttd_seconds', v_mttd, 'status','completed');
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_day_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_days;