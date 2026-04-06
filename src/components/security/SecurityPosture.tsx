import { useState, useEffect } from "react";
import { Lock, Key, Eye, UserX, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { getSecurityPosture } from "@/services/securityService";

const iconMap: Record<string, typeof Lock> = {
  tls: Lock,
  api_keys: Key,
  pii: Eye,
  jailbreak: UserX,
  guardrails: ShieldAlert,
  audit: ShieldCheck,
};

interface PostureCheck {
  id: string;
  title: string;
  desc: string;
  status: 'pass' | 'warn';
}

export function SecurityPosture() {
  const [checks, setChecks] = useState<PostureCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSecurityPosture()
      .then(setChecks)
      .catch(() => setChecks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="nexus-card flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const passCount = checks.filter(c => c.status === 'pass').length;
  const totalCount = checks.length;
  const overallScore = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Postura de Seguranca
        </h3>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${overallScore >= 80 ? 'bg-nexus-emerald/10 text-nexus-emerald' : overallScore >= 50 ? 'bg-nexus-amber/10 text-nexus-amber' : 'bg-destructive/10 text-destructive'}`}>
          {overallScore}% ({passCount}/{totalCount})
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {checks.map((check) => {
          const Icon = iconMap[check.id] || ShieldCheck;
          return (
            <div key={check.id}
              className="p-3 rounded-lg bg-secondary/30 border border-border/30 flex items-start gap-3"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${check.status === 'pass' ? 'bg-nexus-emerald/10' : 'bg-nexus-amber/10'}`}>
                <Icon className={`h-4 w-4 ${check.status === 'pass' ? 'text-nexus-emerald' : 'text-nexus-amber'}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-foreground">{check.title}</p>
                  {check.status === 'pass' ? <CheckCircle className="h-3 w-3 text-nexus-emerald" /> : <AlertTriangle className="h-3 w-3 text-nexus-amber" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{check.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
