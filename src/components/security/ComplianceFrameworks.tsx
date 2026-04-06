import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSecurityPosture, listGuardrailPolicies, getAuditLog } from "@/services/securityService";

interface ComplianceEntry {
  name: string;
  status: 'compliant' | 'partial' | 'in_progress';
  coverage: number;
}

async function computeComplianceFrameworks(): Promise<ComplianceEntry[]> {
  let postureScore = 0;
  let hasGuardrails = false;
  let hasAuditLogs = false;

  try {
    const posture = await getSecurityPosture();
    const passCount = posture.filter(c => c.status === 'pass').length;
    postureScore = posture.length > 0 ? Math.round((passCount / posture.length) * 100) : 0;
  } catch { /* fallback */ }

  try {
    const guardrails = await listGuardrailPolicies();
    hasGuardrails = guardrails.some((g: { is_enabled: boolean }) => g.is_enabled);
  } catch { /* fallback */ }

  try {
    const logs = await getAuditLog({ limit: 1 });
    hasAuditLogs = logs.length > 0;
  } catch { /* fallback */ }

  const lgpdCoverage = Math.min(100, postureScore + (hasGuardrails ? 10 : 0));
  const gdprCoverage = Math.min(100, postureScore + (hasGuardrails ? 5 : 0));
  const soc2Coverage = Math.min(100, Math.round(postureScore * 0.8) + (hasAuditLogs ? 15 : 0));
  const isoCoverage = Math.min(100, Math.round(postureScore * 0.7) + (hasAuditLogs ? 10 : 0));

  return [
    { name: 'LGPD', status: lgpdCoverage >= 90 ? 'compliant' : lgpdCoverage >= 60 ? 'partial' : 'in_progress', coverage: lgpdCoverage },
    { name: 'SOC 2', status: soc2Coverage >= 90 ? 'compliant' : soc2Coverage >= 60 ? 'partial' : 'in_progress', coverage: soc2Coverage },
    { name: 'GDPR', status: gdprCoverage >= 90 ? 'compliant' : gdprCoverage >= 60 ? 'partial' : 'in_progress', coverage: gdprCoverage },
    { name: 'ISO 27001', status: isoCoverage >= 90 ? 'compliant' : isoCoverage >= 60 ? 'partial' : 'in_progress', coverage: isoCoverage },
  ];
}

export function ComplianceFrameworks() {
  const [frameworks, setFrameworks] = useState<ComplianceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    computeComplianceFrameworks()
      .then(setFrameworks)
      .catch(() => setFrameworks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="nexus-card flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
