import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertCircle,
  Cpu,
  DollarSign,
  ExternalLink,
  Loader2,
  Wrench,
  Zap,
} from 'lucide-react';
import { getAgentDayDetails } from '@/services/agentDayDetailsService';
import { formatCost, formatNumber } from './agentMetricsHelpers';

interface DaySummary {
  date: string;
  label: string;
  requests: number;
  cost: number;
  tokens: number;
  avgLatency: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  day: DaySummary | null;
}

function formatLongDate(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function DayDrillDownDrawer({ open, onOpenChange, agentId, day }: Props) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['agent_day_drill', agentId, day?.date],
    queryFn: () => getAgentDayDetails(agentId, day!.date),
    enabled: open && !!day,
  });

  const maxModelCost = useMemo(() => {
    if (!data?.byModel.length) return 0;
    return Math.max(...data.byModel.map((m) => m.costUsd));
  }, [data]);
  const maxToolCount = useMemo(() => {
    if (!data?.byTool.length) return 0;
    return Math.max(...data.byTool.map((t) => t.count));
  }, [data]);

  if (!day) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left border-b border-border/50">
          <DrawerTitle className="font-heading text-lg capitalize">
            {formatLongDate(day.date)}
          </DrawerTitle>
          <DrawerDescription>
            Drill-down de execuções, custo por modelo e top tool calls deste dia.
          </DrawerDescription>

          {/* Header metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <HeaderMetric
              icon={Activity}
              label="Requests"
              value={formatNumber(day.requests)}
            />
            <HeaderMetric
              icon={DollarSign}
              label="Custo"
              value={formatCost(day.cost)}
              accent="amber"
            />
            <HeaderMetric
              icon={Cpu}
              label="Tokens"
              value={formatNumber(day.tokens)}
            />
            <HeaderMetric
              icon={Zap}
              label="Latência média"
              value={day.avgLatency > 0 ? `${Math.round(day.avgLatency)}ms` : '—'}
            />
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 max-h-[calc(85vh-180px)]">
          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Custo por modelo */}
                <Section
                  icon={DollarSign}
                  title="Custo por modelo"
                  count={data?.byModel.length ?? 0}
                >
                  {data && data.byModel.length > 0 ? (
                    <div className="space-y-2">
                      {data.byModel.map((m) => {
                        const pct = maxModelCost > 0 ? (m.costUsd / maxModelCost) * 100 : 0;
                        const totalPct = data.totals.totalCost > 0
                          ? (m.costUsd / data.totals.totalCost) * 100
                          : 0;
                        return (
                          <div key={m.model} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono text-foreground truncate">{m.model}</span>
                              <div className="flex items-center gap-3 shrink-0 text-muted-foreground tabular-nums">
                                <span>{m.count}×</span>
                                <span>{formatNumber(m.tokens)} tk</span>
                                <span className="font-semibold text-foreground">
                                  {formatCost(m.costUsd)}
                                </span>
                                <span className="w-10 text-right">{totalPct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-nexus-amber transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptySection label="Sem custos registrados neste dia." />
                  )}
                </Section>

                {/* Top tool calls */}
                <Section
                  icon={Wrench}
                  title="Top tool calls"
                  count={data?.byTool.length ?? 0}
                >
                  {data && data.byTool.length > 0 ? (
                    <div className="space-y-2">
                      {data.byTool.slice(0, 8).map((t) => {
                        const pct = maxToolCount > 0 ? (t.count / maxToolCount) * 100 : 0;
                        return (
                          <div key={t.tool} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono text-foreground truncate">{t.tool}</span>
                              <div className="flex items-center gap-3 shrink-0 text-muted-foreground tabular-nums">
                                <span className="font-semibold text-foreground">{t.count}×</span>
                                <span>avg {t.avgLatencyMs}ms</span>
                                {t.errors > 0 && (
                                  <span className="text-destructive">{t.errors} erro{t.errors !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                            <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptySection label="Nenhuma chamada de ferramenta registrada." />
                  )}
                </Section>

                {/* Traces */}
                <Section
                  icon={Activity}
                  title="Traces"
                  count={data?.traces.length ?? 0}
                  trailing={
                    data && data.totals.errorCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
                        <AlertCircle className="h-3 w-3" /> {data.totals.errorCount} erro{data.totals.errorCount !== 1 ? 's' : ''}
                      </span>
                    ) : null
                  }
                >
                  {data && data.traces.length > 0 ? (
                    <div className="space-y-1">
                      {data.traces.slice(0, 20).map((t) => {
                        const time = new Date(t.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        });
                        const levelColor =
                          t.level === 'error'
                            ? 'text-destructive'
                            : t.level === 'warning'
                            ? 'text-nexus-amber'
                            : 'text-nexus-emerald';
                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md text-xs hover:bg-secondary/40 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-muted-foreground tabular-nums">{time}</span>
                              <span className={`font-medium ${levelColor}`}>●</span>
                              <span className="text-foreground truncate">{t.event}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-muted-foreground tabular-nums">
                              {typeof t.latency_ms === 'number' && t.latency_ms > 0 && (
                                <span>{t.latency_ms}ms</span>
                              )}
                              {typeof t.cost_usd === 'number' && t.cost_usd > 0 && (
                                <span>{formatCost(t.cost_usd)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {data.traces.length > 20 && (
                        <p className="text-[11px] text-muted-foreground text-center pt-2">
                          + {data.traces.length - 20} traces adicionais
                        </p>
                      )}
                    </div>
                  ) : (
                    <EmptySection label="Sem traces neste dia." />
                  )}
                </Section>

                {/* CTA */}
                <div className="pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/agents/${agentId}/traces`);
                    }}
                  >
                    Ver todos os traces no Observability
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

function HeaderMetric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  accent?: 'amber';
}) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border/40 p-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`mt-0.5 font-mono font-semibold text-sm ${accent === 'amber' ? 'text-nexus-amber' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  trailing,
  children,
}: {
  icon: typeof Activity;
  title: string;
  count: number;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-heading font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {title}
          <span className="text-muted-foreground font-normal">({count})</span>
        </h4>
        {trailing}
      </div>
      {children}
    </section>
  );
}

function EmptySection({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground italic py-3 text-center">{label}</p>;
}
