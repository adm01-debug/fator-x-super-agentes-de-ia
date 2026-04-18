import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertOctagon, Plus, ShieldCheck, Clock, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceId } from "@/lib/agentService";
import {
  type Risk, type RiskCategory, type RiskTreatment, type RiskSummary, type RiskReviewEvent,
  listRisks, listRiskReviews, registerRisk, reviewRisk, closeRisk, getRiskSummary,
  getRiskLevel, getRiskLevelColor, isReviewOverdue,
} from "@/services/riskService";
import { logger } from "@/lib/logger";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES: { value: RiskCategory; label: string }[] = [
  { value: 'strategic', label: 'Estratégico' },
  { value: 'operational', label: 'Operacional' },
  { value: 'technical', label: 'Técnico' },
  { value: 'security', label: 'Segurança' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'reputational', label: 'Reputacional' },
];

const TREATMENTS: { value: RiskTreatment; label: string; description: string }[] = [
  { value: 'mitigate', label: 'Mitigar', description: 'Implementar controles para reduzir' },
  { value: 'accept', label: 'Aceitar', description: 'Aceitar o risco como está' },
  { value: 'transfer', label: 'Transferir', description: 'Seguro, terceiro, etc.' },
  { value: 'avoid', label: 'Evitar', description: 'Eliminar a atividade que gera o risco' },
];

export default function RiskRegisterPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [reviews, setReviews] = useState<RiskReviewEvent[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RiskCategory>("security");
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [treatment, setTreatment] = useState<RiskTreatment>("mitigate");
  const [mitigationPlan, setMitigationPlan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Review state
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    getWorkspaceId().then(setWorkspaceId).catch((err: unknown) => logger.error("ws fetch failed:", err));
  }, [user]);

  const refresh = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [risksList, sum] = await Promise.all([listRisks(workspaceId), getRiskSummary(workspaceId)]);
      setRisks(risksList);
      setSummary(sum);
    } catch (err) {
      logger.error("Risk fetch failed:", err);
      toast.error("Falha ao carregar riscos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [workspaceId]);

  useEffect(() => {
    if (!selectedRisk) { setReviews([]); return; }
    listRiskReviews(selectedRisk.id).then(setReviews).catch(err => logger.error("reviews fetch:", err));
    setReviewScore(selectedRisk.residual_score ?? selectedRisk.inherent_score);
  }, [selectedRisk]);

  const filtered = useMemo(() => {
    return risks.filter(r => {
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      if (filterStatus === "active" && r.status === "closed") return false;
      if (filterStatus === "closed" && r.status !== "closed") return false;
      if (filterStatus === "overdue" && !isReviewOverdue(r.next_review_due)) return false;
      return true;
    });
  }, [risks, filterCategory, filterStatus]);

  const handleCreate = async () => {
    if (!workspaceId || !title.trim()) return;
    setSubmitting(true);
    try {
      await registerRisk({
        workspaceId, title: title.trim(),
        description: description.trim() || undefined,
        category, likelihood, impact, treatment,
        mitigationPlan: mitigationPlan.trim() || undefined,
      });
      toast.success("Risco registrado");
      setCreateOpen(false);
      setTitle(""); setDescription(""); setMitigationPlan("");
      setLikelihood(3); setImpact(3); setCategory("security"); setTreatment("mitigate");
      await refresh();
    } catch (err) {
      logger.error("register failed:", err);
      toast.error(err instanceof Error ? err.message : "Falha ao registrar risco");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!selectedRisk) return;
    setSubmitting(true);
    try {
      await reviewRisk(selectedRisk.id, reviewScore, reviewNotes.trim() || undefined);
      toast.success("Review registrado");
      setReviewNotes("");
      const updated = (await listRisks(workspaceId!)).find(r => r.id === selectedRisk.id);
      if (updated) setSelectedRisk(updated);
      await refresh();
    } catch (err) {
      logger.error("review failed:", err);
      toast.error(err instanceof Error ? err.message : "Falha ao registrar review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!selectedRisk) return;
    if (!confirm("Fechar este risco? Esta ação será registrada no audit log.")) return;
    setSubmitting(true);
    try {
      await closeRisk(selectedRisk.id);
      toast.success("Risco fechado");
      setSelectedRisk(null);
      await refresh();
    } catch (err) {
      logger.error("close failed:", err);
      toast.error(err instanceof Error ? err.message : "Falha ao fechar risco");
    } finally {
      setSubmitting(false);
    }
  };

  // Heatmap aggregation: 5x5 grid
  const heatmapMatrix = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    summary?.heatmap.forEach(({ likelihood: l, impact: i, count }) => {
      matrix[5 - i][l - 1] = count; // top-left = high impact, low likelihood
    });
    return matrix;
  }, [summary]);

  const inherentScore = likelihood * impact;
  const inherentLevel = getRiskLevel(inherentScore);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertOctagon className="h-7 w-7 text-primary" />
            Registro de Riscos
          </h1>
          <p className="text-muted-foreground mt-1">
            ISO 31000 / SOC2 CC3.2 — gestão centralizada de riscos com revisão periódica
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Risco</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar novo risco</DialogTitle>
              <DialogDescription>Avalie likelihood (probabilidade) e impact (impacto) de 1 a 5.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Vazamento de PII via API pública" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={v => setCategory(v as RiskCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tratamento</Label>
                  <Select value={treatment} onValueChange={v => setTreatment(v as RiskTreatment)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TREATMENTS.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <div><div className="font-medium">{t.label}</div><div className="text-xs text-muted-foreground">{t.description}</div></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Likelihood: <span className="font-bold text-primary">{likelihood}</span></Label>
                  <Slider value={[likelihood]} onValueChange={([v]) => setLikelihood(v)} min={1} max={5} step={1} />
                  <p className="text-xs text-muted-foreground">1 = Raro · 5 = Quase certo</p>
                </div>
                <div className="space-y-2">
                  <Label>Impact: <span className="font-bold text-primary">{impact}</span></Label>
                  <Slider value={[impact]} onValueChange={([v]) => setImpact(v)} min={1} max={5} step={1} />
                  <p className="text-xs text-muted-foreground">1 = Negligível · 5 = Catastrófico</p>
                </div>
              </div>
              <div className="rounded-lg border bg-secondary/30 p-3 flex items-center justify-between">
                <span className="text-sm font-medium">Inherent Score (L × I):</span>
                <Badge className={getRiskLevelColor(inherentLevel)}>
                  {inherentScore} — {inherentLevel.toUpperCase()}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plano de mitigação</Label>
                <Textarea id="plan" value={mitigationPlan} onChange={e => setMitigationPlan(e.target.value)} rows={3}
                  placeholder="Quais controles serão implementados?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={submitting || !title.trim()}>
                {submitting ? "Registrando..." : "Registrar risco"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total ativo" value={summary?.total ?? 0} icon={<AlertOctagon className="h-5 w-5" />} loading={loading} />
        <StatCard title="Críticos (≥15)" value={summary?.critical ?? 0} icon={<AlertTriangle className="h-5 w-5" />} loading={loading} variant="destructive" />
        <StatCard title="Reviews vencidos" value={summary?.overdue_reviews ?? 0} icon={<Clock className="h-5 w-5" />} loading={loading} variant="warning" />
        <StatCard title="Sem tratamento" value={summary?.untreated ?? 0} icon={<ShieldCheck className="h-5 w-5" />} loading={loading} />
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Heatmap de Riscos (Likelihood × Impact)</CardTitle>
          <CardDescription>Distribuição visual dos riscos ativos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex flex-col justify-between text-xs text-muted-foreground py-2 -rotate-180" style={{ writingMode: 'vertical-rl' }}>
              <span>Impact →</span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-1.5">
                {heatmapMatrix.map((row, ri) =>
                  row.map((count, ci) => {
                    const lik = ci + 1, imp = 5 - ri;
                    const score = lik * imp;
                    const level = getRiskLevel(score);
                    const opacity = count > 0 ? Math.min(0.4 + count * 0.2, 1) : 0.08;
                    return (
                      <div
                        key={`${ri}-${ci}`}
                        className="aspect-square rounded-md flex items-center justify-center text-sm font-bold border border-border/30 transition-all hover:scale-105"
                        style={{
                          backgroundColor: `hsl(var(--${level === 'critical' ? 'destructive' : level === 'high' ? 'nexus-amber' : level === 'medium' ? 'primary' : 'muted'}) / ${opacity})`,
                        }}
                        title={`Likelihood ${lik}, Impact ${imp} → ${count} risco(s)`}
                      >
                        {count > 0 && <span className="text-foreground">{count}</span>}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="grid grid-cols-5 gap-1.5 mt-2 text-center text-xs text-muted-foreground">
                {[1, 2, 3, 4, 5].map(n => <span key={n}>L{n}</span>)}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-1">Likelihood →</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg">Riscos registrados</CardTitle>
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="closed">Fechados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <AlertOctagon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum risco registrado nesta visualização.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Inerente</TableHead>
                  <TableHead className="text-center">Residual</TableHead>
                  <TableHead>Tratamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próx. review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const overdue = r.status !== 'closed' && isReviewOverdue(r.next_review_due);
                  const inhLvl = getRiskLevel(r.inherent_score);
                  const resLvl = r.residual_score ? getRiskLevel(r.residual_score) : null;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedRisk(r)}>
                      <TableCell className="font-medium max-w-[300px] truncate">{r.title}</TableCell>
                      <TableCell><Badge variant="outline">{CATEGORIES.find(c => c.value === r.category)?.label}</Badge></TableCell>
                      <TableCell className="text-center">
                        <Badge className={getRiskLevelColor(inhLvl)}>{r.inherent_score}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {resLvl ? <Badge className={getRiskLevelColor(resLvl)}>{r.residual_score}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{TREATMENTS.find(t => t.value === r.treatment)?.label}</Badge></TableCell>
                      <TableCell><Badge variant={r.status === 'closed' ? 'outline' : 'default'}>{r.status}</Badge></TableCell>
                      <TableCell>
                        {r.status === 'closed' ? <span className="text-muted-foreground text-xs">—</span> :
                          overdue ? (
                            <Badge variant="destructive" className="animate-pulse">
                              Vencido {formatDistanceToNow(new Date(r.next_review_due), { locale: ptBR })}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              em {formatDistanceToNow(new Date(r.next_review_due), { locale: ptBR })}
                            </span>
                          )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Drill-in Sheet */}
      <Sheet open={!!selectedRisk} onOpenChange={open => !open && setSelectedRisk(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedRisk && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 pr-8">
                  <AlertOctagon className="h-5 w-5 text-primary shrink-0" />
                  {selectedRisk.title}
                </SheetTitle>
                <SheetDescription>{selectedRisk.description || "Sem descrição"}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 mt-5">
                <div className="grid grid-cols-3 gap-3">
                  <InfoBox label="Categoria" value={CATEGORIES.find(c => c.value === selectedRisk.category)?.label ?? selectedRisk.category} />
                  <InfoBox label="Inherent" value={`${selectedRisk.inherent_score} (L${selectedRisk.likelihood}×I${selectedRisk.impact})`} />
                  <InfoBox label="Residual" value={selectedRisk.residual_score?.toString() ?? "—"} />
                  <InfoBox label="Tratamento" value={TREATMENTS.find(t => t.value === selectedRisk.treatment)?.label ?? selectedRisk.treatment} />
                  <InfoBox label="Status" value={selectedRisk.status} />
                  <InfoBox label="Próx. review" value={new Date(selectedRisk.next_review_due).toLocaleDateString('pt-BR')} />
                </div>

                {selectedRisk.mitigation_plan && (
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Plano de mitigação</Label>
                    <p className="text-sm whitespace-pre-wrap rounded-md border bg-secondary/30 p-3">{selectedRisk.mitigation_plan}</p>
                  </div>
                )}

                {selectedRisk.status !== 'closed' && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Registrar review</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Novo residual score: <span className="font-bold text-primary">{reviewScore}</span></Label>
                        <Slider value={[reviewScore]} onValueChange={([v]) => setReviewScore(v)} min={1} max={25} step={1} />
                        <p className="text-xs text-muted-foreground">Score após mitigação aplicada (1-25)</p>
                      </div>
                      <Textarea placeholder="Notas do review (opcional)" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} />
                      <div className="flex gap-2">
                        <Button onClick={handleReview} disabled={submitting} size="sm">
                          <CheckCircle2 className="h-4 w-4 mr-1" />Registrar review
                        </Button>
                        <Button onClick={handleClose} disabled={submitting} size="sm" variant="outline">
                          <X className="h-4 w-4 mr-1" />Fechar risco
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Histórico de reviews ({reviews.length})</Label>
                  {reviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum review registrado ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {reviews.map(rv => (
                        <div key={rv.id} className="rounded-md border p-3 text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium">
                              {rv.previous_residual_score ?? '—'} → {rv.new_residual_score ?? '—'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(rv.reviewed_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                          {rv.notes && <p className="text-muted-foreground text-xs">{rv.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ title, value, icon, loading, variant }: {
  title: string; value: number; icon: React.ReactNode; loading: boolean; variant?: 'destructive' | 'warning';
}) {
  const colorClass = variant === 'destructive' ? 'text-destructive' : variant === 'warning' ? 'text-nexus-amber' : 'text-primary';
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</span>
          <span className={colorClass}>{icon}</span>
        </div>
        {loading ? <Skeleton className="h-8 w-16" /> : <p className={`text-3xl font-bold tabular-nums ${value > 0 && variant ? colorClass : ''}`}>{value}</p>}
      </CardContent>
    </Card>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary/20 p-2.5">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide font-medium">{label}</p>
      <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
    </div>
  );
}
