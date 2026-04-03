import { ORACLE_PRESETS, ORACLE_MODES, type OracleMode } from '@/stores/oracleStore';

interface PresetSelectorProps {
  selectedPreset: string;
  onSelect: (presetId: string) => void;
}

export function PresetSelector({ selectedPreset, onSelect }: PresetSelectorProps) {
  // Group presets by mode
  const grouped: Record<OracleMode, typeof ORACLE_PRESETS> = {
    council: [], researcher: [], validator: [], executor: [], advisor: [],
  };
  ORACLE_PRESETS.forEach(p => grouped[p.mode].push(p));

  return (
    <div className="space-y-4">
      {Object.entries(ORACLE_MODES).map(([modeKey, modeConfig]) => {
        const presets = grouped[modeKey as OracleMode];
        if (!presets.length) return null;

        return (
          <div key={modeKey}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{modeConfig.icon}</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{modeConfig.label}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => onSelect(preset.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedPreset === preset.id
                      ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
                      : 'border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{preset.icon}</span>
                    <span className="text-[11px] font-medium text-foreground truncate">{preset.name.replace(/^[^\s]+\s/, '')}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{preset.description}</p>
                  <div className="flex gap-1 mt-1.5">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{preset.members.length} modelos</span>
                    {preset.enablePeerReview && <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">review</span>}
                    {preset.enableThinking && <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">thinking</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
