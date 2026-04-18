-- ============================================================================
-- Sprint 41 — Vendor Risk Management (TPRM)
-- SOC2 CC9.2 / ISO 27001 A.15 / LGPD Art.39
-- ============================================================================

-- 1) vendors
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('saas','processor','api','infra','consulting','other')),
  website TEXT,
  contact_email TEXT,
  criticality TEXT NOT NULL DEFAULT 'medium' CHECK (criticality IN ('critical','high','medium','low')),
  data_classification TEXT NOT NULL DEFAULT 'confidential' CHECK (data_classification IN ('pii','phi','financial','confidential','public')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','under_review','suspended','offboarded')),
  onboarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offboarded_at TIMESTAMPTZ,
  dpa_signed BOOLEAN NOT NULL DEFAULT false,
  dpa_expires_at TIMESTAMPTZ,
  soc2_valid_until TIMESTAMPTZ,
  iso27001_valid_until TIMESTAMPTZ,
  next_review_due TIMESTAMPTZ,
  notes TEXT,
  owner_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendors_workspace ON public.vendors(workspace_id);
CREATE INDEX idx_vendors_status ON public.vendors(workspace_id, status);
CREATE INDEX idx_vendors_criticality ON public.vendors(workspace_id, criticality);
CREATE INDEX idx_vendors_review_due ON public.vendors(next_review_due) WHERE status != 'offboarded';

-- 2) vendor_assessments
CREATE TABLE public.vendor_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  assessed_by UUID NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  security_score INTEGER NOT NULL CHECK (security_score BETWEEN 1 AND 5),
  compliance_score INTEGER NOT NULL CHECK (compliance_score BETWEEN 1 AND 5),
  operational_score INTEGER NOT NULL CHECK (operational_score BETWEEN 1 AND 5),
  risk_score INTEGER GENERATED ALWAYS AS (
    (6 - security_score) * (6 - compliance_score)
  ) STORED,
  findings TEXT[] NOT NULL DEFAULT '{}',
  recommendations TEXT,
  next_review_due TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_assessments_vendor ON public.vendor_assessments(vendor_id, assessed_at DESC);

-- 3) vendor_documents
CREATE TABLE public.vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('dpa','soc2','iso27001','pentest_report','questionnaire','contract','other')),
  title TEXT NOT NULL,
  file_url TEXT,
  valid_until TIMESTAMPTZ,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX idx_vendor_documents_vendor ON public.vendor_documents(vendor_id, uploaded_at DESC);
CREATE INDEX idx_vendor_documents_validity ON public.vendor_documents(valid_until) WHERE valid_until IS NOT NULL;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

-- vendors: members SELECT, admins INSERT/UPDATE
CREATE POLICY "vendors_select_members"
  ON public.vendors FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "vendors_insert_admins"
  ON public.vendors FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "vendors_update_admins"
  ON public.vendors FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "vendors_delete_admins"
  ON public.vendors FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- vendor_assessments
CREATE POLICY "vendor_assessments_select_members"
  ON public.vendor_assessments FOR SELECT
  USING (vendor_id IN (
    SELECT id FROM public.vendors WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  ));

CREATE POLICY "vendor_assessments_insert_admins"
  ON public.vendor_assessments FOR INSERT
  WITH CHECK (
    assessed_by = auth.uid()
    AND vendor_id IN (
      SELECT id FROM public.vendors WHERE public.is_workspace_admin(auth.uid(), workspace_id)
    )
  );

-- vendor_documents
CREATE POLICY "vendor_documents_select_members"
  ON public.vendor_documents FOR SELECT
  USING (vendor_id IN (
    SELECT id FROM public.vendors WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  ));

CREATE POLICY "vendor_documents_insert_admins"
  ON public.vendor_documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND vendor_id IN (
      SELECT id FROM public.vendors WHERE public.is_workspace_admin(auth.uid(), workspace_id)
    )
  );

CREATE POLICY "vendor_documents_delete_admins"
  ON public.vendor_documents FOR DELETE
  USING (vendor_id IN (
    SELECT id FROM public.vendors WHERE public.is_workspace_admin(auth.uid(), workspace_id)
  ));

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_vendor_assessment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crit TEXT;
  v_interval INTERVAL;
  v_next TIMESTAMPTZ;
BEGIN
  SELECT criticality INTO v_crit FROM public.vendors WHERE id = NEW.vendor_id;
  v_interval := CASE v_crit
    WHEN 'critical' THEN interval '90 days'
    WHEN 'high' THEN interval '180 days'
    ELSE interval '365 days'
  END;
  v_next := NEW.assessed_at + v_interval;

  -- Set on assessment row
  NEW.next_review_due := v_next;

  -- Update vendor
  UPDATE public.vendors
    SET next_review_due = v_next,
        updated_at = now()
    WHERE id = NEW.vendor_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_assessment
  BEFORE INSERT ON public.vendor_assessments
  FOR EACH ROW EXECUTE FUNCTION public.handle_vendor_assessment();

-- ============================================================================
-- RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_vendor(
  p_workspace_id UUID,
  p_name TEXT,
  p_vendor_type TEXT,
  p_criticality TEXT DEFAULT 'medium',
  p_data_classification TEXT DEFAULT 'confidential',
  p_website TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_dpa_signed BOOLEAN DEFAULT false,
  p_dpa_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_soc2_valid_until TIMESTAMPTZ DEFAULT NULL,
  p_iso27001_valid_until TIMESTAMPTZ DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_interval INTERVAL;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;

  v_interval := CASE p_criticality
    WHEN 'critical' THEN interval '90 days'
    WHEN 'high' THEN interval '180 days'
    ELSE interval '365 days'
  END;

  INSERT INTO public.vendors(
    workspace_id, name, vendor_type, criticality, data_classification,
    website, contact_email, dpa_signed, dpa_expires_at,
    soc2_valid_until, iso27001_valid_until, owner_id, notes,
    next_review_due, created_by
  ) VALUES (
    p_workspace_id, p_name, p_vendor_type, p_criticality, p_data_classification,
    p_website, p_contact_email, p_dpa_signed, p_dpa_expires_at,
    p_soc2_valid_until, p_iso27001_valid_until, p_owner_id, p_notes,
    now() + v_interval, auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'vendor.registered', 'vendor', v_id::text,
          jsonb_build_object('name', p_name, 'criticality', p_criticality, 'type', p_vendor_type));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assess_vendor(
  p_vendor_id UUID,
  p_security_score INTEGER,
  p_compliance_score INTEGER,
  p_operational_score INTEGER,
  p_findings TEXT[] DEFAULT '{}',
  p_recommendations TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws UUID;
  v_id UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.vendors WHERE id = p_vendor_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'vendor not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;

  INSERT INTO public.vendor_assessments(
    vendor_id, assessed_by, security_score, compliance_score, operational_score, findings, recommendations
  ) VALUES (
    p_vendor_id, auth.uid(), p_security_score, p_compliance_score, p_operational_score, p_findings, p_recommendations
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'vendor.assessed', 'vendor', p_vendor_id::text,
          jsonb_build_object('assessment_id', v_id, 'security', p_security_score, 'compliance', p_compliance_score, 'operational', p_operational_score));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.offboard_vendor(
  p_vendor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.vendors WHERE id = p_vendor_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'vendor not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;

  UPDATE public.vendors
    SET status = 'offboarded',
        offboarded_at = now(),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_vendor_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'vendor.offboarded', 'vendor', p_vendor_id::text,
          jsonb_build_object('notes', p_notes));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_summary(p_workspace_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_active INTEGER;
  v_critical INTEGER;
  v_dpa_expiring INTEGER;
  v_dpa_expired INTEGER;
  v_certs_expired INTEGER;
  v_overdue_reviews INTEGER;
  v_by_type jsonb;
  v_by_criticality jsonb;
BEGIN
  IF NOT (p_workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'active' AND criticality = 'critical'),
    COUNT(*) FILTER (WHERE status != 'offboarded' AND dpa_signed AND dpa_expires_at BETWEEN now() AND now() + interval '30 days'),
    COUNT(*) FILTER (WHERE status != 'offboarded' AND dpa_signed AND dpa_expires_at < now()),
    COUNT(*) FILTER (WHERE status != 'offboarded' AND ((soc2_valid_until IS NOT NULL AND soc2_valid_until < now()) OR (iso27001_valid_until IS NOT NULL AND iso27001_valid_until < now()))),
    COUNT(*) FILTER (WHERE status != 'offboarded' AND next_review_due IS NOT NULL AND next_review_due < now())
  INTO v_total, v_active, v_critical, v_dpa_expiring, v_dpa_expired, v_certs_expired, v_overdue_reviews
  FROM public.vendors
  WHERE workspace_id = p_workspace_id;

  SELECT COALESCE(jsonb_object_agg(vendor_type, c), '{}'::jsonb) INTO v_by_type
  FROM (SELECT vendor_type, COUNT(*) c FROM public.vendors WHERE workspace_id = p_workspace_id AND status != 'offboarded' GROUP BY vendor_type) t;

  SELECT COALESCE(jsonb_object_agg(criticality, c), '{}'::jsonb) INTO v_by_criticality
  FROM (SELECT criticality, COUNT(*) c FROM public.vendors WHERE workspace_id = p_workspace_id AND status != 'offboarded' GROUP BY criticality) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'critical', v_critical,
    'dpa_expiring', v_dpa_expiring,
    'dpa_expired', v_dpa_expired,
    'certs_expired', v_certs_expired,
    'overdue_reviews', v_overdue_reviews,
    'by_type', v_by_type,
    'by_criticality', v_by_criticality
  );
END;
$$;