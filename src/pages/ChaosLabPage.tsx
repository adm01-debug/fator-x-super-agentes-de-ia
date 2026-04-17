import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Zap, Power, Trash2, Activity, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  listChaosExperiments,
  createChaosExperiment,
  disableChaosExperiment,
  disableAllChaos,
  type ChaosExperiment,
  type ChaosTarget,
  type ChaosFaultType,
} from '@/services/chaosService';
import { getWorkspaceId } from '@/lib/agentService';

const TARGETS: { value: ChaosTarget; label: string }[] = [
  { value: 'llm-gateway', label: 'LLM Gateway' },
  { value: 'agent-workflow-runner', label: 'Agent Workflow Runner' },
];

const FAULT_TYPES: { value: ChaosFaultType; label: string; desc: string }[] = [
  { value: 'latency', label: 'Latência', desc: 'Adiciona delay artificial antes da chamada' },
  { value: 'error_500', label: 'Erro 500', desc: 'Simula erro interno do servidor' },
  { value: 'error_429', label: 'Rate Limit 429', desc: 'Simula limite de requisições atingido' },
  { value: 'timeout', label: 'Timeout', desc: 'Simula timeout de 30s' },
];

export default function ChaosLabPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [target, setTarget] = useState<ChaosTarget>('llm-gateway');
  const [faultType, setFaultType] = useState<ChaosFaultType>('latency');
  const [probability, setProbability] = useState([5]); // percent
  const [latencyMs, setLatencyMs] = useState(500);
  const [durationMin, setDurationMin] = useState(10);

  const refresh = useCallback(async () => {
    try {
      const wsId = await getWorkspaceId();
      setWorkspaceId(wsId);
      const list = await listChaosExperiments(wsId);
      setExperiments(list);
    } catch (e) {
      toast.error('Falha ao carregar experimentos', {
        description: e instanceof Error ? e.message : 'erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleCreate = async () => {
    if (!workspaceId || !name.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    setSubmitting(true);
    try {
      await createChaosExperiment({
        workspace_id: workspaceId,
        name: name.trim(),
        target,
        fault_type: faultType,
        probability: probability[0] / 100,
        latency_ms: faultType === 'latency' ? latencyMs : undefined,
        duration_seconds: durationMin * 60,
      });
      toast.success('Experimento criado', {
        description: `${name} rodará por ${durationMin}min @ ${probability[0]}% probabilidade`,
      });
      setName('');
      refresh();
    } catch (e) {
      toast.error('Falha ao criar experimento', {
        description: e instanceof Error ? e.message : 'erro',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await disableChaosExperiment(id);
      toast.success('Experimento desativado');
      refresh();
    } catch (e) {
      toast.error('Falha ao desativar', { description: e instanceof Error ? e.message : '' });
    }
  };

  const handleKillSwitch = async () => {
    if (!workspaceId) return;
    if (!confirm('Desativar TODOS os experimentos ativos? Esta ação não pode ser desfeita.')) return;
    try {
      const count = await disableAllChaos(workspaceId);
      toast.success(`${count} experimento${count !== 1 ? 's' : ''} desativado${count !== 1 ? 's' : ''}`);
      refresh();
    } catch (e) {
      toast.error('Falha no kill switch', { description: e instanceof Error ? e.message : '' });
    }
  };

  const isActive = (exp: ChaosExperiment) =>
    exp.enabled && new Date(exp.expires_at) > new Date();

  const activeExperiments = experiments.filter(isActive);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 page-enter">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-7 w-7 text-nexus-amber" />
            Chaos Lab
          </h1>
          <p className="text-muted-foreground mt-1">
            Injete falhas controladas para validar resiliência do sistema
          </p>
        </div>
        {activeExperiments.length > 0 && (
          <Button variant="destructive" size="lg" onClick={handleKillSwitch}>
            <Power className="h-4 w-4 mr-2" />
            Pânico — Desativar Tudo ({activeExperiments.length})
          </Button>
        )}
      </div>

      {/* Educational alert when no experiments */}
      {!loading && experiments.length === 0 && (
        <Alert className="border-primary/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>O que é Chaos Engineering?</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Chaos Engineering testa a resiliência injetando falhas controladas (latência, erros 500/429, timeouts)
              para validar se retry, fallback, alertas e SLOs reagem como esperado.
            </p>
            <p className="text-xs text-muted-foreground">
              Comece com algo pequeno: latência de 500ms a 5% no LLM Gateway por 10min. Acompanhe o SLO Dashboard
              para ver o P95 subir e os alertas dispararem.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle>Novo Experimento</CardTitle>
            <CardDescription>
              Probabilidade máx: 50% · Duração máx: 1h · Auto-expira
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exp-name">Nome</Label>
              <Input
                id="exp-name"
                placeholder="ex: latency-llm-baseline-test"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={target} onValueChange={(v) => setTarget(v as ChaosTarget)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGETS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de falha</Label>
                <Select value={faultType} onValueChange={(v) => setFaultType(v as ChaosFaultType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAULT_TYPES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {FAULT_TYPES.find((f) => f.value === faultType)?.desc}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Probabilidade</Label>
                <span className="text-sm font-mono text-primary">{probability[0]}%</span>
              </div>
              <Slider value={probability} onValueChange={setProbability} min={1} max={50} step={1} />
              <p className="text-xs text-muted-foreground">
                Recomendado começar com 5%. Máximo permitido: 50%.
              </p>
            </div>

            {faultType === 'latency' && (
              <div className="space-y-2">
                <Label htmlFor="latency">Latência (ms)</Label>
                <Input
                  id="latency"
                  type="number"
                  min={50}
                  max={10_000}
                  value={latencyMs}
                  onChange={(e) => setLatencyMs(Math.min(10_000, Math.max(50, Number(e.target.value) || 500)))}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Duração (minutos)</Label>
                <span className="text-sm font-mono text-primary">{durationMin} min</span>
              </div>
              <Slider
                value={[durationMin]}
                onValueChange={(v) => setDurationMin(v[0])}
                min={1}
                max={60}
                step={1}
              />
            </div>

            <Button onClick={handleCreate} disabled={submitting || !name.trim()} className="w-full">
              {submitting ? 'Criando...' : 'Iniciar Experimento'}
            </Button>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle>Experimentos</CardTitle>
            <CardDescription>
              {activeExperiments.length} ativo{activeExperiments.length !== 1 ? 's' : ''} ·{' '}
              {experiments.length} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : experiments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum experimento ainda. Crie o primeiro ao lado.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {experiments.map((exp) => {
                  const active = isActive(exp);
                  const expired = new Date(exp.expires_at) <= new Date();
                  return (
                    <div
                      key={exp.id}
                      className={`p-3 rounded-lg border ${
                        active
                          ? 'border-nexus-amber/50 bg-nexus-amber/5'
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{exp.name}</p>
                            {active ? (
                              <Badge variant="default" className="bg-nexus-amber text-background text-[10px]">
                                <Activity className="h-2.5 w-2.5 mr-1" /> ATIVO
                              </Badge>
                            ) : expired ? (
                              <Badge variant="outline" className="text-[10px]">expirado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">desativado</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>{exp.target}</span>
                            <span>·</span>
                            <span>{exp.fault_type}</span>
                            <span>·</span>
                            <span>{(Number(exp.probability) * 100).toFixed(0)}%</span>
                            {exp.fault_type === 'latency' && exp.latency_ms != null && (
                              <>
                                <span>·</span>
                                <span>{exp.latency_ms}ms</span>
                              </>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {active
                              ? `expira ${new Date(exp.expires_at).toLocaleTimeString('pt-BR')}`
                              : `criado ${new Date(exp.created_at).toLocaleString('pt-BR')}`}
                          </div>
                        </div>
                        {active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDisable(exp.id)}
                            title="Desativar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
