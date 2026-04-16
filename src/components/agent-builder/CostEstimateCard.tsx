import { DollarSign, Clock, Hash, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CostEstimateResult } from '@/hooks/useCostEstimate';
import { cn } from '@/lib/utils';

interface CostEstimateCardProps {
  estimate: CostEstimateResult;
  compact?: boolean;
  className?: string;
}

export function CostEstimateCard({ estimate, compact = false, className }: CostEstimateCardProps) {
  const formatUsd = (v: number) => v < 0.0001 ? '<$0.0001' : `$${v.toFixed(4)}`;
  const formatBrl = (v: number) => `R$ ${v.toFixed(4).replace('.', ',')}`;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/40 border border-border/50 text-[11px]',
        className,
      )}>
        <Badge variant="outline" className="h-5 text-[10px] gap-1">
          <DollarSign className="h-3 w-3" /> Estimativa
        </Badge>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Hash className="h-3 w-3" /> ~{estimate.totalTokens} tok
        </span>
        <span className="flex items-center gap-1 text-foreground font-medium">
          {formatUsd(estimate.costUsd)}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{formatBrl(estimate.costBrl)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> ~{(estimate.estLatencyMs / 1000).toFixed(1)}s
        </span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Estimativa de Custo</h4>
        </div>
        <Badge variant="outline" className="text-[10px]">{estimate.pricing.label}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={<Hash className="h-3 w-3" />} label="Input tokens" value={`~${estimate.inputTokens}`} />
        <Metric icon={<Hash className="h-3 w-3" />} label="Output tokens" value={`~${estimate.outputTokens}`} />
        <Metric icon={<DollarSign className="h-3 w-3" />} label="Custo USD" value={formatUsd(estimate.costUsd)} accent />
        <Metric icon={<DollarSign className="h-3 w-3" />} label="Custo BRL" value={formatBrl(estimate.costBrl)} />
        <Metric icon={<Clock className="h-3 w-3" />} label="Latência" value={`~${(estimate.estLatencyMs / 1000).toFixed(1)}s`} />
        <Metric icon={<Zap className="h-3 w-3" />} label="Janela" value={`${(estimate.pricing.context_window / 1000).toFixed(0)}K`} />
      </div>
    </div>
  );
}

function Metric({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <p className={cn('text-sm font-mono font-semibold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
    </div>
  );
}
