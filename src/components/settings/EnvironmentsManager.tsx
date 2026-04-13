import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { AccessControl, DangerousActionDialog } from "@/components/rbac";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listEnvironments, createEnvironment, deleteEnvironment } from "@/services/settingsService";
import { getWorkspaceId } from "@/lib/agentService";
import { environmentSchema } from "@/lib/validations/agentSchema";

export function EnvironmentsManager() {
  const queryClient = useQueryClient();
  const [newEnvName, setNewEnvName] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: environments = [], isLoading } = useQuery({
    queryKey: ['environments'],
    queryFn: async () => {
      const wsId = await getWorkspaceId();
      return listEnvironments(wsId);
    },
  });

  const handleCreate = async () => {
    const result = environmentSchema.safeParse({ name: newEnvName });
    if (!result.success) { toast.error(result.error.errors[0]?.message || 'Nome inválido'); return; }
    setCreating(true);
    const wsId = await getWorkspaceId();
    await createEnvironment(wsId, newEnvName);
    setNewEnvName('');
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ['environments'] });
    toast.success('Ambiente criado');
  };

  const handleDelete = async (id: string) => {
    await deleteEnvironment(id);
    queryClient.invalidateQueries({ queryKey: ['environments'] });
    toast.success('Ambiente removido');
  };

  return (
    <div className="nexus-card space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Ambientes de Deploy</h3>
      <p className="text-xs text-muted-foreground">Gerencie ambientes (development, staging, production) para isolamento de configurações.</p>
      <div className="flex gap-2">
        <Input value={newEnvName} onChange={e => setNewEnvName(e.target.value)} placeholder="Ex: staging" className="bg-secondary/50 text-xs" />
        <Button size="sm" onClick={handleCreate} disabled={creating}>Criar</Button>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : (
        <div className="space-y-2">
          {environments.map((env) => (
            <div key={env.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
              <div>
                <p className="text-sm font-medium text-foreground">{env.name}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(String(env.created_at)).toLocaleDateString('pt-BR')}</p>
              </div>
              <AccessControl permission="settings.write">
                <DangerousActionDialog
                  trigger={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
                  title="Excluir ambiente"
                  description="O ambiente será removido. Configurações vinculadas a ele precisarão ser reatribuídas."
                  action="delete" resourceType="environment" resourceId={String(env.id)} resourceName={env.name} minReasonLength={8}
                  onConfirm={async () => { await handleDelete(String(env.id)); }}
                />
              </AccessControl>
            </div>
          ))}
          {environments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum ambiente criado. Padrão: development.</p>}
        </div>
      )}
    </div>
  );
}
