import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { traces } from "@/lib/mock-data";
import { Activity, Clock, DollarSign, Wrench, ChevronRight } from "lucide-react";
import { useState } from "react";

const stepColors: Record<string, string> = {
  input: 'bg-nexus-cyan',
  retrieval: 'bg-nexus-amber',
  tool_call: 'bg-primary',
  model: 'bg-nexus-glow',
  guardrail: 'bg-nexus-emerald',
  output: 'bg-nexus-emerald',
};

export default function MonitoringPage() {
  const [selectedTrace, setSelectedTrace] = useState(traces[0]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Monitoring" description="Traces, sessões e observabilidade em tempo real" />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Trace list */}
        <div className="space-y-2">
          <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sessões recentes</h3>
          {traces.map(trace => (
            <div
              key={trace.id}
              className={`nexus-card cursor-pointer p-3 ${selectedTrace.id === trace.id ? 'border-primary/40 nexus-glow-sm' : ''}`}
              onClick={() => setSelectedTrace(trace)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-foreground truncate">{trace.agent.split('—')[0].trim()}</p>
                <StatusBadge status={trace.status} />
              </div>
              <p className="text-[11px] text-muted-foreground">{trace.sessionId}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {(trace.duration / 1000).toFixed(1)}s</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${trace.cost.toFixed(3)}</span>
                <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {trace.toolCalls}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Trace detail */}
        <div className="lg:col-span-2 nexus-card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
            <div>
              <h3 className="text-sm font-heading font-semibold text-foreground">{selectedTrace.agent}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{selectedTrace.sessionId} • {selectedTrace.timestamp} • {selectedTrace.user}</p>
            </div>
            <StatusBadge status={selectedTrace.status} size="md" />
          </div>

          <div className="space-y-0">
            {selectedTrace.steps.map((step, i) => (
              <div key={step.id}>
                <div className="flex items-start gap-3 relative">
                  {/* Timeline line */}
                  {i < selectedTrace.steps.length - 1 && (
                    <div className="absolute left-[11px] top-7 w-0.5 h-[calc(100%+4px)] bg-border/50" />
                  )}
                  <div className={`h-6 w-6 rounded-full ${stepColors[step.type] || 'bg-secondary'} flex items-center justify-center shrink-0 z-10`}>
                    <span className="text-[9px] font-bold text-primary-foreground">{i + 1}</span>
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{step.label}</p>
                        <span className="nexus-badge text-[10px] bg-secondary/50 text-muted-foreground">{step.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {step.duration > 0 && <span className="text-[11px] text-muted-foreground">{step.duration}ms</span>}
                        <StatusBadge status={step.status} />
                      </div>
                    </div>
                    {step.detail && <p className="text-[11px] text-muted-foreground mt-1">{step.detail}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-4 gap-4 text-center">
            <div><p className="text-lg font-heading font-bold text-foreground">{(selectedTrace.duration / 1000).toFixed(1)}s</p><p className="text-[10px] text-muted-foreground">Duração total</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">{selectedTrace.tokens.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Tokens</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">${selectedTrace.cost.toFixed(3)}</p><p className="text-[10px] text-muted-foreground">Custo</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">{selectedTrace.toolCalls}</p><p className="text-[10px] text-muted-foreground">Tool calls</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
