/**
 * Eval Schedule Page — `/evals/schedule`
 *
 * Dashboard de prontidão de deploy: mostra todos os agentes do workspace,
 * o último eval run (via `agent_eval_runs`) e o **gate** calculado por
 * `src/services/evalGates.ts`. Agentes que não passam no gate não devem ir
 * para canais de produção (ver `EvalGate.allow`).
 *
 * Ações:
 *  - "Rodar avaliação" dispara o edge `agent-eval-runner` com o dataset
 *    escolhido (ou o padrão associado, se existir).
 *  - Abrir `/evaluations` para ver detalhes / criar novos datasets.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, ShieldCheck, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  computeGateForRun,
  listLatestEvalRunsForAgents,
  DEFAULT_PASS_RATE_THRESHOLD,
  MAX_EVAL_STALENESS_DAYS,
  type EvalGate,
  type EvalGateRun,
} from '@/services/evalGates';

interface AgentRow {
  id: string;
  name: string;
  avatar_emoji: string | null;
  model: string | null;
  status: string | null;
  updated_at: string;
}

interface AgentWithGate {
  agent: AgentRow;
  run: EvalGateRun | null;
  gate: EvalGate;
}

export default function EvalSchedulePage() {
  const navigate = useNavigate();

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['evals_schedule_agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, avatar_emoji, model, status, updated_at')
        .eq('is_template', false)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentRow[];
    },
  });

  const agentIds = useMemo(() => agents.map((a) => a.id), [agents]);

  const { data: latestRuns = {}, isLoading: runsLoading } = useQuery({
    queryKey: ['evals_schedule_latest', agentIds],
    enabled: agentIds.length > 0,
    queryFn: () => listLatestEvalRunsForAgents(agentIds),
  });

  const rows: AgentWithGate[] = useMemo(
    () =>
      agents.map((agent) => {
        const run = latestRuns[agent.id] ?? null;
        const gate = computeGateForRun(run);
        return { agent, run, gate };
      }),
    [agents, latestRuns],
  );

  const counts = useMemo(() => {
    const allow = rows.filter((r) => r.gate.allow).length;
    const block = rows.filter((r) => !r.gate.allow && r.run).length;
    const never = rows.filter((r) => !r.run).length;
    const stale = rows.filter(
      (r) => r.gate.staleness_days !== null && r.gate.staleness_days > MAX_EVAL_STALENESS_DAYS,
    ).length;
    return { allow, block, never, stale };
  }, [rows]);

  const loading = agentsLoading || runsLoading;

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Eval Gates — Schedule"
        description={`Gate de deploy: agentes só vão para produção com pass rate ≥ ${Math.round(DEFAULT_PASS_RATE_THRESHOLD * 100)}% e última avaliação ≤ ${MAX_EVAL_STALENESS_DAYS}d.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/evaluations')}
          >
            Abrir Evaluations <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Liberados"
          value={counts.allow}
          color="text-nexus-emerald"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Bloqueados"
          value={counts.block}
          color="text-destructive"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <StatCard
          label="Sem eval"
          value={counts.never}
          color="text-nexus-amber"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Stale (> 14d)"
          value={counts.stale}
          color="text-nexus-amber"
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando agentes e runs…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum agente encontrado no workspace.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ agent, run, gate }) => (
            <GateRow
              key={agent.id}
              agent={agent}
              run={run}
              gate={gate}
              onOpenEvals={() => navigate('/evaluations')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="nexus-card text-center py-3">
      <div className={`flex items-center justify-center gap-1.5 mb-1 ${color}`}>{icon}</div>
      <p className="text-xl font-heading font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function GateRow({
  agent,
  run,
  gate,
  onOpenEvals,
}: {
  agent: AgentRow;
  run: EvalGateRun | null;
  gate: EvalGate;
  onOpenEvals: () => void;
}) {
  return (
    <Card className="p-4 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-[220px]">
        <span className="text-2xl">{agent.avatar_emoji ?? '🤖'}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{agent.name}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate">{agent.id}</p>
        </div>
      </div>

      <div className="text-xs min-w-[180px]">
        <p className="text-muted-foreground">Último run</p>
        {run ? (
          <>
            <p className="font-semibold text-foreground">
              {run.passed}/{run.total_items} • score {Number(run.avg_score ?? 0).toFixed(2)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {run.completed_at ? new Date(run.completed_at).toLocaleString('pt-BR') : 'sem data'}
            </p>
          </>
        ) : (
          <p className="italic text-muted-foreground">Nunca avaliado</p>
        )}
      </div>

      <div className="text-xs min-w-[120px]">
        <p className="text-muted-foreground">Pass rate</p>
        <p className="text-base font-heading font-bold text-foreground">
          {(gate.pass_rate * 100).toFixed(1)}%
        </p>
      </div>

      <div className="flex-1 min-w-[200px]">
        {gate.allow ? (
          <Badge className="bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/30">
            <ShieldCheck className="h-3 w-3 mr-1" /> Deploy liberado
          </Badge>
        ) : (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30">
            <ShieldAlert className="h-3 w-3 mr-1" /> Deploy bloqueado
          </Badge>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">{gate.reason}</p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenEvals}>
          <Play className="h-3.5 w-3.5" /> Rodar
        </Button>
      </div>
    </Card>
  );
}
