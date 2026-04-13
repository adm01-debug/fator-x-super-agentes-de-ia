import type { SandboxConfig, SandboxRuntime } from '@/components/workflows/SandboxExecutionPanel';

const RUNTIME_OPTIONS: Array<{
  id: SandboxRuntime;
  name: string;
  description: string;
  securityLevel: 'high' | 'medium' | 'low' | 'none';
}> = [
  { id: 'docker', name: 'Docker Container', description: 'Execução isolada em container Docker com filesystem e rede próprios', securityLevel: 'high' },
  { id: 'wasm', name: 'WebAssembly (WASM)', description: 'Execução no browser via Pyodide/QuickJS, sem acesso ao sistema', securityLevel: 'high' },
  { id: 'local', name: 'Local (Desenvolvimento)', description: 'Execução local sem isolamento — APENAS para desenvolvimento', securityLevel: 'low' },
  { id: 'none', name: 'Desabilitado', description: 'Execução de código desabilitada para este agente', securityLevel: 'none' },
];

const SECURITY_LEVEL_COLORS: Record<string, string> = {
  high: 'hsl(var(--nexus-emerald))',
  medium: 'hsl(var(--nexus-yellow))',
  low: 'hsl(var(--nexus-red))',
  none: 'hsl(var(--muted-foreground))',
};

function SliderField({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs font-medium text-foreground">{value} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
    </div>
  );
}

interface SandboxConfigTabProps {
  config: SandboxConfig;
  onUpdate: (updates: Partial<SandboxConfig>) => void;
}

export function SandboxConfigTab({ config, onUpdate }: SandboxConfigTabProps) {
  return (
    <div className="pt-4 space-y-4">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">Runtime</label>
        <div className="grid grid-cols-2 gap-2">
          {RUNTIME_OPTIONS.map((rt) => (
            <div
              key={rt.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${config.runtime === rt.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-border'}`}
              onClick={() => onUpdate({ runtime: rt.id })}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{rt.name}</span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SECURITY_LEVEL_COLORS[rt.securityLevel] }} />
              </div>
              <p className="text-xs text-muted-foreground">{rt.description}</p>
            </div>
          ))}
        </div>
      </div>

      {config.runtime !== 'none' && (
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground font-medium">Limites de Recursos</label>
          <SliderField label="CPU" value={config.cpuLimit} min={0.25} max={4} step={0.25} unit="cores" onChange={(v) => onUpdate({ cpuLimit: v })} />
          <SliderField label="Memória" value={config.memoryLimitMb} min={128} max={4096} step={128} unit="MB" onChange={(v) => onUpdate({ memoryLimitMb: v })} />
          <SliderField label="Timeout" value={config.timeoutSeconds} min={5} max={300} step={5} unit="seg" onChange={(v) => onUpdate({ timeoutSeconds: v })} />
          <SliderField label="Workspace Máximo" value={config.maxWorkspaceSizeMb} min={10} max={1000} step={10} unit="MB" onChange={(v) => onUpdate({ maxWorkspaceSizeMb: v })} />
        </div>
      )}
    </div>
  );
}

export { RUNTIME_OPTIONS, SECURITY_LEVEL_COLORS };
