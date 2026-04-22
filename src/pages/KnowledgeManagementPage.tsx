import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Globe, AlertCircle, Plus, ExternalLink, Eye, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  listHelpCenters,
  createHelpCenter,
  updateHelpCenter,
  listArticles,
  createArticle,
  deleteArticle,
  listQueryGaps,
  analyzeQueryGaps,
  updateGapStatus,
} from '@/services/knowledgeManagementService';
import { listKnowledgeBases } from '@/services/knowledgeService';
import { getCurrentUserWorkspace } from '@/services/workspaceContextService';

export default function KnowledgeManagementPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedKb, setSelectedKb] = useState<string>('');

  const { data: workspace } = useQuery({
    queryKey: ['my_workspace'],
    queryFn: getCurrentUserWorkspace,
  });

  const { data: kbs = [] } = useQuery({
    queryKey: ['knowledge_bases'],
    queryFn: listKnowledgeBases,
  });
  const { data: helpCenters = [] } = useQuery({
    queryKey: ['help_centers', workspace?.id],
    queryFn: () => (workspace?.id ? listHelpCenters(workspace.id) : Promise.resolve([])),
    enabled: !!workspace?.id,
  });

  const { data: articles = [] } = useQuery({
    queryKey: ['kb_articles', selectedKb],
    queryFn: () => (selectedKb ? listArticles(selectedKb) : Promise.resolve([])),
    enabled: !!selectedKb,
  });

  const { data: gaps = [] } = useQuery({
    queryKey: ['kb_gaps', selectedKb],
    queryFn: () => (selectedKb ? listQueryGaps(selectedKb) : Promise.resolve([])),
    enabled: !!selectedKb,
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Gestão de Conhecimento"
        description="Help Centers públicos, artigos, versões, traduções e análise de lacunas"
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">Base de conhecimento:</Label>
        <Select value={selectedKb} onValueChange={setSelectedKb}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Selecione uma base..." />
          </SelectTrigger>
          <SelectContent>
            {kbs.map((kb: { id: string; name: string }) => (
              <SelectItem key={kb.id} value={kb.id}>
                {kb.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="help-centers">
        <TabsList>
          <TabsTrigger value="help-centers">
            <Globe className="h-4 w-4 mr-2" />
            Help Centers
          </TabsTrigger>
          <TabsTrigger value="articles">
            <FileText className="h-4 w-4 mr-2" />
            Artigos
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <AlertCircle className="h-4 w-4 mr-2" />
            Lacunas{' '}
            <Badge variant="secondary" className="ml-2">
              {gaps.filter((g: { status: string }) => g.status === 'open').length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="help-centers" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Centrais de Ajuda Públicas</h3>
            <CreateHelpCenterDialog
              workspaceId={workspace?.id}
              kbs={kbs}
              onCreated={() => qc.invalidateQueries({ queryKey: ['help_centers'] })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(
              helpCenters as Array<{
                id: string;
                slug: string;
                title: string;
                description: string | null;
                primary_color: string | null;
                is_published: boolean;
              }>
            ).map((hc) => (
              <div key={hc.id} className="nexus-card">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${hc.primary_color ?? '#6366f1'}20`,
                      color: hc.primary_color ?? '#6366f1',
                    }}
                  >
                    <Globe className="h-5 w-5" />
                  </div>
                  <Badge variant={hc.is_published ? 'default' : 'secondary'}>
                    {hc.is_published ? 'Publicado' : 'Rascunho'}
                  </Badge>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">{hc.title}</h3>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {hc.description || 'Sem descrição'}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono mb-3">/help/{hc.slug}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`/help/${hc.slug}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Visitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await updateHelpCenter(hc.id, { is_published: !hc.is_published });
                      qc.invalidateQueries({ queryKey: ['help_centers'] });
                      toast.success(hc.is_published ? 'Despublicado' : 'Publicado');
                    }}
                  >
                    {hc.is_published ? 'Despublicar' : 'Publicar'}
                  </Button>
                </div>
              </div>
            ))}
            {helpCenters.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-8">
                Nenhum Help Center criado.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="articles" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Artigos</h3>
            <CreateArticleDialog
              kbId={selectedKb}
              helpCenters={helpCenters}
              onCreated={(id) => navigate(`/knowledge-management/article/${id}`)}
            />
          </div>
          {!selectedKb ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Selecione uma base de conhecimento.
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Nenhum artigo. Crie o primeiro.
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map(
                (a: {
                  id: string;
                  title: string;
                  status: string;
                  language: string;
                  current_version: number;
                  view_count: number;
                  helpful_count: number;
                  updated_at: string;
                }) => (
                  <div
                    key={a.id}
                    className="nexus-card flex items-center gap-4 cursor-pointer hover:border-primary/50"
                    onClick={() => navigate(`/knowledge-management/article/${a.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).click();
                      }
                    }}
                  >
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        v{a.current_version} • {a.language} • atualizado{' '}
                        {new Date(a.updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {a.view_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {a.helpful_count}
                      </span>
                      <Badge variant={a.status === 'published' ? 'default' : 'secondary'}>
                        {a.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Excluir artigo?')) {
                            deleteArticle(a.id).then(() => {
                              qc.invalidateQueries({ queryKey: ['kb_articles'] });
                              toast.success('Excluído');
                            });
                          }
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Lacunas de Conhecimento</h3>
            <Button
              onClick={async () => {
                if (!selectedKb) return toast.error('Selecione uma base');
                toast.info('Analisando...');
                try {
                  const res = await analyzeQueryGaps(selectedKb);
                  toast.success(
                    `${res.gaps_recorded} lacunas encontradas, ${res.suggestions_generated} sugestões geradas`,
                  );
                  qc.invalidateQueries({ queryKey: ['kb_gaps'] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Falha');
                }
              }}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Analisar Lacunas
            </Button>
          </div>
          {gaps.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Nenhuma lacuna. Execute uma análise.
            </div>
          ) : (
            <div className="space-y-2">
              {(
                gaps as Array<{
                  id: string;
                  query: string;
                  occurrences: number;
                  status: string;
                  suggested_topic: string | null;
                  suggested_outline: unknown;
                }>
              ).map((g) => (
                <div key={g.id} className="nexus-card">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{g.query}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {g.occurrences} ocorrências
                      </p>
                      {g.suggested_topic && (
                        <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-xs font-medium text-primary mb-1">
                            Sugestão de artigo:
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {g.suggested_topic}
                          </p>
                          {Array.isArray(g.suggested_outline) && (
                            <ul className="mt-2 list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                              {(g.suggested_outline as string[]).map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge variant={g.status === 'resolved' ? 'default' : 'secondary'}>
                      {g.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!g.suggested_topic) return toast.error('Sem sugestão');
                        const slug = g.suggested_topic
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .slice(0, 60);
                        const a = await createArticle({
                          knowledge_base_id: selectedKb,
                          slug,
                          title: g.suggested_topic,
                          content_json: { type: 'doc', content: [] },
                          language: 'pt-BR',
                        });
                        await updateGapStatus(g.id, 'in_progress', a.id);
                        qc.invalidateQueries({ queryKey: ['kb_gaps'] });
                        navigate(`/knowledge-management/article/${a.id}`);
                      }}
                    >
                      Criar artigo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await updateGapStatus(g.id, 'dismissed');
                        qc.invalidateQueries({ queryKey: ['kb_gaps'] });
                      }}
                    >
                      Dispensar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateHelpCenterDialog({
  workspaceId,
  kbs,
  onCreated,
}: {
  workspaceId?: string;
  kbs: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: '',
    title: 'Central de Ajuda',
    description: '',
    primary_color: '#6366f1',
    knowledge_base_id: '',
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Help Center
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Help Center</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Slug (URL pública)</Label>
            <Input
              value={form.slug}
              placeholder="minha-empresa"
              onChange={(e) =>
                setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
              }
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <Label>Base de conhecimento</Label>
            <Select
              value={form.knowledge_base_id}
              onValueChange={(v) => setForm({ ...form, knowledge_base_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {kbs.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cor primária</Label>
            <Input
              type="color"
              value={form.primary_color}
              onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="h-10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (!workspaceId || !form.slug || !form.title)
                return toast.error('Preencha slug e título');
              try {
                await createHelpCenter({
                  workspace_id: workspaceId,
                  ...form,
                  knowledge_base_id: form.knowledge_base_id || null,
                });
                toast.success('Criado');
                setOpen(false);
                onCreated();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Falhou');
              }
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateArticleDialog({
  kbId,
  helpCenters,
  onCreated,
}: {
  kbId: string;
  helpCenters: { id: string; title: string }[];
  onCreated: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', help_center_id: '', language: 'pt-BR' });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!kbId}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Artigo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Artigo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => {
                const t = e.target.value;
                setForm({
                  ...form,
                  title: t,
                  slug: t
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .slice(0, 80),
                });
              }}
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div>
            <Label>Help Center (opcional)</Label>
            <Select
              value={form.help_center_id}
              onValueChange={(v) => setForm({ ...form, help_center_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                {helpCenters.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Idioma</Label>
            <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (BR)</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (!form.title || !form.slug) return toast.error('Preencha');
              try {
                const a = await createArticle({
                  knowledge_base_id: kbId,
                  slug: form.slug,
                  title: form.title,
                  language: form.language,
                  help_center_id: form.help_center_id || null,
                  content_json: { type: 'doc', content: [] },
                });
                toast.success('Criado');
                setOpen(false);
                onCreated(a.id);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Falhou');
              }
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
