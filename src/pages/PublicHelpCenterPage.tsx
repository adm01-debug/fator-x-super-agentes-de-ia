import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, ThumbsUp, ThumbsDown, MessageSquare, ChevronRight, Eye, Clock } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getHelpCenterBySlug, listPublicArticles, getPublicArticleBySlug, rateArticle, listThreads } from "@/services/knowledgeManagementService";
import { toast } from "sonner";

export default function PublicHelpCenterPage() {
  const { slug, articleSlug } = useParams<{ slug: string; articleSlug?: string }>();
  const [search, setSearch] = useState("");

  const { data: hc, isLoading } = useQuery({
    queryKey: ["public_hc", slug],
    queryFn: () => slug ? getHelpCenterBySlug(slug) : Promise.resolve(null),
    enabled: !!slug,
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!hc) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Help Center não encontrado.</div>;

  const primary = hc.primary_color || "#6366f1";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border" style={{ background: `linear-gradient(135deg, ${primary}15, transparent)` }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-6">
            {hc.logo_url ? <img src={hc.logo_url} alt={hc.title} className="h-10" /> : <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: primary }}>{hc.title[0]}</div>}
            <Link to={`/help/${slug}`} className="text-xl font-heading font-bold text-foreground">{hc.title}</Link>
          </div>
          <h1 className="text-4xl font-heading font-bold text-foreground mb-3">Como podemos ajudar?</h1>
          <p className="text-muted-foreground mb-6">{hc.description}</p>
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar artigos..." className="pl-12 h-12 bg-card text-base" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {articleSlug ? <ArticleView helpCenterId={hc.id} articleSlug={articleSlug} primaryColor={primary} /> : <ArticleList helpCenterId={hc.id} hcSlug={slug!} search={search} primaryColor={primary} />}
      </main>

      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-muted-foreground">
          Powered by Nexus Agents Studio
        </div>
      </footer>
    </div>
  );
}

function ArticleList({ helpCenterId, hcSlug, search, primaryColor }: { helpCenterId: string; hcSlug: string; search: string; primaryColor: string }) {
  const navigate = useNavigate();
  const { data: articles = [] } = useQuery({ queryKey: ["public_articles", helpCenterId], queryFn: () => listPublicArticles(helpCenterId) });
  const { data: threads = [] } = useQuery({ queryKey: ["public_threads", helpCenterId], queryFn: () => listThreads(helpCenterId) });

  const filtered = (articles as Array<{ id: string; slug: string; title: string; excerpt: string | null; view_count: number; helpful_count: number }>).filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.excerpt ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-3">
        <h2 className="text-lg font-heading font-semibold mb-4">Artigos</h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum artigo encontrado.</p>
        ) : filtered.map((a) => (
          <Link key={a.id} to={`/help/${hcSlug}/${a.slug}`} className="nexus-card block hover:border-primary/50 transition-colors group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{a.title}</h3>
                {a.excerpt && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.excerpt}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{a.view_count}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{a.helpful_count}</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
      </div>
      <aside>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold">Comunidade</h2>
          <Button size="sm" variant="outline" onClick={() => navigate(`/help/${hcSlug}/forum`)}>Ver fórum</Button>
        </div>
        <div className="space-y-2">
          {threads.slice(0, 5).map((t: { id: string; title: string; reply_count: number; is_resolved: boolean }) => (
            <Link key={t.id} to={`/help/${hcSlug}/forum/${t.id}`} className="block p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
              <p className="text-sm font-medium text-foreground line-clamp-1">{t.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.reply_count}</span>
                {t.is_resolved && <Badge variant="default" className="text-[10px] py-0">Resolvido</Badge>}
              </div>
            </Link>
          ))}
          {threads.length === 0 && <p className="text-xs text-muted-foreground">Sem tópicos ainda.</p>}
          <Button size="sm" className="w-full mt-2" style={{ background: primaryColor }} onClick={() => navigate(`/help/${hcSlug}/forum`)}>
            Iniciar tópico
          </Button>
        </div>
      </aside>
    </div>
  );
}

function ArticleView({ helpCenterId, articleSlug }: { helpCenterId: string; articleSlug: string; primaryColor: string }) {
  const { data: article } = useQuery({ queryKey: ["public_article", helpCenterId, articleSlug], queryFn: () => getPublicArticleBySlug(helpCenterId, articleSlug) });
  const [rated, setRated] = useState<"yes" | "no" | null>(null);

  if (!article) return <div className="text-center text-muted-foreground py-12">Artigo não encontrado.</div>;

  return (
    <article className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-heading font-bold text-foreground mb-3">{article.title}</h1>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(article.updated_at).toLocaleDateString("pt-BR")}</span>
        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.view_count} visualizações</span>
      </div>
      <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: article.content_html ?? "" }} />
      <div className="border-t border-border mt-12 pt-6">
        <p className="text-sm text-muted-foreground mb-3">Este artigo foi útil?</p>
        <div className="flex gap-2">
          <Button variant={rated === "yes" ? "default" : "outline"} size="sm" disabled={!!rated} onClick={async () => { await rateArticle(article.id, true); setRated("yes"); toast.success("Obrigado!"); }}>
            <ThumbsUp className="h-4 w-4 mr-2" />Sim
          </Button>
          <Button variant={rated === "no" ? "default" : "outline"} size="sm" disabled={!!rated} onClick={async () => { await rateArticle(article.id, false); setRated("no"); toast.success("Obrigado pelo feedback"); }}>
            <ThumbsDown className="h-4 w-4 mr-2" />Não
          </Button>
        </div>
      </div>
    </article>
  );
}
