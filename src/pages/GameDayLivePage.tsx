import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  Wrench,
  CheckCircle2,
  MessageSquare,
  Timer,
  ArrowLeft,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  getGameDay,
  listEvents,
  recordEvent,
  completeGameDay,
  getScorecard,
  type GameDay,
  type GameDayEvent,
  type GameDayScorecard,
  type GameDayEventType,
  SCENARIO_LABELS,
} from '@/services/gameDayService';
import { logger } from '@/lib/logger';

const EVENT_META: Record<GameDayEventType, { label: string; icon: typeof Eye; color: string }> = {
  fault_injected: { label: 'Falha injetada', icon: AlertTriangle, color: 'text-destructive' },
  detection: { label: 'Detectado', icon: Eye, color: 'text-nexus-amber' },
  mitigation: { label: 'Mitigando', icon: Wrench, color: 'text-primary' },
  resolution: { label: 'Resolvido', icon: CheckCircle2, color: 'text-nexus-success' },
  note: { label: 'Nota', icon: MessageSquare, color: 'text-muted-foreground' },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function GameDayLivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gameDay, setGameDay] = useState<GameDay | null>(null);
  const [events, setEvents] = useState<GameDayEvent[]>([]);
  const [scorecard, setScorecard] = useState<GameDayScorecard | null>(null);
  const [now, setNow] = useState(Date.now());
  const [noteText, setNoteText] = useState('');
  const [completeOpen, setCompleteOpen] = useState(false);

  // Scorecard form
  const [runbookFollowed, setRunbookFollowed] = useState(true);
  const [gapsFound, setGapsFound] = useState('');
  const [score, setScore] = useState([7]);
  const [retrospective, setRetrospective] = useState('');

  const elapsedSeconds = useMemo(() => {
    if (!gameDay?.started_at) return 0;
    const start = new Date(gameDay.started_at).getTime();
    const end = gameDay.ended_at ? new Date(gameDay.ended_at).getTime() : now;
    return Math.floor((end - start) / 1000);
  }, [gameDay, now]);

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const gd = await getGameDay(id);
      setGameDay(gd);
      const ev = await listEvents(id);
      setEvents(ev);
      if (gd?.status === 'completed') {
        const sc = await getScorecard(id);
        setScorecard(sc);
      }
    } catch (e) {
      logger.error('load game day', e);
      toast.error('Falha ao carregar');
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [id, loadAll]);

  // Live timer
  useEffect(() => {
    if (gameDay?.status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [gameDay?.status]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`game-day-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_day_events',
          filter: `game_day_id=eq.${id}`,
        },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as GameDayEvent]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleRecord = async (type: GameDayEventType, description: string) => {
    if (!id || !description.trim()) return;
    try {
      await recordEvent(id, type, description);
      toast.success(EVENT_META[type].label + ' registrado');
      if (type === 'note') setNoteText('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar');
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    try {
      const gaps = gapsFound
        .split('\n')
        .map((g) => g.trim())
        .filter(Boolean);
      const result = await completeGameDay({
        game_day_id: id,
        runbook_followed: runbookFollowed,
        gaps_found: gaps,
        score: score[0],
        retrospective,
      });
      toast.success(`Scorecard gerado — MTTR: ${formatDuration(result.mttr_seconds)}`);
      setCompleteOpen(false);
      loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao encerrar');
    }
  };

  if (!gameDay) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-12 text-center text-muted-foreground">Carregando...</Card>
      </div>
    );
  }

  const isRunning = gameDay.status === 'running';
  const isCompleted = gameDay.status === 'completed';

  return (
    <div className="container mx-auto py-6 space-y-6 animate-page-enter">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/observability/game-days')}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold">{gameDay.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={isRunning ? 'default' : isCompleted ? 'secondary' : 'outline'}>
              {gameDay.status}
            </Badge>
            <Badge variant="outline">{SCENARIO_LABELS[gameDay.scenario]}</Badge>
          </div>
        </div>
      </div>

      {isRunning && (
        <Card className="p-6 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer className="h-8 w-8 text-primary animate-pulse" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Tempo decorrido
                </p>
                <p className="text-3xl font-bold tabular-nums font-mono">
                  {formatDuration(elapsedSeconds)}
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => setCompleteOpen(true)}>
              Encerrar e gerar scorecard
            </Button>
          </div>
        </Card>
      )}

      {isCompleted && scorecard && (
        <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Scorecard</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">MTTR</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatDuration(scorecard.mttr_seconds)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">MTTD</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatDuration(scorecard.mttd_seconds)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Score</p>
              <p className="text-2xl font-bold">{scorecard.score ?? '—'}/10</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Runbook</p>
              <p className="text-2xl font-bold">{scorecard.runbook_followed ? '✓' : '✗'}</p>
            </div>
          </div>
          {scorecard.gaps_found.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground uppercase mb-2">Gaps identificados</p>
              <ul className="text-sm space-y-1">
                {scorecard.gaps_found.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </div>
          )}
          {scorecard.retrospective_notes && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground uppercase mb-2">Retrospectiva</p>
              <p className="text-sm">{scorecard.retrospective_notes}</p>
            </div>
          )}
        </Card>
      )}

      {isRunning && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Registrar evento</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleRecord('detection', 'Incidente detectado')}
            >
              <Eye className="h-4 w-4" /> Detectado
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleRecord('mitigation', 'Mitigação iniciada')}
            >
              <Wrench className="h-4 w-4" /> Mitigando
            </Button>
            <Button
              size="lg"
              variant="gradient"
              onClick={() => handleRecord('resolution', 'Incidente resolvido')}
            >
              <CheckCircle2 className="h-4 w-4" /> Resolvido
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar nota..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRecord('note', noteText)}
            />
            <Button onClick={() => handleRecord('note', noteText)} disabled={!noteText.trim()}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Timeline ({events.length})</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => {
              const meta = EVENT_META[ev.event_type];
              const Icon = meta.icon;
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 pb-3 border-b border-border/30 last:border-0"
                >
                  <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{meta.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(ev.occurred_at).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-0.5">{ev.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Encerrar Game Day</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="font-semibold">Runbook foi seguido?</Label>
              <Switch checked={runbookFollowed} onCheckedChange={setRunbookFollowed} />
            </div>
            <div>
              <Label>
                Score (1-10): <strong>{score[0]}</strong>
              </Label>
              <Slider
                value={score}
                onValueChange={setScore}
                min={1}
                max={10}
                step={1}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Gaps identificados (um por linha)</Label>
              <Textarea
                value={gapsFound}
                onChange={(e) => setGapsFound(e.target.value)}
                rows={3}
                placeholder="Ex: Alerta demorou 5min para chegar&#10;Runbook não tinha comando para resetar circuit breaker"
              />
            </div>
            <div>
              <Label>Retrospectiva</Label>
              <Textarea
                value={retrospective}
                onChange={(e) => setRetrospective(e.target.value)}
                rows={4}
                placeholder="O que funcionou bem? O que precisa melhorar?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="gradient" onClick={handleComplete}>
              Gerar scorecard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
