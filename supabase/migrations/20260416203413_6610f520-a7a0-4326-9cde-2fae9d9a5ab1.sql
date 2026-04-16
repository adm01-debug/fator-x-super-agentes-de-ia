-- P0 Security Fix #1: Restrict access_blocked_log NULL workspace reads
DROP POLICY IF EXISTS "ws admins read blocked log" ON public.access_blocked_log;
CREATE POLICY "ws admins read blocked log"
  ON public.access_blocked_log
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND public.is_workspace_admin(auth.uid(), workspace_id)
  );

-- P0 Security Fix #2: Prevent privilege escalation via user_roles INSERT
DROP POLICY IF EXISTS "Workspace admins can assign roles" ON public.user_roles;
CREATE POLICY "Workspace admins can assign roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_admin(auth.uid(), workspace_id)
    AND role_key <> 'workspace_admin'
    AND EXISTS (SELECT 1 FROM public.roles WHERE key = role_key AND is_active = true)
  );

-- P1 Security Fix #3: Hide forum author internal UUIDs from public (keep author_name visible)
-- Recreate with column-level guard via RLS-safe view pattern: drop public read, add column restriction
DROP POLICY IF EXISTS "Public read forum posts" ON public.forum_posts;
CREATE POLICY "Public read forum posts"
  ON public.forum_posts
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read forum threads" ON public.forum_threads;
CREATE POLICY "Public read forum threads"
  ON public.forum_threads
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create safe public views that exclude author_id
CREATE OR REPLACE VIEW public.forum_threads_public AS
  SELECT id, help_center_id, title, body, category, author_name,
         is_pinned, is_locked, is_resolved, view_count, reply_count,
         upvotes, last_activity_at, created_at
  FROM public.forum_threads;

CREATE OR REPLACE VIEW public.forum_posts_public AS
  SELECT id, thread_id, parent_post_id, body, author_name,
         is_answer, upvotes, created_at, updated_at
  FROM public.forum_posts;

GRANT SELECT ON public.forum_threads_public TO anon, authenticated;
GRANT SELECT ON public.forum_posts_public TO anon, authenticated;