import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Globe2,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  Loader2,
  Clock,
  DollarSign,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { browserAgentService, type BrowserSession } from '@/services/browserAgentService';

const statusBadge = (status: BrowserSession['status']) => {
  const map: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    running: { variant: 'default', label: 'Executando' },
    completed: { variant: 'secondary', label: 'Concluída' },
    failed: { variant: 'destructive', label: 'Falhou' },
    cancelled: { variant: 'outline', label: 'Cancelada' },
  };
  const cfg = map[status] ?? map.failed;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export default function BrowserAgentPage() {
  const qc = useQueryClient();
  const [goal, setGoal] = useState('');
  const [startUrl, setStartUrl] = useState('https://duckduckgo.com');
  const [maxSteps, setMaxSteps] = useState(10);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [replaySession, setReplaySession] = useState<BrowserSession | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ['browser-sessions'],
    queryFn: () => browserAgentService.listSessions(),
    refetchInterval: 3000,
  });

  const runMutation = useMutation({
    mutationFn: () =>
      browserAgentService.runAgent({ goal, start_url: startUrl, max_steps: maxSteps }),
    onSuccess: (res) => {
      setActiveSessionId(res.session_id);
      toast.success(`Sessão concluída: ${res.status}`, {
        description: res.final_result?.slice(0, 120),
      });
      qc.invalidateQueries({ queryKey: ['browser-sessions'] });
    },
    onError: (e) =>
      toast.error('Falha', { description: e instanceof Error ? e.message : String(e) }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => browserAgentService.cancelSession(id),
    onSuccess: () => {
      toast.success('Sessão cancelada');
      qc.invalidateQueries({ queryKey: ['browser-sessions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => browserAgentService.deleteSession(id),
    onSuccess: () => {
      toast.success('Sessão removida');
      qc.invalidateQueries({ queryKey: ['browser-sessions'] });
    },
  });

  const totalSessions = sessions.length;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const totalCostCents = sessions.reduce((sum, s) => sum + s.cost_cents, 0);
  const totalSteps = sessions.reduce((sum, s) => sum + s.steps_count, 0);

  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Globe2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              Browser Agent
            </h1>
            <p className="text-sm text-muted-foreground">
              Agentes autônomos que navegam e extraem informação na web
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalSessions}</p>
                <p className="text-xs text-muted-foreground">Sessões totais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{completed}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalSteps}</p>
                <p className="text-xs text-muted-foreground">Steps executados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">${(totalCostCents / 100).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Custo total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova execução</CardTitle>
          <CardDescription>
            Defina o objetivo e a URL inicial. O agente decide cada passo via LLM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <span className="text-sm font-medium">Objetivo</span>
            <Textarea
              placeholder="Ex: Encontre o preço atual do iPhone 15 Pro Max no site da Apple Brasil"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-2">
              <span className="text-sm font-medium">URL inicial</span>
              <Input
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Max steps</span>
              <Input
                type="number"
                min={1}
                max={25}
                value={maxSteps}
                onChange={(e) => setMaxSteps(parseInt(e.target.value) || 10)}
              />
            </div>
          </div>
          <Button
            onClick={() => runMutation.mutate()}
            disabled={!goal.trim() || !startUrl.trim() || runMutation.isPending}
            loading={runMutation.isPending}
            variant="gradient"
            size="lg"
            className="w-full"
          >
            <Play className="h-4 w-4" />
            {runMutation.isPending ? 'Executando...' : 'Executar agente'}
          </Button>
        </CardContent>
      </Card>

      {activeSession && activeSession.status === 'running' && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Sessão ativa
              </CardTitle>
              <CardDescription>{activeSession.goal}</CardDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelMutation.mutate(activeSession.id)}
            >
              <Square className="h-4 w-4" /> Cancelar
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {activeSession.steps.map((s, i) => (
                  <div key={i} className="text-xs p-2 rounded bg-muted/40 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        #{s.step_index + 1}
                      </Badge>
                      <Badge className="text-[10px]">{s.action}</Badge>
                      <span className="text-muted-foreground truncate">{s.url}</span>
                    </div>
                    <p className="text-muted-foreground">{s.reasoning}</p>
                  </div>
                ))}
                {activeSession.steps.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aguardando primeiro passo...</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Todas as sessões executadas</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma sessão ainda. Execute a primeira acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Steps</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-xs truncate" title={s.goal}>
                      {s.goal}
                    </TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-right">
                      {s.steps_count}/{s.max_steps}
                    </TableCell>
                    <TableCell className="text-right">${(s.cost_cents / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => setReplaySession(s)}>
                        Replay
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!replaySession} onOpenChange={(o) => !o && setReplaySession(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Replay da sessão</DialogTitle>
            <DialogDescription>{replaySession?.goal}</DialogDescription>
          </DialogHeader>
          {replaySession && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                {statusBadge(replaySession.status)}
                <span className="text-muted-foreground">·</span>
                <span>{replaySession.steps_count} steps</span>
                <span className="text-muted-foreground">·</span>
                <span>${(replaySession.cost_cents / 100).toFixed(2)}</span>
              </div>
              {replaySession.final_result && (
                <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                  <p className="text-xs font-medium text-emerald-500 mb-1">Resultado final</p>
                  <p className="text-sm whitespace-pre-wrap">{replaySession.final_result}</p>
                </div>
              )}
              {replaySession.error_message && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <p className="text-xs font-medium text-destructive mb-1">Erro</p>
                  <p className="text-sm">{replaySession.error_message}</p>
                </div>
              )}
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {replaySession.steps.map((s, i) => (
                    <div key={i} className="border-l-2 border-primary/40 pl-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          Step {s.step_index + 1}
                        </Badge>
                        <Badge className="text-[10px]">{s.action}</Badge>
                        {s.args.idx !== undefined && (
                          <span className="text-xs text-muted-foreground">idx={s.args.idx}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-1">URL: {s.url}</p>
                      <p className="text-sm">{s.reasoning}</p>
                      {s.args.text && (
                        <p className="text-xs mt-1 font-mono bg-muted/40 px-2 py-1 rounded">
                          {s.args.text}
                        </p>
                      )}
                      {s.args.result && <p className="text-xs mt-1 italic">→ {s.args.result}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
