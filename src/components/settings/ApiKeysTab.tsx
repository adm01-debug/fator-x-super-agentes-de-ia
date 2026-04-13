import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listMaskedSecrets, createWorkspaceSecret, deleteWorkspaceSecret, rotateWorkspaceSecret } from '@/services/settingsService';
import { getWorkspaceId } from '@/lib/agentService';
import { AccessControl, DangerousActionDialog } from '@/components/rbac';

export function ApiKeysTab() {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: secrets = [], isLoading: loadingSecrets } = useQuery({
    queryKey: ['workspace_secrets'],
    queryFn: async () => { const wsId = await getWorkspaceId(); return listMaskedSecrets(wsId); },
  });

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      if (!newKeyName.trim() || !newKeyValue.trim()) throw new Error('Nome e valor são obrigatórios');
      const wsId = await getWorkspaceId();
      await createWorkspaceSecret({ workspaceId: wsId, keyName: newKeyName.trim(), keyValue: newKeyValue.trim() });
    },
    onSuccess: () => { toast.success('API Key adicionada!'); setNewKeyName(''); setNewKeyValue(''); queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] }); },
    onError: (e: Error) => toast.error(e.message || 'Erro inesperado'),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: deleteWorkspaceSecret,
    onSuccess: () => { toast.success('API Key removida'); queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] }); },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async ({ id, newValue }: { id: string; newValue: string }) => { await rotateWorkspaceSecret(id, newValue); },
    onSuccess: () => { toast.success('API Key rotacionada com sucesso!'); setEditingKey(null); setEditValue(''); queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="nexus-card space-y-4">
      <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
      <p className="text-xs text-muted-foreground">Configure chaves de API para conectar modelos de IA e serviços externos.</p>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[11px]">Nome da chave</Label>
          <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="openrouter_api_key" className="bg-secondary/50 text-xs font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Valor</Label>
          <Input type="password" value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} placeholder="sk-..." className="bg-secondary/50 text-xs font-mono" />
        </div>
        <Button size="sm" onClick={() => addKeyMutation.mutate()} disabled={addKeyMutation.isPending} className="gap-1 nexus-gradient-bg text-primary-foreground">
          {addKeyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Adicionar
        </Button>
      </div>

      {loadingSecrets ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : secrets.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhuma API key configurada</p>
      ) : (
        <div className="space-y-2">
          {secrets.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-medium text-foreground">{s.key_name}</p>
                {editingKey === s.id ? (
                  <div className="flex gap-1.5 mt-1.5">
                    <Input type="password" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Novo valor..." className="bg-secondary/50 text-xs font-mono h-7" />
                    <Button size="sm" className="h-7 text-xs" onClick={() => rotateKeyMutation.mutate({ id: s.id, newValue: editValue })} disabled={rotateKeyMutation.isPending}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingKey(null); setEditValue(''); }}>Cancelar</Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{s.masked_value}</p>
                )}
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Atualizado: {new Date(s.updated_at ?? s.created_at ?? '').toLocaleDateString('pt-BR')}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Rotacionar" onClick={() => { setEditingKey(s.id); setEditValue(''); }}>
                <RotateCw className="h-3.5 w-3.5 text-nexus-amber" />
              </Button>
              <AccessControl permission="settings.api_keys">
                <DangerousActionDialog
                  trigger={<Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
                  title="Revogar API key"
                  description="A chave será permanentemente removida. Aplicações que dependem dela serão desautorizadas imediatamente."
                  action="revoke" resourceType="workspace_secret" resourceId={s.id} resourceName={s.key_name}
                  minReasonLength={10} confirmLabel="Revogar"
                  onConfirm={async () => { await deleteKeyMutation.mutateAsync(s.id); }}
                />
              </AccessControl>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-secondary/20 p-3 border border-border/30">
        <p className="text-[11px] text-muted-foreground">
          💡 <strong>Dica:</strong> Adicione <code className="font-mono">openrouter_api_key</code> para usar múltiplos modelos via OpenRouter,
          ou chaves específicas: <code className="font-mono">openai_api_key</code>, <code className="font-mono">anthropic_api_key</code>, <code className="font-mono">google_ai_api_key</code>
        </p>
      </div>
    </div>
  );
}
