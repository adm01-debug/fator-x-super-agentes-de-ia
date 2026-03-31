import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { teamMembers } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

const roleLabels: Record<string, string> = { owner: 'Owner', admin: 'Admin', engineer: 'Engineer', analyst: 'Analyst', viewer: 'Viewer' };

export default function TeamPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Team & Roles"
        description="Gerencie membros, papéis e permissões do workspace"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><UserPlus className="h-4 w-4" /> Convidar</Button>}
      />

      <div className="nexus-card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Membro</th>
              <th className="text-left px-5 py-3 font-medium">Papel</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Último acesso</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((m, i) => (
              <tr key={m.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full nexus-gradient-bg flex items-center justify-center text-xs font-semibold text-primary-foreground">{m.avatar}</div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3"><span className="nexus-badge-primary">{roleLabels[m.role]}</span></td>
                <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{m.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
