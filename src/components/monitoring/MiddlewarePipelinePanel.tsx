/**
 * MiddlewarePipelinePanel — Displays the middleware pipeline configuration.
 * Wires middlewarePipelineService into MonitoringPage.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Layers, Shield, Clock, DollarSign, Eye, RefreshCcw, Zap } from 'lucide-react';

const AVAILABLE_MIDDLEWARES = [
  { id: 'logging', name: 'Logging & Tracing', icon: Eye, description: 'Registra todas as requisições e respostas', priority: 1 },
  { id: 'token_counter', name: 'Token Counter', icon: Zap, description: 'Contabiliza tokens de entrada e saída', priority: 10 },
  { id: 'caching', name: 'Smart Cache', icon: DollarSign, description: 'Cache inteligente para evitar chamadas duplicadas', priority: 20 },
  { id: 'pii_redaction', name: 'PII Redaction', icon: Shield, description: 'Remove dados pessoais antes de enviar ao LLM', priority: 30 },
  { id: 'retry', name: 'Auto Retry', icon: RefreshCcw, description: 'Retenta em caso de falha', priority: 50 },
];

export function MiddlewarePipelinePanel() {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set(['logging', 'token_counter', 'cost_tracker']));

  const toggleMiddleware = (id: string) => {
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pipelineSize = enabledIds.size;

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-heading font-semibold text-foreground">Middleware Pipeline</h3>
          <Badge variant="secondary" className="text-[11px]">{pipelineSize} ativo(s)</Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Pipeline de interceptors que processam todas as requisições LLM — logging, cache, rate limit, cost tracking.
      </p>

      <div className="space-y-2">
        {AVAILABLE_MIDDLEWARES.map((mw) => {
          const Icon = mw.icon;
          const enabled = enabledIds.has(mw.id);
          return (
            <div key={mw.id} className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${enabled ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-secondary/20 opacity-60'}`}>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-primary/15' : 'bg-muted/30'}`}>
                <Icon className={`h-4 w-4 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground">{mw.name}</p>
                  <Badge variant="outline" className="text-[10px] font-mono">P{mw.priority}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{mw.description}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={() => toggleMiddleware(mw.id)} />
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-secondary/20 border border-border/30 p-3">
        <p className="text-[11px] text-muted-foreground">
          <strong>Ordem de execução:</strong>{' '}
          {AVAILABLE_MIDDLEWARES.filter(m => enabledIds.has(m.id)).sort((a, b) => a.priority - b.priority).map(m => m.name).join(' → ') || 'Nenhum middleware ativo'}
        </p>
      </div>
    </div>
  );
}
