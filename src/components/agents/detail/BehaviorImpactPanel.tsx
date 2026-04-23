/**
 * BehaviorImpactPanel — mostra o IMPACTO OPERACIONAL estimado do rollback
 * com base em traces reais dos últimos 7 dias. Complementa o
 * `RestoreDiffPreview` (que mostra a diff de configuração) respondendo:
 *
 *   "Se eu marcar [prompt/tools/model], o que muda no dia-a-dia do agente?"
 *
 * Para cada toggle ativo, exibe um cartão com:
 *  - Prompt → quantas sessões/raciocínios passam pelo prompt atual.
 *  - Tools  → para cada tool adicionada/removida/preservada, em quais etapas
 *             ela é usada e quantas chamadas fez.
 *  - Model  → latência p50/p95, custo médio e tokens — o "preço" do modelo
 *             atual versus a expectativa para o modelo da versão de origem.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Activity, AlertTriangle, Cpu, Loader2, MessageSquare, Wrench, ArrowRight, Sparkles } from 'lucide-react';
import {
  getAgentBehaviorImpact,
  type AgentBehaviorImpact,
  type ToolUsageSummary,
} from '@/services/agentBehaviorImpactService';
import type { RestoreDiff } from './restoreDiffHelpers';

interface Props {
  agentId: string;
  diff: RestoreDiff;
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean };
}

export function BehaviorImpactPanel({ agentId, diff, options }: Props) {
  const anyToggle = options.copyPrompt || options.copyTools || options.copyModel;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent-behavior-impact', agentId],
    queryFn: () => getAgentBehaviorImpact(agentId, 7),
    // Cache por 60s — evita refetch ao trocar toggles repetidas vezes no dialog.
    staleTime: 60_000,
    enabled: !!agentId && anyToggle,
  });

  if (!anyToggle) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/30 p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Calculando impacto operacional dos últimos 7 dias…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Não foi possível calcular o impacto comportamental — diff de configuração ainda é confiável.
      </div>
    );
  }

  const noTrafficAtAll = data.prompt.totalTraces === 0;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/[0.05] border-b border-primary/15">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          <h4 className="text-xs font-semibold text-foreground">Impacto comportamental estimado</h4>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          baseado em {data.prompt.totalTraces} trace{data.prompt.totalTraces === 1 ? '' : 's'} dos últimos {data.windowDays}d
        </span>
      </header>

      {noTrafficAtAll ? (
        <div className="p-4 text-xs text-muted-foreground text-center">
          Nenhum trace registrado nos últimos {data.windowDays} dias — não temos dados de uso para estimar o impacto.
          O diff de configuração acima continua sendo a fonte de verdade.
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {options.copyPrompt && <PromptImpactCard data={data} diff={diff} />}
          {options.copyTools && <ToolsImpactCard data={data} diff={diff} />}
          {options.copyModel && <ModelImpactCard data={data} diff={diff} />}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Prompt                                                            */
/* ─────────────────────────────────────────────────────────────────── */

function PromptImpactCard({ data, diff }: { data: AgentBehaviorImpact; diff: RestoreDiff }) {
  const promptChanges = diff.changes.filter((c) => c.group === 'prompt');
  const willChange = promptChanges.length > 0;

  return (
    <section className="rounded-md border border-border/50 bg-background/50 p-2.5 space-y-2">
      <header className="flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3 text-primary" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Prompt</span>
        {willChange ? (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            {promptChanges.length} campo{promptChanges.length === 1 ? '' : 's'} mudará
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">sem alterações</span>
        )}
      </header>

      <ul className="text-[11px] text-foreground/90 space-y-1">
        <li className="flex items-center gap-1.5">
          <Activity className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
          <span>
            <strong className="font-mono text-primary">{data.prompt.sessions}</strong>{' '}
            sessões nos últimos {data.windowDays}d operaram sob o prompt atual
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <Activity className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
          <span>
            <strong className="font-mono text-primary">{data.prompt.reasoningEvents}</strong>{' '}
            eventos de raciocínio (<code className="text-[10px]">agent.start</code>, <code className="text-[10px]">llm.*</code>, <code className="text-[10px]">reasoning</code>) consultam-no diretamente
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <Activity className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
          <span>
            Output médio:{' '}
            <strong className="font-mono text-primary">{data.prompt.avgOutputChars}</strong> chars — espere variação após o rollback
          </span>
        </li>
      </ul>

      {willChange && diff.promptDeltaChars !== 0 && (
        <p className="text-[10px] text-muted-foreground italic border-t border-border/40 pt-1.5">
          Δ{diff.promptDeltaChars > 0 ? '+' : ''}{diff.promptDeltaChars} chars no prompt → toda nova sessão (estimadas{' '}
          <strong className="font-mono">{Math.round(data.prompt.sessions / data.windowDays)}/dia</strong>) usará a versão restaurada.
        </p>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Tools — coração do impacto: liga config a etapas reais             */
/* ─────────────────────────────────────────────────────────────────── */

function ToolsImpactCard({ data, diff }: { data: AgentBehaviorImpact; diff: RestoreDiff }) {
  // Casa cada tool adicionada/removida com seu uso real para responder
  // "essa tool é chamada de verdade? em que etapas?".
  const usageByKey = useMemo(() => {
    const map = new Map<string, ToolUsageSummary>();
    data.toolUsage.forEach((u) => map.set(u.key, u));
    return map;
  }, [data.toolUsage]);

  const removed = diff.toolsRemoved;
  const added = diff.toolsAdded;

  // Tools que ficam — ainda relevantes para mostrar "essas continuam".
  const preserved = data.toolUsage
    .filter((u) => !removed.some((r) => r.toLowerCase() === u.key) && !added.some((a) => a.toLowerCase() === u.key))
    .slice(0, 3);

  const noToolChanges = removed.length === 0 && added.length === 0;

  return (
    <section className="rounded-md border border-border/50 bg-background/50 p-2.5 space-y-2">
      <header className="flex items-center gap-1.5 flex-wrap">
        <Wrench className="h-3 w-3 text-nexus-amber" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Ferramentas</span>
        {noToolChanges ? (
          <span className="text-[10px] text-muted-foreground">sem alterações</span>
        ) : (
          <>
            {removed.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                −{removed.length} perdida{removed.length === 1 ? '' : 's'}
              </span>
            )}
            {added.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-nexus-emerald/15 text-nexus-emerald">
                +{added.length} ganha{added.length === 1 ? '' : 's'}
              </span>
            )}
          </>
        )}
      </header>

      {/* Tools removidas — mais críticas: vamos perder capability em uso */}
      {removed.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider">
            Será removido ({removed.length})
          </p>
          {removed.map((name) => {
            const usage = usageByKey.get(name.toLowerCase());
            return <ToolImpactRow key={`rem-${name}`} name={name} usage={usage} kind="removed" />;
          })}
        </div>
      )}

      {/* Tools adicionadas — capability nova; sem histórico de uso ainda */}
      {added.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-nexus-emerald uppercase tracking-wider">
            Será adicionado ({added.length})
          </p>
          {added.map((name) => (
            <ToolImpactRow key={`add-${name}`} name={name} usage={undefined} kind="added" />
          ))}
        </div>
      )}

      {/* Top 3 preservadas — contexto de "o que continua funcionando igual" */}
      {preserved.length > 0 && (
        <div className="space-y-1 border-t border-border/40 pt-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Preservadas (top {preserved.length} por uso)
          </p>
          <ul className="text-[10px] text-muted-foreground space-y-0.5">
            {preserved.map((u) => (
              <li key={u.key} className="flex items-center justify-between gap-2">
                <span className="font-mono truncate">{u.displayName}</span>
                <span className="font-mono shrink-0">
                  {u.calls} chamada{u.calls === 1 ? '' : 's'} · {u.sessions} sessõe{u.sessions === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {noToolChanges && data.toolUsage.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic">
          Nenhuma tool foi chamada nos últimos {data.windowDays} dias — sem dados operacionais a comparar.
        </p>
      )}
    </section>
  );
}

function ToolImpactRow({
  name,
  usage,
  kind,
}: {
  name: string;
  usage: ToolUsageSummary | undefined;
  kind: 'added' | 'removed';
}) {
  const tone =
    kind === 'removed'
      ? 'border-destructive/30 bg-destructive/5'
      : 'border-nexus-emerald/30 bg-nexus-emerald/5';

  return (
    <div className={`rounded border ${tone} p-2 text-[11px]`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono font-semibold text-foreground truncate">{name}</span>
        {usage && usage.calls > 0 && (
          <span className="text-[10px] font-mono shrink-0 text-muted-foreground">
            {usage.calls} chamada{usage.calls === 1 ? '' : 's'} / {usage.sessions} sessõe{usage.sessions === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {kind === 'removed' && usage && usage.calls > 0 && (
        <>
          {/* Etapas onde a tool aparece — responde "qual passo do agente vai parar de funcionar". */}
          {usage.events.length > 0 && (
            <div className="flex items-start gap-1 text-[10px] text-muted-foreground mb-0.5">
              <span className="shrink-0">Etapas:</span>
              <div className="flex flex-wrap gap-1">
                {usage.events.map((ev) => (
                  <code key={ev} className="px-1 py-0.5 rounded bg-muted/40 text-foreground/80">
                    {ev}
                  </code>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px] text-destructive">
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
            <span>
              Após o rollback essas {usage.calls} chamada{usage.calls === 1 ? '' : 's'}/semana ficarão sem ferramenta.
              {usage.failures > 0 && ` (${usage.failures} já falhavam)`}
            </span>
          </div>
        </>
      )}
      {kind === 'removed' && (!usage || usage.calls === 0) && (
        <p className="text-[10px] text-muted-foreground italic">
          Sem chamadas registradas nos últimos 7d — perda de baixo risco operacional.
        </p>
      )}
      {kind === 'added' && (
        <p className="text-[10px] text-muted-foreground italic">
          Capability nova — sem histórico de uso ainda. Reasoner do agente decidirá quando invocar.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Model                                                             */
/* ─────────────────────────────────────────────────────────────────── */

function ModelImpactCard({ data, diff }: { data: AgentBehaviorImpact; diff: RestoreDiff }) {
  const modelChange = diff.changes.find((c) => c.field === 'model');
  const paramChanges = diff.changes.filter((c) => c.group === 'model' && c.field !== 'model' && c.field !== 'persona');

  return (
    <section className="rounded-md border border-border/50 bg-background/50 p-2.5 space-y-2">
      <header className="flex items-center gap-1.5 flex-wrap">
        <Cpu className="h-3 w-3 text-nexus-emerald" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Modelo &amp; parâmetros</span>
        {modelChange && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary inline-flex items-center gap-1">
            <span className="font-mono">{String(modelChange.before)}</span>
            <ArrowRight className="h-2.5 w-2.5" aria-hidden />
            <span className="font-mono">{String(modelChange.after)}</span>
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Metric label="Latência p50" value={`${data.model.p50LatencyMs} ms`} />
        <Metric label="Latência p95" value={`${data.model.p95LatencyMs} ms`} />
        <Metric label="Custo médio" value={`$${data.model.avgCostUsd.toFixed(4)}`} />
        <Metric label="Tokens médios" value={String(data.model.avgTokens)} />
      </div>

      {data.model.observedModel && modelChange && data.model.observedModel !== String(modelChange.after) && (
        <p className="text-[10px] text-nexus-amber bg-nexus-amber/5 border border-nexus-amber/20 rounded px-2 py-1.5 flex items-start gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
          <span>
            Métricas acima são do modelo <code className="font-mono">{data.model.observedModel}</code> em uso.
            Após restaurar para <code className="font-mono">{String(modelChange.after)}</code> esses números mudarão —
            considere rodar uma simulação antes de aplicar em produção.
          </span>
        </p>
      )}

      {paramChanges.length > 0 && (
        <div className="border-t border-border/40 pt-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Parâmetros que mudam ({paramChanges.length})
          </p>
          <ul className="space-y-0.5 text-[10px]">
            {paramChanges.map((c) => (
              <li key={c.field} className="flex items-center justify-between gap-2 font-mono">
                <span className="text-foreground/80">{c.label}</span>
                <span className="text-muted-foreground truncate">
                  {String(c.before)} → <span className="text-foreground">{String(c.after)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground italic mt-1">
            Esses ajustes alteram criatividade, tamanho e profundidade das respostas em todas as próximas execuções.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-muted/30 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
