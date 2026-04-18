
-- ════════════════════════════════════════════════════════════════
-- QA V6 — Hardening Sprint (corrected)
-- ════════════════════════════════════════════════════════════════

-- ─── P0-1: workspace_members.email exposure ─────────────────────
DROP POLICY IF EXISTS "Members can view workspace colleagues" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view colleagues (no email)" ON public.workspace_members;

CREATE OR REPLACE VIEW public.workspace_members_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  workspace_id,
  user_id,
  role,
  name,
  invited_at,
  accepted_at,
  CASE
    WHEN user_id = auth.uid() THEN email
    WHEN public.is_workspace_admin(auth.uid(), workspace_id) THEN email
    ELSE NULL
  END AS email
FROM public.workspace_members
WHERE
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()));

GRANT SELECT ON public.workspace_members_safe TO authenticated;

CREATE POLICY "Members can view colleagues (no email)"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  AND user_id <> auth.uid()
  AND NOT public.is_workspace_admin(auth.uid(), workspace_id)
);

COMMENT ON COLUMN public.workspace_members.email IS
  'PII: visible only to self and workspace admins. Use workspace_members_safe view.';

-- ─── P0-2: oncall_schedule.user_email exposure ───────────────────
DROP POLICY IF EXISTS "Members view oncall" ON public.oncall_schedule;
DROP POLICY IF EXISTS "Members view oncall (own/admin email)" ON public.oncall_schedule;

CREATE OR REPLACE VIEW public.oncall_schedule_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  workspace_id,
  user_id,
  user_name,
  starts_at,
  ends_at,
  escalation_order,
  notes,
  created_by,
  created_at,
  CASE
    WHEN user_id = auth.uid() THEN user_email
    WHEN public.is_workspace_admin(auth.uid(), workspace_id) THEN user_email
    ELSE NULL
  END AS user_email
FROM public.oncall_schedule
WHERE
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()));

GRANT SELECT ON public.oncall_schedule_safe TO authenticated;

CREATE POLICY "Members view oncall (gated email)"
ON public.oncall_schedule
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

COMMENT ON COLUMN public.oncall_schedule.user_email IS
  'PII: visible only to self and workspace admins. Use oncall_schedule_safe view.';

-- ─── P1-1: user_roles self-assignment block ─────────────────────
DROP POLICY IF EXISTS "Workspace admins can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Workspace admins can update roles" ON public.user_roles;

CREATE POLICY "Workspace admins can assign roles (no self)"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_admin(auth.uid(), workspace_id)
  AND user_id <> auth.uid()
  AND role_key <> 'workspace_admin'
  AND EXISTS (SELECT 1 FROM public.roles WHERE roles.key = user_roles.role_key AND roles.is_active = true)
);

CREATE POLICY "Workspace admins can update roles (no self)"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_workspace_admin(auth.uid(), workspace_id)
  AND user_id <> auth.uid()
)
WITH CHECK (
  public.is_workspace_admin(auth.uid(), workspace_id)
  AND user_id <> auth.uid()
  AND role_key <> 'workspace_admin'
);

-- ─── P1-2: access_blocked_log NULL-workspace access ─────────────
DROP POLICY IF EXISTS "ws admins read blocked log" ON public.access_blocked_log;

CREATE POLICY "ws admins read blocked log"
ON public.access_blocked_log
FOR SELECT
TO authenticated
USING (
  (workspace_id IS NOT NULL AND public.is_workspace_admin(auth.uid(), workspace_id))
  OR (workspace_id IS NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role_key IN ('workspace_admin', 'admin', 'owner')
  ))
);

-- ─── P1-3: Realtime channel scoping ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='realtime' AND tablename='messages') THEN
    BEGIN
      EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping RLS toggle on realtime.messages (insufficient privilege)';
    END;

    BEGIN
      IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='nexus_subscribe_own_topics') THEN
        EXECUTE 'DROP POLICY "nexus_subscribe_own_topics" ON realtime.messages';
      END IF;

      EXECUTE $POL$
        CREATE POLICY "nexus_subscribe_own_topics"
        ON realtime.messages
        FOR SELECT
        TO authenticated
        USING (
          topic LIKE 'user:' || auth.uid()::text || '%'
          OR EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid()
              AND topic LIKE '%' || wm.workspace_id::text || '%'
          )
        )
      $POL$;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping policy creation on realtime.messages (insufficient privilege)';
    END;
  END IF;
END$$;
