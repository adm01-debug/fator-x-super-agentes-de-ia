import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, MessageSquare, Pin, Lock, CheckCircle2, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  getHelpCenterBySlug,
  listThreads,
  getThread,
  listPosts,
  createThread,
  createPost,
  markAsAnswer,
} from '@/services/knowledgeManagementService';
import { useAuth } from '@/contexts/AuthContext';

export default function PublicForumPage() {
  const { slug, threadId } = useParams<{ slug: string; threadId?: string }>();
  const { data: hc } = useQuery({
    queryKey: ['public_hc', slug],
    queryFn: () => (slug ? getHelpCenterBySlug(slug) : null),
    enabled: !!slug,
  });

  if (!hc)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  const primary = hc.primary_color || '#6366f1';

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b border-border"
        style={{ background: `linear-gradient(135deg, ${primary}15, transparent)` }}
      >
        <div className="max-w-5xl mx-auto px-6 py-6">
          <Link
            to={`/help/${slug}`}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para {hc.title}
          </Link>
          <h1 className="text-2xl font-heading font-bold text-foreground">Fórum da Comunidade</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {threadId ? (
          <ThreadView threadId={threadId} hcSlug={slug!} primaryColor={primary} />
        ) : (
          <ThreadList helpCenterId={hc.id} hcSlug={slug!} primaryColor={primary} />
        )}
      </main>
    </div>
  );
}

function ThreadList({
  helpCenterId,
  hcSlug,
  primaryColor,
}: {
  helpCenterId: string;
  hcSlug: string;
  primaryColor: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: threads = [] } = useQuery({
    queryKey: ['forum_threads', helpCenterId],
    queryFn: () => listThreads(helpCenterId),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'general' });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{threads.length} tópicos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!user} style={{ background: primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo tópico
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar tópico</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium">Título</span>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <span className="text-sm font-medium">Mensagem</span>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  if (!form.title || !form.body) return toast.error('Preencha');
                  try {
                    const t = await createThread({ help_center_id: helpCenterId, ...form });
                    toast.success('Criado');
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ['forum_threads'] });
                    navigate(`/help/${hcSlug}/forum/${t.id}`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Falhou');
                  }
                }}
              >
                Publicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {!user && (
        <p className="text-sm text-muted-foreground">Faça login para participar do fórum.</p>
      )}

      {threads.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          Sem tópicos. Seja o primeiro!
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(
            (t: {
              id: string;
              title: string;
              body: string;
              author_name: string;
              reply_count: number;
              view_count: number;
              is_pinned: boolean;
              is_locked: boolean;
              is_resolved: boolean;
              created_at: string;
            }) => (
              <Link
                key={t.id}
                to={`/help/${hcSlug}/forum/${t.id}`}
                className="nexus-card block hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {t.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                      {t.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {t.is_resolved && <CheckCircle2 className="h-3 w-3 text-nexus-emerald" />}
                      <h3 className="font-semibold text-foreground truncate">{t.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{t.body}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span>{t.author_name}</span>
                      <span>•</span>
                      <span>{new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {t.reply_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {t.view_count}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ThreadView({
  threadId,
  hcSlug,
  primaryColor,
}: {
  threadId: string;
  hcSlug: string;
  primaryColor: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: thread } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => getThread(threadId),
  });
  const { data: posts = [] } = useQuery({
    queryKey: ['posts', threadId],
    queryFn: () => listPosts(threadId),
  });
  const [reply, setReply] = useState('');

  if (!thread) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-6">
      <Link
        to={`/help/${hcSlug}/forum`}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Todos os tópicos
      </Link>

      <div className="nexus-card">
        <div className="flex items-center gap-2 mb-2">
          {thread.is_resolved && <Badge className="bg-nexus-emerald">Resolvido</Badge>}
          {thread.is_pinned && (
            <Badge variant="outline">
              <Pin className="h-3 w-3 mr-1" />
              Fixo
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{thread.title}</h1>
        <div className="text-xs text-muted-foreground mb-4">
          por {thread.author_name} • {new Date(thread.created_at).toLocaleString('pt-BR')}
        </div>
        <div className="text-foreground whitespace-pre-wrap">{thread.body}</div>
      </div>

      <h2 className="text-lg font-semibold">{posts.length} respostas</h2>
      {posts.map(
        (p: {
          id: string;
          body: string;
          author_name: string;
          author_id: string;
          is_answer: boolean;
          created_at: string;
        }) => (
          <div
            key={p.id}
            className={`nexus-card ${p.is_answer ? 'border-nexus-emerald/50 bg-nexus-emerald/5' : ''}`}
          >
            {p.is_answer && (
              <Badge className="bg-nexus-emerald mb-2">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Resposta aceita
              </Badge>
            )}
            <div className="text-xs text-muted-foreground mb-2">
              {p.author_name} • {new Date(p.created_at).toLocaleString('pt-BR')}
            </div>
            <div className="text-foreground whitespace-pre-wrap">{p.body}</div>
            {user?.id === thread.author_id && !p.is_answer && !thread.is_resolved && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={async () => {
                  await markAsAnswer(p.id, threadId);
                  qc.invalidateQueries({ queryKey: ['thread', threadId] });
                  qc.invalidateQueries({ queryKey: ['posts', threadId] });
                  toast.success('Marcada');
                }}
              >
                Marcar como resposta
              </Button>
            )}
          </div>
        ),
      )}

      {user && !thread.is_locked && (
        <div className="nexus-card space-y-3">
          <h3 className="font-semibold">Sua resposta</h3>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Escreva sua resposta..."
          />
          <Button
            style={{ background: primaryColor }}
            onClick={async () => {
              if (!reply.trim()) return;
              try {
                await createPost({ thread_id: threadId, body: reply });
                setReply('');
                qc.invalidateQueries({ queryKey: ['posts', threadId] });
                qc.invalidateQueries({ queryKey: ['thread', threadId] });
                toast.success('Publicada');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Falhou');
              }
            }}
          >
            Publicar resposta
          </Button>
        </div>
      )}
      {!user && (
        <p className="text-sm text-muted-foreground text-center py-4">Faça login para responder.</p>
      )}
    </div>
  );
}
