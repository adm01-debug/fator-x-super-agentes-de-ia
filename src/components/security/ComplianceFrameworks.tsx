import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const complianceFrameworks = [
  { name: 'LGPD', status: 'compliant', coverage: 92 },
  { name: 'SOC 2', status: 'partial', coverage: 78 },
  { name: 'GDPR', status: 'compliant', coverage: 88 },
  { name: 'ISO 27001', status: 'in_progress', coverage: 65 },
];

export function ComplianceFrameworks() {
  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" /> Compliance Frameworks
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {complianceFrameworks.map(fw => (
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
