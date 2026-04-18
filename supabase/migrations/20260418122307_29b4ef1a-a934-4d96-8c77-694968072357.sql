-- Postmortems table
CREATE TABLE public.postmortems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  incident_source TEXT NOT NULL DEFAULT 'manual' CHECK (incident_source IN ('incident_run','game_day','dr_drill','manual')),
  source_id UUID,
  severity TEXT NOT NULL DEFAULT 'SEV3' CHECK (severity IN ('SEV1','SEV2','SEV3','SEV4')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published')),
  summary TEXT,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  root_cause TEXT,
  contributing_factors TEXT[] NOT NULL DEFAULT '{}',
  what_went_well TEXT[] NOT NULL DEFAULT '{}',
  what_went_wrong TEXT[] NOT NULL DEFAULT '{}',
  lessons_learned TEXT,
  author_id UUID NOT NULL,
  reviewer_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_postmortems_workspace ON public.postmortems(workspace_id, created_at DESC);
CREATE INDEX idx_postmortems_severity ON public.postmortems(workspace_id, severity);
CREATE INDEX idx_postmortems_status ON public.postmortems(workspace_id, status);
CREATE INDEX idx_postmortems_source ON public.postmortems(incident_source, source_id);

ALTER TABLE public.postmortems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view postmortems"
  ON public.postmortems FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "members create postmortems"
  ON public.postmortems FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    AND author_id = auth.uid()
  );

CREATE POLICY "author or admin update postmortems"
  ON public.postmortems FOR UPDATE
  USING (
    author_id = auth.uid()
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "author or admin delete postmortems"
  ON public.postmortems FOR DELETE
  USING (
    author_id = auth.uid()
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE TRIGGER trg_postmortems_updated_at
  BEFORE UPDATE ON public.postmortems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Action items
CREATE TABLE public.postmortem_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postmortem_id UUID NOT NULL REFERENCES public.postmortems(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner_id UUID,
  owner_name TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_action_items_pm ON public.postmortem_action_items(postmortem_id);
CREATE INDEX idx_pm_action_items_status ON public.postmortem_action_items(status, due_date);

ALTER TABLE public.postmortem_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view action items"
  ON public.postmortem_action_items FOR SELECT
  USING (
    postmortem_id IN (
      SELECT id FROM public.postmortems
      WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    )
  );

CREATE POLICY "author or admin manage action items"
  ON public.postmortem_action_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.postmortems p
      WHERE p.id = postmortem_id
        AND (p.author_id = auth.uid() OR public.is_workspace_admin(auth.uid(), p.workspace_id))
    )
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.postmortems p
      WHERE p.id = postmortem_id
        AND (p.author_id = auth.uid() OR public.is_workspace_admin(auth.uid(), p.workspace_id))
    )
  );

CREATE TRIGGER trg_pm_action_items_updated_at
  BEFORE UPDATE ON public.postmortem_action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Generate postmortem from incident run
CREATE OR REPLACE FUNCTION public.generate_postmortem_from_incident(p_incident_run_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_pb RECORD;
  v_pm_id UUID;
  v_timeline JSONB;
  v_severity TEXT;
  v_duration_seconds INTEGER;
BEGIN
  SELECT ir.*, ip.name AS pb_name, ip.trigger_type, ip.actions
    INTO v_run
    FROM public.incident_runs ir
    JOIN public.incident_playbooks ip ON ip.id = ir.playbook_id
    WHERE ir.id = p_incident_run_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'incident run not found'; END IF;

  IF NOT (v_run.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_duration_seconds := COALESCE(EXTRACT(EPOCH FROM (v_run.ended_at - v_run.started_at))::int, 0);
  v_severity := CASE
    WHEN v_run.status = 'failed' THEN 'SEV1'
    WHEN v_run.status = 'partial' THEN 'SEV2'
    ELSE 'SEV3'
  END;

  v_timeline := jsonb_build_array(
    jsonb_build_object('at', v_run.started_at, 'event', 'Incident detected', 'detail', 'Trigger: ' || v_run.triggered_by),
    jsonb_build_object('at', v_run.started_at, 'event', 'Playbook executed', 'detail', v_run.pb_name),
    jsonb_build_object('at', COALESCE(v_run.ended_at, now()), 'event', 'Resolution', 'detail', 'Status: ' || v_run.status)
  );

  INSERT INTO public.postmortems(
    workspace_id, title, incident_source, source_id, severity, status,
    summary, timeline, author_id, contributing_factors
  ) VALUES (
    v_run.workspace_id,
    'Postmortem: ' || v_run.pb_name || ' (' || to_char(v_run.started_at, 'YYYY-MM-DD HH24:MI') || ')',
    'incident_run',
    p_incident_run_id,
    v_severity,
    'draft',
    'Auto-generated from incident run. Duration: ' || v_duration_seconds || 's. Status: ' || v_run.status || '.',
    v_timeline,
    auth.uid(),
    ARRAY['Trigger: ' || v_run.triggered_by]
  ) RETURNING id INTO v_pm_id;

  RETURN v_pm_id;
END;
$$;

-- RPC: Generate postmortem from game day
CREATE OR REPLACE FUNCTION public.generate_postmortem_from_gameday(p_game_day_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gd RECORD;
  v_sc RECORD;
  v_pm_id UUID;
  v_timeline JSONB;
  v_severity TEXT;
BEGIN
  SELECT * INTO v_gd FROM public.game_days WHERE id = p_game_day_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'game day not found'; END IF;

  IF NOT (v_gd.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_sc FROM public.game_day_scorecards WHERE game_day_id = p_game_day_id LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'at', occurred_at, 'event', event_type, 'detail', description
  ) ORDER BY occurred_at), '[]'::jsonb) INTO v_timeline
  FROM public.game_day_events WHERE game_day_id = p_game_day_id;

  v_severity := CASE
    WHEN v_sc.score IS NULL OR v_sc.score >= 8 THEN 'SEV3'
    WHEN v_sc.score >= 5 THEN 'SEV2'
    ELSE 'SEV1'
  END;

  INSERT INTO public.postmortems(
    workspace_id, title, incident_source, source_id, severity, status,
    summary, timeline, author_id, contributing_factors, what_went_wrong
  ) VALUES (
    v_gd.workspace_id,
    'Game Day Postmortem: ' || v_gd.title,
    'game_day',
    p_game_day_id,
    v_severity,
    'draft',
    'Game day exercise. Scenario: ' || v_gd.scenario || '. MTTR: ' || COALESCE(v_sc.mttr_seconds::text, 'n/a') || 's, MTTD: ' || COALESCE(v_sc.mttd_seconds::text, 'n/a') || 's. Score: ' || COALESCE(v_sc.score::text, 'n/a') || '/10.',
    v_timeline,
    auth.uid(),
    COALESCE(v_sc.gaps_found, ARRAY[]::text[]),
    COALESCE(v_sc.gaps_found, ARRAY[]::text[])
  ) RETURNING id INTO v_pm_id;

  RETURN v_pm_id;
END;
$$;

-- RPC: Publish postmortem (with gate)
CREATE OR REPLACE FUNCTION public.publish_postmortem(p_postmortem_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pm RECORD;
  v_action_count INTEGER;
BEGIN
  SELECT * INTO v_pm FROM public.postmortems WHERE id = p_postmortem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'postmortem not found'; END IF;

  IF v_pm.author_id <> auth.uid() AND NOT public.is_workspace_admin(auth.uid(), v_pm.workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_pm.summary IS NULL OR length(trim(v_pm.summary)) < 10 THEN
    RAISE EXCEPTION 'summary required (min 10 chars)';
  END IF;
  IF v_pm.root_cause IS NULL OR length(trim(v_pm.root_cause)) < 10 THEN
    RAISE EXCEPTION 'root cause required (min 10 chars)';
  END IF;

  SELECT COUNT(*) INTO v_action_count FROM public.postmortem_action_items WHERE postmortem_id = p_postmortem_id;
  IF v_action_count < 1 THEN
    RAISE EXCEPTION 'at least 1 action item required';
  END IF;

  UPDATE public.postmortems
    SET status = 'published', published_at = now()
    WHERE id = p_postmortem_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'postmortem.published', 'postmortem', p_postmortem_id::text,
          jsonb_build_object('severity', v_pm.severity, 'action_items', v_action_count));

  RETURN jsonb_build_object('status', 'published', 'published_at', now(), 'action_items', v_action_count);
END;
$$;