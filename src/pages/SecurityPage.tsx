import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { SecurityPosture } from "@/components/security/SecurityPosture";
import { ComplianceFrameworks } from "@/components/security/ComplianceFrameworks";
import { GuardrailPolicies } from "@/components/security/GuardrailPolicies";
import { SessionManagement } from "@/components/security/SessionManagement";
import { RateLimitingPanel } from "@/components/security/RateLimitingPanel";
import { AuditLogSection } from "@/components/security/AuditLogSection";
import { GuardrailsConfig } from "@/components/agent-builder/GuardrailsConfig";
import { listApiKeys, createApiKey, revokeApiKey } from '@/services/securityService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Key, Plus, Trash2, Loader2, Copy } from 'lucide-react';
import { AccessControl, DangerousActionDialog } from '@/components/rbac';
import { toast } from 'sonner';
import { RedTeamingPanel } from '@/components/security/RedTeamingPanel';
import { PIIScannerPanel } from '@/components/security/PIIScannerPanel';
import { TwoFactorSetup } from '@/components/security/TwoFactorSetup';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
}

function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

  useEffect(() => { loadKeys(); }, []);

  async function loadKeys() {
    try { setKeys(await listApiKeys() as ApiKey[]); } catch { /* table might not exist */ }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const result = await createApiKey(newKeyName.trim());
      setNewRawKey(result.raw_key);
      setNewKeyName('');
      await loadKeys();
      toast.success('API Key criada');
    } catch {
      toast.error('Falha ao criar API Key');
    }
    setCreating(false);
  }

  async function handleRevoke(id: string) {
    try {
      await revokeApiKey(id);
      await loadKeys();
      toast.success('API Key revogada');
    } catch { toast.error('Falha ao revogar'); }
  }

  return (
    <div className="nexus-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">API Keys</h3>
          <Badge variant="outline" className="text-[10px]">{keys.length} ativas</Badge>
        </div>
      </div>

      {newRawKey && (
        <div className="bg-nexus-emerald/10 border border-nexus-emerald/30 rounded-lg p-3 text-xs">
          <p className="text-nexus-emerald font-bold mb-1">🔑 Nova API Key (copie agora — não será exibida novamente):</p>
          <div className="flex items-center gap-2">
            <code className="bg-secondary px-2 py-1 rounded font-mono text-nexus-emerald flex-1 truncate">{newRawKey}</code>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(newRawKey); toast.success('Copiada!'); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Nome da key (ex: Widget Produção)" className="bg-secondary/50 border-border/50 text-xs h-8" />
        <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()} size="sm" className="h-8">
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-4">Carregando...</div>
      ) : keys.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 bg-secondary/30 rounded-lg">Nenhuma API Key criada.</div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="bg-secondary/30 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">{k.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[10px] text-muted-foreground font-mono">{k.key_prefix}...****</code>
                  <Badge variant="outline" className={`text-[8px] ${k.is_active ? 'border-nexus-emerald text-nexus-emerald' : 'border-destructive text-destructive'}`}>
                    {k.is_active ? 'Ativa' : 'Revogada'}
                  </Badge>
                </div>
              </div>
              {k.is_active && (
                <AccessControl permission="settings.api_keys">
                  <DangerousActionDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive h-7">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    }
                    title="Revogar API key"
                    description="A chave será imediatamente revogada. Aplicações que dependem dela perderão acesso instantaneamente."
                    action="revoke"
                    resourceType="api_key"
                    resourceId={k.id}
                    resourceName={k.name ?? k.key_prefix}
                    minReasonLength={10}
                    requirePassword={true}
                    confirmLabel="Revogar Chave"
                    metadata={{ key_prefix: k.key_prefix }}
                    onConfirm={async () => {
                      await handleRevoke(k.id);
                    }}
                  />
                </AccessControl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="Segurança & Guardrails" description="Segurança, compliance e governança dos agentes de IA" />
      <InfoHint title="Segurança em camadas">
        A segurança opera em múltiplas camadas: autenticação, criptografia, mascaramento de dados, detecção de jailbreak, rate limiting, audit logging e guardrails customizados por agente.
      </InfoHint>

      <SecurityPosture />
      <TwoFactorSetup />
      <ApiKeysPanel />
      <GuardrailsConfig />
      <ComplianceFrameworks />
      <GuardrailPolicies />
      <SessionManagement />
      <RateLimitingPanel />
      <AuditLogSection />
      <PIIScannerPanel />
      <RedTeamingPanel />
    </div>
  );
}
