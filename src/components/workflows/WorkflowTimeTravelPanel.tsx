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
  Pause,
  RotateCcw,
  Eye,
  DollarSign,
  Zap,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  getExecutionTimeline,
  getCheckpoint,
  forkFromCheckpoint,
  recoverExecution,
  type WorkflowCheckpoint,
} from '@/services/workflowCheckpointService';

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
  completed: { icon: CheckCircle2, color: '#6BCB77', label: 'Concluído' },
  running: { icon: Loader2, color: '#4D96FF', label: 'Executando' },
  failed: { icon: XCircle, color: '#FF6B6B', label: 'Falhou' },
  pending: { icon: Clock, color: '#FFD93D', label: 'Pendente' },
  skipped: { icon: ChevronRight, color: '#666', label: 'Pulado' },
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

  // Inspect a checkpoint's state
  const handleInspect = async (checkpointId: string) => {
    try {
      setSelectedCheckpoint(checkpointId);
      const cp = await getCheckpoint(checkpointId);
      setInspectedState(cp.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao inspecionar checkpoint');
    }
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
      <Card className="bg-[#111122] border-[#222244]">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#4D96FF]" />
          <span className="ml-2 text-sm text-gray-400">Carregando timeline...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <Card className="bg-[#111122] border-[#222244]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Clock className="w-4 h-4 text-[#4D96FF]" />
            Time-Travel Debugger
            <Badge className="bg-[#4D96FF]/20 text-[#4D96FF] text-[10px] ml-2">
              {timeline.length} checkpoints
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#6BCB77]" />
              <div>
                <p className="text-xs text-gray-400">Custo Total</p>
                <p className="text-sm font-medium text-white">{formatCost(totalCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFD93D]" />
              <div>
                <p className="text-xs text-gray-400">Tokens</p>
                <p className="text-sm font-medium text-white">{formatTokens(totalTokens)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#9B59B6]" />
              <div>
                <p className="text-xs text-gray-400">Duração</p>
                <p className="text-sm font-medium text-white">{formatDuration(totalDuration)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/30">
          <AlertCircle className="w-4 h-4 text-[#FF6B6B]" />
          <span className="text-sm text-[#FF6B6B]">{error}</span>
        </div>
      )}

      {/* Timeline */}
      <Card className="bg-[#111122] border-[#222244]">
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-1">
              {timeline.map((entry, idx) => {
                const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const isSelected = selectedCheckpoint === entry.id;
                const isLast = idx === timeline.length - 1;

                return (
                  <div key={entry.id} className="relative flex gap-3">
                    {/* Timeline Line */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0"
                        style={{
                          borderColor: statusCfg.color,
                          backgroundColor: isSelected ? `${statusCfg.color}20` : 'transparent',
                        }}
                      >
                        <StatusIcon
                          className="w-4 h-4"
                          style={{ color: statusCfg.color }}
                        />
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
                        isSelected ? 'bg-[#0a0a2a] p-3' : 'hover:bg-[#0a0a1a] p-3'
                      }`}
                      onClick={() => handleInspect(entry.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            #{entry.step_index} · {entry.node_type}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Node: {entry.node_id}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-[#222244]"
                            style={{ color: statusCfg.color }}
                          >
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{formatCost(entry.cost_usd)}</span>
                        <span>·</span>
                        <span>{formatTokens(entry.tokens_used)} tokens</span>
                        <span>·</span>
                        <span>{formatDuration(entry.duration_ms)}</span>
                      </div>

                      {/* Error message */}
                      {entry.error && (
                        <p className="text-xs text-[#FF6B6B] mt-1 truncate">
                          ⚠ {entry.error}
                        </p>
                      )}

                      {/* Actions (show when selected) */}
                      {isSelected && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-[#222244] hover:bg-[#4D96FF]/20 hover:text-[#4D96FF]"
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
                            className="h-7 text-xs border-[#222244] hover:bg-[#9B59B6]/20 hover:text-[#9B59B6]"
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
                            className="h-7 text-xs border-[#222244] hover:bg-[#6BCB77]/20 hover:text-[#6BCB77]"
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

      {/* State Inspector */}
      {inspectedState && (
        <Card className="bg-[#111122] border-[#222244]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-white">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#E67E22]" />
                Estado do Checkpoint
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-gray-400"
                onClick={() => setInspectedState(null)}
              >
                Fechar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(inspectedState, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
