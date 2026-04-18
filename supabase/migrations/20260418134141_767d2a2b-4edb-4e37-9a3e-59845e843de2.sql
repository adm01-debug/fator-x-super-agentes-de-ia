-- ============ RISK REGISTER ============
CREATE TABLE public.risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('strategic','operational','technical','security','compliance','financial','reputational')),
  likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  inherent_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
  residual_score INTEGER CHECK (residual_score IS NULL OR residual_score BETWEEN 1 AND 25),
  treatment TEXT NOT NULL DEFAULT 'mitigate' CHECK (treatment IN ('accept','mitigate','transfer','avoid')),
  mitigation_plan TEXT,
  owner_id UUID,
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified','assessed','treated','monitored','closed')),
  identified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_due TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  closed_at TIMESTAMPTZ,
  related_finding_id UUID REFERENCES public.pentest_findings(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_register_workspace ON public.risk_register(workspace_id);
CREATE INDEX idx_risk_register_status ON public.risk_register(workspace_id, status);
CREATE INDEX idx_risk_register_residual ON public.risk_register(workspace_id, residual_score DESC NULLS LAST);
CREATE INDEX idx_risk_register_review_due ON public.risk_register(workspace_id, next_review_due) WHERE status != 'closed';

ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view risks" ON public.risk_register FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Admins insert risks" ON public.risk_register FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update risks" ON public.risk_register FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER trg_risk_register_updated BEFORE UPDATE ON public.risk_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RISK REVIEW EVENTS ============
CREATE TABLE public.risk_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES public.risk_register(id) ON DELETE CASCADE,
  reviewed_by UUID NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_residual_score INTEGER,
  new_residual_score INTEGER,
  notes TEXT
);

CREATE INDEX idx_risk_reviews_risk ON public.risk_review_events(risk_id, reviewed_at DESC);

ALTER TABLE public.risk_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view reviews" ON public.risk_review_events FOR SELECT
  USING (risk_id IN (SELECT id FROM public.risk_register WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));
CREATE POLICY "Admins insert reviews" ON public.risk_review_events FOR INSERT
  WITH CHECK (risk_id IN (SELECT id FROM public.risk_register WHERE public.is_workspace_admin(auth.uid(), workspace_id)));

-- Trigger: ao INSERT em review, recalcula next_review_due e residual_score do risco
CREATE OR REPLACE FUNCTION public.handle_risk_review_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  -- Critical risks: 30d cycle, others: 90d
  v_interval := CASE WHEN NEW.new_residual_score >= 15 THEN interval '30 days' ELSE interval '90 days' END;

  UPDATE public.risk_register
    SET residual_score = COALESCE(NEW.new_residual_score, residual_score),
        next_review_due = NEW.reviewed_at + v_interval,
        status = CASE WHEN status = 'identified' THEN 'assessed' ELSE status END,
        updated_at = now()
    WHERE id = NEW.risk_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_risk_review_event AFTER INSERT ON public.risk_review_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_risk_review_event();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.register_risk(
  p_workspace_id UUID, p_title TEXT, p_description TEXT, p_category TEXT,
  p_likelihood INTEGER, p_impact INTEGER, p_treatment TEXT DEFAULT 'mitigate',
  p_mitigation_plan TEXT DEFAULT NULL, p_owner_id UUID DEFAULT NULL,
  p_related_finding_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  INSERT INTO public.risk_register(
    workspace_id, title, description, category, likelihood, impact, treatment,
    mitigation_plan, owner_id, related_finding_id, created_by
  ) VALUES (
    p_workspace_id, p_title, p_description, p_category, p_likelihood, p_impact, p_treatment,
    p_mitigation_plan, p_owner_id, p_related_finding_id, auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'risk.registered', 'risk', v_id::text,
          jsonb_build_object('title', p_title, 'category', p_category, 'inherent', p_likelihood * p_impact));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.review_risk(
  p_risk_id UUID, p_new_residual_score INTEGER, p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_workspace UUID; v_prev INTEGER; v_event_id UUID;
BEGIN
  SELECT workspace_id, residual_score INTO v_workspace, v_prev FROM public.risk_register WHERE id = p_risk_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'risk not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  IF p_new_residual_score IS NOT NULL AND (p_new_residual_score < 1 OR p_new_residual_score > 25) THEN
    RAISE EXCEPTION 'residual score must be between 1 and 25';
  END IF;

  INSERT INTO public.risk_review_events(risk_id, reviewed_by, previous_residual_score, new_residual_score, notes)
  VALUES (p_risk_id, auth.uid(), v_prev, p_new_residual_score, p_notes)
  RETURNING id INTO v_event_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'risk.reviewed', 'risk', p_risk_id::text,
          jsonb_build_object('previous', v_prev, 'new', p_new_residual_score));
  RETURN v_event_id;
END $$;

CREATE OR REPLACE FUNCTION public.close_risk(p_risk_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace UUID;
BEGIN
  SELECT workspace_id INTO v_workspace FROM public.risk_register WHERE id = p_risk_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'risk not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  UPDATE public.risk_register
    SET status = 'closed', closed_at = now(), updated_at = now()
    WHERE id = p_risk_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'risk.closed', 'risk', p_risk_id::text, jsonb_build_object('notes', p_notes));
END $$;

CREATE OR REPLACE FUNCTION public.get_risk_summary(p_workspace_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INTEGER; v_critical INTEGER; v_high INTEGER; v_medium INTEGER; v_low INTEGER;
  v_overdue INTEGER; v_untreated INTEGER; v_closed INTEGER;
  v_by_category JSONB; v_by_treatment JSONB; v_heatmap JSONB;
BEGIN
  IF NOT (p_workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status != 'closed'),
    COUNT(*) FILTER (WHERE status != 'closed' AND COALESCE(residual_score, inherent_score) >= 15),
    COUNT(*) FILTER (WHERE status != 'closed' AND COALESCE(residual_score, inherent_score) BETWEEN 9 AND 14),
    COUNT(*) FILTER (WHERE status != 'closed' AND COALESCE(residual_score, inherent_score) BETWEEN 4 AND 8),
    COUNT(*) FILTER (WHERE status != 'closed' AND COALESCE(residual_score, inherent_score) <= 3),
    COUNT(*) FILTER (WHERE status != 'closed' AND next_review_due < now()),
    COUNT(*) FILTER (WHERE status IN ('identified','assessed') AND residual_score IS NULL),
    COUNT(*) FILTER (WHERE status = 'closed')
  INTO v_total, v_critical, v_high, v_medium, v_low, v_overdue, v_untreated, v_closed
  FROM public.risk_register WHERE workspace_id = p_workspace_id;

  SELECT COALESCE(jsonb_object_agg(category, cnt), '{}'::jsonb) INTO v_by_category FROM (
    SELECT category, COUNT(*) AS cnt FROM public.risk_register
    WHERE workspace_id = p_workspace_id AND status != 'closed' GROUP BY category
  ) x;

  SELECT COALESCE(jsonb_object_agg(treatment, cnt), '{}'::jsonb) INTO v_by_treatment FROM (
    SELECT treatment, COUNT(*) AS cnt FROM public.risk_register
    WHERE workspace_id = p_workspace_id AND status != 'closed' GROUP BY treatment
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('likelihood', likelihood, 'impact', impact, 'count', cnt)), '[]'::jsonb)
  INTO v_heatmap FROM (
    SELECT likelihood, impact, COUNT(*) AS cnt FROM public.risk_register
    WHERE workspace_id = p_workspace_id AND status != 'closed' GROUP BY likelihood, impact
  ) x;

  RETURN jsonb_build_object(
    'total', v_total, 'critical', v_critical, 'high', v_high, 'medium', v_medium, 'low', v_low,
    'overdue_reviews', v_overdue, 'untreated', v_untreated, 'closed', v_closed,
    'by_category', v_by_category, 'by_treatment', v_by_treatment, 'heatmap', v_heatmap
  );
END $$;