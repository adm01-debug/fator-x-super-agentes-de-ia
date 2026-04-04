import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// Badge removed — unused
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Brain, Clock, Globe, User, Users, Database, Plus, Trash2, Search, Loader2, Zap, Archive } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { memorySchema } from "@/lib/validations/agentSchema";

const memoryTypes = [
  { key: 'short_term', icon: Clock, title: 'Short-term', desc: 'Memória da conversa atual', retention: 'Sessão', color: 'text-nexus-cyan' },
  { key: 'episodic', icon: Brain, title: 'Episódica', desc: 'Eventos e interações passadas', retention: '90 dias', color: 'text-primary' },
  { key: 'semantic', icon: Globe, title: 'Semântica', desc: 'Conhecimento geral aprendido', retention: 'Permanente', color: 'text-nexus-emerald' },
  { key: 'user_profile', icon: User, title: 'Perfil do Usuário', desc: 'Preferências individuais', retention: 'Até remoção', color: 'text-nexus-amber' },
  { key: 'team', icon: Users, title: 'Team / Shared', desc: 'Contexto compartilhado entre agentes', retention: 'Permanente', color: 'text-nexus-glow' },
  { key: 'external', icon: Database, title: 'Conectores Externos', desc: 'Redis, Pinecone, PostgreSQL', retention: 'Conforme provider', color: 'text-muted-foreground' },
];

async function invokeMemoryTool(tool: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('memory-tools', {
    body: { tool, params },
  });
  if (error) throw new Error(error.message || 'Erro ao chamar memory-tools');
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function MemoryPage() {
  const [activeType, setActiveType] = useState('semantic');
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const queryClient = useQueryClient();

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ['agent_memories', activeType, search],
    queryFn: async () => {
      // Use memory_search when there's a search query, otherwise list all
      if (search.trim()) {
        try {
          const result = await invokeMemoryTool('memory_search', {
            query: search.trim(),
            memory_type: activeType,
            limit: 50,
          });
          return (result?.memories ?? []) as Array<{ id: string; content: string; source: string; created_at: string; relevance_score: number | null }>;
        } catch {
          // Fallback to direct query if edge function fails
        }
      }
      const { data, error } = await supabase.from('agent_memories')
        .select('*')
        .eq('memory_type', activeType)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; content: string; source: string; created_at: string; relevance_score: number | null }>;
    },
  });

  const handleAdd = async () => {
    const result = memorySchema.safeParse({ content: newContent, memory_type: activeType, source: newSource || undefined });
    if (!result.success) { toast.error(result.error.errors[0]?.message || 'Dados inválidos'); return; }
    setSaving(true);
    try {
      await invokeMemoryTool('memory_save', {
        content: newContent.trim(),
        memory_type: activeType,
        source: newSource.trim() || 'Manual',
      });
      setNewContent(''); setNewSource('');
      queryClient.invalidateQueries({ queryKey: ['agent_memories'] });
      toast.success('Memória salva via Memory Engine!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await invokeMemoryTool('memory_forget', { memory_id: id });
      queryClient.invalidateQueries({ queryKey: ['agent_memories'] });
      toast.success('Memória removida');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    }
  };

  const handleCompact = async () => {
    setCompacting(true);
    try {
      const result = await invokeMemoryTool('memory_compact', {
        memory_type: activeType,
      });
      queryClient.invalidateQueries({ queryKey: ['agent_memories'] });
      toast.success(`Compactação concluída: ${result?.compacted ?? 0} memórias consolidadas`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? `Erro na compactação: ${e.message}` : "Erro na compactação");
    } finally { setCompacting(false); }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Memory Engine" description="Sistema de memória persistente — cada tipo com governança e ciclo de vida próprios" />

      <InfoHint title="MemGPT Engine ativado">
        Todas as operações usam a edge function memory-tools (padrão MemGPT/Letta) com suporte a save, search, compact e forget.
      </InfoHint>

      {/* Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {memoryTypes.map(mt => {
          const Icon = mt.icon;
          const isActive = activeType === mt.key;
          return (
            <button key={mt.key} onClick={() => setActiveType(mt.key)}
              className={`nexus-card text-left transition-all ${isActive ? 'ring-1 ring-primary border-primary' : 'hover:border-primary/30'}`}>
              <Icon className={`h-5 w-5 mb-2 ${mt.color}`} />
              <div className="text-xs font-semibold text-foreground">{mt.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{mt.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Add + Search + Compact */}
      <div className="nexus-card space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar memórias (semântica via memory-tools)..." className="pl-9 bg-secondary/50 text-xs" />
          </div>
          <Button size="sm" variant="outline" onClick={handleCompact} disabled={compacting} className="gap-1.5 text-xs shrink-0">
            {compacting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Compactar
          </Button>
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
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-nexus-cyan/10 flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-nexus-cyan" />
          </div>
          <p className="text-sm text-muted-foreground">{search ? 'Nenhuma memória encontrada para essa busca' : 'Nenhuma memória deste tipo ainda. Adicione acima para começar.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((entry) => (
            <div key={entry.id} className="nexus-card flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed">{entry.content}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                  <span>{entry.source}</span>
                  <span>•</span>
                  <span>{new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                  {entry.relevance_score && entry.relevance_score !== 1 && (
                    <><span>•</span><span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" /> {(Number(entry.relevance_score) * 100).toFixed(0)}%</span></>
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
