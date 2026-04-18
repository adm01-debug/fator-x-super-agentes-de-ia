-- DR Drills table
CREATE TABLE public.dr_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('full','workspace','table')),
  target_tables TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','snapshotting','restoring','validating','completed','failed','cancelled')),
  rto_target_seconds INTEGER NOT NULL DEFAULT 900,
  rpo_target_seconds INTEGER NOT NULL DEFAULT 300,
  actual_rto_seconds INTEGER,
  actual_rpo_seconds INTEGER,
  success BOOLEAN,
  error_message TEXT,
  executor_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dr_drills_workspace ON public.dr_drills(workspace_id, scheduled_at DESC);
CREATE INDEX idx_dr_drills_status ON public.dr_drills(status);

-- DR Snapshots
CREATE TABLE public.dr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES public.dr_drills(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  row_count BIGINT NOT NULL DEFAULT 0,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dr_snapshots_drill ON public.dr_snapshots(drill_id, table_name);

-- DR Restore Logs
CREATE TABLE public.dr_restore_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES public.dr_drills(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('snapshot','isolate','restore','validate','cleanup')),
  status TEXT NOT NULL CHECK (status IN ('started','succeeded','failed','skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_dr_restore_logs_drill ON public.dr_restore_logs(drill_id, started_at);

-- Enable RLS
ALTER TABLE public.dr_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dr_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dr_restore_logs ENABLE ROW LEVEL SECURITY;

-- RLS: dr_drills
CREATE POLICY "Members can view drills" ON public.dr_drills
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Admins can insert drills" ON public.dr_drills
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins can update drills" ON public.dr_drills
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete drills" ON public.dr_drills
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- RLS: dr_snapshots
CREATE POLICY "Members can view snapshots" ON public.dr_snapshots
  FOR SELECT TO authenticated
  USING (drill_id IN (SELECT id FROM public.dr_drills WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- RLS: dr_restore_logs
CREATE POLICY "Members can view restore logs" ON public.dr_restore_logs
  FOR SELECT TO authenticated
  USING (drill_id IN (SELECT id FROM public.dr_drills WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

-- Updated_at trigger
CREATE TRIGGER trg_dr_drills_updated_at
  BEFORE UPDATE ON public.dr_drills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dr_drills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dr_restore_logs;

-- RPC: start_dr_drill (snapshots row counts + checksums)
CREATE OR REPLACE FUNCTION public.start_dr_drill(p_drill_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drill public.dr_drills%ROWTYPE;
  v_table TEXT;
  v_count BIGINT;
  v_checksum TEXT;
  v_total_tables INTEGER := 0;
BEGIN
  SELECT * INTO v_drill FROM public.dr_drills WHERE id = p_drill_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'drill not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_drill.workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  IF v_drill.status NOT IN ('scheduled','failed') THEN
    RAISE EXCEPTION 'drill not in scheduled state (current: %)', v_drill.status;
  END IF;

  UPDATE public.dr_drills
    SET status = 'snapshotting', started_at = now(), executor_id = auth.uid()
    WHERE id = p_drill_id;

  INSERT INTO public.dr_restore_logs(drill_id, step, status, metadata)
  VALUES (p_drill_id, 'snapshot', 'started', jsonb_build_object('tables', v_drill.target_tables));

  -- Snapshot row counts + checksums for each target table
  FOREACH v_table IN ARRAY v_drill.target_tables LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_count;
      EXECUTE format('SELECT md5(string_agg(t::text, '''' ORDER BY t::text)) FROM (SELECT * FROM public.%I LIMIT 1000) t', v_table) INTO v_checksum;

      INSERT INTO public.dr_snapshots(drill_id, table_name, row_count, checksum, snapshot_data)
      VALUES (p_drill_id, v_table, COALESCE(v_count, 0), COALESCE(v_checksum, ''),
              jsonb_build_object('captured_at', now(), 'method', 'count+md5'));
      v_total_tables := v_total_tables + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.dr_restore_logs(drill_id, step, status, error_message, metadata)
      VALUES (p_drill_id, 'snapshot', 'failed', SQLERRM, jsonb_build_object('table', v_table));
    END;
  END LOOP;

  INSERT INTO public.dr_restore_logs(drill_id, step, status, ended_at, duration_ms, metadata)
  VALUES (p_drill_id, 'snapshot', 'succeeded', now(), 0, jsonb_build_object('tables_snapshotted', v_total_tables));

  RETURN jsonb_build_object('status','snapshotting','tables_snapshotted', v_total_tables, 'started_at', now());
END;
$$;

-- RPC: record_dr_step
CREATE OR REPLACE FUNCTION public.record_dr_step(
  p_drill_id UUID,
  p_step TEXT,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_error TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_drill_status TEXT;
BEGIN
  INSERT INTO public.dr_restore_logs(drill_id, step, status, ended_at, error_message, metadata)
  VALUES (p_drill_id, p_step, p_status,
          CASE WHEN p_status IN ('succeeded','failed','skipped') THEN now() ELSE NULL END,
          p_error, p_metadata)
  RETURNING id INTO v_id;

  -- Advance drill status based on step
  v_drill_status := CASE p_step
    WHEN 'isolate' THEN 'restoring'
    WHEN 'restore' THEN 'restoring'
    WHEN 'validate' THEN 'validating'
    ELSE NULL
  END;

  IF v_drill_status IS NOT NULL AND p_status = 'started' THEN
    UPDATE public.dr_drills SET status = v_drill_status WHERE id = p_drill_id;
  END IF;

  RETURN v_id;
END;
$$;

-- RPC: complete_dr_drill
CREATE OR REPLACE FUNCTION public.complete_dr_drill(
  p_drill_id UUID,
  p_actual_rto_seconds INTEGER,
  p_actual_rpo_seconds INTEGER,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drill public.dr_drills%ROWTYPE;
  v_rto_ok BOOLEAN;
  v_rpo_ok BOOLEAN;
BEGIN
  SELECT * INTO v_drill FROM public.dr_drills WHERE id = p_drill_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'drill not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_drill.workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_rto_ok := p_actual_rto_seconds <= v_drill.rto_target_seconds;
  v_rpo_ok := p_actual_rpo_seconds <= v_drill.rpo_target_seconds;

  UPDATE public.dr_drills
    SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
        ended_at = now(),
        actual_rto_seconds = p_actual_rto_seconds,
        actual_rpo_seconds = p_actual_rpo_seconds,
        success = p_success,
        error_message = p_error_message
    WHERE id = p_drill_id;

  INSERT INTO public.dr_restore_logs(drill_id, step, status, ended_at, metadata)
  VALUES (p_drill_id, 'cleanup', 'succeeded', now(),
          jsonb_build_object('rto_ok', v_rto_ok, 'rpo_ok', v_rpo_ok,
                             'rto_target', v_drill.rto_target_seconds,
                             'rpo_target', v_drill.rpo_target_seconds,
                             'rto_actual', p_actual_rto_seconds,
                             'rpo_actual', p_actual_rpo_seconds));

  RETURN jsonb_build_object(
    'status', CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    'rto_ok', v_rto_ok,
    'rpo_ok', v_rpo_ok,
    'rto_actual', p_actual_rto_seconds,
    'rpo_actual', p_actual_rpo_seconds
  );
END;
$$;