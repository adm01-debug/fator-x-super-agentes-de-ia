import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Loader2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceId } from "@/lib/agentService";
import { InviteMemberDialog } from "@/components/dialogs/InviteMemberDialog";

const roleLabels: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer', operator: 'Operator', owner: 'Owner' };

export default function TeamPage() {
  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ['workspace_members'],
    queryFn: async () => {
      const wsId = await getWorkspaceId();
      const { data, error } = await supabase.from('workspace_members').select('*').eq('workspace_id', wsId);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Team & Roles"
        description="Gerencie membros, papéis e permissões do workspace"
        actions={<InviteMemberDialog onInvited={() => refetch()} />}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum membro</h2>
          <p className="text-sm text-muted-foreground">Convide membros para colaborar no workspace.</p>
        </div>
      ) : (
        <div className="nexus-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Membro</th>
                <th className="text-left px-5 py-3 font-medium">Papel</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full nexus-gradient-bg flex items-center justify-center text-xs font-semibold text-primary-foreground">
                        {(m.name || m.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.name || 'Sem nome'}</p>
                        <p className="text-[11px] text-muted-foreground">{m.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="nexus-badge-primary">{roleLabels[m.role || 'editor'] || m.role}</span></td>
                  <td className="px-5 py-3"><StatusBadge status={m.accepted_at ? 'active' : 'invited'} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
