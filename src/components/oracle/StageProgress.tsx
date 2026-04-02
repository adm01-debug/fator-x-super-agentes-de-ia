import { ORACLE_MODES, type OracleMode } from '@/stores/oracleStore';

interface StageProgressProps {
  mode: OracleMode;
  currentStage: number;
}

export function StageProgress({ mode, currentStage }: StageProgressProps) {
  const stages = ORACLE_MODES[mode].stages;

  return (
    <div className="nexus-card">
      <div className="flex items-center gap-2">
        {stages.map((stage, i) => (
          <div key={stage} className="flex items-center gap-2 flex-1">
            <div
              animate={currentStage === i + 1 ? { scale: [1, 1.1, 1] } : {}}
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                currentStage > i + 1
                  ? 'bg-primary text-primary-foreground'
                  : currentStage === i + 1
                    ? 'nexus-gradient-bg text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {currentStage > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap ${currentStage >= i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {stage}
            </span>
            {i < stages.length - 1 && (
              <div className={`flex-1 h-0.5 rounded ${currentStage > i + 1 ? 'bg-primary' : 'bg-secondary'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
