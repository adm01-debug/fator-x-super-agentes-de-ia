import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Terminal, HardDrive, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import type { SandboxConfig, SandboxRuntime } from '@/components/workflows/SandboxExecutionPanel';

const RUNTIME_OPTIONS: Array<{ id: SandboxRuntime; name: string; securityLevel: string }> = [
  { id: 'docker', name: 'Docker Container', securityLevel: 'high' },
  { id: 'wasm', name: 'WebAssembly (WASM)', securityLevel: 'high' },
  { id: 'local', name: 'Local (Desenvolvimento)', securityLevel: 'low' },
  { id: 'none', name: 'Desabilitado', securityLevel: 'none' },
];

const SECURITY_LEVEL_COLORS: Record<string, string> = {
  high: 'hsl(var(--nexus-emerald))',
  medium: 'hsl(var(--nexus-yellow))',
  low: 'hsl(var(--nexus-red))',
  none: 'hsl(var(--muted-foreground))',
};

function ToggleField({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: typeof Shield;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => onChange(!checked)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (e.currentTarget as HTMLElement).click();
        }
      }}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        <div>
          <p className="text-sm text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div
        className={`w-10 h-5 rounded-full flex items-center transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </div>
    </div>
  );
}

interface SandboxSecurityTabProps {
  config: SandboxConfig;
  onUpdate: (updates: Partial<SandboxConfig>) => void;
}

export function SandboxSecurityTab({ config, onUpdate }: SandboxSecurityTabProps) {
  const selectedRuntime = RUNTIME_OPTIONS.find((r) => r.id === config.runtime);

  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4 space-y-3">
        <ToggleField
          label="Acesso à Rede"
          description="Permitir que o código acesse a internet"
          checked={config.networkEnabled}
          onChange={(v) => onUpdate({ networkEnabled: v })}
          icon={config.networkEnabled ? Wifi : WifiOff}
        />
        <ToggleField
          label="Escrita em Disco"
          description="Permitir que o código crie/edite arquivos no workspace"
          checked={config.writeAccess}
          onChange={(v) => onUpdate({ writeAccess: v })}
          icon={HardDrive}
        />
        <ToggleField
          label="Acesso ao Shell"
          description="Permitir execução de comandos shell (bash/sh)"
          checked={config.shellAccess}
          onChange={(v) => onUpdate({ shellAccess: v })}
          icon={Terminal}
        />

        {config.networkEnabled && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Domínios Permitidos</span>
            <textarea
              value={config.allowedDomains.join('\n')}
              onChange={(e) =>
                onUpdate({ allowedDomains: e.target.value.split('\n').filter(Boolean) })
              }
              className="w-full h-20 p-2 bg-background border border-border rounded text-xs font-mono text-muted-foreground resize-none focus:border-primary focus:outline-none"
              placeholder={'api.exemplo.com\ngithub.com\npypi.org'}
            />
          </div>
        )}

        <div className="p-3 rounded-lg bg-background border border-border">
          <p className="text-xs font-medium text-foreground mb-2">Resumo de Segurança</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Runtime</span>
              <span className="text-foreground">{selectedRuntime?.name ?? 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Isolamento</span>
              <Badge
                className="text-[9px]"
                style={{
                  backgroundColor: `${SECURITY_LEVEL_COLORS[selectedRuntime?.securityLevel ?? 'none']}20`,
                  color: SECURITY_LEVEL_COLORS[selectedRuntime?.securityLevel ?? 'none'],
                }}
              >
                {selectedRuntime?.securityLevel ?? 'N/A'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rede</span>
              <span className={config.networkEnabled ? 'text-nexus-amber' : 'text-nexus-emerald'}>
                {config.networkEnabled
                  ? `Habilitada (${config.allowedDomains.length} domínios)`
                  : 'Bloqueada'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Shell</span>
              <span className={config.shellAccess ? 'text-destructive' : 'text-nexus-emerald'}>
                {config.shellAccess ? 'Habilitado ⚠️' : 'Bloqueado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Linguagens</span>
              <span className="text-foreground">{config.allowedLanguages.join(', ')}</span>
            </div>
          </div>
        </div>

        {(config.shellAccess || config.runtime === 'local') && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-destructive">Atenção: Configuração de Risco</p>
              <p className="text-xs text-destructive/80 mt-1">
                {config.runtime === 'local'
                  ? 'Runtime local não tem isolamento. Use apenas em ambiente de desenvolvimento.'
                  : 'Acesso ao shell permite execução arbitrária de comandos. Use com cautela.'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
