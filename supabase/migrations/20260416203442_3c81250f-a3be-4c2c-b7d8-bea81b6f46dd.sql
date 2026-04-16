DROP VIEW IF EXISTS public.forum_threads_public;
DROP VIEW IF EXISTS public.forum_posts_public;

CREATE VIEW public.forum_threads_public
  WITH (security_invoker = true) AS
  SELECT id, help_center_id, title, body, category, author_name,
         is_pinned, is_locked, is_resolved, view_count, reply_count,
         upvotes, last_activity_at, created_at
  FROM public.forum_threads;

CREATE VIEW public.forum_posts_public
  WITH (security_invoker = true) AS
  SELECT id, thread_id, parent_post_id, body, author_name,
         is_answer, upvotes, created_at, updated_at
  FROM public.forum_posts;

GRANT SELECT ON public.forum_threads_public TO anon, authenticated;
GRANT SELECT ON public.forum_posts_public TO anon, authenticated;