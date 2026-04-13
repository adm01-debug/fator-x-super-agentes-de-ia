import { Shield } from 'lucide-react';

export function SliderField({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs font-medium text-foreground">{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

export function ToggleField({
  label, description, checked, onChange, icon: Icon,
}: {
  label: string; description?: string; checked: boolean;
  onChange: (v: boolean) => void; icon?: typeof Shield;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        <div>
          <p className="text-sm text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className={`w-10 h-5 rounded-full flex items-center transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </div>
  );
}
