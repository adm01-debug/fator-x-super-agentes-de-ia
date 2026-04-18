import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Plus, Play, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { listGameDays, createGameDay, deleteGameDay, startGameDay, type GameDay, type GameDayScenario, SCENARIO_LABELS } from '@/services/gameDayService';
import { getCurrentWorkspaceId } from '@/lib/agentService';
import { logger } from '@/lib/logger';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'outline',
  running: 'default',
  completed: 'secondary',
  aborted: 'destructive',
};

export default function GameDaysPage() {
  const [gameDays, setGameDays] = useState<GameDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scenario, setScenario] = useState<GameDayScenario>('provider_outage');
  const [scheduledAt, setScheduledAt] = useState('');
  const [runbookSection, setRunbookSection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Start dialog state
  const [startTarget, setStartTarget] = useState<GameDay | null>(null);
  const [injectChaos, setInjectChaos] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const wsId = await getCurrentWorkspaceId();
      setWorkspaceId(wsId);
      const data = await listGameDays(wsId);
      setGameDays(data);
    } catch (e) {
      logger.error('load game days', e);
      toast.error('Falha ao carregar Game Days');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!workspaceId || !title || !scheduledAt) return;
    setSubmitting(true);
    try {
      await createGameDay({
        workspace_id: workspaceId,
        title,
        description,
        scenario,
        scheduled_at: new Date(scheduledAt).toISOString(),
        runbook_section: runbookSection || undefined,
      });
      toast.success('Game Day agendado');
      setDialogOpen(false);
      setTitle(''); setDescription(''); setScheduledAt(''); setRunbookSection('');
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao agendar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!startTarget) return;
    try {
      await startGameDay(startTarget.id, injectChaos);
      toast.success('Game Day iniciado — modo war room ativo');
      navigate(`/observability/game-days/${startTarget.id}/live`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao iniciar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este Game Day?')) return;
    try {
      await deleteGameDay(id);
      toast.success('Excluído');
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir');
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6 animate-page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <Swords className="h-8 w-8 text-primary" />
            Game Days
          </h1>
          <p className="text-muted-foreground mt-1">
            Drills programados de resposta a incidentes — treine sua equipe sob pressão controlada
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="h-4 w-4" />
              Agendar Game Day
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar novo Game Day</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Q2 Provider Outage Drill" />
              </div>
              <div>
                <Label>Cenário</Label>
                <Select value={scenario} onValueChange={(v) => setScenario(v as GameDayScenario)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCENARIO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div>
                <Label>Seção do runbook (opcional)</Label>
                <Input value={runbookSection} onChange={(e) => setRunbookSection(e.target.value)} placeholder="Ex: docs/RUNBOOK.md#provider-outage" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} loading={submitting} disabled={!title || !scheduledAt}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">Carregando...</Card>
      ) : gameDays.length === 0 ? (
        <Card className="p-12 text-center">
          <Swords className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhum Game Day agendado</h3>
          <p className="text-muted-foreground mb-4">Drills mensais identificam gaps no runbook e melhoram MTTR.</p>
          <Button onClick={() => setDialogOpen(true)} variant="gradient">
            <Plus className="h-4 w-4" /> Agendar primeiro
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {gameDays.map((gd) => (
            <Card key={gd.id} className="p-5 hover:shadow-elegant transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{gd.title}</h3>
                    <Badge variant={STATUS_VARIANTS[gd.status]}>{gd.status}</Badge>
                    <Badge variant="outline">{SCENARIO_LABELS[gd.scenario]}</Badge>
                  </div>
                  {gd.description && <p className="text-sm text-muted-foreground mb-2">{gd.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(gd.scheduled_at).toLocaleString('pt-BR')}
                    </span>
                    {gd.participants.length > 0 && <span>{gd.participants.length} participantes</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {gd.status === 'scheduled' && (
                    <Button size="sm" variant="gradient" onClick={() => setStartTarget(gd)}>
                      <Play className="h-3.5 w-3.5" /> Iniciar
                    </Button>
                  )}
                  {gd.status === 'running' && (
                    <Button size="sm" onClick={() => navigate(`/observability/game-days/${gd.id}/live`)}>
                      War Room
                    </Button>
                  )}
                  {gd.status === 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/observability/game-days/${gd.id}/live`)}>
                      Ver scorecard
                    </Button>
                  )}
                  {gd.status === 'scheduled' && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(gd.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!startTarget} onOpenChange={(o) => !o && setStartTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Game Day: {startTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Cenário: <strong>{startTarget && SCENARIO_LABELS[startTarget.scenario]}</strong>
            </p>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-semibold">Injetar chaos automaticamente</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cria experimento controlado (50% probabilidade, expira em 2h)
                </p>
              </div>
              <Switch checked={injectChaos} onCheckedChange={setInjectChaos} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartTarget(null)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleStart}>
              <Play className="h-4 w-4" /> Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
