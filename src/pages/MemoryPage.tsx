import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Brain, Clock, Globe, User, Users, Database, Plus, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceId } from "@/lib/agentService";

const memoryTypes = [
  { key: 'short_term', icon: Clock, title: 'Short-term', desc: 'Memória da conversa atual', retention: 'Sessão', color: 'text-nexus-cyan' },
  { key: 'episodic', icon: Brain, title: 'Episódica', desc: 'Eventos e interações passadas', retention: '90 dias', color: 'text-primary' },
  { key: 'semantic', icon: Globe, title: 'Semântica', desc: 'Conhecimento geral aprendido', retention: 'Permanente', color: 'text-nexus-emerald' },
  { key: 'user_profile', icon: User, title: 'Perfil do Usuário', desc: 'Preferências individuais', retention: 'Até remoção', color: 'text-nexus-amber' },
  { key: 'team', icon: Users, title: 'Team / Shared', desc: 'Contexto compartilhado entre agentes', retention: 'Permanente', color: 'text-nexus-glow' },
  { key: 'external', icon: Database, title: 'Conectores Externos', desc: 'Redis, Pinecone, PostgreSQL', retention: 'Conforme provider', color: 'text-muted-foreground' },
];

export default function MemoryPage() {
  const [activeType, setActiveType] = useState('semantic');
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ['agent_memories', activeType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('agent_memories')
        .select('*')
        .eq('memory_type', activeType)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; content: string; source: string; created_at: string; relevance_score: number | null }>;
    },
  });

  const filtered = memories.filter(m =>
    search ? m.content.toLowerCase().includes(search.toLowerCase()) : true
  );

  const handleAdd = async () => {
    if (!newContent.trim()) { toast.error('Conteúdo é obrigatório'); return; }
    setSaving(true);
    try {
      const workspaceId = await getWorkspaceId();
      const { error } = await (supabase as any).from('agent_memories').insert({
        workspace_id: workspaceId,
        memory_type: activeType,
        content: newContent.trim(),
        source: newSource.trim() || 'Manual',
      });
      if (error) throw error;
      setNewContent(''); setNewSource('');
      queryClient.invalidateQueries({ queryKey: ['agent_memories'] });
      toast.success('Memória salva!');
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('agent_memories').delete().eq('id', id);
    if (error) toast.error(`Erro: ${error.message}`);
    else { queryClient.invalidateQueries({ queryKey: ['agent_memories'] }); toast.success('Removida'); }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Memory Engine" description="Sistema de memória persistente — cada tipo com governança e ciclo de vida próprios" />

      <InfoHint title="Memória persistente ativada">
        Todas as memórias agora são salvas no Supabase com suporte a busca semântica (pgvector), TTL, e governança por tipo.
      </InfoHint>

      {/* Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {memoryTypes.map(mt => {
          const Icon = mt.icon;
          const isActive = activeType === mt.key;
          const count = isActive ? filtered.length : null;
          return (
            <button key={mt.key} onClick={() => setActiveType(mt.key)}
              className={`nexus-card text-left transition-all ${isActive ? 'ring-1 ring-primary border-primary' : 'hover:border-primary/30'}`}>
              <Icon className={`h-5 w-5 mb-2 ${mt.color}`} />
              <div className="text-xs font-semibold text-foreground">{mt.title}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{mt.desc}</div>
              {count !== null && <Badge variant="secondary" className="mt-2 text-[10px]">{count} itens</Badge>}
            </button>
          );
        })}
      </div>

      {/* Add + Search */}
      <div className="nexus-card space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar memórias..." className="pl-9 bg-secondary/50 text-xs" />
        </div>
        <div className="space-y-2">
          <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Conteúdo da memória..." rows={2} className="bg-secondary/50 text-xs" />
          <div className="flex gap-2">
            <Input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Fonte (opcional)" className="bg-secondary/50 text-xs flex-1" />
            <Button size="sm" onClick={handleAdd} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Brain className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{search ? 'Nenhuma memória encontrada' : 'Nenhuma memória deste tipo ainda'}</p>
        </div>
      ) : (
        <div className="space-y-2">
            {filtered.map((entry, i) => (
              <div key={entry.id} layout
                className="nexus-card flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{entry.content}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>{entry.source}</span>
                    <span>•</span>
                    <span>{new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                    {entry.relevance_score && entry.relevance_score !== 1 && (
                      <><span>•</span><span>Relevância: {(Number(entry.relevance_score) * 100).toFixed(0)}%</span></>
                    )}
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover memória?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(entry.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        
      )}
    </div>
  );
}
