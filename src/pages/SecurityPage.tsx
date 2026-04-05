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
import { listApiKeys, createApiKey, revokeApiKey, getSecurityEvents } from '@/services/securityService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Key, Plus, Trash2, Shield, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';

function ApiKeysPanel() {
  const [keys, setKeys] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

  useEffect(() => { loadKeys(); }, []);

  async function loadKeys() {
    try { setKeys(await listApiKeys()); } catch { /* table might not exist */ }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const result = await createApiKey(newKeyName.trim());
      setNewRawKey((result as Record<string, string>).raw_key);
      setNewKeyName('');
      await loadKeys();
      toast.success('API Key criada');
    } catch (err) {
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
          <Key className="w-5 h-5 text-[#FFD93D]" />
          <h3 className="text-sm font-bold text-white">API Keys</h3>
          <Badge variant="outline" className="text-[10px]">{keys.length} ativas</Badge>
        </div>
      </div>

      {newRawKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-xs">
          <p className="text-green-400 font-bold mb-1">🔑 Nova API Key (copie agora — não será exibida novamente):</p>
          <div className="flex items-center gap-2">
            <code className="bg-[#0a0a1a] px-2 py-1 rounded font-mono text-green-300 flex-1 truncate">{newRawKey}</code>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(newRawKey); toast.success('Copiada!'); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Nome da key (ex: Widget Produção)" className="bg-[#0a0a1a] border-[#222244] text-xs h-8" />
        <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()} size="sm" className="h-8">
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-[#888888] text-center py-4">Carregando...</div>
      ) : keys.length === 0 ? (
        <div className="text-xs text-[#888888] text-center py-6 bg-[#0a0a1a] rounded-lg">Nenhuma API Key criada.</div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={String(k.id)} className="bg-[#0a0a1a] rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-white">{String(k.name)}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[10px] text-[#888888] font-mono">{String(k.key_prefix)}...****</code>
                  <Badge variant="outline" className={`text-[8px] ${k.is_active ? 'border-[#6BCB77] text-[#6BCB77]' : 'border-[#FF6B6B] text-[#FF6B6B]'}`}>
                    {k.is_active ? 'Ativa' : 'Revogada'}
                  </Badge>
                </div>
              </div>
              {k.is_active && (
                <Button variant="ghost" size="sm" className="text-red-400 h-7" onClick={() => handleRevoke(String(k.id))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
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
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Security & Guardrails" description="Segurança, compliance e governança dos agentes de IA" />
      <InfoHint title="Segurança em camadas">
        A segurança opera em múltiplas camadas: autenticação, criptografia, mascaramento de dados, detecção de jailbreak, rate limiting, audit logging e guardrails customizados por agente.
      </InfoHint>

      <SecurityPosture />
      <ApiKeysPanel />
      <GuardrailsConfig />
      <ComplianceFrameworks />
      <GuardrailPolicies />
      <SessionManagement />
      <RateLimitingPanel />
      <AuditLogSection />
    </div>
  );
}
