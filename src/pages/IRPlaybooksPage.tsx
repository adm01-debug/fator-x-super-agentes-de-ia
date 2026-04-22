/**
 * Sprint 44 — Incident Response Playbooks page
 * /security/ir
 */
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Plus,
  Play,
  Trash2,
  BookOpen,
  Activity,
  ShieldAlert,
  Clock,
  AlertTriangle,
  ListChecks,
  Archive,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkspaceId } from '@/lib/agentService';
import {
  listPlaybooks,
  createPlaybook,
  activatePlaybook,
  archivePlaybook,
  deletePlaybook,
  listSteps,
  addStep,
  deleteStep,
  listTabletops,
  recordTabletop,
  getSummary,
  isReviewOverdue,
  severityVariant,
  outcomeVariant,
  INCIDENT_TYPE_LABELS,
  PHASE_LABELS,
  SEVERITY_LABELS,
  OUTCOME_LABELS,
  type IRPlaybook,
  type IRPlaybookStep,
  type IRTabletopExercise,
  type IRSummary,
  type IRIncidentType,
  type IRSeverity,
  type IRPhase,
  type IRTabletopOutcome,
} from '@/services/irPlaybookService';
import { logger } from '@/lib/logger';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const INCIDENT_TYPES: IRIncidentType[] = [
  'data_breach',
  'ddos',
  'ransomware',
  'account_takeover',
  'insider_threat',
  'service_outage',
  'supply_chain',
  'other',
];
const SEVERITIES: IRSeverity[] = ['low', 'medium', 'high', 'critical'];
const PHASES: IRPhase[] = ['detect', 'contain', 'eradicate', 'recover', 'postmortem'];
const OUTCOMES: IRTabletopOutcome[] = ['scheduled', 'pass', 'partial', 'fail'];

export default function IRPlaybooksPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<IRPlaybook[]>([]);
  const [tabletops, setTabletops] = useState<IRTabletopExercise[]>([]);
  const [summary, setSummary] = useState<IRSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drillPlaybook, setDrillPlaybook] = useState<IRPlaybook | null>(null);
  const [drillSteps, setDrillSteps] = useState<IRPlaybookStep[]>([]);
  const [tabletopDialog, setTabletopDialog] = useState<IRPlaybook | null>(null);
  const [stepDialog, setStepDialog] = useState(false);

  const [form, setForm] = useState({
    name: '',
    incident_type: 'other' as IRIncidentType,
    severity_default: 'medium' as IRSeverity,
    description: '',
  });
  const [stepForm, setStepForm] = useState({
    phase: 'detect' as IRPhase,
    title: '',
    instructions: '',
    expected_duration_minutes: 30,
    responsible_role: '',
    automation_hint: '',
  });
  const [tabletopForm, setTabletopForm] = useState({
    scheduled_for: new Date().toISOString().slice(0, 16),
    executed_at: '',
    scenario: '',
    participants: '',
    outcome: 'scheduled' as IRTabletopOutcome,
    gaps: '',
    action_items: '',
    mttr_actual_minutes: 0,
    notes: '',
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const wid = await getWorkspaceId();
        if (!wid) return;
        setWorkspaceId(wid);
        const [pb, tt, sm] = await Promise.all([
          listPlaybooks(wid),
          listTabletops(wid),
          getSummary(wid),
        ]);
        setPlaybooks(pb);
        setTabletops(tt);
        setSummary(sm);
      } catch (e) {
        logger.error('load IR playbooks failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const refresh = async () => {
    if (!workspaceId) return;
    const [pb, tt, sm] = await Promise.all([
      listPlaybooks(workspaceId),
      listTabletops(workspaceId),
      getSummary(workspaceId),
    ]);
    setPlaybooks(pb);
    setTabletops(tt);
    setSummary(sm);
    if (drillPlaybook) {
      const updated = pb.find((p) => p.id === drillPlaybook.id);
      if (updated) setDrillPlaybook(updated);
      setDrillSteps(await listSteps(drillPlaybook.id));
    }
  };

  const openDrill = async (pb: IRPlaybook) => {
    setDrillPlaybook(pb);
    try {
      setDrillSteps(await listSteps(pb.id));
    } catch (e) {
      toast.error('Falha ao carregar steps', { description: String(e) });
    }
  };

  const handleCreate = async () => {
    if (!workspaceId || !user) return;
    if (!form.name.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    try {
      await createPlaybook({
        workspace_id: workspaceId,
        name: form.name,
        incident_type: form.incident_type,
        severity_default: form.severity_default,
        description: form.description,
        created_by: user.id,
      });
      toast.success('Playbook criado (draft)');
      setDialogOpen(false);
      setForm({ name: '', incident_type: 'other', severity_default: 'medium', description: '' });
      await refresh();
    } catch (e) {
      toast.error('Falha ao criar', { description: String(e) });
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activatePlaybook(id);
      toast.success('Playbook ativado');
      await refresh();
    } catch (e) {
      toast.error('Falha', { description: String(e) });
    }
  };
  const handleArchive = async (id: string) => {
    try {
      await archivePlaybook(id);
      toast.success('Arquivado');
      await refresh();
    } catch (e) {
      toast.error('Falha', { description: String(e) });
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir playbook?')) return;
    try {
      await deletePlaybook(id);
      toast.success('Excluído');
      setDrillPlaybook(null);
      await refresh();
    } catch (e) {
      toast.error('Falha', { description: String(e) });
    }
  };

  const handleAddStep = async () => {
    if (!drillPlaybook) return;
    if (!stepForm.title.trim()) {
      toast.error('Título obrigatório');
      return;
    }
    try {
      await addStep({
        playbook_id: drillPlaybook.id,
        step_order: drillSteps.length,
        phase: stepForm.phase,
        title: stepForm.title,
        instructions: stepForm.instructions || null,
        expected_duration_minutes: stepForm.expected_duration_minutes || null,
        responsible_role: stepForm.responsible_role || null,
        automation_hint: stepForm.automation_hint || null,
      });
      toast.success('Step adicionado');
      setStepDialog(false);
      setStepForm({
        phase: 'detect',
        title: '',
        instructions: '',
        expected_duration_minutes: 30,
        responsible_role: '',
        automation_hint: '',
      });
      await refresh();
    } catch (e) {
      toast.error('Falha', { description: String(e) });
    }
  };
  const handleDeleteStep = async (id: string) => {
    try {
      await deleteStep(id);
      await refresh();
    } catch (e) {
      toast.error('Falha', { description: String(e) });
    }
  };

  const handleRecordTabletop = async () => {
    if (!tabletopDialog || !workspaceId || !user) return;
    if (!tabletopForm.scenario.trim()) {
      toast.error('Cenário obrigatório');
      return;
    }
    try {
      await recordTabletop({
        playbook_id: tabletopDialog.id,
        workspace_id: workspaceId,
        scheduled_for: new Date(tabletopForm.scheduled_for).toISOString(),
        executed_at: tabletopForm.executed_at
          ? new Date(tabletopForm.executed_at).toISOString()
          : null,
        scenario: tabletopForm.scenario,
        participants: tabletopForm.participants
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        outcome: tabletopForm.outcome,
        gaps: tabletopForm.gaps
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        action_items: tabletopForm.action_items || undefined,
        mttr_actual_minutes: tabletopForm.mttr_actual_minutes || undefined,
        notes: tabletopForm.notes || undefined,
        created_by: user.id,
      });
      toast.success('Exercício registrado');
      setTabletopDialog(null);
      setTabletopForm({
        scheduled_for: new Date().toISOString().slice(0, 16),
        executed_at: '',
        scenario: '',
        participants: '',
        outcome: 'scheduled',
        gaps: '',
        action_items: '',
        mttr_actual_minutes: 0,
        notes: '',
      });
      await refresh();
    } catch (e) {
      toast.error('Falha', { description: String(e) });
    }
  };

  const playbooksByPhase = useMemo(() => {
    const map: Record<IRPhase, IRPlaybookStep[]> = {
      detect: [],
      contain: [],
      eradicate: [],
      recover: [],
      postmortem: [],
    };
    drillSteps.forEach((s) => map[s.phase].push(s));
    return map;
  }, [drillSteps]);

  const drillTabletops = useMemo(
    () => (drillPlaybook ? tabletops.filter((t) => t.playbook_id === drillPlaybook.id) : []),
    [drillPlaybook, tabletops],
  );

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Playbooks de IR
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Procedimentos formais por tipo de incidente — NIST SP 800-61, SOC2 CC7.4, ISO 27035
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo playbook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar playbook de IR</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Data Breach LGPD"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de incidente</Label>
                  <Select
                    value={form.incident_type}
                    onValueChange={(v: IRIncidentType) => setForm({ ...form, incident_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {INCIDENT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severidade padrão</Label>
                  <Select
                    value={form.severity_default}
                    onValueChange={(v: IRSeverity) => setForm({ ...form, severity_default: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SEVERITY_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Após criar, abra o playbook e adicione steps por fase NIST
                (Detect/Contain/Eradicate/Recover/Postmortem).
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={ShieldAlert}
          label="Playbooks ativos"
          value={summary?.active_playbooks ?? 0}
        />
        <StatCard
          icon={AlertTriangle}
          label="Reviews em atraso"
          value={summary?.reviews_overdue ?? 0}
          pulse={(summary?.reviews_overdue ?? 0) > 0}
        />
        <StatCard
          icon={Clock}
          label="MTTR médio (min, 90d)"
          value={summary ? Math.round(summary.avg_mttr_minutes) : 0}
        />
        <StatCard icon={ListChecks} label="Gaps abertos (180d)" value={summary?.open_gaps ?? 0} />
      </div>

      <Tabs defaultValue="playbooks">
        <TabsList>
          <TabsTrigger value="playbooks">
            <BookOpen className="h-4 w-4 mr-2" />
            Playbooks ({playbooks.length})
          </TabsTrigger>
          <TabsTrigger value="tabletops">
            <Activity className="h-4 w-4 mr-2" />
            Exercícios ({tabletops.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks" className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : playbooks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum playbook ainda. Crie o primeiro para incidentes mais comuns (data breach,
                DDoS, ransomware).
              </CardContent>
            </Card>
          ) : (
            playbooks.map((pb) => {
              const overdue = isReviewOverdue(pb);
              return (
                <Card
                  key={pb.id}
                  className="hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => openDrill(pb)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold">{pb.name}</h3>
                          <Badge variant="outline">{INCIDENT_TYPE_LABELS[pb.incident_type]}</Badge>
                          <Badge variant={severityVariant(pb.severity_default)}>
                            {SEVERITY_LABELS[pb.severity_default]}
                          </Badge>
                          <Badge
                            variant={
                              pb.status === 'active'
                                ? 'default'
                                : pb.status === 'archived'
                                  ? 'secondary'
                                  : 'outline'
                            }
                            className="text-[10px]"
                          >
                            {pb.status} v{pb.version}
                          </Badge>
                          {overdue && (
                            <Badge variant="destructive" className="text-[10px] animate-pulse">
                              Review vencido
                            </Badge>
                          )}
                        </div>
                        {pb.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {pb.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {pb.next_review_due
                            ? `Próx. revisão: ${format(new Date(pb.next_review_due), 'dd/MM/yyyy', { locale: ptBR })}`
                            : 'Sem revisão registrada'}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).click();
                          }
                        }}
                      >
                        {pb.status === 'draft' && (
                          <Button size="sm" variant="outline" onClick={() => handleActivate(pb.id)}>
                            <Play className="h-3 w-3 mr-1" />
                            Ativar
                          </Button>
                        )}
                        {pb.status === 'active' && (
                          <Button size="sm" variant="outline" onClick={() => setTabletopDialog(pb)}>
                            <Activity className="h-3 w-3 mr-1" />
                            Tabletop
                          </Button>
                        )}
                        {pb.status !== 'archived' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleArchive(pb.id)}
                            title="Arquivar"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(pb.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="tabletops" className="space-y-2">
          {tabletops.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum exercício registrado.
              </CardContent>
            </Card>
          ) : (
            tabletops.map((t) => {
              const pb = playbooks.find((p) => p.id === t.playbook_id);
              return (
                <Card key={t.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {pb?.name ?? 'Playbook removido'}
                          </span>
                          <Badge variant={outcomeVariant(t.outcome)}>
                            {OUTCOME_LABELS[t.outcome]}
                          </Badge>
                          {t.mttr_actual_minutes != null && (
                            <Badge variant="outline" className="text-[10px]">
                              MTTR {t.mttr_actual_minutes}min
                            </Badge>
                          )}
                          {t.gaps.length > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {t.gaps.length} gaps
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.scenario} ·{' '}
                          {formatDistanceToNow(new Date(t.executed_at ?? t.scheduled_for), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Drill-in Sheet */}
      <Sheet open={!!drillPlaybook} onOpenChange={(o) => !o && setDrillPlaybook(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {drillPlaybook && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {drillPlaybook.name}
                  <Badge variant="outline">
                    {INCIDENT_TYPE_LABELS[drillPlaybook.incident_type]}
                  </Badge>
                  <Badge variant={severityVariant(drillPlaybook.severity_default)}>
                    {SEVERITY_LABELS[drillPlaybook.severity_default]}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="steps" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="steps" className="flex-1">
                    Steps (NIST)
                  </TabsTrigger>
                  <TabsTrigger value="exercises" className="flex-1">
                    Exercícios ({drillTabletops.length})
                  </TabsTrigger>
                  <TabsTrigger value="details" className="flex-1">
                    Detalhes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="steps" className="space-y-4 mt-4">
                  <div className="flex justify-end">
                    <Dialog open={stepDialog} onOpenChange={setStepDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-3 w-3 mr-1" />
                          Novo step
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adicionar step</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label>Fase NIST</Label>
                            <Select
                              value={stepForm.phase}
                              onValueChange={(v: IRPhase) => setStepForm({ ...stepForm, phase: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PHASES.map((p) => (
                                  <SelectItem key={p} value={p}>
                                    {PHASE_LABELS[p]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Título</Label>
                            <Input
                              value={stepForm.title}
                              onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Instruções</Label>
                            <Textarea
                              rows={3}
                              value={stepForm.instructions}
                              onChange={(e) =>
                                setStepForm({ ...stepForm, instructions: e.target.value })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Duração (min)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={stepForm.expected_duration_minutes}
                                onChange={(e) =>
                                  setStepForm({
                                    ...stepForm,
                                    expected_duration_minutes: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label>Papel responsável</Label>
                              <Input
                                value={stepForm.responsible_role}
                                onChange={(e) =>
                                  setStepForm({ ...stepForm, responsible_role: e.target.value })
                                }
                                placeholder="Ex: SecOps Lead"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Hint de automação (opcional)</Label>
                            <Input
                              value={stepForm.automation_hint}
                              onChange={(e) =>
                                setStepForm({ ...stepForm, automation_hint: e.target.value })
                              }
                              placeholder="Ex: trigger playbook X"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setStepDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleAddStep}>Adicionar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {PHASES.map((phase) => (
                    <div key={phase}>
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                        {PHASE_LABELS[phase]}
                      </h4>
                      {playbooksByPhase[phase].length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-2">— nenhum step</p>
                      ) : (
                        <div className="space-y-2">
                          {playbooksByPhase[phase].map((s) => (
                            <Card key={s.id}>
                              <CardContent className="py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{s.title}</p>
                                    {s.instructions && (
                                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                        {s.instructions}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                                      {s.expected_duration_minutes != null && (
                                        <Badge variant="outline" className="text-[10px]">
                                          {s.expected_duration_minutes}min
                                        </Badge>
                                      )}
                                      {s.responsible_role && (
                                        <Badge variant="secondary" className="text-[10px]">
                                          {s.responsible_role}
                                        </Badge>
                                      )}
                                      {s.automation_hint && (
                                        <Badge variant="outline" className="text-[10px]">
                                          ⚙ {s.automation_hint}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteStep(s.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="exercises" className="space-y-2 mt-4">
                  <Button size="sm" onClick={() => setTabletopDialog(drillPlaybook)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Registrar exercício
                  </Button>
                  {drillTabletops.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhum exercício para este playbook.
                    </p>
                  ) : (
                    drillTabletops.map((t) => (
                      <Card key={t.id}>
                        <CardContent className="py-3">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={outcomeVariant(t.outcome)}>
                              {OUTCOME_LABELS[t.outcome]}
                            </Badge>
                            {t.mttr_actual_minutes != null && (
                              <Badge variant="outline" className="text-[10px]">
                                MTTR {t.mttr_actual_minutes}min
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(t.executed_at ?? t.scheduled_for), 'dd/MM/yyyy', {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          <p className="text-sm">{t.scenario}</p>
                          {t.gaps.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-destructive mb-1">Gaps:</p>
                              <ul className="text-xs text-muted-foreground list-disc list-inside">
                                {t.gaps.map((g, i) => (
                                  <li key={i}>{g}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {t.action_items && (
                            <p className="text-xs text-muted-foreground mt-2">
                              <b>Ações:</b> {t.action_items}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="details" className="space-y-2 mt-4 text-sm">
                  <p>
                    <b>Status:</b> {drillPlaybook.status} (v{drillPlaybook.version})
                  </p>
                  <p>
                    <b>Tipo:</b> {INCIDENT_TYPE_LABELS[drillPlaybook.incident_type]}
                  </p>
                  <p>
                    <b>Severidade padrão:</b> {SEVERITY_LABELS[drillPlaybook.severity_default]}
                  </p>
                  <p>
                    <b>Última revisão:</b>{' '}
                    {drillPlaybook.last_reviewed_at
                      ? format(new Date(drillPlaybook.last_reviewed_at), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })
                      : '—'}
                  </p>
                  <p>
                    <b>Próxima revisão:</b>{' '}
                    {drillPlaybook.next_review_due
                      ? format(new Date(drillPlaybook.next_review_due), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })
                      : '—'}
                  </p>
                  {drillPlaybook.description && (
                    <p className="text-muted-foreground whitespace-pre-wrap pt-2 border-t border-border/40">
                      {drillPlaybook.description}
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Tabletop dialog */}
      <Dialog open={!!tabletopDialog} onOpenChange={(o) => !o && setTabletopDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar exercício tabletop</DialogTitle>
          </DialogHeader>
          {tabletopDialog && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Playbook: <b>{tabletopDialog.name}</b>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Agendado para</Label>
                  <Input
                    type="datetime-local"
                    value={tabletopForm.scheduled_for}
                    onChange={(e) =>
                      setTabletopForm({ ...tabletopForm, scheduled_for: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Executado em</Label>
                  <Input
                    type="datetime-local"
                    value={tabletopForm.executed_at}
                    onChange={(e) =>
                      setTabletopForm({ ...tabletopForm, executed_at: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Cenário</Label>
                <Input
                  value={tabletopForm.scenario}
                  onChange={(e) => setTabletopForm({ ...tabletopForm, scenario: e.target.value })}
                  placeholder="Ex: Vazamento de 10k registros via API pública"
                />
              </div>
              <div>
                <Label>Participantes (separados por vírgula)</Label>
                <Input
                  value={tabletopForm.participants}
                  onChange={(e) =>
                    setTabletopForm({ ...tabletopForm, participants: e.target.value })
                  }
                  placeholder="DPO, SecOps, Engenharia"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Outcome</Label>
                  <Select
                    value={tabletopForm.outcome}
                    onValueChange={(v: IRTabletopOutcome) =>
                      setTabletopForm({ ...tabletopForm, outcome: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOMES.map((o) => (
                        <SelectItem key={o} value={o}>
                          {OUTCOME_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>MTTR real (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={tabletopForm.mttr_actual_minutes}
                    onChange={(e) =>
                      setTabletopForm({
                        ...tabletopForm,
                        mttr_actual_minutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Gaps (1 por linha)</Label>
                <Textarea
                  rows={3}
                  value={tabletopForm.gaps}
                  onChange={(e) => setTabletopForm({ ...tabletopForm, gaps: e.target.value })}
                  placeholder="Faltou DPO\nNotificação ANPD atrasada"
                />
              </div>
              <div>
                <Label>Ações</Label>
                <Textarea
                  rows={2}
                  value={tabletopForm.action_items}
                  onChange={(e) =>
                    setTabletopForm({ ...tabletopForm, action_items: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea
                  rows={2}
                  value={tabletopForm.notes}
                  onChange={(e) => setTabletopForm({ ...tabletopForm, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTabletopDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRecordTabletop}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  pulse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  pulse?: boolean;
}) {
  return (
    <Card className={pulse ? 'border-destructive/40' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${pulse ? 'text-destructive animate-pulse' : ''}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
