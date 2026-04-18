-- QA Sprint: fix swapped is_workspace_admin args + restrict workflow_runs policies to authenticated
-- Source: security--run_security_scan findings P1

-- 1) compliance_evidence: fix swapped args on "Admins manage compliance evidence"
DROP POLICY IF EXISTS "Admins manage compliance evidence" ON public.compliance_evidence;
CREATE POLICY "Admins manage compliance evidence"
ON public.compliance_evidence
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_reports r
    WHERE r.id = compliance_evidence.report_id
      AND public.is_workspace_admin(auth.uid(), r.workspace_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compliance_reports r
    WHERE r.id = compliance_evidence.report_id
      AND public.is_workspace_admin(auth.uid(), r.workspace_id)
  )
);

-- 2) compliance_reports: fix swapped args on insert/update/delete admin policies
DROP POLICY IF EXISTS "Admins create compliance reports" ON public.compliance_reports;
CREATE POLICY "Admins create compliance reports"
ON public.compliance_reports
FOR INSERT
TO authenticated
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Admins update compliance reports" ON public.compliance_reports;
CREATE POLICY "Admins update compliance reports"
ON public.compliance_reports
FOR UPDATE
TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Admins delete compliance reports" ON public.compliance_reports;
CREATE POLICY "Admins delete compliance reports"
ON public.compliance_reports
FOR DELETE
TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- 3) agent_workflow_runs: restrict policies from public to authenticated only
DROP POLICY IF EXISTS "Create workflow runs" ON public.agent_workflow_runs;
CREATE POLICY "Create workflow runs"
ON public.agent_workflow_runs
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "View workflow runs" ON public.agent_workflow_runs;
CREATE POLICY "View workflow runs"
ON public.agent_workflow_runs
FOR SELECT
TO authenticated
USING (
  workflow_id IN (
    SELECT id FROM public.agent_workflows
    WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Update workflow runs" ON public.agent_workflow_runs;
CREATE POLICY "Update workflow runs"
ON public.agent_workflow_runs
FOR UPDATE
TO authenticated
USING (
  workflow_id IN (
    SELECT id FROM public.agent_workflows
    WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  )
);
