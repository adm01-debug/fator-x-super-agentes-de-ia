-- ============== Tables ==============
CREATE TABLE public.workspace_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  monthly_limit_usd NUMERIC(12,2),
  daily_limit_usd NUMERIC(12,2),
  hard_stop BOOLEAN NOT NULL DEFAULT false,
  soft_threshold_pct INTEGER NOT NULL DEFAULT 80 CHECK (soft_threshold_pct BETWEEN 1 AND 100),
  notify_emails TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.budget_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('soft_warning','hard_block','agent_paused','reset')),
  period TEXT NOT NULL CHECK (period IN ('daily','monthly')),
  period_spend_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  period_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  pct_used NUMERIC(6,2) NOT NULL DEFAULT 0,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_budget_events_workspace_time ON public.budget_events(workspace_id, triggered_at DESC);
CREATE INDEX idx_budget_events_type ON public.budget_events(event_type);

-- ============== RLS ==============
ALTER TABLE public.workspace_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace budget"
  ON public.workspace_budgets FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Admins can insert workspace budget"
  ON public.workspace_budgets FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins can update workspace budget"
  ON public.workspace_budgets FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete workspace budget"
  ON public.workspace_budgets FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Members can view budget events"
  ON public.budget_events FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- triggers
CREATE TRIGGER trg_workspace_budgets_updated
  BEFORE UPDATE ON public.workspace_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== RPCs ==============
CREATE OR REPLACE FUNCTION public.get_current_spend(p_workspace_id UUID, p_period TEXT DEFAULT 'monthly')
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ;
  v_spend NUMERIC := 0;
BEGIN
  IF NOT (p_workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_since := CASE
    WHEN p_period = 'daily' THEN date_trunc('day', now())
    ELSE date_trunc('month', now())
  END;
  SELECT COALESCE(SUM(t.cost_usd), 0) INTO v_spend
  FROM public.agent_traces t
  JOIN public.agents a ON a.id = t.agent_id
  WHERE a.workspace_id = p_workspace_id
    AND t.created_at >= v_since
    AND t.cost_usd IS NOT NULL;
  RETURN v_spend;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_budget(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_budget public.workspace_budgets%ROWTYPE;
  v_monthly_spend NUMERIC := 0;
  v_daily_spend NUMERIC := 0;
  v_monthly_pct NUMERIC := 0;
  v_daily_pct NUMERIC := 0;
  v_allowed BOOLEAN := true;
  v_reason TEXT := NULL;
  v_warning BOOLEAN := false;
BEGIN
  SELECT * INTO v_budget FROM public.workspace_budgets WHERE workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'configured', false);
  END IF;

  SELECT COALESCE(SUM(t.cost_usd), 0) INTO v_monthly_spend
    FROM public.agent_traces t JOIN public.agents a ON a.id = t.agent_id
    WHERE a.workspace_id = p_workspace_id AND t.created_at >= date_trunc('month', now()) AND t.cost_usd IS NOT NULL;
  SELECT COALESCE(SUM(t.cost_usd), 0) INTO v_daily_spend
    FROM public.agent_traces t JOIN public.agents a ON a.id = t.agent_id
    WHERE a.workspace_id = p_workspace_id AND t.created_at >= date_trunc('day', now()) AND t.cost_usd IS NOT NULL;

  IF v_budget.monthly_limit_usd IS NOT NULL AND v_budget.monthly_limit_usd > 0 THEN
    v_monthly_pct := ROUND((v_monthly_spend / v_budget.monthly_limit_usd) * 100, 2);
  END IF;
  IF v_budget.daily_limit_usd IS NOT NULL AND v_budget.daily_limit_usd > 0 THEN
    v_daily_pct := ROUND((v_daily_spend / v_budget.daily_limit_usd) * 100, 2);
  END IF;

  IF v_budget.hard_stop THEN
    IF v_budget.monthly_limit_usd IS NOT NULL AND v_monthly_spend >= v_budget.monthly_limit_usd THEN
      v_allowed := false; v_reason := 'monthly_limit_exceeded';
    ELSIF v_budget.daily_limit_usd IS NOT NULL AND v_daily_spend >= v_budget.daily_limit_usd THEN
      v_allowed := false; v_reason := 'daily_limit_exceeded';
    END IF;
  END IF;

  IF v_monthly_pct >= v_budget.soft_threshold_pct OR v_daily_pct >= v_budget.soft_threshold_pct THEN
    v_warning := true;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'configured', true,
    'reason', v_reason,
    'warning', v_warning,
    'hard_stop', v_budget.hard_stop,
    'monthly_spend', v_monthly_spend,
    'monthly_limit', v_budget.monthly_limit_usd,
    'monthly_pct', v_monthly_pct,
    'daily_spend', v_daily_spend,
    'daily_limit', v_budget.daily_limit_usd,
    'daily_pct', v_daily_pct,
    'soft_threshold_pct', v_budget.soft_threshold_pct
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_budget()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_monthly NUMERIC; v_daily NUMERIC;
  v_monthly_pct NUMERIC; v_daily_pct NUMERIC;
  v_blocked INTEGER := 0; v_warned INTEGER := 0; v_paused INTEGER := 0;
  v_paused_count INTEGER;
BEGIN
  FOR r IN SELECT * FROM public.workspace_budgets LOOP
    SELECT COALESCE(SUM(t.cost_usd),0) INTO v_monthly
      FROM public.agent_traces t JOIN public.agents a ON a.id=t.agent_id
      WHERE a.workspace_id=r.workspace_id AND t.created_at >= date_trunc('month', now()) AND t.cost_usd IS NOT NULL;
    SELECT COALESCE(SUM(t.cost_usd),0) INTO v_daily
      FROM public.agent_traces t JOIN public.agents a ON a.id=t.agent_id
      WHERE a.workspace_id=r.workspace_id AND t.created_at >= date_trunc('day', now()) AND t.cost_usd IS NOT NULL;

    v_monthly_pct := CASE WHEN r.monthly_limit_usd > 0 THEN ROUND((v_monthly/r.monthly_limit_usd)*100,2) ELSE 0 END;
    v_daily_pct := CASE WHEN r.daily_limit_usd > 0 THEN ROUND((v_daily/r.daily_limit_usd)*100,2) ELSE 0 END;

    -- Hard block (monthly)
    IF r.hard_stop AND r.monthly_limit_usd IS NOT NULL AND v_monthly >= r.monthly_limit_usd THEN
      IF NOT EXISTS (SELECT 1 FROM public.budget_events WHERE workspace_id=r.workspace_id AND event_type='hard_block' AND period='monthly' AND triggered_at >= date_trunc('month', now())) THEN
        INSERT INTO public.budget_events(workspace_id,event_type,period,period_spend_usd,period_limit_usd,pct_used)
          VALUES(r.workspace_id,'hard_block','monthly',v_monthly,r.monthly_limit_usd,v_monthly_pct);
        UPDATE public.agents SET status='paused' WHERE workspace_id=r.workspace_id AND status='active';
        GET DIAGNOSTICS v_paused_count = ROW_COUNT;
        IF v_paused_count > 0 THEN
          INSERT INTO public.budget_events(workspace_id,event_type,period,period_spend_usd,period_limit_usd,pct_used,metadata)
            VALUES(r.workspace_id,'agent_paused','monthly',v_monthly,r.monthly_limit_usd,v_monthly_pct,jsonb_build_object('paused_count',v_paused_count));
          v_paused := v_paused + v_paused_count;
        END IF;
        v_blocked := v_blocked + 1;
      END IF;
    -- Hard block (daily)
    ELSIF r.hard_stop AND r.daily_limit_usd IS NOT NULL AND v_daily >= r.daily_limit_usd THEN
      IF NOT EXISTS (SELECT 1 FROM public.budget_events WHERE workspace_id=r.workspace_id AND event_type='hard_block' AND period='daily' AND triggered_at >= date_trunc('day', now())) THEN
        INSERT INTO public.budget_events(workspace_id,event_type,period,period_spend_usd,period_limit_usd,pct_used)
          VALUES(r.workspace_id,'hard_block','daily',v_daily,r.daily_limit_usd,v_daily_pct);
        v_blocked := v_blocked + 1;
      END IF;
    -- Soft warning
    ELSIF v_monthly_pct >= r.soft_threshold_pct AND r.monthly_limit_usd IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.budget_events WHERE workspace_id=r.workspace_id AND event_type='soft_warning' AND period='monthly' AND triggered_at >= now() - interval '6 hours') THEN
        INSERT INTO public.budget_events(workspace_id,event_type,period,period_spend_usd,period_limit_usd,pct_used)
          VALUES(r.workspace_id,'soft_warning','monthly',v_monthly,r.monthly_limit_usd,v_monthly_pct);
        v_warned := v_warned + 1;
      END IF;
    ELSIF v_daily_pct >= r.soft_threshold_pct AND r.daily_limit_usd IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.budget_events WHERE workspace_id=r.workspace_id AND event_type='soft_warning' AND period='daily' AND triggered_at >= now() - interval '6 hours') THEN
        INSERT INTO public.budget_events(workspace_id,event_type,period,period_spend_usd,period_limit_usd,pct_used)
          VALUES(r.workspace_id,'soft_warning','daily',v_daily,r.daily_limit_usd,v_daily_pct);
        v_warned := v_warned + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('blocked',v_blocked,'warned',v_warned,'agents_paused',v_paused,'checked_at',now());
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_workspace_budget(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  UPDATE public.agents SET status='active' WHERE workspace_id=p_workspace_id AND status='paused';
  INSERT INTO public.budget_events(workspace_id,event_type,period,period_spend_usd,period_limit_usd,pct_used,metadata)
    VALUES(p_workspace_id,'reset','monthly',0,0,0,jsonb_build_object('reset_by',auth.uid()));
  RETURN jsonb_build_object('status','ok','reset_at',now());
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_events;