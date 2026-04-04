import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { QuickActionsBar } from "@/components/shared/QuickActionsBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, BookOpen, ArrowRight, Loader2, Database, Pencil, Trash2, Bot, FileText } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabaseExtended";
import { CreateKnowledgeBaseDialog } from "@/components/dialogs/CreateKnowledgeBaseDialog";
import { EditKnowledgeBaseDialog } from "@/components/dialogs/EditKnowledgeBaseDialog";
import { KnowledgeBaseDetail } from "@/components/knowledge/KnowledgeBaseDetail";
import { toast } from "sonner";

const pipeline = ['Parsing', 'Chunking', 'Metadata', 'Embeddings', 'Indexing'];

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [editKb, setEditKb] = useState<any>(null);
  const [selectedKb, setSelectedKb] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: knowledgeBases = [], isLoading, refetch } = useQuery({
    queryKey: ['knowledge_bases'],
    queryFn: async () => {
      const { data, error } = await supabase.from('knowledge_bases').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('knowledge_bases').delete().eq('id', id);
    if (error) {
      toast.error(`Erro ao deletar: ${error.message}`);
    } else {
      toast.success("Base removida com sucesso");
      refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge_bases'] });
    }
  };

  // Detail view
  if (selectedKb) {
    return (
      <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
        <KnowledgeBaseDetail kbId={selectedKb.id} kbName={selectedKb.name} onBack={() => setSelectedKb(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Knowledge / RAG"
        description="Gerencie bases de conhecimento, documentos e pipelines de ingestão"
        actions={<CreateKnowledgeBaseDialog onCreated={() => refetch()} />}
      />

      <QuickActionsBar actions={[
        { label: 'Agents', icon: Bot, path: '/agents' },
        { label: 'Prompts', icon: FileText, path: '/prompts' },
      ]} />

      <InfoHint title="O que é RAG?">
        Retrieval-Augmented Generation combina busca em documentos com geração de linguagem. O agente recupera trechos relevantes da base de conhecimento antes de responder, melhorando a factualidade e permitindo citações.
      </InfoHint>

      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Pipeline de ingestão</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {pipeline.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">{i + 1}</div>
                <p className="text-[11px] text-foreground mt-1.5 font-medium">{step}</p>
              </div>
              {i < pipeline.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar bases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma base de conhecimento</h2>
          <p className="text-sm text-muted-foreground mb-4">Crie uma base para alimentar seus agentes com RAG.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((kb) => (
            <div key={kb.id}
              className="nexus-card group cursor-pointer"
              onClick={() => setSelectedKb({ id: kb.id, name: kb.name })}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{kb.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{kb.vector_db} • {kb.embedding_model?.split('-').slice(-1)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={kb.status || 'active'} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{kb.description || 'Sem descrição'}</p>
              <div className="grid grid-cols-2 gap-2 text-center border-t border-border/50 pt-3">
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">{kb.document_count ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground">Docs</p>
                </div>
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">{(kb.chunk_count ?? 0).toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Chunks</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50" onClick={e => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => setEditKb(kb)}
                >
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{kb.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todos os documentos e chunks desta base serão removidos permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(kb.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vector Indexes Status */}
      <VectorIndexesStatus />

      <EditKnowledgeBaseDialog
        kb={editKb}
        open={!!editKb}
        onOpenChange={(open) => { if (!open) setEditKb(null); }}
        onUpdated={() => refetch()}
      />
    </div>
  );
}

function VectorIndexesStatus() {
  const { data: indexes = [] } = useQuery({
    queryKey: ['vector_indexes'],
    queryFn: async () => {
      const { data } = await supabase.from('vector_indexes').select('*, knowledge_bases(name)').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: chunkStats } = useQuery({
    queryKey: ['chunk_embedding_stats'],
    queryFn: async () => {
      const [done, pending, failed] = await Promise.all([
        supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'done'),
        supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'pending'),
        supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'failed'),
      ]);
      return { done: done.count ?? 0, pending: pending.count ?? 0, failed: failed.count ?? 0 };
    },
  });

  if (!chunkStats && indexes.length === 0) return null;

  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" /> Embeddings & Vector Indexes
      </h3>
      {chunkStats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center py-2 rounded-lg bg-nexus-emerald/10">
            <p className="text-lg font-bold text-nexus-emerald">{chunkStats.done}</p>
            <p className="text-[11px] text-muted-foreground">Embeddings prontos</p>
          </div>
          <div className="text-center py-2 rounded-lg bg-nexus-amber/10">
            <p className="text-lg font-bold text-nexus-amber">{chunkStats.pending}</p>
            <p className="text-[11px] text-muted-foreground">Pendentes</p>
          </div>
          <div className="text-center py-2 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">{chunkStats.failed}</p>
            <p className="text-[11px] text-muted-foreground">Falharam</p>
          </div>
        </div>
      )}
      {indexes.length > 0 && (
        <div className="space-y-2">
          {indexes.map((idx: Record<string, unknown>) => (
            <div key={String(idx.id)} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30 text-xs">
              <div>
                <span className="font-medium text-foreground">{(idx.knowledge_bases as Record<string, string> | null)?.name || 'KB'}</span>
                <span className="text-muted-foreground ml-2">{String(idx.provider)} • {String(idx.model)} • {String(idx.dimensions)}d</span>
              </div>
              <span className={`text-[11px] ${idx.status === 'active' ? 'text-nexus-emerald' : 'text-nexus-amber'}`}>{String(idx.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
