import { Database, Link2, GitBranch, Shield, Activity } from "lucide-react";

interface StatsProps {
  entityCount: number;
  connectionCount: number;
  connectedCount: number;
  totalRecords: number;
  joinCount: number;
  crossDbCount: number;
}

export function DataHubStats({ entityCount, connectionCount, connectedCount, totalRecords, joinCount, crossDbCount }: StatsProps) {
  const stats = [
    { label: "Entidades", value: entityCount, icon: Database, color: "text-primary" },
    { label: "Conexões Ativas", value: `${connectedCount}/${connectionCount}`, icon: Activity, color: "text-nexus-emerald" },
    { label: "Total Registros", value: totalRecords >= 0 ? totalRecords.toLocaleString() : "—", icon: Shield, color: "text-nexus-cyan" },
    { label: "Joins", value: joinCount, icon: GitBranch, color: "text-nexus-amber" },
    { label: "Cross-DB", value: crossDbCount, icon: Link2, color: "text-nexus-purple" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="nexus-card p-3 flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0`}>
              <Icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-heading font-bold text-foreground leading-tight">{s.value}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
