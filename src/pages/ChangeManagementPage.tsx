import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, GitPullRequest, ShieldAlert, Calendar, CheckCircle2, AlertOctagon, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceId } from "@/lib/agentService";
import {
  type ChangeRequest, type ChangeApproval, type FreezeWindow, type ChangeSummary,
  type ChangeType, type ChangeRiskLevel, type ChangeStatus,
  listChangeRequests, listFreezeWindows, listApprovals,
  submitChangeRequest, decideChange, executeChange, rollbackChange,
  getChangeSummary, createFreezeWindow, isInActiveFreeze,
  statusVariant, riskVariant, typeLabel,
} from "@/services/changeManagementService";

const TYPES: ChangeType[] = ["standard", "normal", "emergency"];
const RISKS: ChangeRiskLevel[] = ["low", "medium", "high", "critical"];
const STATUSES: ChangeStatus[] = ["draft", "pending_approval", "approved", "rejected", "scheduled", "in_progress", "completed", "rolled_back", "failed"];

export default function ChangeManagementPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [freezes, setFreezes] = useState<FreezeWindow[]>([]);
  const [summary, setSummary] = useState<ChangeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [selected, setSelected] = useState<ChangeRequest | null>(null);
  const [approvals, setApprovals] = useState<ChangeApproval[]>([]);
  const [approveComment, setApproveComment] = useState("");
  const [rollbackUrl, setRollbackUrl] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    change_type: "normal" as ChangeType,
    risk_level: "medium" as ChangeRiskLevel,
    affected_systems: "",
    scheduled_for: "",
    rollback_plan: "",
    validation_steps: "",
  });
  const [freezeForm, setFreezeForm] = useState({
    name: "",
    reason: "",
    starts_at: "",
    ends_at: "",
    allow_emergency: true,
  });

  useEffect(() => {
    if (!user) return;
    getWorkspaceId().then((id) => { if (id) setWorkspaceId(id); });
  }, [user]);

  const refresh = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [list, fz, sum] = await Promise.all([
        listChangeRequests(workspaceId),
        listFreezeWindows(workspaceId),
        getChangeSummary(workspaceId),
      ]);
      setChanges(list);
      setFreezes(fz);
      setSummary(sum);
    } catch (e) {
      toast.error("Erro ao carregar mudanças", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (workspaceId) refresh(); }, [workspaceId]);

  const refreshApprovals = async (c: ChangeRequest) => {
    try { setApprovals(await listApprovals(c.id)); } catch { /* noop */ }
  };

  const handleCreate = async () => {
    if (!workspaceId || !form.title.trim()) {
      toast.error("Informe o título da mudança");
      return;
    }
    try {
      await submitChangeRequest({
        workspace_id: workspaceId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        change_type: form.change_type,
        risk_level: form.risk_level,
        affected_systems: form.affected_systems.split(",").map((s) => s.trim()).filter(Boolean),
        scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
        rollback_plan: form.rollback_plan.trim() || null,
        validation_steps: form.validation_steps.trim() || null,
      });
      toast.success("Mudança submetida para aprovação");
      setCreateOpen(false);
      setForm({ title: "", description: "", change_type: "normal", risk_level: "medium", affected_systems: "", scheduled_for: "", rollback_plan: "", validation_steps: "" });
      await refresh();
    } catch (e) {
      toast.error("Falha ao submeter", { description: (e as Error).message });
    }
  };

  const handleCreateFreeze = async () => {
    if (!workspaceId || !freezeForm.name.trim() || !freezeForm.starts_at || !freezeForm.ends_at) {
      toast.error("Preencha nome, início e fim");
      return;
    }
    try {
      await createFreezeWindow({
        workspace_id: workspaceId,
        name: freezeForm.name.trim(),
        reason: freezeForm.reason.trim() || null,
        starts_at: new Date(freezeForm.starts_at).toISOString(),
        ends_at: new Date(freezeForm.ends_at).toISOString(),
        allow_emergency: freezeForm.allow_emergency,
      });
      toast.success("Janela de freeze criada");
      setFreezeOpen(false);
      setFreezeForm({ name: "", reason: "", starts_at: "", ends_at: "", allow_emergency: true });
      await refresh();
    } catch (e) {
      toast.error("Falha ao criar freeze", { description: (e as Error).message });
    }
  };

  const handleDecide = async (decision: "approve" | "reject") => {
    if (!selected) return;
    try {
      await decideChange(selected.id, decision, approveComment.trim() || null);
      toast.success(decision === "approve" ? "Mudança aprovada" : "Mudança rejeitada");
      setApproveComment("");
      await refresh();
      const updated = (await listChangeRequests(workspaceId!)).find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
      await refreshApprovals(selected);
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    }
  };

  const handleExecute = async (success: boolean) => {
    if (!selected) return;
    try {
      await executeChange(selected.id, success);
      toast.success(success ? "Execução registrada" : "Falha registrada");
      await refresh();
      const updated = (await listChangeRequests(workspaceId!)).find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    }
  };

  const handleRollback = async () => {
    if (!selected) return;
    if (!rollbackUrl.trim()) {
      toast.error("URL do post-mortem é obrigatória");
      return;
    }
    try {
      await rollbackChange(selected.id, rollbackUrl.trim());
      toast.success("Rollback registrado");
      setRollbackUrl("");
      await refresh();
      const updated = (await listChangeRequests(workspaceId!)).find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    }
  };

  const filtered = useMemo(() => {
    return changes.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterType !== "all" && c.change_type !== filterType) return false;
      return true;
    });
  }, [changes, filterStatus, filterType]);

  const activeFreezes = freezes.filter((f) => {
    const now = Date.now();
    return now >= new Date(f.starts_at).getTime() && now <= new Date(f.ends_at).getTime();
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Mudanças (CAB)
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Change Advisory Board — ITIL 4 / SOC2 CC8.1 / ISO 27001 A.12.1.2
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={freezeOpen} onOpenChange={setFreezeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Snowflake className="h-4 w-4" /> Nova janela</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova janela de freeze</DialogTitle>
                <DialogDescription>Bloqueia mudanças não-emergenciais durante o período</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={freezeForm.name} onChange={(e) => setFreezeForm({ ...freezeForm, name: e.target.value })} placeholder="Ex: Black Friday" /></div>
                <div><Label>Motivo</Label><Textarea value={freezeForm.reason} onChange={(e) => setFreezeForm({ ...freezeForm, reason: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início</Label><Input type="datetime-local" value={freezeForm.starts_at} onChange={(e) => setFreezeForm({ ...freezeForm, starts_at: e.target.value })} /></div>
                  <div><Label>Fim</Label><Input type="datetime-local" value={freezeForm.ends_at} onChange={(e) => setFreezeForm({ ...freezeForm, ends_at: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={freezeForm.allow_emergency} onCheckedChange={(v) => setFreezeForm({ ...freezeForm, allow_emergency: v })} />
                  <Label className="cursor-pointer">Permitir emergências</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setFreezeOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateFreeze}>Criar freeze</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova mudança</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova mudança</DialogTitle>
                <DialogDescription>Submeter para aprovação do CAB</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Migrar DB para PG16" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.change_type} onValueChange={(v) => setForm({ ...form, change_type: v as ChangeType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => (<SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Risco</Label>
                    <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v as ChangeRiskLevel })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RISKS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Sistemas afetados (separados por vírgula)</Label><Input value={form.affected_systems} onChange={(e) => setForm({ ...form, affected_systems: e.target.value })} placeholder="auth-service, billing-api" /></div>
                <div><Label>Agendado para</Label><Input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></div>
                <div><Label>Plano de rollback</Label><Textarea value={form.rollback_plan} onChange={(e) => setForm({ ...form, rollback_plan: e.target.value })} rows={3} placeholder="Passos para reverter caso a mudança falhe..." /></div>
                <div><Label>Validação pós-deploy</Label><Textarea value={form.validation_steps} onChange={(e) => setForm({ ...form, validation_steps: e.target.value })} rows={3} placeholder="Como confirmar que a mudança foi bem-sucedida..." /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate}>Submeter</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<AlertOctagon className="h-4 w-4 text-nexus-amber" />} label="Pendentes aprovação" value={summary?.pending ?? 0} loading={loading} />
        <StatCard icon={<Calendar className="h-4 w-4 text-primary" />} label="Agendadas (7 dias)" value={summary?.scheduled_7d ?? 0} loading={loading} />
        <StatCard icon={<Snowflake className="h-4 w-4 text-primary" />} label="Freezes ativos" value={summary?.in_freeze ?? 0} loading={loading} pulse={(summary?.in_freeze ?? 0) > 0} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-nexus-emerald" />} label="Taxa de sucesso (30d)" value={`${summary?.success_rate_30d ?? 0}%`} loading={loading} />
      </div>

      <Tabs defaultValue="changes">
        <TabsList>
          <TabsTrigger value="changes" className="gap-2"><GitPullRequest className="h-4 w-4" /> Mudanças</TabsTrigger>
          <TabsTrigger value="freezes" className="gap-2"><Snowflake className="h-4 w-4" /> Janelas de freeze</TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUSES.map((s) => (<SelectItem key={s} value={s}>{statusVariant(s).label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {TYPES.map((t) => (<SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-2">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GitPullRequest className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma mudança registrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agendado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const inFreeze = isInActiveFreeze(c.scheduled_for, freezes, c.change_type);
                      const sv = statusVariant(c.status);
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setSelected(c); refreshApprovals(c); }}>
                          <TableCell className="font-medium">{c.title}</TableCell>
                          <TableCell><Badge variant="outline">{typeLabel(c.change_type)}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={riskVariant(c.risk_level)}>{c.risk_level}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={sv.className}>{sv.label}</Badge></TableCell>
                          <TableCell className="text-sm">
                            {c.scheduled_for ? (
                              <span className={inFreeze ? "text-destructive font-semibold animate-pulse" : "text-muted-foreground"}>
                                {new Date(c.scheduled_for).toLocaleString("pt-BR")}
                                {inFreeze && " ⚠ freeze"}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freezes">
          <Card>
            <CardContent className="p-0">
              {freezes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Snowflake className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma janela de freeze configurada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Emergências</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freezes.map((f) => {
                      const isActive = activeFreezes.some((a) => a.id === f.id);
                      const isUpcoming = new Date(f.starts_at).getTime() > Date.now();
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.name}{f.reason && <p className="text-xs text-muted-foreground mt-0.5">{f.reason}</p>}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(f.starts_at).toLocaleString("pt-BR")} → {new Date(f.ends_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>{f.allow_emergency ? <Badge variant="outline" className="bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30">Permitidas</Badge> : <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Bloqueadas</Badge>}</TableCell>
                          <TableCell>
                            {isActive ? <Badge className="bg-destructive text-destructive-foreground animate-pulse">Ativo</Badge>
                              : isUpcoming ? <Badge variant="outline">Agendado</Badge>
                              : <Badge variant="outline" className="text-muted-foreground">Encerrado</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drill-in sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription className="flex gap-2 flex-wrap pt-2">
                  <Badge variant="outline">{typeLabel(selected.change_type)}</Badge>
                  <Badge variant="outline" className={riskVariant(selected.risk_level)}>{selected.risk_level}</Badge>
                  <Badge variant="outline" className={statusVariant(selected.status).className}>{statusVariant(selected.status).label}</Badge>
                </SheetDescription>
              </SheetHeader>

              <Tabs defaultValue="details" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Detalhes</TabsTrigger>
                  <TabsTrigger value="approvals" className="flex-1">Aprovações ({approvals.length})</TabsTrigger>
                  <TabsTrigger value="execution" className="flex-1">Execução</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 pt-4">
                  {selected.description && (<Field label="Descrição" value={selected.description} />)}
                  {selected.affected_systems.length > 0 && (
                    <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Sistemas afetados</p>
                      <div className="flex gap-1.5 flex-wrap">{selected.affected_systems.map((s) => (<Badge key={s} variant="outline">{s}</Badge>))}</div>
                    </div>
                  )}
                  {selected.scheduled_for && (<Field label="Agendado para" value={new Date(selected.scheduled_for).toLocaleString("pt-BR")} />)}
                  {selected.rollback_plan && (<Field label="Plano de rollback" value={selected.rollback_plan} mono />)}
                  {selected.validation_steps && (<Field label="Validação" value={selected.validation_steps} mono />)}
                  {selected.post_mortem_url && (<div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Post-mortem</p><a href={selected.post_mortem_url} target="_blank" rel="noreferrer" className="text-primary text-sm underline">{selected.post_mortem_url}</a></div>)}
                </TabsContent>

                <TabsContent value="approvals" className="space-y-4 pt-4">
                  {selected.status === "pending_approval" && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <Label>Decidir</Label>
                        <Textarea value={approveComment} onChange={(e) => setApproveComment(e.target.value)} rows={2} placeholder="Comentário (opcional)" />
                        <div className="flex gap-2">
                          <Button onClick={() => handleDecide("approve")} className="flex-1">Aprovar</Button>
                          <Button onClick={() => handleDecide("reject")} variant="destructive" className="flex-1">Rejeitar</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {approvals.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Nenhuma decisão ainda</p>
                  ) : (
                    <div className="space-y-2">
                      {approvals.map((a) => (
                        <Card key={a.id}>
                          <CardContent className="p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2"><Badge variant="outline" className={a.decision === "approve" ? "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30" : a.decision === "reject" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30"}>{a.decision}</Badge><span className="text-xs text-muted-foreground">{new Date(a.decided_at).toLocaleString("pt-BR")}</span></div>
                              {a.comment && <p className="text-sm mt-1">{a.comment}</p>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="execution" className="space-y-4 pt-4">
                  {selected.status === "approved" && (
                    <Card><CardContent className="p-4"><Button onClick={() => handleExecute(true)} className="w-full">Iniciar execução</Button></CardContent></Card>
                  )}
                  {selected.status === "in_progress" && (
                    <Card><CardContent className="p-4 space-y-2">
                      <Button onClick={() => handleExecute(true)} className="w-full">Marcar como concluída</Button>
                      <Button onClick={() => handleExecute(false)} variant="destructive" className="w-full">Marcar como falhou</Button>
                    </CardContent></Card>
                  )}
                  {(selected.status === "completed" || selected.status === "failed" || selected.status === "in_progress") && (
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Rollback</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <Input value={rollbackUrl} onChange={(e) => setRollbackUrl(e.target.value)} placeholder="URL do post-mortem (obrigatório)" />
                        <Button onClick={handleRollback} variant="outline" className="w-full">Registrar rollback</Button>
                      </CardContent>
                    </Card>
                  )}
                  {selected.executed_at && (<Field label="Executado em" value={new Date(selected.executed_at).toLocaleString("pt-BR")} />)}
                  {selected.completed_at && (<Field label="Concluído em" value={new Date(selected.completed_at).toLocaleString("pt-BR")} />)}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ icon, label, value, loading, pulse }: { icon: React.ReactNode; label: string; value: number | string; loading: boolean; pulse?: boolean }) {
  return (
    <Card className={pulse ? "border-destructive/40" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{icon} {label}</div>
        <div className={`text-3xl font-bold mt-2 ${pulse ? "text-destructive animate-pulse" : ""}`}>
          {loading ? <Skeleton className="h-8 w-16" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{label}</p>
      <p className={`text-sm whitespace-pre-wrap ${mono ? "font-mono bg-muted/40 p-2 rounded" : ""}`}>{value}</p>
    </div>
  );
}
