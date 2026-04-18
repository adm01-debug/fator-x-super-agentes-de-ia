
-- ════════════════════════════════════════════════════════════════
-- QA V6.2 — Rewrite functions to use isolated email tables
-- ════════════════════════════════════════════════════════════════

-- ─── get_current_oncall: read email from oncall_schedule_emails ──
CREATE OR REPLACE FUNCTION public.get_current_oncall(p_workspace_id uuid)
RETURNS TABLE(user_id uuid, user_name text, user_email text, escalation_order integer, ends_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    os.user_id,
    os.user_name,
    CASE
      WHEN os.user_id = auth.uid() THEN oce.user_email
      WHEN public.is_workspace_admin(auth.uid(), os.workspace_id) THEN oce.user_email
      ELSE NULL
    END AS user_email,
    os.escalation_order,
    os.ends_at
  FROM public.oncall_schedule os
  LEFT JOIN public.oncall_schedule_emails oce ON oce.schedule_id = os.id
  WHERE os.workspace_id = p_workspace_id
    AND os.starts_at <= now()
    AND os.ends_at > now()
  ORDER BY os.escalation_order ASC
  LIMIT 5;
$function$;

-- ─── get_pending_invites_for_email: query the new emails table ───
CREATE OR REPLACE FUNCTION public.get_pending_invites_for_email(_email text)
RETURNS TABLE(id uuid, workspace_id uuid, role text, name text, invited_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL OR lower(v_user_email) <> lower(_email) THEN
    RAISE EXCEPTION 'forbidden: can only query own invites';
  END IF;

  RETURN QUERY
    SELECT m.id, m.workspace_id, m.role, m.name, m.invited_at
    FROM public.workspace_members m
    JOIN public.workspace_member_emails wme ON wme.member_id = m.id
    WHERE lower(wme.email) = lower(_email)
      AND m.accepted_at IS NULL;
END $function$;

-- ─── invite_workspace_member: atomic create-with-email ──────────
CREATE OR REPLACE FUNCTION public.invite_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_role text DEFAULT 'agent_viewer',
  p_name text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
  v_user_id uuid;
BEGIN
  -- Caller must be admin or workspace owner
  IF NOT (
    public.is_workspace_admin(auth.uid(), p_workspace_id)
    OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id AND w.owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden: only admins can invite members';
  END IF;

  v_user_id := COALESCE(p_user_id, gen_random_uuid());

  INSERT INTO public.workspace_members (workspace_id, user_id, role, name)
  VALUES (p_workspace_id, v_user_id, p_role, p_name)
  RETURNING id INTO v_member_id;

  INSERT INTO public.workspace_member_emails (member_id, workspace_id, user_id, email)
  VALUES (v_member_id, p_workspace_id, v_user_id, p_email);

  RETURN v_member_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.invite_workspace_member(uuid, text, text, text, uuid) TO authenticated;
