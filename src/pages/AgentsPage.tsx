import { logger } from '@/lib/logger';
import { PageHeader } from "@/components/shared/PageHeader";
import { QuickActionsBar } from "@/components/shared/QuickActionsBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, Plus, Search, Filter, BookOpen, GitBranch, Activity,
  Download, Upload, Trash2, Archive, CheckSquare, X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAgents, cloneAgent, autoTagAgent } from "@/lib/agentService";
import { useAgents } from "@/hooks/use-data";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { exportAgentToJSON, downloadJSON, importAgentFromJSON, readFileAsText } from "@/lib/agentExportImport";
import { bulkUpdateStatus, bulkDelete } from "@/lib/agentBulkActions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AccessControl, DangerousActionDialog } from "@/components/rbac";
import { AgentCard } from "@/components/agents/AgentCard";

type AgentRow = Tables<"agents">;

const FAV_KEY = "nexus-fav-agents";
function getFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch (err) { logger.error("Operation failed:", err); return []; }
}
function toggleFavorite(id: string): string[] {
  const prev = getFavorites();
  const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
  try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* quota */ }
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectionMode = selectedIds.size > 0;

  // useAgents available for cross-component data sharing
  const { data: _allAgentsCache } = useAgents();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', statusFilter],
    queryFn: () => listAgents(statusFilter),
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
      await cloneAgent(agent);
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
    try {
      const result = await autoTagAgent(agent);
      if (result.added === 0) { toast.info('Nenhuma tag nova detectada'); return; }
      toast.success(`${result.added} tags adicionadas automaticamente`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao auto-tag');
    }
  }, [queryClient]);

  const handleExport = useCallback((e: React.MouseEvent, agent: AgentRow) => {
    e.stopPropagation();
    const json = exportAgentToJSON(agent);
    const safeName = agent.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    downloadJSON(json, `agent_${safeName}.json`);
    toast.success(`"${agent.name}" exportado com sucesso`);
  }, []);

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

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Agentes"
        description="Gerencie seus agentes de IA — crie, configure e monitore"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Importar
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/agents/templates')}>
              <BookOpen className="h-3.5 w-3.5" /> Templates
            </Button>
            <AccessControl permission="agents.create">
              <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
                <Plus className="h-4 w-4" /> Criar agente
              </Button>
            </AccessControl>
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
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={selectAll}>Selecionar todos</Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleBulkExport} disabled={bulkLoading}>
            <Download className="h-3 w-3" /> Exportar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleBulkArchive} disabled={bulkLoading}>
            <Archive className="h-3 w-3" /> Arquivar
          </Button>
          <AccessControl permission="agents.delete">
            <DangerousActionDialog
              trigger={
                <Button variant="destructive" size="sm" className="gap-1.5 h-7 text-xs" disabled={bulkLoading}>
                  <Trash2 className="h-3 w-3" /> Excluir
                </Button>
              }
              title={`Excluir ${selectedIds.size} agente(s)`}
              description={<><p>Esta ação é irreversível.</p><p>Conversas e logs históricos ficarão órfãos.</p></>}
              action="bulk_delete"
              resourceType="agents"
              resourceName={`${selectedIds.size} agente(s)`}
              minReasonLength={15}
              requirePassword={true}
              confirmLabel="Excluir Permanentemente"
              metadata={{ count: selectedIds.size, ids: Array.from(selectedIds) }}
              onConfirm={async () => { await handleBulkDelete(); }}
            />
          </AccessControl>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="nexus-card space-y-3" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl skeleton-shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded skeleton-shimmer" />
                  <div className="h-3 w-24 rounded skeleton-shimmer" />
                </div>
              </div>
              <div className="h-3 w-full rounded skeleton-shimmer" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                <div className="h-5 w-12 rounded-full skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : !user ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center border border-primary/10">
              <Bot className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Faça login para ver seus agentes</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">Seus agentes são salvos na nuvem e vinculados à sua conta.</p>
          <Button onClick={() => navigate("/auth")} className="nexus-gradient-bg text-primary-foreground gap-2">Entrar</Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
          {search || statusFilter !== "all" ? (
            <>
              <div className="relative mb-6">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center border border-border/50">
                  <Search className="h-9 w-9 text-muted-foreground/50" />
                </div>
              </div>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Nenhum agente encontrado</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">Tente ajustar os filtros ou o termo de busca.</p>
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); }}>Limpar filtros</Button>
            </>
          ) : (
            <>
              <div className="relative mb-6">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center border border-primary/15 animate-border-glow">
                  <Bot className="h-12 w-12 text-primary" />
                </div>
                <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-md">
                  <Plus className="h-5 w-5 text-nexus-emerald" />
                </div>
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground mb-2">Crie seu primeiro agente</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
                Comece com um template ou importe um arquivo JSON para dar vida ao seu agente de IA.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" /> Importar JSON
                </Button>
                <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
                  <Plus className="h-4 w-4" /> Criar agente
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {sorted.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isFav={favorites.includes(agent.id)}
              isSelected={selectedIds.has(agent.id)}
              selectionMode={selectionMode}
              cloning={cloning === agent.id}
              onToggleFav={handleToggleFav}
              onClone={handleClone}
              onAutoTag={handleAutoTag}
              onExport={handleExport}
              onToggleSelect={toggleSelect}
              onNavigate={() => navigate(`/builder/${agent.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
