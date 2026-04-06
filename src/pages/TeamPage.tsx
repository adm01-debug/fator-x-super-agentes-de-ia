import { TableSkeleton } from "@/components/shared/PageSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Trash2, CheckCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceId } from "@/lib/agentService";
import { useAuth } from "@/contexts/AuthContext";
import { InviteMemberDialog } from "@/components/dialogs/InviteMemberDialog";
import { toast } from "sonner";
import { listMembers, removeMember, getPendingInvites, acceptInvite } from "@/services/teamsService";

const roleLabels: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer', operator: 'Operator', owner: 'Owner' };

export default function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ['workspace_members'],
    queryFn: async () => {
      const wsId = await getWorkspaceId();
      return listMembers(wsId);
    },
  });

  // Pending invitations for the current user
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['pending_invites', user?.email],
    queryFn: () => getPendingInvites(user!.email!),
    enabled: !!user?.email,
  });

  const handleAcceptInvite = async (memberId: string) => {
    try {
      await acceptInvite(memberId);
      toast.success('Convite aceito!');
      queryClient.invalidateQueries({ queryKey: ['workspace_members'] });
      queryClient.invalidateQueries({ queryKey: ['pending_invites'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aceitar convite');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const wsId = await getWorkspaceId();
      const member = members.find(m => m.id === memberId);
      if (member?.user_id) await removeMember(wsId, member.user_id);
      toast.success('Membro removido');
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Equipe & Papéis"
        description="Gerencie membros, papéis e permissões do workspace"
        actions={<InviteMemberDialog onInvited={() => refetch()} />}
      />

      {/* Pending invitations banner */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          {pendingInvites.map(invite => (
            <div key={invite.id}
              className="nexus-card border-primary/30 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">Convite pendente para um workspace</p>
                <p className="text-xs text-muted-foreground">Papel: {roleLabels[invite.role || 'editor'] || invite.role}</p>
              </div>
              <Button onClick={() => handleAcceptInvite(invite.id)} className="nexus-gradient-bg text-primary-foreground gap-1.5">
                <CheckCircle className="h-4 w-4" /> Aceitar
              </Button>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
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
                <th className="text-right px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
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
                  <td className="px-5 py-3 text-right">
                    {m.user_id !== user?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive gap-1">
                            <Trash2 className="h-3 w-3" /> Remover
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                            <AlertDialogDescription>O membro perderá acesso ao workspace.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => m.id && handleRemoveMember(m.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
