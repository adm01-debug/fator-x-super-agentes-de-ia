import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, FileText, Wand2, ShieldAlert, Activity, ArchiveRestore } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceInfo } from "@/lib/agentService";
import { supabase } from "@/integrations/supabase/client";
import {
  listPostmortems, createManualPostmortem, generateFromIncident, generateFromGameday,
  listRecentIncidentRuns, listRecentGameDays,
  type Postmortem, type PostmortemSeverity, type PostmortemStatus, type PostmortemSource,
} from "@/services/postmortemService";

const SEV_COLORS: Record<PostmortemSeverity, string> = {
  SEV1: "bg-destructive/15 text-destructive border-destructive/30",
  SEV2: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
  SEV3: "bg-primary/10 text-primary border-primary/30",
  SEV4: "bg-muted text-muted-foreground border-border",
};

const STATUS_COLORS: Record<PostmortemStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-nexus-amber/15 text-nexus-amber",
  published: "bg-emerald-500/15 text-emerald-500",
};

const SOURCE_ICON: Record<PostmortemSource, React.ComponentType<{ className?: string }>> = {
  incident_run: ShieldAlert,
  game_day: Activity,
  dr_drill: ArchiveRestore,
  manual: FileText,
};

export default function PostmortemsPage() {
  useAuth();
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [items, setItems] = useState<Postmortem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSev, setFilterSev] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genTab, setGenTab] = useState<"incident" | "gameday">("incident");
  const [recentIncidents, setRecentIncidents] = useState<Array<{ id: string; started_at: string; status: string; triggered_by: string }>>([]);
  const [recentGamedays, setRecentGamedays] = useState<Array<{ id: string; title: string; scenario: string; started_at: string | null }>>([]);

  const [newTitle, setNewTitle] = useState("");
  const [newSev, setNewSev] = useState<PostmortemSeverity>("SEV2");
  const [newSummary, setNewSummary] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getWorkspaceInfo()
      .then((ws) => {
        if (ws) return ws;
        return supabase.from("workspaces").select("id").limit(1).maybeSingle().then(r => r.data ? { id: r.data.id } as never : null);
      })
      .then(async (ws: { id?: string } | null) => {
        // getWorkspaceInfo returns no id directly; fallback fetch
        const { data: w } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();
        const wsId = w?.id ?? null;
        setWorkspaceId(wsId);
        if (wsId) await refresh(wsId);
        else setLoading(false);
      })
      .catch((e) => { logger.error("ws fetch failed", e); setLoading(false); });
  }, []);

  async function refresh(wsId: string) {
    setLoading(true);
    try {
      const data = await listPostmortems(wsId);
      setItems(data);
    } catch (e) {
      logger.error("listPostmortems failed", e);
      toast.error("Falha ao carregar postmortems");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (filterSev !== "all" && p.severity !== filterSev) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterSource !== "all" && p.incident_source !== filterSource) return false;
      if (search.trim() && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filterSev, filterStatus, filterSource, search]);

  const stats = useMemo(() => ({
    total: items.length,
    sev1: items.filter(i => i.severity === "SEV1").length,
    draft: items.filter(i => i.status === "draft").length,
    published: items.filter(i => i.status === "published").length,
  }), [items]);

  async function openGenerator() {
    if (!workspaceId) return;
    setGenOpen(true);
    try {
      const [inc, gd] = await Promise.all([
        listRecentIncidentRuns(workspaceId, 20),
        listRecentGameDays(workspaceId, 20),
      ]);
      setRecentIncidents(inc as never);
      setRecentGamedays(gd as never);
    } catch (e) {
      logger.error("recent sources fetch failed", e);
    }
  }

  async function handleGenIncident(id: string) {
    try {
      const pmId = await generateFromIncident(id);
      toast.success("Postmortem gerado");
      setGenOpen(false);
      navigate(`/observability/postmortems/${pmId}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleGenGameday(id: string) {
    try {
      const pmId = await generateFromGameday(id);
      toast.success("Postmortem gerado");
      setGenOpen(false);
      navigate(`/observability/postmortems/${pmId}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleCreateManual() {
    if (!workspaceId || !newTitle.trim()) return;
    setCreating(true);
    try {
      const id = await createManualPostmortem({
        workspace_id: workspaceId,
        title: newTitle.trim(),
        severity: newSev,
        summary: newSummary.trim() || undefined,
      });
      toast.success("Postmortem criado");
      setCreateOpen(false);
      setNewTitle(""); setNewSummary(""); setNewSev("SEV2");
      navigate(`/observability/postmortems/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Postmortems
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Aprendizado estruturado pós-incidente — blameless, acionável, publicado em até 5 dias.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openGenerator}>
            <Wand2 className="h-4 w-4 mr-2" /> Gerar de incidente
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo postmortem
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="SEV1" value={stats.sev1} accent="text-destructive" />
        <StatCard label="Rascunhos" value={stats.draft} />
        <StatCard label="Publicados" value={stats.published} accent="text-emerald-500" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Lista</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Buscar título…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
              <Select value={filterSev} onValueChange={setFilterSev}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas SEV</SelectItem>
                  <SelectItem value="SEV1">SEV1</SelectItem>
                  <SelectItem value="SEV2">SEV2</SelectItem>
                  <SelectItem value="SEV3">SEV3</SelectItem>
                  <SelectItem value="SEV4">SEV4</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="review">Em revisão</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  <SelectItem value="incident_run">Incidente</SelectItem>
                  <SelectItem value="game_day">Game Day</SelectItem>
                  <SelectItem value="dr_drill">DR Drill</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhum postmortem encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((pm) => {
                const Icon = SOURCE_ICON[pm.incident_source];
                return (
                  <button
                    key={pm.id}
                    onClick={() => navigate(`/observability/postmortems/${pm.id}`)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pm.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {pm.summary || "Sem resumo ainda"}
                      </p>
                    </div>
                    <Badge variant="outline" className={SEV_COLORS[pm.severity]}>{pm.severity}</Badge>
                    <Badge variant="outline" className={STATUS_COLORS[pm.status]}>
                      {pm.status === "draft" ? "Rascunho" : pm.status === "review" ? "Revisão" : "Publicado"}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {new Date(pm.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo postmortem manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: SEV1 — Provider outage 2026-04-18" />
            </div>
            <div>
              <Label>Severidade</Label>
              <Select value={newSev} onValueChange={(v) => setNewSev(v as PostmortemSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEV1">SEV1 — Outage crítico</SelectItem>
                  <SelectItem value="SEV2">SEV2 — Degradação grave</SelectItem>
                  <SelectItem value="SEV3">SEV3 — Impacto limitado</SelectItem>
                  <SelectItem value="SEV4">SEV4 — Cosmético / interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resumo (opcional)</Label>
              <Input value={newSummary} onChange={(e) => setNewSummary(e.target.value)} placeholder="O que aconteceu, em uma frase" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateManual} disabled={!newTitle.trim() || creating}>
              {creating ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate from source dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Gerar postmortem a partir de…</DialogTitle></DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant={genTab === "incident" ? "default" : "outline"} onClick={() => setGenTab("incident")}>
              <ShieldAlert className="h-4 w-4 mr-2" /> Incidente
            </Button>
            <Button size="sm" variant={genTab === "gameday" ? "default" : "outline"} onClick={() => setGenTab("gameday")}>
              <Activity className="h-4 w-4 mr-2" /> Game Day
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {genTab === "incident" && recentIncidents.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum incident run recente.</p>
            )}
            {genTab === "incident" && recentIncidents.map((r) => (
              <button key={r.id} onClick={() => handleGenIncident(r.id)}
                className="w-full text-left p-2.5 rounded-md border border-border hover:bg-secondary/40 transition-colors flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{new Date(r.started_at).toLocaleString("pt-BR")}</span>
                <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                <span className="text-xs text-muted-foreground truncate flex-1">trigger: {r.triggered_by}</span>
              </button>
            ))}
            {genTab === "gameday" && recentGamedays.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum game day finalizado.</p>
            )}
            {genTab === "gameday" && recentGamedays.map((g) => (
              <button key={g.id} onClick={() => handleGenGameday(g.id)}
                className="w-full text-left p-2.5 rounded-md border border-border hover:bg-secondary/40 transition-colors flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate flex-1">{g.title}</span>
                <Badge variant="outline" className="text-[10px]">{g.scenario}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
