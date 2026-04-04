import { ShieldAlert } from "lucide-react";

const limits = [
  { name: 'API Requests', current: 847, max: 1000, unit: '/min' },
  { name: 'LLM Calls', current: 145, max: 200, unit: '/min' },
  { name: 'File Uploads', current: 23, max: 50, unit: '/hora' },
  { name: 'Webhook Calls', current: 12, max: 100, unit: '/min' },
];

export function RateLimitingPanel() {
  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-primary" /> Rate Limiting
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {limits.map(l => {
          const pct = (l.current / l.max) * 100;
          const isHigh = pct > 80;
          return (
            <div key={l.name} className="p-3 rounded-lg bg-secondary/20 border border-border/30">
              <p className="text-xs font-medium text-foreground">{l.name}</p>
              <p className="text-lg font-heading font-bold text-foreground mt-1">
                {l.current}<span className="text-xs font-normal text-muted-foreground">/{l.max} {l.unit}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isHigh ? 'bg-nexus-amber' : 'bg-nexus-emerald'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {isHigh && <p className="text-[10px] text-nexus-amber mt-1">⚠ Próximo do limite</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
