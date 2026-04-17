/**
 * Nexus — Global Search
 * Busca unificada (ILIKE + ranking simples) em múltiplas tabelas do workspace.
 * Retorna até N resultados por tipo, sempre escopados aos workspaces do usuário.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchHit {
  type: "agent" | "knowledge_base" | "article" | "workflow" | "eval_dataset" | "automation" | "document";
  id: string;
  title: string;
  snippet: string;
  url: string;
  score: number;
  meta?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const query = String(body?.query ?? "").trim();
    const limit = Math.min(Math.max(Number(body?.limit ?? 6), 1), 20);

    if (query.length < 2) {
      return new Response(JSON.stringify({ results: [], total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pattern = `%${query.replace(/[%_]/g, "")}%`;
    const ql = query.toLowerCase();

    const score = (text: string | null | undefined) => {
      if (!text) return 0;
      const t = text.toLowerCase();
      if (t === ql) return 1;
      if (t.startsWith(ql)) return 0.9;
      if (t.includes(ql)) return 0.7;
      return 0.5;
    };

    // Run all queries in parallel — RLS scopes them to user's workspaces
    const [agentsR, kbR, articlesR, workflowsR, evalsR, autoR, docsR] = await Promise.all([
      supabase.from("agents").select("id, name, mission, persona, model").or(`name.ilike.${pattern},mission.ilike.${pattern},persona.ilike.${pattern}`).limit(limit),
      supabase.from("knowledge_bases").select("id, name, description").or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(limit),
      supabase.from("kb_articles").select("id, title, excerpt, slug, knowledge_base_id, status").or(`title.ilike.${pattern},excerpt.ilike.${pattern}`).eq("status", "published").limit(limit),
      supabase.from("agent_workflows").select("id, name, description, status").or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(limit),
      supabase.from("agent_eval_datasets").select("id, name, description").or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(limit),
      supabase.from("automation_rules").select("id, name, description, is_active").or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(limit),
      supabase.from("documents").select("id, title, source_url").ilike("title", pattern).limit(limit),
    ]);

    const results: SearchHit[] = [];

    (agentsR.data ?? []).forEach((a: any) => results.push({
      type: "agent",
      id: a.id,
      title: a.name,
      snippet: a.mission || a.persona || a.model || "",
      url: `/builder/${a.id}`,
      score: score(a.name) + 0.05,
      meta: { model: a.model },
    }));

    (kbR.data ?? []).forEach((k: any) => results.push({
      type: "knowledge_base",
      id: k.id,
      title: k.name,
      snippet: k.description || "Base de conhecimento",
      url: `/knowledge`,
      score: score(k.name),
    }));

    (articlesR.data ?? []).forEach((a: any) => results.push({
      type: "article",
      id: a.id,
      title: a.title,
      snippet: a.excerpt || "Artigo da KB",
      url: `/knowledge`,
      score: score(a.title),
    }));

    (workflowsR.data ?? []).forEach((w: any) => results.push({
      type: "workflow",
      id: w.id,
      title: w.name,
      snippet: w.description || `Status: ${w.status}`,
      url: `/workflows`,
      score: score(w.name),
      meta: { status: w.status },
    }));

    (evalsR.data ?? []).forEach((e: any) => results.push({
      type: "eval_dataset",
      id: e.id,
      title: e.name,
      snippet: e.description || "Dataset de avaliação",
      url: `/evaluations`,
      score: score(e.name),
    }));

    (autoR.data ?? []).forEach((r: any) => results.push({
      type: "automation",
      id: r.id,
      title: r.name,
      snippet: r.description || (r.is_active ? "Ativa" : "Inativa"),
      url: `/automations`,
      score: score(r.name),
      meta: { active: r.is_active },
    }));

    (docsR.data ?? []).forEach((d: any) => results.push({
      type: "document",
      id: d.id,
      title: d.title,
      snippet: d.source_url || "Documento",
      url: `/knowledge`,
      score: score(d.title) - 0.1,
    }));

    results.sort((a, b) => b.score - a.score);

    return new Response(JSON.stringify({ results, total: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("global-search error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
