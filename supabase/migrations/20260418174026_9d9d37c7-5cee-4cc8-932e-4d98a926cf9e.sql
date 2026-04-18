
-- ════════════════════════════════════════════════════════════════
-- QA V6.1 — Move PII to isolated tables (final, with view rebuild)
-- ════════════════════════════════════════════════════════════════

-- Drop dependent legacy view first (we'll recreate it properly)
DROP VIEW IF EXISTS public.workspace_members_directory CASCADE;

-- ─── A) workspace_member_emails ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_member_emails (
  member_id    uuid PRIMARY KEY REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  email        text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wme_workspace ON public.workspace_member_emails(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wme_user ON public.workspace_member_emails(user_id);

INSERT INTO public.workspace_member_emails (member_id, workspace_id, user_id, email)
SELECT id, workspace_id, user_id, email
FROM public.workspace_members
WHERE email IS NOT NULL
ON CONFLICT (member_id) DO NOTHING;

ALTER TABLE public.workspace_member_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self or admin reads email" ON public.workspace_member_emails;
CREATE POLICY "self or admin reads email"
ON public.workspace_member_emails FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "owner inserts emails" ON public.workspace_member_emails;
CREATE POLICY "owner inserts emails"
ON public.workspace_member_emails FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  OR public.is_workspace_admin(auth.uid(), workspace_id)
);

DROP POLICY IF EXISTS "self or admin updates email" ON public.workspace_member_emails;
CREATE POLICY "self or admin updates email"
ON public.workspace_member_emails FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_admin(auth.uid(), workspace_id))
WITH CHECK (user_id = auth.uid() OR public.is_workspace_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "admin deletes emails" ON public.workspace_member_emails;
CREATE POLICY "admin deletes emails"
ON public.workspace_member_emails FOR DELETE TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Rebuild safe view (uses the new emails table)
CREATE OR REPLACE VIEW public.workspace_members_safe
WITH (security_invoker = true)
AS
SELECT
  wm.id, wm.workspace_id, wm.user_id, wm.role, wm.name,
  wm.invited_at, wm.accepted_at,
  wme.email
FROM public.workspace_members wm
LEFT JOIN public.workspace_member_emails wme
  ON wme.member_id = wm.id
 AND (wme.user_id = auth.uid() OR public.is_workspace_admin(auth.uid(), wm.workspace_id))
WHERE wm.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()));

GRANT SELECT ON public.workspace_members_safe TO authenticated;

-- Recreate the legacy directory view backed by the new structure
CREATE OR REPLACE VIEW public.workspace_members_directory
WITH (security_invoker = true)
AS
SELECT
  wm.id, wm.workspace_id, wm.user_id, wm.role, wm.name,
  wme.email,
  wm.accepted_at
FROM public.workspace_members wm
LEFT JOIN public.workspace_member_emails wme
  ON wme.member_id = wm.id
 AND (wme.user_id = auth.uid() OR public.is_workspace_admin(auth.uid(), wm.workspace_id))
WHERE wm.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()));

GRANT SELECT ON public.workspace_members_directory TO authenticated;

-- Drop legacy email column
ALTER TABLE public.workspace_members DROP COLUMN IF EXISTS email;

-- ─── B) oncall_schedule_emails ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oncall_schedule_emails (
  schedule_id  uuid PRIMARY KEY REFERENCES public.oncall_schedule(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  user_email   text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oce_workspace ON public.oncall_schedule_emails(workspace_id);
CREATE INDEX IF NOT EXISTS idx_oce_user ON public.oncall_schedule_emails(user_id);

INSERT INTO public.oncall_schedule_emails (schedule_id, workspace_id, user_id, user_email)
SELECT id, workspace_id, user_id, user_email
FROM public.oncall_schedule
WHERE user_email IS NOT NULL
ON CONFLICT (schedule_id) DO NOTHING;

ALTER TABLE public.oncall_schedule_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self or admin reads oncall email" ON public.oncall_schedule_emails;
CREATE POLICY "self or admin reads oncall email"
ON public.oncall_schedule_emails FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "admin manages oncall emails" ON public.oncall_schedule_emails;
CREATE POLICY "admin manages oncall emails"
ON public.oncall_schedule_emails FOR ALL TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE OR REPLACE VIEW public.oncall_schedule_safe
WITH (security_invoker = true)
AS
SELECT
  os.id, os.workspace_id, os.user_id, os.user_name,
  os.starts_at, os.ends_at, os.escalation_order, os.notes,
  os.created_by, os.created_at,
  oce.user_email
FROM public.oncall_schedule os
LEFT JOIN public.oncall_schedule_emails oce
  ON oce.schedule_id = os.id
 AND (oce.user_id = auth.uid() OR public.is_workspace_admin(auth.uid(), os.workspace_id))
WHERE os.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()));

GRANT SELECT ON public.oncall_schedule_safe TO authenticated;

ALTER TABLE public.oncall_schedule DROP COLUMN IF EXISTS user_email;
