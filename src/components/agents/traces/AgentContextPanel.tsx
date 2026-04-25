/**
 * AgentContextPanel — contextual side card shown in the trace explorer when a
 * single agent is selected (via drill-down, deep-link or pinned route).
 *
 * Surfaces: identity (avatar, name, persona), runtime config (model, reasoning,
 * prompt version), lifecycle status, and cost/usage estimates derived from the
 * traces currently in scope (already filtered by window + level + event).
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bot, Brain, Coins, FileText, GitBranch, Pencil, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgent } from '@/hooks/use-data';
import type { ExecutionGroup } from '@/services/agentTracesService';

interface Props {
  agentId: string;
  /** Traces in scope (already filtered) — used to compute observed cost/tokens. */
  executions: ExecutionGroup[];
  /** When true, render a compact loading skeleton even before the query starts. */
  loading?: boolean;
}

/** Maps lifecycle status → semantic Badge variant + label. */
function statusBadge(status: string | null | undefined): { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string } {
  switch (status) {
    case 'production':
    case 'active':
      return { variant: 'default', label: 'Produção' };
    case 'staging':
      return { variant: 'secondary', label: 'Staging' };
    case 'draft':
      return { variant: 'outline', label: 'Rascunho' };
    case 'archived':
    case 'inactive':
      return { variant: 'destructive', label: 'Arquivado' };
    default:
      return { variant: 'outline', label: status || '—' };
  }
}

/** Friendly model display + provider hint. */
function formatModel(model: string | null | undefined): { name: string; provider: string } {
  if (!model) return { name: '—', provider: '' };
  if (model.startsWith('claude')) return { name: model, provider: 'Anthropic' };
  if (model.startsWith('gpt')) return { name: model, provider: 'OpenAI' };
  if (model.startsWith('gemini')) return { name: model, provider: 'Google' };
  if (model.startsWith('llama')) return { name: model, provider: 'Meta' };
  return { name: model, provider: 'Custom' };
}

interface RowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}

function Row({ icon: Icon, label, children }: RowProps) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="text-xs text-foreground/90 mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}

export function AgentContextPanel({ agentId, executions, loading }: Props) {
  const { data: agent, isLoading } = useAgent(agentId);

  // Derive observed cost/tokens from the traces currently in scope so the panel
  // reflects exactly the time window the user is exploring.
  const observed = useMemo(() => {
    let cost = 0;
    let tokens = 0;
    let runs = executions.length;
    for (const e of executions) {
      cost += e.total_cost;
      tokens += e.total_tokens;
    }
    const avgCostPerRun = runs > 0 ? cost / runs : 0;
    return { cost, tokens, runs, avgCostPerRun };
  }, [executions]);

  if (isLoading || loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!agent) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Agente não encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  const status = statusBadge(agent.status as string | null);
  const model = formatModel(agent.model as string | null);
  // `agent.config` may carry a system_prompt string — its length is a proxy for
  // prompt complexity; we expose only the existence + size, not the content.
  const config = (agent.config ?? {}) as Record<string, unknown>;
  const systemPrompt = typeof config.system_prompt === 'string' ? (config.system_prompt as string) : '';

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-0">
        {/* Header — identity */}
        <div className="p-4 border-b border-border/40 bg-card/40">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-lg shrink-0"
              aria-hidden
            >
              {(agent.avatar_emoji as string) || '🤖'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                <Badge variant={status.variant} className="text-[10px] h-4 px-1.5 shrink-0">
                  {status.label}
                </Badge>
              </div>
              {agent.persona && (
                <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                  {String(agent.persona).replace(/_/g, ' ')}
                </p>
              )}
              {agent.mission && (
                <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2 leading-relaxed">
                  {agent.mission as string}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Runtime config */}
        <div className="px-4 py-2 divide-y divide-border/30">
          <Row icon={Bot} label="Modelo">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono">{model.name}</span>
              {model.provider && (
                <span className="text-[10px] text-muted-foreground">· {model.provider}</span>
              )}
            </div>
          </Row>

          {agent.reasoning && (
            <Row icon={Brain} label="Raciocínio">
              <span className="font-mono uppercase text-[11px]">{agent.reasoning as string}</span>
            </Row>
          )}

          <Row icon={GitBranch} label="Versão do prompt">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono">v{(agent.version as number | null) ?? 1}</span>
              {systemPrompt && (
                <span className="text-[10px] text-muted-foreground">
                  · {systemPrompt.length.toLocaleString('pt-BR')} chars
                </span>
              )}
            </div>
          </Row>

          {systemPrompt && (
            <Row icon={FileText} label="System prompt (preview)">
              <p className="text-[11px] text-muted-foreground/90 font-mono leading-relaxed line-clamp-2">
                {systemPrompt.slice(0, 160)}
                {systemPrompt.length > 160 && '…'}
              </p>
            </Row>
          )}
        </div>

        {/* Observed cost/usage in the current window */}
        <div className="px-4 py-3 border-t border-border/40 bg-card/40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3 w-3" aria-hidden /> Estimativa na janela
            </p>
            <span className="text-[10px] text-muted-foreground tabular-nums">{observed.runs} exec.</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-sm font-mono tabular-nums">${observed.cost.toFixed(4)}</p>
              <p className="text-[10px] text-muted-foreground">Custo total</p>
            </div>
            <div>
              <p className="text-sm font-mono tabular-nums">
                {observed.tokens >= 1000 ? `${(observed.tokens / 1000).toFixed(1)}k` : observed.tokens}
              </p>
              <p className="text-[10px] text-muted-foreground">Tokens</p>
            </div>
            <div>
              <p className="text-sm font-mono tabular-nums">
                ${observed.avgCostPerRun.toFixed(4)}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5" aria-hidden /> Média/exec
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-4 py-2.5 border-t border-border/40 flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs flex-1 justify-start">
            <Link to={`/agents/${agentId}`}>
              <Pencil className="h-3 w-3 mr-1.5" aria-hidden /> Editar agente
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs flex-1 justify-start">
            <Link to={`/agents/${agentId}`}>
              Detalhes <ArrowUpRight className="h-3 w-3 ml-1" aria-hidden />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
