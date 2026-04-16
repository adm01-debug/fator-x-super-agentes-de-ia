import { supabase } from "@/integrations/supabase/client";

// ============ Help Centers ============
export async function listHelpCenters(workspaceId: string) {
  const { data, error } = await supabase.from("help_centers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getHelpCenterBySlug(slug: string) {
  const { data, error } = await supabase.from("help_centers").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createHelpCenter(payload: {
  workspace_id: string;
  knowledge_base_id?: string | null;
  slug: string;
  title: string;
  description?: string;
  primary_color?: string;
  logo_url?: string | null;
  custom_domain?: string | null;
}) {
  const { data, error } = await supabase.from("help_centers").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateHelpCenter(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from("help_centers").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHelpCenter(id: string) {
  const { error } = await supabase.from("help_centers").delete().eq("id", id);
  if (error) throw error;
}

// ============ Articles ============
export async function listArticles(knowledgeBaseId: string, opts?: { status?: string; language?: string }) {
  let q = supabase.from("kb_articles").select("*").eq("knowledge_base_id", knowledgeBaseId).order("updated_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.language) q = q.eq("language", opts.language);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listPublicArticles(helpCenterId: string, language = "pt-BR") {
  const { data, error } = await supabase.from("kb_articles").select("id,slug,title,excerpt,view_count,helpful_count,tags,updated_at").eq("help_center_id", helpCenterId).eq("status", "published").eq("language", language).order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getArticle(id: string) {
  const { data, error } = await supabase.from("kb_articles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPublicArticleBySlug(helpCenterId: string, slug: string, language = "pt-BR") {
  const { data, error } = await supabase.from("kb_articles").select("*").eq("help_center_id", helpCenterId).eq("slug", slug).eq("language", language).eq("status", "published").maybeSingle();
  if (error) throw error;
  if (data) {
    await supabase.from("kb_articles").update({ view_count: (data.view_count ?? 0) + 1 }).eq("id", data.id);
  }
  return data;
}

export async function createArticle(payload: {
  knowledge_base_id: string;
  help_center_id?: string | null;
  slug: string;
  title: string;
  excerpt?: string;
  content_json?: unknown;
  content_html?: string;
  language?: string;
  tags?: string[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("kb_articles").insert({ ...payload, author_id: user?.id, content_json: payload.content_json ?? {} } as never).select().single();
  if (error) throw error;
  return data;
}

export async function updateArticle(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from("kb_articles").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteArticle(id: string) {
  const { error } = await supabase.from("kb_articles").delete().eq("id", id);
  if (error) throw error;
}

export async function rateArticle(id: string, helpful: boolean) {
  const article = await getArticle(id);
  if (!article) return;
  const field = helpful ? "helpful_count" : "not_helpful_count";
  const current = (article as unknown as Record<string, number>)[field] ?? 0;
  await supabase.from("kb_articles").update({ [field]: current + 1 } as never).eq("id", id);
}

// ============ Versions ============
export async function listArticleVersions(articleId: string) {
  const { data, error } = await supabase.from("kb_article_versions").select("*").eq("article_id", articleId).order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getArticleVersion(id: string) {
  const { data, error } = await supabase.from("kb_article_versions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// ============ Translations ============
export async function listTranslations(articleId: string) {
  const { data, error } = await supabase.from("kb_translations").select("*").eq("article_id", articleId);
  if (error) throw error;
  return data ?? [];
}

export async function translateArticle(articleId: string, targetLanguage: string) {
  const { data, error } = await supabase.functions.invoke("kb-translate-article", {
    body: { article_id: articleId, target_language: targetLanguage },
  });
  if (error) throw error;
  return data;
}

export async function markTranslationReviewed(id: string) {
  const { error } = await supabase.from("kb_translations").update({ reviewed: true }).eq("id", id);
  if (error) throw error;
}

// ============ Query Gaps ============
export async function listQueryGaps(knowledgeBaseId: string, status?: string) {
  let q = supabase.from("kb_query_gaps").select("*").eq("knowledge_base_id", knowledgeBaseId).order("occurrences", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function analyzeQueryGaps(knowledgeBaseId: string) {
  const { data, error } = await supabase.functions.invoke("kb-analyze-gaps", {
    body: { knowledge_base_id: knowledgeBaseId },
  });
  if (error) throw error;
  return data;
}

export async function updateGapStatus(id: string, status: string, resolvedArticleId?: string) {
  const { error } = await supabase.from("kb_query_gaps").update({ status, resolved_article_id: resolvedArticleId ?? null }).eq("id", id);
  if (error) throw error;
}

// ============ Forum ============
export async function listThreads(helpCenterId: string) {
  const { data, error } = await supabase.from("forum_threads").select("*").eq("help_center_id", helpCenterId).order("is_pinned", { ascending: false }).order("last_activity_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getThread(id: string) {
  const { data, error } = await supabase.from("forum_threads").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (data) await supabase.from("forum_threads").update({ view_count: (data.view_count ?? 0) + 1 }).eq("id", id);
  return data;
}

export async function listPosts(threadId: string) {
  const { data, error } = await supabase.from("forum_posts").select("*").eq("thread_id", threadId).order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createThread(payload: { help_center_id: string; title: string; body: string; category?: string; author_name?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Login necessário");
  const { data, error } = await supabase.from("forum_threads").insert({ ...payload, author_id: user.id, author_name: payload.author_name ?? user.email?.split("@")[0] ?? "Usuário" }).select().single();
  if (error) throw error;
  return data;
}

export async function createPost(payload: { thread_id: string; body: string; parent_post_id?: string | null; author_name?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Login necessário");
  const { data, error } = await supabase.from("forum_posts").insert({ ...payload, author_id: user.id, author_name: payload.author_name ?? user.email?.split("@")[0] ?? "Usuário" }).select().single();
  if (error) throw error;
  return data;
}

export async function markAsAnswer(postId: string, threadId: string) {
  await supabase.from("forum_posts").update({ is_answer: true }).eq("id", postId);
  await supabase.from("forum_threads").update({ is_resolved: true }).eq("id", threadId);
}
