import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Archive, Play, Trash2, ChevronDown, CheckCircle2, XCircle, Clock, Database, AlertTriangle, Sparkles } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import {
  listDrills, createDrill, deleteDrill, listSnapshots, listRestoreLogs, executeDrill,
  DR_TEMPLATES, type DRDrill, type DRSnapshot, type DRRestoreLog,
} from "@/services/drDrillService";
import { logger } from "@/lib/logger";

const STATUS_VARIANTS: Record<DRDrill["status"], { label: string; cls: string }> = {
  scheduled: { label: "Agendado", cls: "bg-secondary text-secondary-foreground" },
  snapshotting: { label: "Snapshot", cls: "bg-primary/15 text-primary" },
  restoring: { label: "Restaurando", cls: "bg-primary/15 text-primary" },
  validating: { label: "Validando", cls: "bg-primary/15 text-primary" },
  completed: { label: "Concluído", cls: "bg-success/15 text-success" },
  failed: { label: "Falhou", cls: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

function fmtDuration(secs: number | null): string {
  if (secs === null || secs === undefined) return "—";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function rtoStatus(actual: number | null, target: number): { color: string; label: string } {
  if (actual === null) return { color: "text-muted-foreground", label: "—" };
  const ratio = actual / target;
  if (ratio <= 0.8) return { color: "text-success", label: "✓" };
  if (ratio <= 1.0) return { color: "text-warning", label: "⚠" };
  return { color: "text-destructive", label: "✗" };
}

export default function DRDrillsPage() {
  const { workspace } = useWorkspace();
  const [drills, setDrills] = useState<DRDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [openDialog, setOpenDialog] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [snapshots, setSnapshots] = useState<Record<string, DRSnapshot[]>>({});
  const [logs, setLogs] = useState<Record<string, DRRestoreLog[]>>({});

  const [form, setForm] = useState({
    name: "",
    description: "",
    scope: "table" as "full" | "workspace" | "table",
    target_tables: "agents,agent_traces,workspaces",
    rto_target_seconds: 300,
    rpo_target_seconds: 60,
  });

  const refresh = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      setDrills(await listDrills(workspace.id));
    } catch (e) {
      logger.error("listDrills failed", e);
      toast.error("Falha ao carregar drills");
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refresh on drill or log changes
  useEffect(() => {
    if (!workspace?.id) return;
    const ch = supabase
      .channel(`dr-drills-${workspace.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dr_drills", filter: `workspace_id=eq.${workspace.id}` }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dr_restore_logs" }, async (payload) => {
        const drillId = (payload.new as { drill_id?: string }).drill_id;
        if (drillId && expanded[drillId]) {
          setLogs((prev) => ({ ...prev, [drillId]: [...(prev[drillId] ?? []), payload.new as DRRestoreLog] }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspace?.id, expanded, refresh]);

  async function handleCreate() {
    if (!workspace?.id) return;
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    const tables = form.target_tables.split(",").map((t) => t.trim()).filter(Boolean);
    if (tables.length === 0) { toast.error("Informe ao menos uma tabela"); return; }
    try {
      await createDrill({
        workspace_id: workspace.id,
        name: form.name,
        description: form.description || undefined,
        scope: form.scope,
        target_tables: tables,
        rto_target_seconds: form.rto_target_seconds,
        rpo_target_seconds: form.rpo_target_seconds,
      });
      toast.success("Drill agendado");
      setOpenDialog(false);
      setForm({ name: "", description: "", scope: "table", target_tables: "agents,agent_traces,workspaces", rto_target_seconds: 300, rpo_target_seconds: 60 });
      refresh();
    } catch (e) {
      toast.error("Falha ao agendar", { description: e instanceof Error ? e.message : "Verifique permissões" });
    }
  }

  function applyTemplate(tplId: string) {
    const tpl = DR_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setForm({
      name: tpl.name,
      description: tpl.description,
      scope: tpl.scope,
      target_tables: tpl.target_tables.join(","),
      rto_target_seconds: tpl.rto_target_seconds,
      rpo_target_seconds: tpl.rpo_target_seconds,
    });
  }

  async function handleRun(drillId: string) {
    setRunning((p) => ({ ...p, [drillId]: true }));
    try {
      const result = await executeDrill(drillId);
      if (result.status === "completed") {
        toast.success("Drill concluído", { description: `RTO ${result.rto_actual}s · RPO ${result.rpo_actual}s` });
      } else {
        toast.warning("Drill com falhas", { description: result.error ?? "Veja a timeline" });
      }
      refresh();
    } catch (e) {
      toast.error("Falha ao executar", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning((p) => ({ ...p, [drillId]: false }));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este drill e todos os snapshots/logs?")) return;
    try {
      await deleteDrill(id);
      toast.success("Drill removido");
      refresh();
    } catch (e) {
      toast.error("Falha ao remover", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  async function toggleExpand(drill: DRDrill) {
    const open = !expanded[drill.id];
    setExpanded((p) => ({ ...p, [drill.id]: open }));
    if (open && !snapshots[drill.id]) {
      try {
        const [snaps, lg] = await Promise.all([listSnapshots(drill.id), listRestoreLogs(drill.id)]);
        setSnapshots((p) => ({ ...p, [drill.id]: snaps }));
        setLogs((p) => ({ ...p, [drill.id]: lg }));
      } catch (e) {
        logger.error("expand failed", e);
      }
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Archive className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              DR Drills
            </h1>
          </div>
          <p className="text-muted-foreground">
            Validação programada de backup → restore com métricas RTO/RPO reais.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button><Sparkles className="h-4 w-4 mr-2" />Agendar Drill</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo DR Drill</DialogTitle>
              <DialogDescription>Configure escopo, tabelas alvo e metas RTO/RPO.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {DR_TEMPLATES.map((tpl) => (
                  <Button key={tpl.id} variant="outline" size="sm" onClick={() => applyTemplate(tpl.id)} className="h-auto py-2 flex flex-col items-start text-left">
                    <span className="text-xs font-semibold">{tpl.name}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-2 font-normal">{tpl.description}</span>
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Drill mensal críticas" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Escopo</Label>
                  <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as "full" | "workspace" | "table" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Tabelas específicas</SelectItem>
                      <SelectItem value="workspace">Workspace completo</SelectItem>
                      <SelectItem value="full">Full DR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tabelas alvo (separadas por vírgula)</Label>
                  <Input value={form.target_tables} onChange={(e) => setForm({ ...form, target_tables: e.target.value })} placeholder="agents,agent_traces" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>RTO target (segundos)</Label>
                  <Input type="number" min={1} value={form.rto_target_seconds} onChange={(e) => setForm({ ...form, rto_target_seconds: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>RPO target (segundos)</Label>
                  <Input type="number" min={1} value={form.rpo_target_seconds} onChange={(e) => setForm({ ...form, rpo_target_seconds: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Drills programados</CardTitle>
          <CardDescription>Cadência recomendada: críticas semanal · workspace mensal · full trimestral</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && drills.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <Archive className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum drill agendado ainda.</p>
              <Button size="sm" onClick={() => setOpenDialog(true)}>Criar o primeiro</Button>
            </div>
          )}
          {drills.map((d) => {
            const rto = rtoStatus(d.actual_rto_seconds, d.rto_target_seconds);
            const rpo = rtoStatus(d.actual_rpo_seconds, d.rpo_target_seconds);
            const isExpanded = expanded[d.id];
            const variant = STATUS_VARIANTS[d.status];
            return (
              <Collapsible key={d.id} open={isExpanded}>
                <div className="border border-border rounded-lg p-4 space-y-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{d.name}</p>
                        <Badge className={variant.cls}>{variant.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{d.scope}</Badge>
                      </div>
                      {d.description && <p className="text-xs text-muted-foreground line-clamp-1">{d.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Agendado {new Date(d.scheduled_at).toLocaleString("pt-BR")}</span>
                        <span>{d.target_tables.length} tabela(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(d.status === "scheduled" || d.status === "failed") && (
                        <Button size="sm" onClick={() => handleRun(d.id)} disabled={running[d.id]}>
                          <Play className="h-3 w-3 mr-1" />{running[d.id] ? "Executando…" : "Executar"}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)} aria-label="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      <CollapsibleTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => toggleExpand(d)} aria-label="Detalhes">
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/30 rounded p-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">RTO (atual / meta)</span>
                        <span className={`font-mono font-semibold ${rto.color}`}>{rto.label}</span>
                      </div>
                      <div className="font-mono text-sm">{fmtDuration(d.actual_rto_seconds)} <span className="text-muted-foreground text-xs">/ {fmtDuration(d.rto_target_seconds)}</span></div>
                      {d.actual_rto_seconds !== null && (
                        <Progress value={Math.min((d.actual_rto_seconds / d.rto_target_seconds) * 100, 150)} className="h-1.5" />
                      )}
                    </div>
                    <div className="bg-secondary/30 rounded p-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">RPO (atual / meta)</span>
                        <span className={`font-mono font-semibold ${rpo.color}`}>{rpo.label}</span>
                      </div>
                      <div className="font-mono text-sm">{fmtDuration(d.actual_rpo_seconds)} <span className="text-muted-foreground text-xs">/ {fmtDuration(d.rpo_target_seconds)}</span></div>
                      {d.actual_rpo_seconds !== null && (
                        <Progress value={Math.min((d.actual_rpo_seconds / d.rpo_target_seconds) * 100, 150)} className="h-1.5" />
                      )}
                    </div>
                  </div>

                  {d.error_message && (
                    <div className="flex items-start gap-2 text-xs bg-destructive/10 text-destructive rounded p-2">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{d.error_message}</span>
                    </div>
                  )}

                  <CollapsibleContent className="space-y-3 pt-2 border-t border-border/50">
                    <div>
                      <p className="text-xs font-semibold mb-2">Snapshots ({(snapshots[d.id] ?? []).length})</p>
                      <div className="space-y-1 max-h-40 overflow-auto">
                        {(snapshots[d.id] ?? []).map((s) => (
                          <div key={s.id} className="flex items-center justify-between text-xs font-mono bg-secondary/20 rounded px-2 py-1">
                            <span>{s.table_name}</span>
                            <span className="text-muted-foreground">{s.row_count.toLocaleString("pt-BR")} rows · {s.checksum.slice(0, 8)}</span>
                          </div>
                        ))}
                        {(snapshots[d.id] ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sem snapshots.</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-2">Timeline ({(logs[d.id] ?? []).length})</p>
                      <div className="space-y-1 max-h-60 overflow-auto">
                        {(logs[d.id] ?? []).map((l) => (
                          <div key={l.id} className="flex items-start gap-2 text-xs border-l-2 border-border pl-2 py-1">
                            {l.status === "succeeded" && <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />}
                            {l.status === "failed" && <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />}
                            {l.status === "started" && <Clock className="h-3 w-3 text-primary shrink-0 mt-0.5 animate-pulse" />}
                            {l.status === "skipped" && <Clock className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{l.step}</span>
                                <span className="text-muted-foreground font-mono">{new Date(l.started_at).toLocaleTimeString("pt-BR")}</span>
                              </div>
                              {l.error_message && <p className="text-destructive">{l.error_message}</p>}
                            </div>
                          </div>
                        ))}
                        {(logs[d.id] ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sem eventos.</p>}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
