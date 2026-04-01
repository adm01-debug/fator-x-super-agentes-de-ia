import { useState, useEffect } from 'react';
import { SectionTitle } from '../ui';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceId } from '@/lib/agentService';
import { Button } from '@/components/ui/button';
import { Check, AlertTriangle, Loader2 } from 'lucide-react';

const API_KEYS = [
  { key_name: 'anthropic_api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...', description: 'Para modelos Claude (Opus, Sonnet, Haiku)' },
  { key_name: 'openai_api_key', label: 'OpenAI API Key', placeholder: 'sk-...', description: 'Para modelos GPT' },
  { key_name: 'openrouter_api_key', label: 'OpenRouter API Key', placeholder: 'sk-or-...', description: 'Acesso a 200+ modelos com uma única key. Recomendado para o ORÁCULO.' },
  { key_name: 'google_ai_api_key', label: 'Google AI API Key', placeholder: 'AIza...', description: 'Para modelos Gemini' },
];

function maskKey(value: string): string {
  if (!value || value.length < 8) return value;
  return value.slice(0, 6) + '...' + value.slice(-4);
}

export function SettingsModule() {
  const { resetAgent, exportJSON } = useAgentBuilderStore();
  const [keys, setKeys] = useState<Record<string, { value: string; saved: boolean }>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const wsId = await getWorkspaceId();
      const { data } = await supabase
        .from('workspace_secrets')
        .select('key_name, key_value')
        .eq('workspace_id', wsId);
      const map: Record<string, { value: string; saved: boolean }> = {};
      for (const row of data || []) {
        map[row.key_name] = { value: row.key_value, saved: true };
      }
      setKeys(map);
    } catch {
      // No workspace yet
    } finally {
      setLoading(false);
    }
  }

  async function saveKey(keyName: string) {
    setSaving(true);
    try {
      const wsId = await getWorkspaceId();
      const existing = keys[keyName];
      if (existing?.saved) {
        await supabase.from('workspace_secrets').update({ key_value: editValue, updated_at: new Date().toISOString() })
          .eq('workspace_id', wsId).eq('key_name', keyName);
      } else {
        await supabase.from('workspace_secrets').insert({ workspace_id: wsId, key_name: keyName, key_value: editValue });
      }
      setKeys(prev => ({ ...prev, [keyName]: { value: editValue, saved: true } }));
      setEditingKey(null);
      setEditValue('');
      toast.success('API Key salva com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar key');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle icon="⚙️" title="Configurações" subtitle="Preferências do workspace e API keys" />

      {/* API Keys */}
      <SectionTitle icon="🔑" title="API Keys" subtitle="Chaves de API para integrações (armazenadas de forma segura)" />
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          API_KEYS.map(({ key_name, label, placeholder, description }) => {
            const stored = keys[key_name];
            const isEditing = editingKey === key_name;

            return (
              <div key={key_name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{description}</p>
                  </div>
                  {stored?.saved ? (
                    <span className="flex items-center gap-1 text-xs text-nexus-emerald"><Check className="h-3.5 w-3.5" /> Configurada</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-nexus-amber"><AlertTriangle className="h-3.5 w-3.5" /> Não configurada</span>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={placeholder}
                      className="flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
                    />
                    <Button size="sm" onClick={() => saveKey(key_name)} disabled={saving || !editValue}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingKey(null); setEditValue(''); }}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-muted-foreground font-mono bg-secondary/30 px-3 py-2 rounded-lg">
                      {stored?.saved ? maskKey(stored.value) : '—'}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => { setEditingKey(key_name); setEditValue(''); }}>
                      {stored?.saved ? 'Editar' : 'Adicionar'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}

        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Dica:</strong> O OpenRouter permite acessar 200+ modelos (Claude, GPT, Gemini, Llama, Mistral...) com uma única API key.
            Recomendado para o Oráculo (Multi-LLM Council). Obtenha em: <a href="https://openrouter.ai" target="_blank" rel="noopener" className="text-primary underline">openrouter.ai</a>
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <SectionTitle icon="⚠️" title="Danger Zone" subtitle="Ações irreversíveis" />
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Exportar todos os dados</p>
            <p className="text-xs text-muted-foreground">Baixar configuração do agente atual em JSON</p>
          </div>
          <button
            onClick={() => {
              const data = exportJSON();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'nexus-export.json'; a.click();
              URL.revokeObjectURL(url);
              toast.success('Dados exportados!');
            }}
            className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-all"
          >
            📦 Exportar
          </button>
        </div>
        <div className="border-t border-destructive/20 pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-destructive">Resetar agente atual</p>
            <p className="text-xs text-muted-foreground">Limpar todas as configurações do agente em edição</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Tem certeza? Esta ação não pode ser desfeita.')) {
                resetAgent();
                toast.success('Agente resetado');
              }
            }}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm hover:opacity-90 transition-all"
          >
            🗑️ Resetar
          </button>
        </div>
      </div>
    </div>
  );
}
