/**
 * RetryEnginePanel — Circuit breaker status and retry policies.
 * Wires retryEngineService into MonitoringPage.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { RefreshCcw, Shield, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  RETRY_PRESETS,
  DEFAULT_CIRCUIT_CONFIG,
} from '@/services/retryEngineService';

const PRESET_META: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  aggressive: { label: 'Agressivo', icon: <Zap className="h-3.5 w-3.5" />, description: '5 tentativas, backoff exponencial x3' },
  gentle: { label: 'Suave', icon: <CheckCircle2 className="h-3.5 w-3.5" />, description: '2 tentativas, delay fixo' },
  api_call: { label: 'API Call', icon: <RefreshCcw className="h-3.5 w-3.5" />, description: '3 tentativas, timeout 10s' },
  webhook_delivery: { label: 'Webhook', icon: <AlertTriangle className="h-3.5 w-3.5" />, description: '5 tentativas, até 5min de delay' },
  database_operation: { label: 'Database', icon: <Shield className="h-3.5 w-3.5" />, description: '3 tentativas, delay curto' },
  llm_inference: { label: 'LLM Inference', icon: <Zap className="h-3.5 w-3.5" />, description: '3 tentativas, timeout 2min' },
};

export function RetryEnginePanel() {
  const [selectedPreset, setSelectedPreset] = useState<string>('api_call');

  const preset = RETRY_PRESETS[selectedPreset];

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCcw className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-heading font-semibold text-foreground">Retry & Circuit Breaker</h3>
        <Badge variant="secondary" className="text-[11px]">{Object.keys(RETRY_PRESETS).length} presets</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Políticas de retry com backoff exponencial e circuit breaker para resiliência.
      </p>

      {/* Presets grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(PRESET_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setSelectedPreset(key)}
            className={`rounded-lg border p-3 text-left transition-all ${selectedPreset === key ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 bg-secondary/20 hover:border-border'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={selectedPreset === key ? 'text-primary' : 'text-muted-foreground'}>{meta.icon}</span>
              <span className="text-xs font-semibold text-foreground">{meta.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{meta.description}</p>
          </button>
        ))}
      </div>

      {/* Selected preset details */}
      {preset && (
        <div className="rounded-lg bg-secondary/20 border border-border/30 p-4 space-y-2">
          <h4 className="text-xs font-semibold text-foreground">Configuração: {PRESET_META[selectedPreset]?.label}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div><p className="text-lg font-heading font-bold text-foreground">{preset.max_attempts}</p><p className="text-[11px] text-muted-foreground">Tentativas</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">{preset.initial_delay_ms}ms</p><p className="text-[11px] text-muted-foreground">Delay inicial</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">{(preset.max_delay_ms / 1000).toFixed(0)}s</p><p className="text-[11px] text-muted-foreground">Delay máximo</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">{(preset.timeout_ms / 1000).toFixed(0)}s</p><p className="text-[11px] text-muted-foreground">Timeout</p></div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="text-[11px] text-muted-foreground mr-1">Erros retentáveis:</span>
            {preset.retryable_errors.map(e => <Badge key={e} variant="outline" className="text-[10px] font-mono">{e}</Badge>)}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
            <span>Estratégia: <strong className="text-foreground">{preset.backoff_strategy}</strong></span>
            <span>•</span>
            <span>On exhaust: <strong className="text-foreground">{preset.on_exhaust}</strong></span>
          </div>
        </div>
      )}

      {/* Circuit Breaker */}
      <div className="rounded-lg bg-secondary/20 border border-border/30 p-4 space-y-2">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-nexus-amber" /> Circuit Breaker (Default)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div><p className="text-lg font-heading font-bold text-foreground">{DEFAULT_CIRCUIT_CONFIG.failure_threshold}</p><p className="text-[11px] text-muted-foreground">Falhas p/ abrir</p></div>
          <div><p className="text-lg font-heading font-bold text-foreground">{DEFAULT_CIRCUIT_CONFIG.success_threshold}</p><p className="text-[11px] text-muted-foreground">Sucesso p/ fechar</p></div>
          <div><p className="text-lg font-heading font-bold text-foreground">{(DEFAULT_CIRCUIT_CONFIG.timeout_ms / 1000).toFixed(0)}s</p><p className="text-[11px] text-muted-foreground">Timeout reset</p></div>
          <div><p className="text-lg font-heading font-bold text-foreground">{DEFAULT_CIRCUIT_CONFIG.half_open_max_calls}</p><p className="text-[11px] text-muted-foreground">Half-open calls</p></div>
        </div>
      </div>
    </div>
  );
}
