import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QuickActionsBar } from "@/components/shared/QuickActionsBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bot, Plus, Search, Filter, ArrowRight, Loader2, BookOpen, GitBranch, Activity,
  Star, Copy, Wand2, Download, Upload, Trash2, Archive, CheckSquare, X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, Database } from "@/integrations/supabase/types";
import { exportAgentToJSON, downloadJSON, importAgentFromJSON, readFileAsText } from "@/lib/agentExportImport";
import { bulkUpdateStatus, bulkDelete } from "@/lib/agentBulkActions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AgentRow = Tables<"agents">;

const FAV_KEY = "nexus-fav-agents";
function getFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch (err) { console.error("Operation failed:", err); return []; }
}
function toggleFavorite(id: string): string[] {
  const prev = getFavorites();
  const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [favorites, setFavorites] = useState<string[]>(getFavorites);
  const [cloning, setCloning] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectionMode = selectedIds.size > 0;

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("agents")
        .select("*")
        .order("updated_at", { ascending: false });
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as Database["public"]["Enums"]["agent_status"]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleToggleFav = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(toggleFavorite(id));
  }, []);

  const handleClone = useCallback(async (e: React.MouseEvent, agent: AgentRow) => {
    e.stopPropagation();
    setCloning(agent.id);
    try {
      const { id, created_at, updated_at, ...rest } = agent;
      const { error } = await supabase.from('agents').insert({
        ...rest,
        name: `${agent.name} (cópia)`,
        status: 'draft' as const,
        version: 1,
      }).select('id').single();
      if (error) throw error;
      toast.success('Agente clonado!');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao clonar');
    } finally {
      setCloning(null);
    }
  }, [queryClient]);

  const handleAutoTag = useCallback(async (e: React.MouseEvent, agent: AgentRow) => {
    e.stopPropagation();
    const config = agent.config as Record<string, unknown> | null;
    const tags: string[] = [];
    if (agent.model?.includes('gpt')) tags.push('OpenAI');
    if (agent.model?.includes('gemini')) tags.push('Gemini');
    if (agent.model?.includes('claude')) tags.push('Claude');
    if (config?.tools && Array.isArray(config.tools) && config.tools.length) tags.push('tools');
    if (config?.rag_enabled || config?.knowledge_base) tags.push('RAG');
    if (config?.memory_enabled) tags.push('memory');
    if (agent.status === 'production') tags.push('prod');
    if (agent.persona) tags.push('persona');
    const merged = [...new Set([...(agent.tags ?? []), ...tags])];
    if (merged.length === (agent.tags ?? []).length) {
      toast.info('Nenhuma tag nova detectada');
      return;
    }
    const { error } = await supabase.from('agents').update({ tags: merged }).eq('id', agent.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${merged.length - (agent.tags ?? []).length} tags adicionadas automaticamente`);
    queryClient.invalidateQueries({ queryKey: ['agents'] });
  }, [queryClient]);

  // ═══ Export ═══
  const handleExport = useCallback((e: React.MouseEvent, agent: AgentRow) => {
    e.stopPropagation();
    const json = exportAgentToJSON(agent);
    const safeName = agent.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    downloadJSON(json, `agent_${safeName}.json`);
    toast.success(`"${agent.name}" exportado com sucesso`);
  }, []);

  // ═══ Import ═══
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const id = await importAgentFromJSON(text);
      toast.success('Agente importado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      navigate(`/builder/${id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [queryClient, navigate]);

  // ═══ Selection ═══
  const toggleSelect = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map(a => a.id)));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ═══ Bulk Actions ═══
  const handleBulkArchive = useCallback(async () => {
    setBulkLoading(true);
    try {
      await bulkUpdateStatus(Array.from(selectedIds), 'archived');
      toast.success(`${selectedIds.size} agente(s) arquivado(s)`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, queryClient]);

  const handleBulkDelete = useCallback(async () => {
    setBulkLoading(true);
    try {
      await bulkDelete(Array.from(selectedIds));
      toast.success(`${selectedIds.size} agente(s) removido(s)`);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, queryClient]);

  const handleBulkExport = useCallback(() => {
    const selected = agents.filter(a => selectedIds.has(a.id));
    selected.forEach(agent => {
      const json = exportAgentToJSON(agent);
      const safeName = agent.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      downloadJSON(json, `agent_${safeName}.json`);
    });
    toast.success(`${selected.length} agente(s) exportado(s)`);
  }, [selectedIds, agents]);

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    const aFav = favorites.includes(a.id) ? 1 : 0;
    const bFav = favorites.includes(b.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return 0;
  });

  const getConfig = (agent: AgentRow) => {
    const config = agent.config as Record<string, unknown> | null;
    return config ?? {};
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Agents"
        description="Gerencie seus agentes de IA — crie, configure e monitore"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Importar
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
              <Plus className="h-4 w-4" /> Criar agente
            </Button>
          </div>
        }
      />

      <QuickActionsBar actions={[
        { label: 'Conhecimento', icon: BookOpen, path: '/knowledge' },
        { label: 'Workflows', icon: GitBranch, path: '/workflows' },
        { label: 'Monitoramento', icon: Activity, path: '/monitoring' },
      ]} />

      {/* Bulk Actions Bar */}
      {selectionMode && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-fade-in">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selecionado(s)</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={selectAll}>
            Selecionar todos
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleBulkExport} disabled={bulkLoading}>
            <Download className="h-3 w-3" /> Exportar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleBulkArchive} disabled={bulkLoading}>
            <Archive className="h-3 w-3" /> Arquivar
          </Button>
          <Button variant="destructive" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setDeleteDialogOpen(true)} disabled={bulkLoading}>
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar agentes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-secondary/50 border-border/50">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="configured">Configurado</SelectItem>
            <SelectItem value="testing">Testando</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Produção</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !user ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Faça login para ver seus agentes</h2>
          <p className="text-sm text-muted-foreground mb-4">Seus agentes são salvos na nuvem e vinculados à sua conta.</p>
          <Button onClick={() => navigate("/auth")} className="nexus-gradient-bg text-primary-foreground">Entrar</Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {search || statusFilter !== "all" ? (
            <>
              <Search className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum agente encontrado</h2>
              <p className="text-sm text-muted-foreground mb-4">Tente ajustar os filtros ou o termo de busca.</p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Nenhum agente ainda</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Crie seu primeiro agente ou importe um arquivo JSON.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" /> Importar JSON
                </Button>
                <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2">
                  <Plus className="h-4 w-4" /> Criar agente
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {sorted.map((agent) => {
            const config = getConfig(agent);
            const isFav = favorites.includes(agent.id);
            const isSelected = selectedIds.has(agent.id);
            return (
              <div
                key={agent.id}
                className={`nexus-card nexus-card-interactive cursor-pointer group relative ${isSelected ? 'ring-2 ring-primary' : ''}`}
                onClick={() => selectionMode ? toggleSelect({stopPropagation: () => {}} as React.MouseEvent, agent.id) : navigate(`/builder/${agent.id}`)}
              >
                {/* Selection checkbox */}
                <div
                  className={`absolute top-3 left-3 z-10 transition-opacity ${selectionMode || 'opacity-0 group-hover:opacity-100'}`}
                  onClick={(e) => toggleSelect(e, agent.id)}
                >
                  <Checkbox checked={isSelected} className="h-4 w-4" />
                </div>

                <div className={`flex items-start justify-between mb-3 ${selectionMode ? 'ml-7' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                        {agent.avatar_emoji || "🤖"}
                      </div>
                      <span
                        className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                          agent.status === 'production' || agent.status === 'monitoring'
                            ? 'bg-nexus-emerald animate-glow-pulse'
                            : agent.status === 'deprecated' || agent.status === 'archived'
                            ? 'bg-destructive'
                            : agent.status === 'draft'
                            ? 'bg-muted-foreground/40'
                            : 'bg-nexus-amber'
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {(config as Record<string, unknown>).type as string || agent.persona} • {agent.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleExport(e, agent)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-nexus-cyan hover:bg-nexus-cyan/10 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Exportar agente"
                      title="Exportar JSON"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleAutoTag(e, agent)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-nexus-purple hover:bg-nexus-purple/10 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Auto-tag com IA"
                      title="Auto-tag"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleClone(e, agent)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Clonar agente"
                      disabled={cloning === agent.id}
                    >
                      {cloning === agent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={(e) => handleToggleFav(e, agent.id)}
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                        isFav 
                          ? 'text-nexus-amber hover:bg-nexus-amber/10' 
                          : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100'
                      }`}
                      aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                    <StatusBadge status={agent.status || "draft"} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {agent.mission || (config as Record<string, unknown>).description as string || "Sem descrição"}
                </p>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {(agent.tags ?? []).slice(0, 3).map(tag => (
                    <span key={tag} className="nexus-badge-primary">{tag}</span>
                  ))}
                  {(agent.tags ?? []).length > 3 && (
                    <span className="nexus-badge-muted">+{(agent.tags ?? []).length - 3}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground">
                    v{agent.version} • {new Date(agent.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} agente(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados, traces e configurações serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={bulkLoading}>
              {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
