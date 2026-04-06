import { useState, useEffect } from "react";
import { ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRateLimitStats } from "@/services/securityService";

export function RateLimitingPanel() {
  const [limits, setLimits] = useState<Array<{ name: string; current: number; max: number; unit: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); getRateLimitStats().then(setLimits).catch(() => setLimits([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  if (loading && limits.length === 0) return <div className="nexus-card flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" /> Rate Limiting
        </h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {limits.map(l => {
          const pct = l.max > 0 ? (l.current / l.max) * 100 : 0;
          const isHigh = pct > 80;
          return (
            <div key={l.name} className="p-3 rounded-lg bg-secondary/20 border border-border/30">
              <p className="text-xs font-medium text-foreground">{l.name}</p>
              <p className="text-lg font-heading font-bold text-foreground mt-1">
                {l.current}<span className="text-xs font-normal text-muted-foreground">/{l.max} {l.unit}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isHigh ? 'bg-nexus-amber' : 'bg-nexus-emerald'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              {isHigh && <p className="text-[10px] text-nexus-amber mt-1">Próximo do limite</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
