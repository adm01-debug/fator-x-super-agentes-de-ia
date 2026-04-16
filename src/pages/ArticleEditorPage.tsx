import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Globe, GitBranch, Languages } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "@/components/knowledge/RichEditor";
import { ArticleDiffViewer } from "@/components/knowledge/ArticleDiffViewer";
import {
  getArticle, updateArticle,
  listArticleVersions,
  listTranslations, translateArticle, markTranslationReviewed,
} from "@/services/knowledgeManagementService";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt-BR", label: "Português (BR)" },
];

export default function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: article, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: () => id ? getArticle(id) : Promise.resolve(null),
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState("draft");
  const [content, setContent] = useState<unknown>(null);
  const [contentHtml, setContentHtml] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setExcerpt(article.excerpt ?? "");
      setStatus(article.status);
      setContent(article.content_json);
      setContentHtml(article.content_html ?? "");
    }
  }, [article]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateArticle(id, { title, excerpt, status, content_json: content as Record<string, unknown>, content_html: contentHtml });
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["article", id] });
      qc.invalidateQueries({ queryKey: ["versions", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!article) return <div className="p-8 text-center text-muted-foreground">Artigo não encontrado.</div>;

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/knowledge-management")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">v{article.current_version}</Badge>
          <Badge variant={status === "published" ? "default" : "secondary"}>{status}</Badge>
          <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="versions"><GitBranch className="h-4 w-4 mr-2" />Versões</TabsTrigger>
          <TabsTrigger value="translations"><Languages className="h-4 w-4 mr-2" />Traduções</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4 mt-6">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="text-2xl font-heading font-bold border-0 px-0 focus-visible:ring-0" />
          </div>
          <div>
            <Label>Resumo</Label>
            <Input value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Resumo curto do artigo (aparece em listagens)" />
          </div>
          <div>
            <Label>Conteúdo</Label>
            <RichEditor value={content} onChange={(json, html) => { setContent(json); setContentHtml(html); }} />
          </div>
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <VersionsTab articleId={id!} currentTitle={title} currentHtml={contentHtml} />
        </TabsContent>

        <TabsContent value="translations" className="mt-6">
          <TranslationsTab articleId={id!} sourceLanguage={article.language} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-6">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="nexus-card text-center"><p className="text-2xl font-bold">{article.view_count}</p><p className="text-xs text-muted-foreground">Visualizações</p></div>
            <div className="nexus-card text-center"><p className="text-2xl font-bold text-nexus-emerald">{article.helpful_count}</p><p className="text-xs text-muted-foreground">Úteis</p></div>
            <div className="nexus-card text-center"><p className="text-2xl font-bold text-destructive">{article.not_helpful_count}</p><p className="text-xs text-muted-foreground">Não úteis</p></div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VersionsTab({ articleId, currentTitle, currentHtml }: { articleId: string; currentTitle: string; currentHtml: string }) {
  const { data: versions = [] } = useQuery({ queryKey: ["versions", articleId], queryFn: () => listArticleVersions(articleId) });
  const [selected, setSelected] = useState<string>("");

  const selectedVersion = versions.find((v: { id: string }) => v.id === selected);

  if (versions.length === 0) return <div className="text-center text-sm text-muted-foreground py-12">Sem versões anteriores. Edite e salve para criar histórico.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>Comparar com:</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Escolha uma versão..." /></SelectTrigger>
          <SelectContent>
            {versions.map((v: { id: string; version: number; created_at: string }) => (
              <SelectItem key={v.id} value={v.id}>v{v.version} — {new Date(v.created_at).toLocaleString("pt-BR")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedVersion && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Comparando v{(selectedVersion as { version: number }).version} → versão atual</p>
          </div>
          <ArticleDiffViewer
            oldText={`${(selectedVersion as { title: string }).title}\n\n${stripHtml((selectedVersion as { content_html?: string }).content_html ?? "")}`}
            newText={`${currentTitle}\n\n${stripHtml(currentHtml)}`}
          />
        </>
      )}
    </div>
  );
}

function TranslationsTab({ articleId, sourceLanguage }: { articleId: string; sourceLanguage: string }) {
  const qc = useQueryClient();
  const { data: translations = [] } = useQuery({ queryKey: ["translations", articleId], queryFn: () => listTranslations(articleId) });
  const [target, setTarget] = useState("en");
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const r = await translateArticle(articleId, target);
      toast.success(r.cached ? "Tradução obtida do cache (translation memory)" : "Tradução criada via IA");
      qc.invalidateQueries({ queryKey: ["translations", articleId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falhou"); }
    finally { setTranslating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <Label>Idioma alvo</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.filter(l => l.code !== sourceLanguage).map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleTranslate} disabled={translating}><Languages className="h-4 w-4 mr-2" />{translating ? "Traduzindo..." : "Traduzir"}</Button>
      </div>
      <div className="space-y-2">
        {translations.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">Nenhuma tradução. Use a IA para traduzir.</div>
        ) : translations.map((t: { id: string; target_language: string; translated_title: string; translation_method: string; reviewed: boolean; updated_at: string }) => (
          <div key={t.id} className="nexus-card flex items-center gap-4">
            <Languages className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{t.translated_title}</p>
              <p className="text-xs text-muted-foreground">{t.target_language} • {t.translation_method} • {new Date(t.updated_at).toLocaleString("pt-BR")}</p>
            </div>
            <Badge variant={t.reviewed ? "default" : "secondary"}>{t.reviewed ? "Revisada" : "Auto"}</Badge>
            {!t.reviewed && <Button size="sm" variant="ghost" onClick={async () => { await markTranslationReviewed(t.id); qc.invalidateQueries({ queryKey: ["translations", articleId] }); toast.success("Marcada como revisada"); }}>Marcar como revisada</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
