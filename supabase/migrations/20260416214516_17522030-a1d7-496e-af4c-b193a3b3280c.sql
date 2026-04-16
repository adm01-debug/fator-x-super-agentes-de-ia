-- Module #16 Automações: rules + execution logs
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('interaction_created','interaction_length','manual','scheduled','webhook')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL CHECK (action_type IN ('disc_analysis','eq_analysis','bias_analysis','full_pipeline','notify','webhook')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_rules_workspace ON public.automation_rules(workspace_id);
CREATE INDEX idx_automation_rules_active ON public.automation_rules(is_active) WHERE is_active = true;

CREATE TABLE public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success','failed','running','skipped')),
  trigger_payload JSONB,
  result JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_logs_rule ON public.automation_logs(rule_id, created_at DESC);
CREATE INDEX idx_automation_logs_workspace ON public.automation_logs(workspace_id, created_at DESC);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read rules" ON public.automation_rules FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "members create rules" ON public.automation_rules FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())) AND created_by = auth.uid());
CREATE POLICY "admins update rules" ON public.automation_rules FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "admins delete rules" ON public.automation_rules FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "members read logs" ON public.automation_logs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE TRIGGER set_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();