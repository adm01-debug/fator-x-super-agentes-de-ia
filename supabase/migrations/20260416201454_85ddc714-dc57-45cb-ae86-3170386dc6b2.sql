
-- ============================================================
-- KNOWLEDGE MANAGEMENT v2: 6 features (Help Center, WYSIWYG, Versions, Gaps, i18n, Forum)
-- ============================================================

-- 1. HELP CENTERS (public, customizable per workspace)
CREATE TABLE public.help_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  knowledge_base_id uuid REFERENCES public.knowledge_bases(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Central de Ajuda',
  description text DEFAULT '',
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  custom_domain text,
  is_published boolean NOT NULL DEFAULT false,
  seo_meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.help_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published help centers" ON public.help_centers FOR SELECT USING (is_published = true);
CREATE POLICY "Workspace members manage help centers" ON public.help_centers FOR ALL TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- 2. KB ARTICLES (rich content + versioning)
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  help_center_id uuid REFERENCES public.help_centers(id) ON DELETE SET NULL,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text DEFAULT '',
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_html text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  language text NOT NULL DEFAULT 'pt-BR',
  view_count integer NOT NULL DEFAULT 0,
  helpful_count integer NOT NULL DEFAULT 0,
  not_helpful_count integer NOT NULL DEFAULT 0,
  current_version integer NOT NULL DEFAULT 1,
  author_id uuid,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(knowledge_base_id, slug, language)
);
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published articles" ON public.kb_articles FOR SELECT USING (status = 'published');
CREATE POLICY "Workspace members manage articles" ON public.kb_articles FOR ALL TO authenticated
  USING (knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))))
  WITH CHECK (knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

-- 3. ARTICLE VERSIONS (immutable history with diff support)
CREATE TABLE public.kb_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  content_json jsonb NOT NULL,
  content_html text,
  change_summary text DEFAULT '',
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id, version)
);
ALTER TABLE public.kb_article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members read versions" ON public.kb_article_versions FOR SELECT TO authenticated
  USING (article_id IN (SELECT id FROM public.kb_articles WHERE knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))));
CREATE POLICY "Workspace members create versions" ON public.kb_article_versions FOR INSERT TO authenticated
  WITH CHECK (article_id IN (SELECT id FROM public.kb_articles WHERE knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))));

-- 4. TRANSLATIONS (multi-language with translation memory cache)
CREATE TABLE public.kb_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  source_language text NOT NULL,
  target_language text NOT NULL,
  source_hash text NOT NULL,
  translated_title text NOT NULL,
  translated_content_json jsonb NOT NULL,
  translation_method text NOT NULL DEFAULT 'ai' CHECK (translation_method IN ('ai','human','hybrid')),
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id, target_language, source_hash)
);
ALTER TABLE public.kb_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage translations" ON public.kb_translations FOR ALL TO authenticated
  USING (article_id IN (SELECT id FROM public.kb_articles WHERE knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))))
  WITH CHECK (article_id IN (SELECT id FROM public.kb_articles WHERE knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))));

-- 5. QUERY GAPS (unanswered queries for gap analysis)
CREATE TABLE public.kb_query_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  query text NOT NULL,
  query_normalized text NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  best_match_score numeric DEFAULT 0,
  best_match_chunk_id uuid,
  suggested_topic text,
  suggested_outline jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','dismissed')),
  resolved_article_id uuid REFERENCES public.kb_articles(id) ON DELETE SET NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(knowledge_base_id, query_normalized)
);
ALTER TABLE public.kb_query_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage query gaps" ON public.kb_query_gaps FOR ALL TO authenticated
  USING (knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))))
  WITH CHECK (knowledge_base_id IN (SELECT id FROM public.knowledge_bases WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

-- 6. COMMUNITY FORUM
CREATE TABLE public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_center_id uuid NOT NULL REFERENCES public.help_centers(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Anônimo',
  title text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'general',
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  is_resolved boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  upvotes integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read forum threads" ON public.forum_threads FOR SELECT USING (true);
CREATE POLICY "Authenticated create threads" ON public.forum_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own threads" ON public.forum_threads FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);
CREATE POLICY "Authors delete own threads" ON public.forum_threads FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Anônimo',
  body text NOT NULL,
  is_answer boolean NOT NULL DEFAULT false,
  upvotes integer NOT NULL DEFAULT 0,
  parent_post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read forum posts" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated create posts" ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own posts" ON public.forum_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);
CREATE POLICY "Authors delete own posts" ON public.forum_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- Indexes
CREATE INDEX idx_kb_articles_kb_status ON public.kb_articles(knowledge_base_id, status);
CREATE INDEX idx_kb_articles_help_center ON public.kb_articles(help_center_id) WHERE help_center_id IS NOT NULL;
CREATE INDEX idx_kb_versions_article ON public.kb_article_versions(article_id, version DESC);
CREATE INDEX idx_kb_translations_lookup ON public.kb_translations(article_id, target_language);
CREATE INDEX idx_kb_gaps_status ON public.kb_query_gaps(knowledge_base_id, status, occurrences DESC);
CREATE INDEX idx_forum_threads_hc ON public.forum_threads(help_center_id, last_activity_at DESC);
CREATE INDEX idx_forum_posts_thread ON public.forum_posts(thread_id, created_at);

-- updated_at triggers
CREATE TRIGGER tr_help_centers_updated BEFORE UPDATE ON public.help_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_kb_articles_updated BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_kb_translations_updated BEFORE UPDATE ON public.kb_translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_forum_posts_updated BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create version on article update
CREATE OR REPLACE FUNCTION public.kb_article_create_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.content_json IS DISTINCT FROM NEW.content_json) OR (OLD.title IS DISTINCT FROM NEW.title) THEN
    NEW.current_version := OLD.current_version + 1;
    INSERT INTO public.kb_article_versions(article_id, version, title, content_json, content_html, author_id)
    VALUES (OLD.id, OLD.current_version, OLD.title, OLD.content_json, OLD.content_html, OLD.author_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_kb_article_version BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.kb_article_create_version();

-- Forum reply count trigger
CREATE OR REPLACE FUNCTION public.forum_update_thread_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads SET reply_count = reply_count + 1, last_activity_at = now() WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_threads SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.thread_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER tr_forum_thread_stats AFTER INSERT OR DELETE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.forum_update_thread_stats();
