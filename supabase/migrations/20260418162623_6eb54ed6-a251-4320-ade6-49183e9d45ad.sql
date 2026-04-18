
-- Drop existing safe views first (avoids "cannot drop columns from view")
DROP VIEW IF EXISTS public.workspace_members_safe CASCADE;
DROP VIEW IF EXISTS public.forum_threads_safe CASCADE;
DROP VIEW IF EXISTS public.forum_posts_safe CASCADE;

-- 1) workspace_members
DROP POLICY IF EXISTS "Members can view workspace colleagues" ON public.workspace_members;
CREATE POLICY "Members can view workspace colleagues"
ON public.workspace_members FOR SELECT TO authenticated
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

REVOKE SELECT (email) ON public.workspace_members FROM authenticated;
REVOKE SELECT (email) ON public.workspace_members FROM anon;

CREATE VIEW public.workspace_members_safe
WITH (security_invoker = true) AS
SELECT id, workspace_id, user_id, role, name, invited_at, accepted_at
FROM public.workspace_members;
GRANT SELECT ON public.workspace_members_safe TO authenticated;

CREATE OR REPLACE FUNCTION public.get_workspace_members_full(_workspace_id uuid)
RETURNS TABLE (
  id uuid, workspace_id uuid, user_id uuid, role text,
  email text, name text, invited_at timestamptz, accepted_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  RETURN QUERY
    SELECT m.id, m.workspace_id, m.user_id, m.role, m.email, m.name, m.invited_at, m.accepted_at
    FROM public.workspace_members m
    WHERE m.workspace_id = _workspace_id;
END $$;
GRANT EXECUTE ON FUNCTION public.get_workspace_members_full(uuid) TO authenticated;

-- 2) oncall_schedule
REVOKE SELECT (user_email) ON public.oncall_schedule FROM authenticated;
REVOKE SELECT (user_email) ON public.oncall_schedule FROM anon;

CREATE OR REPLACE FUNCTION public.get_oncall_with_contacts(_workspace_id uuid)
RETURNS TABLE (
  id uuid, workspace_id uuid, user_id uuid, user_name text, user_email text,
  starts_at timestamptz, ends_at timestamptz, escalation_order int, notes text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  RETURN QUERY
    SELECT o.id, o.workspace_id, o.user_id, o.user_name, o.user_email,
           o.starts_at, o.ends_at, o.escalation_order, o.notes
    FROM public.oncall_schedule o
    WHERE o.workspace_id = _workspace_id
    ORDER BY o.starts_at;
END $$;
GRANT EXECUTE ON FUNCTION public.get_oncall_with_contacts(uuid) TO authenticated;

-- 3) user_2fa
REVOKE SELECT (secret, backup_codes) ON public.user_2fa FROM authenticated;
REVOKE SELECT (secret, backup_codes) ON public.user_2fa FROM anon;
REVOKE UPDATE (secret, backup_codes) ON public.user_2fa FROM authenticated;
REVOKE UPDATE (secret, backup_codes) ON public.user_2fa FROM anon;
REVOKE INSERT (secret, backup_codes) ON public.user_2fa FROM authenticated;
REVOKE INSERT (secret, backup_codes) ON public.user_2fa FROM anon;

CREATE OR REPLACE FUNCTION public.get_my_2fa_status()
RETURNS TABLE (enabled boolean, last_verified_at timestamptz, configured_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT enabled, last_verified_at, created_at
  FROM public.user_2fa
  WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_2fa_status() TO authenticated;

-- 4) compliance_frameworks: revogar writes do cliente
REVOKE INSERT, UPDATE, DELETE ON public.compliance_frameworks FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.compliance_frameworks FROM anon;

-- 5) Forum safe views
CREATE VIEW public.forum_threads_safe
WITH (security_invoker = true) AS
SELECT id, help_center_id, author_id,
       CASE WHEN author_name ~* '@' THEN 'Membro' ELSE author_name END AS author_name,
       title, body, category, is_pinned, is_locked, is_resolved,
       view_count, reply_count, upvotes, last_activity_at, created_at
FROM public.forum_threads;
GRANT SELECT ON public.forum_threads_safe TO authenticated, anon;

CREATE VIEW public.forum_posts_safe
WITH (security_invoker = true) AS
SELECT id, thread_id, author_id,
       CASE WHEN author_name ~* '@' THEN 'Membro' ELSE author_name END AS author_name,
       body, is_answer, upvotes, parent_post_id, created_at, updated_at
FROM public.forum_posts;
GRANT SELECT ON public.forum_posts_safe TO authenticated, anon;
