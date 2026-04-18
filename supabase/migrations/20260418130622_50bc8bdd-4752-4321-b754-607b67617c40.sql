-- Managed secrets registry (metadata only — never stores secret values)
CREATE TABLE public.managed_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('api_key','oauth_client','db_password','jwt_signing','webhook_secret','encryption_key','ssh_key','certificate')),
  provider TEXT,
  environment TEXT NOT NULL DEFAULT 'prod' CHECK (environment IN ('prod','staging','dev')),
  rotation_interval_days INTEGER NOT NULL DEFAULT 90 CHECK (rotation_interval_days > 0),
  last_rotated_at TIMESTAMPTZ,
  next_rotation_due TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_rotation','overdue','retired')),
  owner_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(workspace_id, name, environment)
);

CREATE INDEX idx_managed_secrets_workspace ON public.managed_secrets(workspace_id);
CREATE INDEX idx_managed_secrets_status ON public.managed_secrets(workspace_id, status);
CREATE INDEX idx_managed_secrets_next_due ON public.managed_secrets(workspace_id, next_rotation_due) WHERE status != 'retired';

ALTER TABLE public.managed_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view managed secrets"
  ON public.managed_secrets FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Workspace admins can insert managed secrets"
  ON public.managed_secrets FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Workspace admins can update managed secrets"
  ON public.managed_secrets FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can delete managed secrets"
  ON public.managed_secrets FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Rotation events history
CREATE TABLE public.secret_rotation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secret_id UUID NOT NULL REFERENCES public.managed_secrets(id) ON DELETE CASCADE,
  rotated_by UUID NOT NULL,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL CHECK (reason IN ('scheduled','compromised','employee_offboarding','manual','policy_change')),
  previous_age_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_secret_rotation_events_secret ON public.secret_rotation_events(secret_id, rotated_at DESC);

ALTER TABLE public.secret_rotation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view rotation events"
  ON public.secret_rotation_events FOR SELECT
  USING (secret_id IN (
    SELECT id FROM public.managed_secrets
    WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  ));

CREATE POLICY "Workspace admins can insert rotation events"
  ON public.secret_rotation_events FOR INSERT
  WITH CHECK (
    rotated_by = auth.uid() AND
    secret_id IN (
      SELECT id FROM public.managed_secrets
      WHERE public.is_workspace_admin(auth.uid(), workspace_id)
    )
  );

-- Trigger to auto-update last_rotated_at and next_rotation_due
CREATE OR REPLACE FUNCTION public.handle_secret_rotation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval INTEGER;
BEGIN
  SELECT rotation_interval_days INTO v_interval
    FROM public.managed_secrets WHERE id = NEW.secret_id;

  UPDATE public.managed_secrets
    SET last_rotated_at = NEW.rotated_at,
        next_rotation_due = NEW.rotated_at + (v_interval || ' days')::interval,
        status = 'active',
        updated_at = now()
    WHERE id = NEW.secret_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_secret_rotation_event
AFTER INSERT ON public.secret_rotation_events
FOR EACH ROW EXECUTE FUNCTION public.handle_secret_rotation_event();

-- updated_at trigger
CREATE TRIGGER trg_managed_secrets_updated_at
BEFORE UPDATE ON public.managed_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: register a managed secret
CREATE OR REPLACE FUNCTION public.register_managed_secret(
  p_workspace_id UUID,
  p_name TEXT,
  p_category TEXT,
  p_provider TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT 'prod',
  p_rotation_interval_days INTEGER DEFAULT 90,
  p_owner_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_last_rotated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_last TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;

  v_last := COALESCE(p_last_rotated_at, now());
  v_next := v_last + (p_rotation_interval_days || ' days')::interval;

  INSERT INTO public.managed_secrets(
    workspace_id, name, category, provider, environment,
    rotation_interval_days, last_rotated_at, next_rotation_due,
    owner_id, notes, created_by, status
  ) VALUES (
    p_workspace_id, p_name, p_category, p_provider, p_environment,
    p_rotation_interval_days, v_last, v_next,
    p_owner_id, p_notes, auth.uid(),
    CASE WHEN v_next < now() THEN 'overdue'
         WHEN v_next < now() + interval '7 days' THEN 'pending_rotation'
         ELSE 'active' END
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'secret.registered', 'managed_secret', v_id::text,
          jsonb_build_object('name', p_name, 'category', p_category, 'environment', p_environment));

  RETURN v_id;
END;
$$;

-- RPC: record a rotation
CREATE OR REPLACE FUNCTION public.record_secret_rotation(
  p_secret_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret public.managed_secrets%ROWTYPE;
  v_age INTEGER;
  v_event_id UUID;
BEGIN
  SELECT * INTO v_secret FROM public.managed_secrets WHERE id = p_secret_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'secret not found'; END IF;

  IF NOT public.is_workspace_admin(auth.uid(), v_secret.workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;

  v_age := CASE WHEN v_secret.last_rotated_at IS NOT NULL
    THEN EXTRACT(DAY FROM (now() - v_secret.last_rotated_at))::int
    ELSE NULL END;

  INSERT INTO public.secret_rotation_events(secret_id, rotated_by, reason, previous_age_days, notes)
  VALUES (p_secret_id, auth.uid(), p_reason, v_age, p_notes)
  RETURNING id INTO v_event_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'secret.rotated', 'managed_secret', p_secret_id::text,
          jsonb_build_object('reason', p_reason, 'previous_age_days', v_age));

  RETURN v_event_id;
END;
$$;

-- RPC: retire a secret
CREATE OR REPLACE FUNCTION public.mark_secret_retired(
  p_secret_id UUID,
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
  SELECT workspace_id INTO v_ws FROM public.managed_secrets WHERE id = p_secret_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'secret not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;

  UPDATE public.managed_secrets
    SET status = 'retired',
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_secret_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'secret.retired', 'managed_secret', p_secret_id::text,
          jsonb_build_object('notes', p_notes));
END;
$$;

-- RPC: dashboard summary
CREATE OR REPLACE FUNCTION public.get_secrets_status_summary(p_workspace_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_active INTEGER;
  v_pending INTEGER;
  v_overdue INTEGER;
  v_retired INTEGER;
  v_by_category jsonb;
BEGIN
  IF NOT (p_workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active' AND (next_rotation_due IS NULL OR next_rotation_due > now() + interval '7 days')),
    COUNT(*) FILTER (WHERE status != 'retired' AND next_rotation_due BETWEEN now() AND now() + interval '7 days'),
    COUNT(*) FILTER (WHERE status != 'retired' AND next_rotation_due < now()),
    COUNT(*) FILTER (WHERE status = 'retired')
  INTO v_total, v_active, v_pending, v_overdue, v_retired
  FROM public.managed_secrets
  WHERE workspace_id = p_workspace_id;

  SELECT COALESCE(jsonb_object_agg(category, c), '{}'::jsonb) INTO v_by_category
  FROM (
    SELECT category, COUNT(*) AS c
    FROM public.managed_secrets
    WHERE workspace_id = p_workspace_id AND status != 'retired'
    GROUP BY category
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'pending', v_pending,
    'overdue', v_overdue,
    'retired', v_retired,
    'by_category', v_by_category
  );
END;
$$;

-- Auto-update status based on next_rotation_due (cron-friendly RPC)
CREATE OR REPLACE FUNCTION public.refresh_secrets_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overdue INTEGER;
  v_pending INTEGER;
BEGIN
  UPDATE public.managed_secrets
    SET status = 'overdue', updated_at = now()
    WHERE status != 'retired'
      AND status != 'overdue'
      AND next_rotation_due < now();
  GET DIAGNOSTICS v_overdue = ROW_COUNT;

  UPDATE public.managed_secrets
    SET status = 'pending_rotation', updated_at = now()
    WHERE status = 'active'
      AND next_rotation_due BETWEEN now() AND now() + interval '7 days';
  GET DIAGNOSTICS v_pending = ROW_COUNT;

  RETURN jsonb_build_object('marked_overdue', v_overdue, 'marked_pending', v_pending, 'checked_at', now());
END;
$$;