-- SBOM Snapshots
CREATE TABLE public.sbom_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'cyclonedx' CHECK (format IN ('cyclonedx','spdx')),
  source TEXT NOT NULL DEFAULT 'package.json' CHECK (source IN ('package.json','manual','upload')),
  total_components INTEGER NOT NULL DEFAULT 0,
  generated_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sbom_snapshots_workspace ON public.sbom_snapshots(workspace_id, created_at DESC);

-- SBOM Components
CREATE TABLE public.sbom_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.sbom_snapshots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  ecosystem TEXT NOT NULL DEFAULT 'npm' CHECK (ecosystem IN ('npm','deno','pypi','cargo','go','maven','rubygems')),
  license TEXT,
  direct BOOLEAN NOT NULL DEFAULT true,
  supplier TEXT,
  purl TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sbom_components_snapshot ON public.sbom_components(snapshot_id);
CREATE INDEX idx_sbom_components_name_version ON public.sbom_components(name, version);

-- Vulnerability Findings
CREATE TABLE public.vulnerability_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES public.sbom_snapshots(id) ON DELETE CASCADE,
  component_id UUID REFERENCES public.sbom_components(id) ON DELETE CASCADE,
  cve_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  cvss_score NUMERIC(3,1),
  summary TEXT,
  fixed_version TEXT,
  reference_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','fixed','accepted_risk')),
  notes TEXT,
  acknowledged_by UUID,
  resolved_by UUID,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_vuln_findings_workspace_status ON public.vulnerability_findings(workspace_id, status, severity);
CREATE INDEX idx_vuln_findings_snapshot ON public.vulnerability_findings(snapshot_id);

-- RLS
ALTER TABLE public.sbom_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbom_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sbom snapshots" ON public.sbom_snapshots
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Admins insert sbom snapshots" ON public.sbom_snapshots
  FOR INSERT WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins delete sbom snapshots" ON public.sbom_snapshots
  FOR DELETE USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Members view sbom components" ON public.sbom_components
  FOR SELECT USING (snapshot_id IN (SELECT id FROM public.sbom_snapshots WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));
CREATE POLICY "Admins insert sbom components" ON public.sbom_components
  FOR INSERT WITH CHECK (snapshot_id IN (SELECT id FROM public.sbom_snapshots WHERE public.is_workspace_admin(auth.uid(), workspace_id)));

CREATE POLICY "Members view vulnerabilities" ON public.vulnerability_findings
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Admins insert vulnerabilities" ON public.vulnerability_findings
  FOR INSERT WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update vulnerabilities" ON public.vulnerability_findings
  FOR UPDATE USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- RPCs
CREATE OR REPLACE FUNCTION public.create_sbom_snapshot(
  p_workspace_id UUID,
  p_name TEXT,
  p_format TEXT,
  p_source TEXT,
  p_components JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_snapshot_id UUID;
  v_comp JSONB;
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;

  INSERT INTO public.sbom_snapshots(workspace_id, name, format, source, generated_by, total_components)
  VALUES (p_workspace_id, p_name, COALESCE(p_format,'cyclonedx'), COALESCE(p_source,'package.json'), auth.uid(), 0)
  RETURNING id INTO v_snapshot_id;

  FOR v_comp IN SELECT * FROM jsonb_array_elements(p_components) LOOP
    INSERT INTO public.sbom_components(snapshot_id, name, version, ecosystem, license, direct, supplier, purl)
    VALUES (
      v_snapshot_id,
      v_comp->>'name',
      v_comp->>'version',
      COALESCE(v_comp->>'ecosystem','npm'),
      v_comp->>'license',
      COALESCE((v_comp->>'direct')::boolean, true),
      v_comp->>'supplier',
      v_comp->>'purl'
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.sbom_snapshots SET total_components = v_count WHERE id = v_snapshot_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'sbom.created', 'sbom_snapshot', v_snapshot_id::text,
          jsonb_build_object('components', v_count, 'name', p_name));

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_vulnerability(
  p_snapshot_id UUID,
  p_component_id UUID,
  p_cve_id TEXT,
  p_severity TEXT,
  p_cvss_score NUMERIC,
  p_summary TEXT,
  p_fixed_version TEXT,
  p_reference_url TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_finding_id UUID;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.sbom_snapshots WHERE id = p_snapshot_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'snapshot not found'; END IF;

  -- Dedupe: same snapshot + component + CVE
  SELECT id INTO v_finding_id FROM public.vulnerability_findings
   WHERE snapshot_id = p_snapshot_id AND COALESCE(component_id::text,'') = COALESCE(p_component_id::text,'') AND cve_id = p_cve_id LIMIT 1;
  IF v_finding_id IS NOT NULL THEN RETURN v_finding_id; END IF;

  INSERT INTO public.vulnerability_findings(workspace_id, snapshot_id, component_id, cve_id, severity, cvss_score, summary, fixed_version, reference_url)
  VALUES (v_workspace_id, p_snapshot_id, p_component_id, p_cve_id, p_severity, p_cvss_score, p_summary, p_fixed_version, p_reference_url)
  RETURNING id INTO v_finding_id;

  RETURN v_finding_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_vulnerability(p_finding_id UUID, p_notes TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.vulnerability_findings WHERE id = p_finding_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'finding not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.vulnerability_findings
    SET status = 'acknowledged', acknowledged_by = auth.uid(), notes = COALESCE(p_notes, notes)
    WHERE id = p_finding_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'vulnerability.acknowledged', 'vulnerability_finding', p_finding_id::text, jsonb_build_object('notes', p_notes));
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_vulnerability_fixed(p_finding_id UUID, p_notes TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.vulnerability_findings WHERE id = p_finding_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'finding not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.vulnerability_findings
    SET status = 'fixed', resolved_by = auth.uid(), resolved_at = now(), notes = COALESCE(p_notes, notes)
    WHERE id = p_finding_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'vulnerability.fixed', 'vulnerability_finding', p_finding_id::text, jsonb_build_object('notes', p_notes));
END;
$$;