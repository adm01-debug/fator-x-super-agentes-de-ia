CREATE TABLE public.compliance_frameworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT NOT NULL DEFAULT 'manual',
  auto_check_query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(framework_id, code)
);

CREATE TABLE public.compliance_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id),
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_controls INTEGER NOT NULL DEFAULT 0,
  passed_controls INTEGER NOT NULL DEFAULT 0,
  failed_controls INTEGER NOT NULL DEFAULT 0,
  na_controls INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(5,2),
  notes TEXT,
  generated_by UUID NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.compliance_reports(id) ON DELETE CASCADE,
  control_id UUID NOT NULL REFERENCES public.compliance_controls(id),
  status TEXT NOT NULL DEFAULT 'pending',
  evidence_data JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  UNIQUE(report_id, control_id)
);

CREATE INDEX idx_compliance_controls_framework ON public.compliance_controls(framework_id);
CREATE INDEX idx_compliance_reports_workspace ON public.compliance_reports(workspace_id, created_at DESC);
CREATE INDEX idx_compliance_evidence_report ON public.compliance_evidence(report_id);

ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frameworks viewable by authenticated"
  ON public.compliance_frameworks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Controls viewable by authenticated"
  ON public.compliance_controls FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members view compliance reports"
  ON public.compliance_reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = compliance_reports.workspace_id
      AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Admins create compliance reports"
  ON public.compliance_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Admins update compliance reports"
  ON public.compliance_reports FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Admins delete compliance reports"
  ON public.compliance_reports FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Members view compliance evidence"
  ON public.compliance_evidence FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.compliance_reports r
    JOIN public.workspace_members wm ON wm.workspace_id = r.workspace_id
    WHERE r.id = compliance_evidence.report_id
      AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Admins manage compliance evidence"
  ON public.compliance_evidence FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.compliance_reports r
    WHERE r.id = compliance_evidence.report_id
      AND public.is_workspace_admin(r.workspace_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.compliance_reports r
    WHERE r.id = compliance_evidence.report_id
      AND public.is_workspace_admin(r.workspace_id, auth.uid())
  ));

CREATE TRIGGER trg_compliance_reports_updated
  BEFORE UPDATE ON public.compliance_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.compliance_frameworks (code, name, description, version) VALUES
  ('SOC2', 'SOC 2 Type II', 'Service Organization Control 2 — Trust Services Criteria', '2017'),
  ('ISO27001', 'ISO/IEC 27001', 'Information Security Management System', '2022'),
  ('LGPD', 'LGPD Brasil', 'Lei Geral de Proteção de Dados — Brasil', '2020');

INSERT INTO public.compliance_controls (framework_id, code, category, title, description, evidence_type, auto_check_query)
SELECT f.id, c.code, c.category, c.title, c.description, c.evidence_type, c.auto_check_query
FROM public.compliance_frameworks f
CROSS JOIN (VALUES
  ('SOC2','CC6.1','Logical Access','Logical access security software','Restrict logical access through authentication','auto','SELECT count(*) FROM auth.users'),
  ('SOC2','CC6.2','Logical Access','New user registration and authorization','Users registered and authorized prior to access','auto','SELECT count(*) FROM public.workspace_members'),
  ('SOC2','CC6.3','Logical Access','Role-based access controls','RBAC enforced via RLS','auto','SELECT count(*) FROM pg_policies WHERE schemaname=''public'''),
  ('SOC2','CC7.1','System Operations','Detection of security events','Monitoring and audit logs in place','auto','SELECT count(*) FROM public.audit_log WHERE created_at > now() - interval ''30 days'''),
  ('SOC2','CC7.2','System Operations','Anomaly detection','Cost/SLO/security anomaly detection active','auto','SELECT count(*) FROM public.cost_alerts'),
  ('SOC2','CC7.3','System Operations','Incident response','Documented incident playbooks and runs','auto','SELECT count(*) FROM public.incident_playbooks'),
  ('SOC2','CC7.4','System Operations','Postmortem process','Blameless postmortems for incidents','auto','SELECT count(*) FROM public.postmortems'),
  ('SOC2','CC9.1','Risk Mitigation','Disaster recovery testing','Periodic DR drills with RTO/RPO targets','auto','SELECT count(*) FROM public.dr_drills'),
  ('ISO27001','A.5.1','Information Security Policies','Policies for information security','Documented security policies','manual',NULL),
  ('ISO27001','A.8.2','Asset Management','Information classification','Workspace data isolation via RLS','auto','SELECT count(*) FROM pg_policies WHERE schemaname=''public'''),
  ('ISO27001','A.9.2','Access Control','User access management','Workspace members and roles','auto','SELECT count(*) FROM public.workspace_members'),
  ('ISO27001','A.12.4','Operations Security','Logging and monitoring','Audit logs retained','auto','SELECT count(*) FROM public.audit_log'),
  ('ISO27001','A.16.1','Incident Management','Incident response procedures','Incident playbooks documented','auto','SELECT count(*) FROM public.incident_playbooks'),
  ('ISO27001','A.17.1','Business Continuity','Continuity planning','DR drills executed regularly','auto','SELECT count(*) FROM public.dr_drills'),
  ('LGPD','Art.37','Governança LGPD','Encarregado de dados (DPO)','DPO designado e contato registrado','manual',NULL),
  ('LGPD','Art.46','Segurança','Medidas de segurança técnicas','RLS, criptografia em trânsito, audit log','auto','SELECT count(*) FROM pg_policies WHERE schemaname=''public'''),
  ('LGPD','Art.18','Direitos do titular','Atendimento a pedidos de exclusão','Pedidos de deleção registrados','auto','SELECT count(*) FROM public.data_deletion_requests'),
  ('LGPD','Art.8','Consentimento','Registro de consentimento','Consentimentos do usuário registrados','auto','SELECT count(*) FROM public.consent_records')
) AS c(fw, code, category, title, description, evidence_type, auto_check_query)
WHERE f.code = c.fw;

CREATE OR REPLACE FUNCTION public.generate_compliance_report(
  _workspace_id UUID,
  _framework_code TEXT,
  _name TEXT,
  _period_start DATE,
  _period_end DATE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report_id UUID;
  _framework_id UUID;
  _control RECORD;
  _passed INTEGER := 0;
  _failed INTEGER := 0;
  _total INTEGER := 0;
  _check_count BIGINT;
  _evidence_status TEXT;
BEGIN
  IF NOT public.is_workspace_admin(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can generate compliance reports';
  END IF;

  SELECT id INTO _framework_id FROM public.compliance_frameworks WHERE code = _framework_code;
  IF _framework_id IS NULL THEN
    RAISE EXCEPTION 'Framework % not found', _framework_code;
  END IF;

  INSERT INTO public.compliance_reports (
    workspace_id, framework_id, name, period_start, period_end, status, generated_by
  ) VALUES (
    _workspace_id, _framework_id, _name, _period_start, _period_end, 'draft', auth.uid()
  ) RETURNING id INTO _report_id;

  FOR _control IN
    SELECT * FROM public.compliance_controls WHERE framework_id = _framework_id
  LOOP
    _total := _total + 1;
    _evidence_status := 'pending';
    _check_count := 0;

    IF _control.evidence_type = 'auto' AND _control.auto_check_query IS NOT NULL THEN
      BEGIN
        EXECUTE _control.auto_check_query INTO _check_count;
        IF _check_count > 0 THEN
          _evidence_status := 'passed';
          _passed := _passed + 1;
        ELSE
          _evidence_status := 'failed';
          _failed := _failed + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        _evidence_status := 'failed';
        _failed := _failed + 1;
      END;
    END IF;

    INSERT INTO public.compliance_evidence (
      report_id, control_id, status, evidence_data
    ) VALUES (
      _report_id, _control.id, _evidence_status,
      jsonb_build_object('check_count', _check_count, 'auto', _control.evidence_type = 'auto')
    );
  END LOOP;

  UPDATE public.compliance_reports SET
    total_controls = _total,
    passed_controls = _passed,
    failed_controls = _failed,
    score = CASE WHEN _total > 0 THEN ROUND((_passed::numeric / _total) * 100, 2) ELSE 0 END
  WHERE id = _report_id;

  RETURN _report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_compliance_report(_report_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id UUID;
BEGIN
  SELECT workspace_id INTO _workspace_id FROM public.compliance_reports WHERE id = _report_id;
  IF NOT public.is_workspace_admin(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can publish reports';
  END IF;

  UPDATE public.compliance_reports
  SET status = 'published', published_at = now()
  WHERE id = _report_id;
END;
$$;