-- Enums
CREATE TYPE public.change_type AS ENUM ('standard', 'normal', 'emergency');
CREATE TYPE public.change_risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.change_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'rolled_back', 'failed');
CREATE TYPE public.change_decision AS ENUM ('approve', 'reject', 'request_changes');

-- change_requests
CREATE TABLE public.change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  change_type public.change_type NOT NULL DEFAULT 'normal',
  risk_level public.change_risk_level NOT NULL DEFAULT 'medium',
  affected_systems TEXT[] NOT NULL DEFAULT '{}',
  requested_by UUID NOT NULL,
  assigned_to UUID,
  status public.change_status NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rollback_plan TEXT,
  validation_steps TEXT,
  post_mortem_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_requests_workspace ON public.change_requests(workspace_id);
CREATE INDEX idx_change_requests_status ON public.change_requests(status);
CREATE INDEX idx_change_requests_scheduled ON public.change_requests(scheduled_for);

-- change_approvals
CREATE TABLE public.change_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  change_id UUID NOT NULL REFERENCES public.change_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  decision public.change_decision NOT NULL,
  comment TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_approvals_change ON public.change_approvals(change_id);

-- freeze_windows
CREATE TABLE public.freeze_windows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reason TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  allow_emergency BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_freeze_windows_workspace ON public.freeze_windows(workspace_id);
CREATE INDEX idx_freeze_windows_period ON public.freeze_windows(starts_at, ends_at);

-- updated_at trigger
CREATE TRIGGER trg_change_requests_updated_at
  BEFORE UPDATE ON public.change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Freeze validation trigger
CREATE OR REPLACE FUNCTION public.enforce_freeze_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freeze RECORD;
BEGIN
  IF NEW.scheduled_for IS NULL OR NEW.status NOT IN ('approved', 'scheduled') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_freeze
  FROM public.freeze_windows
  WHERE workspace_id = NEW.workspace_id
    AND NEW.scheduled_for BETWEEN starts_at AND ends_at
  LIMIT 1;

  IF FOUND THEN
    IF NEW.change_type = 'emergency' AND v_freeze.allow_emergency THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Mudança agendada dentro de janela de freeze ativa: %', v_freeze.name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_change_requests_freeze
  BEFORE INSERT OR UPDATE ON public.change_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_freeze_window();

-- Enable RLS
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freeze_windows ENABLE ROW LEVEL SECURITY;

-- RLS: change_requests
CREATE POLICY "Members view change requests"
ON public.change_requests FOR SELECT
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Members create change requests"
ON public.change_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY "Requester or admin updates change requests"
ON public.change_requests FOR UPDATE
USING (
  public.is_workspace_admin(auth.uid(), workspace_id)
  OR (requested_by = auth.uid() AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
);

CREATE POLICY "Admin deletes change requests"
ON public.change_requests FOR DELETE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- RLS: change_approvals
CREATE POLICY "Members view approvals"
ON public.change_approvals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.change_requests cr
  WHERE cr.id = change_id
    AND cr.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
));

CREATE POLICY "Admins insert approvals"
ON public.change_approvals FOR INSERT
WITH CHECK (
  approver_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.change_requests cr
    WHERE cr.id = change_id AND public.is_workspace_admin(auth.uid(), cr.workspace_id)
  )
);

-- RLS: freeze_windows
CREATE POLICY "Members view freeze windows"
ON public.freeze_windows FOR SELECT
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Admins manage freeze windows"
ON public.freeze_windows FOR ALL
USING (public.is_workspace_admin(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- RPCs
CREATE OR REPLACE FUNCTION public.submit_change_request(
  p_workspace_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_change_type public.change_type,
  p_risk_level public.change_risk_level,
  p_affected_systems TEXT[],
  p_scheduled_for TIMESTAMPTZ,
  p_rollback_plan TEXT,
  p_validation_steps TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_workspace_id NOT IN (SELECT public.get_user_workspace_ids(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.change_requests (
    workspace_id, title, description, change_type, risk_level,
    affected_systems, requested_by, status, scheduled_for,
    rollback_plan, validation_steps
  ) VALUES (
    p_workspace_id, p_title, p_description, p_change_type, p_risk_level,
    COALESCE(p_affected_systems, '{}'), auth.uid(), 'pending_approval', p_scheduled_for,
    p_rollback_plan, p_validation_steps
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_change(
  p_change_id UUID,
  p_decision public.change_decision,
  p_comment TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace UUID;
BEGIN
  SELECT workspace_id INTO v_workspace FROM public.change_requests WHERE id = p_change_id;
  IF v_workspace IS NULL THEN
    RAISE EXCEPTION 'Mudança não encontrada';
  END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'Apenas admins podem decidir mudanças';
  END IF;

  INSERT INTO public.change_approvals (change_id, approver_id, decision, comment)
  VALUES (p_change_id, auth.uid(), p_decision, p_comment);

  UPDATE public.change_requests
  SET status = CASE
    WHEN p_decision = 'approve' THEN 'approved'::public.change_status
    WHEN p_decision = 'reject' THEN 'rejected'::public.change_status
    ELSE 'draft'::public.change_status
  END
  WHERE id = p_change_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_change(
  p_change_id UUID,
  p_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace UUID;
  v_status public.change_status;
BEGIN
  SELECT workspace_id, status INTO v_workspace, v_status
  FROM public.change_requests WHERE id = p_change_id;
  IF v_workspace IS NULL THEN
    RAISE EXCEPTION 'Mudança não encontrada';
  END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'Apenas admins executam mudanças';
  END IF;

  IF v_status = 'approved' THEN
    UPDATE public.change_requests
    SET status = 'in_progress', executed_at = now()
    WHERE id = p_change_id;
  ELSIF v_status = 'in_progress' THEN
    UPDATE public.change_requests
    SET status = CASE WHEN p_success THEN 'completed'::public.change_status ELSE 'failed'::public.change_status END,
        completed_at = now()
    WHERE id = p_change_id;
  ELSE
    RAISE EXCEPTION 'Mudança não está em estado executável (atual: %)', v_status;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_change(
  p_change_id UUID,
  p_post_mortem_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace UUID;
BEGIN
  SELECT workspace_id INTO v_workspace FROM public.change_requests WHERE id = p_change_id;
  IF v_workspace IS NULL THEN
    RAISE EXCEPTION 'Mudança não encontrada';
  END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'Apenas admins podem fazer rollback';
  END IF;
  IF p_post_mortem_url IS NULL OR length(trim(p_post_mortem_url)) = 0 THEN
    RAISE EXCEPTION 'post_mortem_url é obrigatório para rollback';
  END IF;

  UPDATE public.change_requests
  SET status = 'rolled_back', post_mortem_url = p_post_mortem_url, completed_at = now()
  WHERE id = p_change_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_change_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending INT;
  v_scheduled_7d INT;
  v_in_freeze INT;
  v_completed_30d INT;
  v_total_30d INT;
  v_success_rate NUMERIC;
BEGIN
  IF p_workspace_id NOT IN (SELECT public.get_user_workspace_ids(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT count(*) INTO v_pending FROM public.change_requests
   WHERE workspace_id = p_workspace_id AND status = 'pending_approval';

  SELECT count(*) INTO v_scheduled_7d FROM public.change_requests
   WHERE workspace_id = p_workspace_id
     AND status IN ('approved','scheduled')
     AND scheduled_for BETWEEN now() AND now() + interval '7 days';

  SELECT count(*) INTO v_in_freeze FROM public.freeze_windows
   WHERE workspace_id = p_workspace_id AND now() BETWEEN starts_at AND ends_at;

  SELECT count(*) INTO v_total_30d FROM public.change_requests
   WHERE workspace_id = p_workspace_id
     AND completed_at >= now() - interval '30 days'
     AND status IN ('completed','failed','rolled_back');

  SELECT count(*) INTO v_completed_30d FROM public.change_requests
   WHERE workspace_id = p_workspace_id
     AND completed_at >= now() - interval '30 days'
     AND status = 'completed';

  v_success_rate := CASE WHEN v_total_30d = 0 THEN 0 ELSE round((v_completed_30d::numeric / v_total_30d) * 100, 1) END;

  RETURN jsonb_build_object(
    'pending', v_pending,
    'scheduled_7d', v_scheduled_7d,
    'in_freeze', v_in_freeze,
    'success_rate_30d', v_success_rate,
    'total_30d', v_total_30d,
    'completed_30d', v_completed_30d
  );
END;
$$;