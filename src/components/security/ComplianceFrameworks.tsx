import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSecurityPosture, listGuardrailPolicies, getAuditLog } from "@/services/securityService";

export function ComplianceFrameworks() {
  const [frameworks, setFrameworks] = useState<Array<{ name: string; status: string; coverage: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let postureScore = 0, hasGuardrails = false, hasLogs = false;
      try { const p = await getSecurityPosture(); postureScore = p.length > 0 ? Math.round((p.filter(c => c.status === 'pass').length / p.length) * 100) : 0; } catch {}
      try { const g = await listGuardrailPolicies(); hasGuardrails = g.some((x: { is_enabled: boolean }) => x.is_enabled); } catch {}
      try { const l = await getAuditLog({ limit: 1 }); hasLogs = l.length > 0; } catch {}
      const lgpd = Math.min(100, postureScore + (hasGuardrails ? 10 : 0));
      const gdpr = Math.min(100, postureScore + (hasGuardrails ? 5 : 0));
      const soc2 = Math.min(100, Math.round(postureScore * 0.8) + (hasLogs ? 15 : 0));
      const iso = Math.min(100, Math.round(postureScore * 0.7) + (hasLogs ? 10 : 0));
      const status = (v: number) => v >= 90 ? 'compliant' : v >= 60 ? 'partial' : 'in_progress';
      setFrameworks([
        { name: 'LGPD', status: status(lgpd), coverage: lgpd },
        { name: 'SOC 2', status: status(soc2), coverage: soc2 },
        { name: 'GDPR', status: status(gdpr), coverage: gdpr },
        { name: 'ISO 27001', status: status(iso), coverage: iso },
      ]);
    })().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="nexus-card flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" /> Compliance Frameworks
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {frameworks.map(fw => (
          <div key={fw.name} className="p-3 rounded-lg bg-secondary/30 border border-border/30 text-center">
            <p className="text-sm font-heading font-bold text-foreground">{fw.name}</p>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full nexus-gradient-bg transition-all" style={{ width: `${fw.coverage}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">{fw.coverage}%</span>
              <Badge variant="outline" className={`text-[11px] ${fw.status === 'compliant' ? 'border-nexus-emerald/30 text-nexus-emerald' : fw.status === 'partial' ? 'border-nexus-amber/30 text-nexus-amber' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                {fw.status === 'compliant' ? 'Conforme' : fw.status === 'partial' ? 'Parcial' : 'Planejado'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
