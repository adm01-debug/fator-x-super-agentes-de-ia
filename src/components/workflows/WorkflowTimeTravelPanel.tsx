/**
 * Nexus Agents Studio — Time-Travel Debugging Panel
 * 
 * Allows users to:
 * - View execution timeline with all checkpoints
 * - Inspect state at any checkpoint
 * - Fork execution from any point with modified state
 * - Compare states between checkpoints
 * - Replay workflow from any checkpoint
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  GitBranch,
  Play,
  Eye,
  DollarSign,
  Zap,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeftRight,
  Download,
  FileText,
  Printer,
  Filter,
  X,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import {
  getExecutionTimeline,
  getCheckpoint,
  forkFromCheckpoint,
  recoverExecution,
  type WorkflowCheckpoint,
} from '@/services/workflowCheckpointService';
import { StepComparePanel } from './StepComparePanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadMarkdown, openPrintablePdf } from '@/lib/workflows/exportTimeTravelReport';
import { toast } from 'sonner';

// ──────── Types ────────

interface TimeTravelPanelProps {
  executionId: string;
  onForkCreated?: (newExecutionId: string) => void;
  onResumeFrom?: (checkpoint: WorkflowCheckpoint) => void;
}

type TimelineEntry = WorkflowCheckpoint & {
  cumulative_cost_usd: number;
  cumulative_tokens: number;
  cumulative_duration_ms: number;
};

// ──────── Status Helpers ────────

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'hsl(var(--nexus-emerald))', label: 'Concluído' },
  running: { icon: Loader2, color: 'hsl(var(--nexus-blue))', label: 'Executando' },
  failed: { icon: XCircle, color: 'hsl(var(--nexus-red))', label: 'Falhou' },
  pending: { icon: Clock, color: 'hsl(var(--nexus-yellow))', label: 'Pendente' },
  skipped: { icon: ChevronRight, color: 'hsl(var(--muted-foreground))', label: 'Pulado' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

// ──────── Filter Helpers ────────

type StatusFilter = 'success' | 'warning' | 'error';
type KindFilter = 'llm' | 'tool' | 'guardrail' | 'other';

const STATUS_FILTER_META: Record<StatusFilter, { label: string; icon: string; color: string; matches: (s: string) => boolean }> = {
  success: { label: 'Sucesso', icon: '✓', color: 'hsl(var(--nexus-emerald))', matches: (s) => s === 'completed' || s === 'success' || s === 'ok' },
  warning: { label: 'Atenção', icon: '⚠', color: 'hsl(var(--nexus-yellow))', matches: (s) => s === 'pending' || s === 'running' || s === 'skipped' || s === 'warning' },
  error:   { label: 'Falha',   icon: '✗', color: 'hsl(var(--destructive))',  matches: (s) => s === 'failed' || s === 'error' },
};

const KIND_FILTER_META: Record<KindFilter, { label: string; matches: (nodeType: string) => boolean }> = {
  llm:       { label: 'LLM',       matches: (t) => /llm|model|gpt|gemini|claude|chat|completion|prompt/i.test(t) },
  tool:      { label: 'Tool',      matches: (t) => /tool|function|action|api|webhook|http|skill/i.test(t) },
  guardrail: { label: 'Guardrail', matches: (t) => /guard|policy|filter|moderation|safety|validate/i.test(t) },
  other:     { label: 'Outros',    matches: () => true }, // fallback handled separately
};

function classifyKind(nodeType: string): KindFilter {
  if (KIND_FILTER_META.llm.matches(nodeType)) return 'llm';
  if (KIND_FILTER_META.tool.matches(nodeType)) return 'tool';
  if (KIND_FILTER_META.guardrail.matches(nodeType)) return 'guardrail';
  return 'other';
}

// ──────── Main Component ────────

export function WorkflowTimeTravelPanel({
  executionId,
  onForkCreated,
  onResumeFrom,
}: TimeTravelPanelProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [inspectedState, setInspectedState] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters: empty Set = "show all".
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set());
  const [kindFilters, setKindFilters] = useState<Set<KindFilter>>(new Set());

  // Compare mode: when active, clicking a step picks A then B (round-robin).
  const [compareMode, setCompareMode] = useState(false);
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<WorkflowCheckpoint | null>(null);
  const [compareB, setCompareB] = useState<WorkflowCheckpoint | null>(null);
  const [comparing, setComparing] = useState(false);

  // Load timeline
  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getExecutionTimeline(executionId);
      setTimeline(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar timeline');
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Inspect a checkpoint's state OR pick it as A/B in compare mode.
  const handleInspect = async (checkpointId: string) => {
    if (compareMode) {
      // Round-robin assignment: fill A first, then B, then replace A again.
      if (!compareAId || (compareAId && compareBId)) {
        setCompareAId(checkpointId);
        setCompareBId(null);
        setCompareA(null);
        setCompareB(null);
      } else if (checkpointId !== compareAId) {
        setCompareBId(checkpointId);
      }
      return;
    }
    try {
      setSelectedCheckpoint(checkpointId);
      const cp = await getCheckpoint(checkpointId);
      setInspectedState(cp.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao inspecionar checkpoint');
    }
  };

  // Load A and B checkpoints whenever both ids are set.
  useEffect(() => {
    if (!compareMode || !compareAId || !compareBId) return;
    let cancelled = false;
    (async () => {
      try {
        setComparing(true);
        const [a, b] = await Promise.all([getCheckpoint(compareAId), getCheckpoint(compareBId)]);
        if (cancelled) return;
        setCompareA(a);
        setCompareB(b);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar comparação');
      } finally {
        if (!cancelled) setComparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compareMode, compareAId, compareBId]);

  const resetCompare = () => {
    setCompareAId(null);
    setCompareBId(null);
    setCompareA(null);
    setCompareB(null);
  };

  const swapCompare = () => {
    setCompareAId(compareBId);
    setCompareBId(compareAId);
    setCompareA(compareB);
    setCompareB(compareA);
  };

  // Fork from a checkpoint
  const handleFork = async (checkpointId: string) => {
    try {
      setForking(true);
      const result = await forkFromCheckpoint({ checkpoint_id: checkpointId });
      onForkCreated?.(result.execution.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar fork');
    } finally {
      setForking(false);
    }
  };

  // Resume from checkpoint
  const handleResume = async (checkpointId: string) => {
    try {
      const cp = await getCheckpoint(checkpointId);
      await recoverExecution(executionId);
      onResumeFrom?.(cp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resumir execução');
    }
  };

  // Stats summary
  const lastEntry = timeline[timeline.length - 1];
  const totalCost = lastEntry?.cumulative_cost_usd ?? 0;
  const totalTokens = lastEntry?.cumulative_tokens ?? 0;
  const totalDuration = lastEntry?.cumulative_duration_ms ?? 0;

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando timeline...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base text-foreground">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Time-Travel Debugger
              <Badge className="bg-primary/20 text-primary text-[10px] ml-2">
                {timeline.length} checkpoints
              </Badge>
            </span>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-border hover:bg-nexus-amber/20 hover:text-nexus-amber"
                    disabled={timeline.length === 0}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">
                    Compartilhar execução
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      openPrintablePdf({
                        executionId,
                        timeline,
                        activeCheckpoint:
                          timeline.find((t) => t.id === selectedCheckpoint) ?? null,
                        activeState: inspectedState,
                        totals: {
                          cost_usd: totalCost,
                          tokens: totalTokens,
                          duration_ms: totalDuration,
                        },
                      });
                      toast.success('Relatório aberto — use Ctrl/Cmd+P para salvar como PDF');
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 mr-2" />
                    PDF (imprimir)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      downloadMarkdown({
                        executionId,
                        timeline,
                        activeCheckpoint:
                          timeline.find((t) => t.id === selectedCheckpoint) ?? null,
                        activeState: inspectedState,
                        totals: {
                          cost_usd: totalCost,
                          tokens: totalTokens,
                          duration_ms: totalDuration,
                        },
                      });
                      toast.success('Markdown baixado');
                    }}
                  >
                    <FileText className="w-3.5 h-3.5 mr-2" />
                    Markdown (.md)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                variant={compareMode ? 'default' : 'outline'}
                className={`h-7 text-xs ${
                  compareMode
                    ? 'bg-nexus-purple text-primary-foreground hover:bg-nexus-purple/90'
                    : 'border-border hover:bg-nexus-purple/20 hover:text-nexus-purple'
                }`}
                onClick={() => {
                  const next = !compareMode;
                  setCompareMode(next);
                  if (!next) resetCompare();
                  else setInspectedState(null);
                }}
                aria-pressed={compareMode}
              >
                <ArrowLeftRight className="w-3 h-3 mr-1" />
                {compareMode ? 'Sair da comparação' : 'Comparar steps'}
              </Button>
            </div>
          </CardTitle>
          {compareMode && (
            <p className="text-[11px] text-muted-foreground mt-2">
              {!compareAId
                ? 'Clique em um step para escolher A.'
                : !compareBId
                ? 'Agora clique em outro step para escolher B.'
                : comparing
                ? 'Carregando comparação…'
                : 'Comparando A × B abaixo. Clique em outro step para substituir A.'}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-nexus-emerald" />
              <div>
                <p className="text-xs text-muted-foreground">Custo Total</p>
                <p className="text-sm font-medium text-foreground">{formatCost(totalCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-nexus-amber" />
              <div>
                <p className="text-xs text-muted-foreground">Tokens</p>
                <p className="text-sm font-medium text-foreground">{formatTokens(totalTokens)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-nexus-purple" />
              <div>
                <p className="text-xs text-muted-foreground">Duração</p>
                <p className="text-sm font-medium text-foreground">{formatDuration(totalDuration)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Timeline */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-1">
              {timeline.map((entry, idx) => {
                const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const isSelected = selectedCheckpoint === entry.id;
                const isLast = idx === timeline.length - 1;

                const isPickedA = compareMode && compareAId === entry.id;
                const isPickedB = compareMode && compareBId === entry.id;
                return (
                  <div key={entry.id} className="relative flex gap-3">

                    {/* Timeline Line */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 relative"
                        style={{
                          borderColor: isPickedA
                            ? 'hsl(var(--destructive))'
                            : isPickedB
                            ? 'hsl(var(--nexus-emerald))'
                            : statusCfg.color,
                          backgroundColor: isSelected || isPickedA || isPickedB ? `${statusCfg.color}20` : 'transparent',
                        }}
                      >
                        <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
                        {(isPickedA || isPickedB) && (
                          <span
                            className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-primary-foreground ${
                              isPickedA ? 'bg-destructive' : 'bg-nexus-emerald'
                            }`}
                          >
                            {isPickedA ? 'A' : 'B'}
                          </span>
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className="w-0.5 flex-1 min-h-[20px]"
                          style={{ backgroundColor: `${statusCfg.color}40` }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className={`flex-1 pb-4 rounded-lg transition-colors cursor-pointer ${
                        isPickedA
                          ? 'bg-destructive/5 ring-1 ring-destructive/30 p-3'
                          : isPickedB
                          ? 'bg-nexus-emerald/5 ring-1 ring-nexus-emerald/30 p-3'
                          : isSelected
                          ? 'bg-muted p-3'
                          : 'hover:bg-background p-3'
                      }`}
                      onClick={() => handleInspect(entry.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            #{entry.step_index} · {entry.node_type}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Node: {entry.node_id}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-border"
                            style={{ color: statusCfg.color }}
                          >
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{formatCost(entry.cost_usd)}</span>
                        <span>·</span>
                        <span>{formatTokens(entry.tokens_used)} tokens</span>
                        <span>·</span>
                        <span>{formatDuration(entry.duration_ms)}</span>
                      </div>

                      {/* Error message */}
                      {entry.error && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          ⚠ {entry.error}
                        </p>
                      )}

                      {/* Actions (show when selected) */}
                      {isSelected && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-border hover:bg-primary/20 hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInspect(entry.id);
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Inspecionar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-border hover:bg-nexus-purple/20 hover:text-nexus-purple"
                            disabled={forking}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFork(entry.id);
                            }}
                          >
                            <GitBranch className="w-3 h-3 mr-1" />
                            Fork
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-border hover:bg-nexus-emerald/20 hover:text-nexus-emerald"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResume(entry.id);
                            }}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Replay
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* State Inspector — hidden in compare mode to give space to the comparison panel */}
      {!compareMode && inspectedState && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-foreground">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-nexus-orange" />
                Estado do Checkpoint
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => setInspectedState(null)}
              >
                Fechar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(inspectedState, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side step comparison */}
      {compareMode && compareA && compareB && (
        <StepComparePanel
          checkpointA={compareA}
          checkpointB={compareB}
          onClose={resetCompare}
          onSwap={swapCompare}
        />
      )}
    </div>
  );
}
