import { Badge } from '@/components/ui/badge';
import { ConsensusPoint } from '@/stores/oracleStore';

interface ConsensusMatrixProps {
  points: ConsensusPoint[];
  overallConsensus: number;
}

const levelConfig = {
  strong: { color: 'bg-nexus-emerald/20 text-nexus-emerald border-nexus-emerald/30', icon: '🟢', label: 'Forte' },
  partial: { color: 'bg-nexus-amber/20 text-nexus-amber border-nexus-amber/30', icon: '🟡', label: 'Parcial' },
  disputed: { color: 'bg-nexus-rose/20 text-nexus-rose border-nexus-rose/30', icon: '🔴', label: 'Disputado' },
  unique: { color: 'bg-primary/20 text-primary border-primary/30', icon: '🔵', label: 'Único' },
};

const positionIcon: Record<string, string> = {
  agree: '✅',
  disagree: '❌',
  partially_agree: '⚠️',
  not_mentioned: '—',
};

export function ConsensusMatrix({ points, overallConsensus }: ConsensusMatrixProps) {
  if (!points.length) return null;

  const models = [...new Set(points.flatMap(p => p.modelPositions.map(mp => mp.model)))];
  const shortName = (m: string) => m.split('/').pop() || m;

  const grouped = {
    strong: points.filter(p => p.consensusLevel === 'strong'),
    partial: points.filter(p => p.consensusLevel === 'partial'),
    disputed: points.filter(p => p.consensusLevel === 'disputed'),
    unique: points.filter(p => p.consensusLevel === 'unique'),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          📊 Mapa de Consenso
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Consenso geral:</span>
          <Badge variant="outline" className={`text-xs ${overallConsensus >= 80 ? 'border-nexus-emerald/50 text-nexus-emerald' : overallConsensus >= 50 ? 'border-nexus-amber/50 text-nexus-amber' : 'border-nexus-rose/50 text-nexus-rose'}`}>
            {overallConsensus}%
          </Badge>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(grouped).map(([level, pts]) => pts.length > 0 && (
          <Badge key={level} variant="outline" className={`text-[11px] ${levelConfig[level as keyof typeof levelConfig].color}`}>
            {levelConfig[level as keyof typeof levelConfig].icon} {pts.length} {levelConfig[level as keyof typeof levelConfig].label}
          </Badge>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/50 border-b border-border/50">
                <th className="text-left p-2.5 text-muted-foreground font-medium">Ponto</th>
                {models.map(m => (
                  <th key={m} className="text-center p-2.5 text-muted-foreground font-medium min-w-[80px]">{shortName(m)}</th>
                ))}
                <th className="text-center p-2.5 text-muted-foreground font-medium w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, i) => (
                <tr key={point.id} className={`border-b border-border/30 ${i % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}`}>
                  <td className="p-2.5 text-foreground max-w-[200px]">
                    <span className="line-clamp-2">{point.claim}</span>
                    <Badge variant="outline" className="text-[11px] mt-1 opacity-60">{point.category}</Badge>
                  </td>
                  {models.map(m => {
                    const pos = point.modelPositions.find(mp => mp.model === m);
                    return (
                      <td key={m} className="text-center p-2.5" title={pos?.detail}>
                        <span className="text-base">{positionIcon[pos?.position || 'not_mentioned']}</span>
                      </td>
                    );
                  })}
                  <td className="text-center p-2.5">
                    <span className="text-base">{levelConfig[point.consensusLevel].icon}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
