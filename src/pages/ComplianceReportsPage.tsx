import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  FileCheck2,
  Calendar,
  Eye,
  BadgeCheck,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { useWorkspaceId } from '@/hooks/use-data';
import {
  complianceService,
  type ComplianceFramework,
  type ComplianceReport,
  type ComplianceControl,
  type ComplianceEvidence,
} from '@/services/complianceService';

function statusColor(status: string) {
  if (status === 'passed') return 'text-nexus-green';
  if (status === 'failed') return 'text-nexus-red';
  return 'text-nexus-amber';
}

function statusIcon(status: string) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-nexus-green" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-nexus-red" />;
  return <Clock className="h-4 w-4 text-nexus-amber" />;
}

export default function ComplianceReportsPage() {
  const { data: workspaceId } = useWorkspaceId();
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ComplianceReport | null>(null);
  const [evidence, setEvidence] = useState<ComplianceEvidence[]>([]);
  const [controls, setControls] = useState<ComplianceControl[]>([]);

  const [form, setForm] = useState({
    frameworkCode: 'SOC2',
    name: '',
    periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    (async () => {
      try {
        const fw = await complianceService.listFrameworks();
        setFrameworks(fw);
      } catch {
        toast.error('Erro ao carregar frameworks');
      }
    })();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    refresh();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function refresh() {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const r = await complianceService.listReports(workspaceId);
      setReports(r);
    } catch {
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!workspaceId) return;
    if (!form.name.trim()) {
      toast.error('Informe um nome para o relatório');
      return;
    }
    setGenerating(true);
    try {
      const id = await complianceService.generateReport({
        workspaceId,
        frameworkCode: form.frameworkCode,
        name: form.name.trim(),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      });
      toast.success('Relatório gerado', { description: 'Evidências coletadas automaticamente.' });
      setDialogOpen(false);
      setForm({ ...form, name: '' });
      await refresh();
      const created = await complianceService.getReport(id);
      if (created) openDetail(created);
    } catch {
      toast.error('Falha ao gerar relatório', { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish(report: ComplianceReport) {
    try {
      await complianceService.publishReport(report.id);
      toast.success('Relatório publicado');
      await refresh();
      if (activeReport?.id === report.id) {
        const updated = await complianceService.getReport(report.id);
        setActiveReport(updated);
      }
    } catch {
      toast.error('Falha ao publicar', { description: (e as Error).message });
    }
  }

  async function openDetail(report: ComplianceReport) {
    setActiveReport(report);
    setDetailOpen(true);
    try {
      const [ev, ctrls] = await Promise.all([
        complianceService.listEvidence(report.id),
        complianceService.listControls(report.framework_id),
      ]);
      setEvidence(ev);
      setControls(ctrls);
    } catch {
      toast.error('Erro ao carregar detalhes');
    }
  }

  const stats = useMemo(() => {
    const total = reports.length;
    const published = reports.filter((r) => r.status === 'published').length;
    const avgScore =
      total > 0 ? Math.round(reports.reduce((s, r) => s + Number(r.score ?? 0), 0) / total) : 0;
    const totalControls = reports.reduce((s, r) => s + r.total_controls, 0);
    return { total, published, avgScore, totalControls };
  }, [reports]);

  const fwByCode = useMemo(() => {
    const map = new Map<string, ComplianceFramework>();
    frameworks.forEach((f) => map.set(f.id, f));
    return map;
  }, [frameworks]);

  const controlById = useMemo(() => {
    const map = new Map<string, ComplianceControl>();
    controls.forEach((c) => map.set(c.id, c));
    return map;
  }, [controls]);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Compliance Reports"
        description="Relatórios automáticos para SOC 2, ISO 27001 e LGPD com coleta de evidências do backend."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo relatório
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar relatório de compliance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Framework</Label>
                  <Select
                    value={form.frameworkCode}
                    onValueChange={(v) => setForm({ ...form, frameworkCode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frameworks.map((f) => (
                        <SelectItem key={f.id} value={f.code}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome do relatório</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: SOC 2 Q2 2026"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input
                      type="date"
                      value={form.periodStart}
                      onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input
                      type="date"
                      value={form.periodEnd}
                      onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Gerar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Frameworks disponíveis</div>
            <div className="text-2xl font-bold mt-1">{frameworks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Relatórios gerados</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Publicados</div>
            <div className="text-2xl font-bold mt-1 text-nexus-green">{stats.published}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Score médio</div>
            <div className="text-2xl font-bold mt-1">{stats.avgScore}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" />
            Relatórios do workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando…
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <div className="text-sm">Nenhum relatório ainda. Gere o primeiro acima.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((r) => {
                const fw = fwByCode.get(r.framework_id);
                const score = Number(r.score ?? 0);
                const failing = r.failed_controls;
                return (
                  <Card key={r.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShieldCheck
                          className={`h-4 w-4 ${score >= 95 ? 'text-nexus-green' : score >= 80 ? 'text-nexus-amber' : 'text-nexus-red'}`}
                        />
                        <span className="truncate">{r.name}</span>
                        {r.status === 'published' && (
                          <BadgeCheck className="h-4 w-4 text-nexus-green ml-auto" />
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{fw?.code ?? '—'}</Badge>
                        <Badge variant={r.status === 'published' ? 'default' : 'secondary'}>
                          {r.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span>Score</span>
                          <span className="font-bold">{score}%</span>
                        </div>
                        <Progress value={score} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-nexus-green/10 rounded">
                          <div className="text-muted-foreground">Passando</div>
                          <div className="font-bold text-nexus-green">
                            {r.passed_controls}/{r.total_controls}
                          </div>
                        </div>
                        <div
                          className={`p-2 rounded ${failing > 0 ? 'bg-nexus-red/10' : 'bg-muted/30'}`}
                        >
                          <div className="text-muted-foreground">Falhando</div>
                          <div className={`font-bold ${failing > 0 ? 'text-nexus-red' : ''}`}>
                            {failing}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {r.period_start} → {r.period_end}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openDetail(r)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Detalhes
                        </Button>
                        {r.status !== 'published' && (
                          <Button size="sm" className="flex-1" onClick={() => handlePublish(r)}>
                            <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                            Publicar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{activeReport?.name}</SheetTitle>
          </SheetHeader>
          {activeReport && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Card>
                  <CardContent className="p-3">
                    <div className="text-muted-foreground">Score</div>
                    <div className="text-xl font-bold">{Number(activeReport.score ?? 0)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="text-muted-foreground">Passando</div>
                    <div className="text-xl font-bold text-nexus-green">
                      {activeReport.passed_controls}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="text-muted-foreground">Falhando</div>
                    <div className="text-xl font-bold text-nexus-red">
                      {activeReport.failed_controls}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Evidências por controle</h3>
                <div className="space-y-2">
                  {evidence.map((ev) => {
                    const ctrl = controlById.get(ev.control_id);
                    const checkCount =
                      (ev.evidence_data as { check_count?: number })?.check_count ?? 0;
                    return (
                      <div key={ev.id} className="flex items-start gap-3 p-3 border rounded-md">
                        <div className="mt-0.5">{statusIcon(ev.status)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {ctrl?.code}
                            </Badge>
                            <span className="text-sm font-medium truncate">{ctrl?.title}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {ctrl?.description}
                          </div>
                          <div className={`text-[11px] mt-1 ${statusColor(ev.status)}`}>
                            {ev.status === 'passed' && `✓ ${checkCount} registros encontrados`}
                            {ev.status === 'failed' && `✗ Sem evidências (${checkCount})`}
                            {ev.status === 'pending' && '⏳ Verificação manual necessária'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
