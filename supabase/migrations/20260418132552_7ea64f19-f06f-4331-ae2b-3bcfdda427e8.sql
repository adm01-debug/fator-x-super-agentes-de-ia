
-- Pentest engagements
CREATE TABLE public.pentest_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('black_box','grey_box','white_box','red_team')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scoping' CHECK (status IN ('scoping','in_progress','reporting','completed','cancelled')),
  report_url TEXT,
  executive_summary TEXT,
  total_findings INTEGER NOT NULL DEFAULT 0,
  lead_contact TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pentest_engagements_workspace ON public.pentest_engagements(workspace_id, status);

-- Pentest findings
CREATE TABLE public.pentest_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.pentest_engagements(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  cvss_score NUMERIC(3,1),
  category TEXT NOT NULL CHECK (category IN ('auth','injection','xss','csrf','crypto','config','logic','info_disclosure','other')),
  description TEXT,
  reproduction_steps TEXT,
  impact TEXT,
  recommendation TEXT,
  affected_assets TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_remediation','fixed','accepted_risk','false_positive')),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ,
  assigned_to UUID,
  fixed_at TIMESTAMPTZ,
  verification_notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pentest_findings_engagement ON public.pentest_findings(engagement_id);
CREATE INDEX idx_pentest_findings_workspace_status ON public.pentest_findings(workspace_id, status);
CREATE INDEX idx_pentest_findings_due ON public.pentest_findings(due_date) WHERE status IN ('open','in_remediation');

-- RLS
ALTER TABLE public.pentest_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pentest_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view engagements" ON public.pentest_engagements FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Admins insert engagements" ON public.pentest_engagements FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update engagements" ON public.pentest_engagements FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins delete engagements" ON public.pentest_engagements FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Members view findings" ON public.pentest_findings FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Admins insert findings" ON public.pentest_findings FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update findings" ON public.pentest_findings FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins delete findings" ON public.pentest_findings FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Trigger: auto-calculate due_date based on severity
CREATE OR REPLACE FUNCTION public.set_pentest_finding_due_date()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_date := NEW.discovered_at + CASE NEW.severity
      WHEN 'critical' THEN interval '7 days'
      WHEN 'high' THEN interval '30 days'
      WHEN 'medium' THEN interval '90 days'
      WHEN 'low' THEN interval '180 days'
      ELSE interval '365 days'
    END;
  END IF;
  IF NEW.status = 'fixed' AND NEW.fixed_at IS NULL THEN
    NEW.fixed_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pentest_finding_due_date
  BEFORE INSERT OR UPDATE ON public.pentest_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_pentest_finding_due_date();

-- Trigger: maintain total_findings count
CREATE OR REPLACE FUNCTION public.update_engagement_finding_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pentest_engagements SET total_findings = total_findings + 1, updated_at = now() WHERE id = NEW.engagement_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pentest_engagements SET total_findings = GREATEST(0, total_findings - 1), updated_at = now() WHERE id = OLD.engagement_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_pentest_finding_count
  AFTER INSERT OR DELETE ON public.pentest_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_engagement_finding_count();

-- Updated_at triggers
CREATE TRIGGER trg_pentest_engagement_updated BEFORE UPDATE ON public.pentest_engagements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pentest_finding_updated BEFORE UPDATE ON public.pentest_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: create engagement
CREATE OR REPLACE FUNCTION public.create_pentest_engagement(
  p_workspace_id UUID, p_name TEXT, p_vendor TEXT, p_engagement_type TEXT,
  p_scope JSONB DEFAULT '{}'::jsonb, p_started_at TIMESTAMPTZ DEFAULT NULL,
  p_lead_contact TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  INSERT INTO public.pentest_engagements(workspace_id, name, vendor, engagement_type, scope, started_at, lead_contact, notes, created_by)
  VALUES (p_workspace_id, p_name, p_vendor, p_engagement_type, p_scope, p_started_at, p_lead_contact, p_notes, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'pentest.engagement_created', 'pentest_engagement', v_id::text,
          jsonb_build_object('vendor', p_vendor, 'type', p_engagement_type));
  RETURN v_id;
END $$;

-- RPC: record finding
CREATE OR REPLACE FUNCTION public.record_pentest_finding(
  p_engagement_id UUID, p_title TEXT, p_severity TEXT, p_category TEXT,
  p_cvss_score NUMERIC DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_reproduction_steps TEXT DEFAULT NULL, p_impact TEXT DEFAULT NULL,
  p_recommendation TEXT DEFAULT NULL, p_affected_assets TEXT[] DEFAULT '{}'::text[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace UUID; v_id UUID;
BEGIN
  SELECT workspace_id INTO v_workspace FROM public.pentest_engagements WHERE id = p_engagement_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'engagement not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  INSERT INTO public.pentest_findings(engagement_id, workspace_id, title, severity, category, cvss_score,
    description, reproduction_steps, impact, recommendation, affected_assets, created_by)
  VALUES (p_engagement_id, v_workspace, p_title, p_severity, p_category, p_cvss_score,
    p_description, p_reproduction_steps, p_impact, p_recommendation, p_affected_assets, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'pentest.finding_recorded', 'pentest_finding', v_id::text,
          jsonb_build_object('severity', p_severity, 'category', p_category));
  RETURN v_id;
END $$;

-- RPC: update finding status
CREATE OR REPLACE FUNCTION public.update_pentest_finding_status(
  p_finding_id UUID, p_status TEXT, p_verification_notes TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace UUID;
BEGIN
  SELECT workspace_id INTO v_workspace FROM public.pentest_findings WHERE id = p_finding_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'finding not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  UPDATE public.pentest_findings
    SET status = p_status,
        verification_notes = COALESCE(p_verification_notes, verification_notes),
        fixed_at = CASE WHEN p_status = 'fixed' THEN now() ELSE fixed_at END,
        updated_at = now()
    WHERE id = p_finding_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'pentest.finding_status_changed', 'pentest_finding', p_finding_id::text,
          jsonb_build_object('new_status', p_status));
END $$;

-- RPC: summary
CREATE OR REPLACE FUNCTION public.get_pentest_summary(p_workspace_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_engagements INTEGER; v_open INTEGER; v_overdue INTEGER;
  v_critical_open INTEGER; v_high_open INTEGER;
  v_mttr_days NUMERIC;
BEGIN
  IF NOT (p_workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COUNT(*) INTO v_engagements FROM public.pentest_engagements WHERE workspace_id = p_workspace_id;
  SELECT COUNT(*) INTO v_open FROM public.pentest_findings WHERE workspace_id = p_workspace_id AND status IN ('open','in_remediation');
  SELECT COUNT(*) INTO v_overdue FROM public.pentest_findings WHERE workspace_id = p_workspace_id AND status IN ('open','in_remediation') AND due_date < now();
  SELECT COUNT(*) INTO v_critical_open FROM public.pentest_findings WHERE workspace_id = p_workspace_id AND status IN ('open','in_remediation') AND severity = 'critical';
  SELECT COUNT(*) INTO v_high_open FROM public.pentest_findings WHERE workspace_id = p_workspace_id AND status IN ('open','in_remediation') AND severity = 'high';
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fixed_at - discovered_at))/86400)::numeric, 1) INTO v_mttr_days
    FROM public.pentest_findings WHERE workspace_id = p_workspace_id AND status = 'fixed' AND fixed_at IS NOT NULL;
  RETURN jsonb_build_object(
    'engagements', v_engagements,
    'open_findings', v_open,
    'overdue', v_overdue,
    'critical_open', v_critical_open,
    'high_open', v_high_open,
    'mttr_days', COALESCE(v_mttr_days, 0)
  );
END $$;
