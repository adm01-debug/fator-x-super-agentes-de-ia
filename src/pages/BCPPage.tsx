import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LifeBuoy, Plus, AlertTriangle, Activity, Clock, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkspaceId } from '@/lib/agentService';
import {
  type BusinessSystem,
  type BcpTestRun,
  type BcpSummary,
  type BcpCategory,
  type BcpCriticality,
  type BcpSystemStatus,
  type BcpTestType,
  listBusinessSystems,
  listSystemTests,
  getBcpSummary,
  registerBusinessSystem,
  recordBcpTest,
  updateSystemStatus,
  isTestOverdue,
  daysUntilTest,
  isRtoBreach,
  isRpoBreach,
  formatDuration,
  TIER_LABEL,
  CATEGORY_LABEL,
  STATUS_LABEL,
  TEST_TYPE_LABEL,
} from '@/services/bcpService';

const tierBadgeClass = (t: BcpCriticality) =>
  ({
    tier_1: 'bg-destructive/15 text-destructive border-destructive/30',
    tier_2: 'bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30',
    tier_3: 'bg-primary/15 text-primary border-primary/30',
    tier_4: 'bg-muted text-muted-foreground border-border',
  })[t];

const statusBadgeClass = (s: BcpSystemStatus) =>
  ({
    operational: 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30',
    degraded: 'bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30',
    down: 'bg-destructive/15 text-destructive border-destructive/30 animate-pulse',
    retired: 'bg-muted text-muted-foreground border-border',
  })[s];

export default function BCPPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [systems, setSystems] = useState<BusinessSystem[]>([]);
  const [summary, setSummary] = useState<BcpSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tierFilter, setTierFilter] = useState<'all' | BcpCriticality>('all');
  const [catFilter, setCatFilter] = useState<'all' | BcpCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | BcpSystemStatus>('all');

  // New system dialog
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'core' as BcpCategory,
    criticality: 'tier_3' as BcpCriticality,
    rto_minutes: 240,
    rpo_minutes: 60,
    mtpd_hours: 24,
    dependencies: '',
    recovery_strategy: '',
  });

  // Drill-in
  const [selected, setSelected] = useState<BusinessSystem | null>(null);
  const [tests, setTests] = useState<BcpTestRun[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);

  // New test
  const [testForm, setTestForm] = useState({
    test_type: 'tabletop' as BcpTestType,
    scenario: '',
    actual_rto_minutes: '',
    actual_rpo_minutes: '',
    success: true,
    gaps: '',
    action_items: '',
    notes: '',
  });
  const [recordingTest, setRecordingTest] = useState(false);

  useEffect(() => {
    if (!user) return;
    getWorkspaceId().then((id) => {
      if (id) setWorkspaceId(id);
    });
  }, [user]);

  const refresh = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        listBusinessSystems(workspaceId),
        getBcpSummary(workspaceId),
      ]);
      setSystems(list);
      setSummary(sum);
    } catch (e) {
      toast.error('Falha ao carregar sistemas', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (workspaceId) refresh();
  }, [workspaceId]);

  const refreshTests = async (sys: BusinessSystem) => {
    setTestsLoading(true);
    try {
      const list = await listSystemTests(sys.id);
      setTests(list);
    } catch (e) {
      toast.error('Falha ao carregar testes', { description: (e as Error).message });
    } finally {
      setTestsLoading(false);
    }
  };

  const filtered = useMemo(
    () =>
      systems.filter(
        (s) =>
          (tierFilter === 'all' || s.criticality === tierFilter) &&
          (catFilter === 'all' || s.category === catFilter) &&
          (statusFilter === 'all' || s.status === statusFilter),
      ),
    [systems, tierFilter, catFilter, statusFilter],
  );

  const handleCreate = async () => {
    if (!workspaceId || !form.name.trim()) {
      toast.error('Informe o nome do sistema');
      return;
    }
    setCreating(true);
    try {
      await registerBusinessSystem({
        workspace_id: workspaceId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        criticality: form.criticality,
        rto_minutes: form.rto_minutes,
        rpo_minutes: form.rpo_minutes,
        mtpd_hours: form.mtpd_hours,
        dependencies: form.dependencies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        recovery_strategy: form.recovery_strategy.trim() || null,
      });
      toast.success('Sistema cadastrado');
      setNewOpen(false);
      setForm({
        name: '',
        description: '',
        category: 'core',
        criticality: 'tier_3',
        rto_minutes: 240,
        rpo_minutes: 60,
        mtpd_hours: 24,
        dependencies: '',
        recovery_strategy: '',
      });
      refresh();
    } catch (e) {
      toast.error('Falha ao cadastrar', { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const handleRecordTest = async () => {
    if (!selected || !testForm.scenario.trim()) {
      toast.error('Descreva o cenário do teste');
      return;
    }
    setRecordingTest(true);
    try {
      await recordBcpTest({
        system_id: selected.id,
        test_type: testForm.test_type,
        scenario: testForm.scenario.trim(),
        actual_rto_minutes: testForm.actual_rto_minutes
          ? Number(testForm.actual_rto_minutes)
          : null,
        actual_rpo_minutes: testForm.actual_rpo_minutes
          ? Number(testForm.actual_rpo_minutes)
          : null,
        success: testForm.success,
        gaps: testForm.gaps
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        action_items: testForm.action_items.trim() || null,
        notes: testForm.notes.trim() || null,
      });
      toast.success('Teste registrado');
      setTestForm({
        test_type: 'tabletop',
        scenario: '',
        actual_rto_minutes: '',
        actual_rpo_minutes: '',
        success: true,
        gaps: '',
        action_items: '',
        notes: '',
      });
      await refreshTests(selected);
      await refresh();
      const updated = (await listBusinessSystems(workspaceId!)).find((s) => s.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) {
      toast.error('Falha ao registrar teste', { description: (e as Error).message });
    } finally {
      setRecordingTest(false);
    }
  };

  const handleStatusChange = async (status: BcpSystemStatus) => {
    if (!selected) return;
    try {
      await updateSystemStatus(selected.id, status);
      toast.success('Status atualizado');
      await refresh();
      setSelected({ ...selected, status });
    } catch (e) {
      toast.error('Falha ao atualizar status', { description: (e as Error).message });
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
            <LifeBuoy className="h-7 w-7 text-primary" />
            Continuidade de Negócios (BCP)
          </h1>
          <p className="text-muted-foreground mt-1">
            BIA, RTO/RPO e testes de continuidade conforme ISO 22301 / SOC2 A1.2.
          </p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo sistema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar sistema crítico</DialogTitle>
              <DialogDescription>
                Defina criticidade, RTO/RPO e estratégia de recuperação. A próxima data de teste é
                calculada automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: Auth Service"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v as BcpCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABEL).map(([k, l]) => (
                        <SelectItem key={k} value={k}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label>Criticidade</Label>
                <Select
                  value={form.criticality}
                  onValueChange={(v) => setForm({ ...form, criticality: v as BcpCriticality })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIER_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>RTO — Recovery Time Objective: {formatDuration(form.rto_minutes)}</Label>
                <Slider
                  min={5}
                  max={1440}
                  step={5}
                  value={[form.rto_minutes]}
                  onValueChange={(v) => setForm({ ...form, rto_minutes: v[0] })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>RPO — Recovery Point Objective: {formatDuration(form.rpo_minutes)}</Label>
                <Slider
                  min={1}
                  max={1440}
                  step={1}
                  value={[form.rpo_minutes]}
                  onValueChange={(v) => setForm({ ...form, rpo_minutes: v[0] })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>MTPD — Maximum Tolerable Period of Disruption: {form.mtpd_hours}h</Label>
                <Slider
                  min={1}
                  max={168}
                  step={1}
                  value={[form.mtpd_hours]}
                  onValueChange={(v) => setForm({ ...form, mtpd_hours: v[0] })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Dependências (separadas por vírgula)</Label>
                <Input
                  value={form.dependencies}
                  onChange={(e) => setForm({ ...form, dependencies: e.target.value })}
                  placeholder="Postgres, Redis, Stripe API"
                />
              </div>
              <div>
                <Label>Estratégia de recuperação</Label>
                <Textarea
                  value={form.recovery_strategy}
                  onChange={(e) => setForm({ ...form, recovery_strategy: e.target.value })}
                  rows={3}
                  placeholder="Hot standby em região alternativa, failover automático em < 15min..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Cadastrando...' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total ativos"
          value={summary?.total ?? 0}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Tier 1 (críticos)"
          value={summary?.tier_1 ?? 0}
          icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
          loading={loading}
        />
        <StatCard
          label="Testes vencidos"
          value={summary?.tests_overdue ?? 0}
          icon={<Clock className="h-4 w-4 text-nexus-amber" />}
          loading={loading}
          highlight={(summary?.tests_overdue ?? 0) > 0}
        />
        <StatCard
          label="Breaches RTO"
          value={summary?.rto_breaches ?? 0}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          loading={loading}
          highlight={(summary?.rto_breaches ?? 0) > 0}
        />
        <StatCard
          label="Down / Degradados"
          value={(summary?.down ?? 0) + (summary?.degraded ?? 0)}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          loading={loading}
          highlight={(summary?.down ?? 0) > 0}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Sistemas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as typeof tierFilter)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Criticidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as criticidades</SelectItem>
                {Object.entries(TIER_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={(v) => setCatFilter(v as typeof catFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {Object.entries(CATEGORY_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LifeBuoy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum sistema cadastrado.</p>
              <p className="text-sm mt-1">
                Comece registrando seus serviços críticos para definir RTO/RPO.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sistema</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>RTO / RPO</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próximo teste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const overdue = isTestOverdue(s);
                  const dleft = daysUntilTest(s);
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() => {
                        setSelected(s);
                        refreshTests(s);
                      }}
                    >
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tierBadgeClass(s.criticality)}>
                          {TIER_LABEL[s.criticality].split(' — ')[0]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {CATEGORY_LABEL[s.category]}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatDuration(s.rto_minutes)} / {formatDuration(s.rpo_minutes)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(s.status)}>
                          {STATUS_LABEL[s.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.next_test_due ? (
                          <Badge
                            variant="outline"
                            className={
                              overdue
                                ? 'bg-destructive/15 text-destructive border-destructive/30 animate-pulse'
                                : (dleft ?? 0) < 30
                                  ? 'bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30'
                                  : 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30'
                            }
                          >
                            {overdue ? `Vencido há ${Math.abs(dleft ?? 0)}d` : `${dleft}d`}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.name}
                  <Badge variant="outline" className={tierBadgeClass(selected.criticality)}>
                    {TIER_LABEL[selected.criticality].split(' — ')[0]}
                  </Badge>
                </SheetTitle>
                <SheetDescription>{selected.description || 'Sem descrição.'}</SheetDescription>
              </SheetHeader>
              <Tabs defaultValue="details" className="mt-4">
                <TabsList>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="tests">Testes ({tests.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <Field label="Categoria" value={CATEGORY_LABEL[selected.category]} />
                    <Field label="MTPD" value={`${selected.mtpd_hours}h`} />
                    <Field label="RTO objetivo" value={formatDuration(selected.rto_minutes)} />
                    <Field label="RPO objetivo" value={formatDuration(selected.rpo_minutes)} />
                    <Field
                      label="Último teste"
                      value={
                        selected.last_tested_at
                          ? new Date(selected.last_tested_at).toLocaleDateString('pt-BR')
                          : 'Nunca'
                      }
                    />
                    <Field
                      label="Próximo teste"
                      value={
                        selected.next_test_due
                          ? new Date(selected.next_test_due).toLocaleDateString('pt-BR')
                          : '—'
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status operacional</Label>
                    <Select
                      value={selected.status}
                      onValueChange={(v) => handleStatusChange(v as BcpSystemStatus)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, l]) => (
                          <SelectItem key={k} value={k}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selected.dependencies.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Dependências</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selected.dependencies.map((d) => (
                          <Badge key={d} variant="secondary">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selected.recovery_strategy && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Estratégia de recuperação
                      </Label>
                      <p className="text-sm mt-1 p-3 bg-secondary/40 rounded-md whitespace-pre-wrap">
                        {selected.recovery_strategy}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tests" className="space-y-4 pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Registrar novo teste</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={testForm.test_type}
                            onValueChange={(v) =>
                              setTestForm({ ...testForm, test_type: v as BcpTestType })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TEST_TYPE_LABEL).map(([k, l]) => (
                                <SelectItem key={k} value={k}>
                                  {l}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Sucesso</Label>
                          <Select
                            value={testForm.success ? 'yes' : 'no'}
                            onValueChange={(v) =>
                              setTestForm({ ...testForm, success: v === 'yes' })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Sim</SelectItem>
                              <SelectItem value="no">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Cenário *</Label>
                        <Textarea
                          rows={2}
                          value={testForm.scenario}
                          onChange={(e) => setTestForm({ ...testForm, scenario: e.target.value })}
                          placeholder="Ex.: Falha total da região primária; failover para us-west-2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">RTO real (min)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={testForm.actual_rto_minutes}
                            onChange={(e) =>
                              setTestForm({ ...testForm, actual_rto_minutes: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">RPO real (min)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={testForm.actual_rpo_minutes}
                            onChange={(e) =>
                              setTestForm({ ...testForm, actual_rpo_minutes: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">
                          Gaps identificados (separados por vírgula)
                        </Label>
                        <Input
                          value={testForm.gaps}
                          onChange={(e) => setTestForm({ ...testForm, gaps: e.target.value })}
                          placeholder="DNS demorou 8min, runbook desatualizado"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Action items</Label>
                        <Textarea
                          rows={2}
                          value={testForm.action_items}
                          onChange={(e) =>
                            setTestForm({ ...testForm, action_items: e.target.value })
                          }
                        />
                      </div>
                      <Button
                        onClick={handleRecordTest}
                        disabled={recordingTest}
                        className="w-full"
                      >
                        {recordingTest ? 'Registrando...' : 'Registrar teste'}
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Histórico</h4>
                    {testsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : tests.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum teste registrado ainda.
                      </p>
                    ) : (
                      tests.map((t) => {
                        const rtoBreach = isRtoBreach(t, selected);
                        const rpoBreach = isRpoBreach(t, selected);
                        return (
                          <Card key={t.id}>
                            <CardContent className="pt-4 space-y-2">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{TEST_TYPE_LABEL[t.test_type]}</Badge>
                                  <Badge
                                    variant="outline"
                                    className={
                                      t.success
                                        ? 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30'
                                        : 'bg-destructive/15 text-destructive border-destructive/30'
                                    }
                                  >
                                    {t.success ? 'Sucesso' : 'Falha'}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(t.executed_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <p className="text-sm">{t.scenario}</p>
                              {(t.actual_rto_minutes != null || t.actual_rpo_minutes != null) && (
                                <div className="flex gap-2 text-xs">
                                  {t.actual_rto_minutes != null && (
                                    <Badge
                                      variant="outline"
                                      className={
                                        rtoBreach
                                          ? 'bg-destructive/15 text-destructive border-destructive/30 animate-pulse'
                                          : 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30'
                                      }
                                    >
                                      RTO: {formatDuration(t.actual_rto_minutes)}{' '}
                                      {rtoBreach && `(>${formatDuration(selected.rto_minutes)})`}
                                    </Badge>
                                  )}
                                  {t.actual_rpo_minutes != null && (
                                    <Badge
                                      variant="outline"
                                      className={
                                        rpoBreach
                                          ? 'bg-destructive/15 text-destructive border-destructive/30 animate-pulse'
                                          : 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30'
                                      }
                                    >
                                      RPO: {formatDuration(t.actual_rpo_minutes)}{' '}
                                      {rpoBreach && `(>${formatDuration(selected.rpo_minutes)})`}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              {t.gaps.length > 0 && (
                                <div className="text-xs">
                                  <span className="font-semibold text-muted-foreground">
                                    Gaps:{' '}
                                  </span>
                                  {t.gaps.join(', ')}
                                </div>
                              )}
                              {t.action_items && (
                                <p className="text-xs italic text-muted-foreground">
                                  → {t.action_items}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-destructive/40' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="font-medium">{value}</p>
    </div>
  );
}
