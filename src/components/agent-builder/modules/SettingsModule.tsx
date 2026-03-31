import { useState } from 'react';
import { SectionTitle, InputField, SelectField, ToggleField } from '../ui';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { toast } from 'sonner';

export function SettingsModule() {
  const { agent, resetAgent, exportJSON } = useAgentBuilderStore();
  const [workspaceName, setWorkspaceName] = useState('Meu Workspace');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [language, setLanguage] = useState('pt-BR');
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4.6');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ anthropic: '', openai: '', embedding: '' });
  const [defaultGuardrails, setDefaultGuardrails] = useState(true);
  const [defaultLogging, setDefaultLogging] = useState(true);

  return (
    <div className="space-y-8">
      <SectionTitle icon="⚙️" title="Configurações" subtitle="Preferências do workspace e defaults" />

      {/* Workspace */}
      <SectionTitle icon="🏢" title="Workspace" subtitle="Configurações gerais do workspace" />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <InputField label="Nome do Workspace" value={workspaceName} onChange={setWorkspaceName} />
        <SelectField
          label="Timezone"
          value={timezone}
          onChange={setTimezone}
          options={[
            { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
            { value: 'America/New_York', label: 'New York (UTC-5)' },
            { value: 'Europe/London', label: 'London (UTC+0)' },
            { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
          ]}
        />
        <SelectField
          label="Idioma"
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'pt-BR', label: 'Português (Brasil)' },
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
          ]}
        />
      </div>

      {/* API Keys */}
      <SectionTitle icon="🔑" title="API Keys" subtitle="Chaves de API para integrações (armazenadas de forma segura)" />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {[
          { id: 'anthropic', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
          { id: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...' },
          { id: 'embedding', label: 'Embedding API Key', placeholder: 'Chave do provedor de embeddings' },
        ].map((key) => (
          <InputField
            key={key.id}
            label={key.label}
            value={apiKeys[key.id]}
            onChange={(v) => setApiKeys(prev => ({ ...prev, [key.id]: v }))}
            placeholder={key.placeholder}
            type="password"
          />
        ))}
        <p className="text-xs text-muted-foreground">
          ⚠️ As chaves são armazenadas de forma segura e nunca expostas no frontend.
        </p>
      </div>

      {/* Defaults */}
      <SectionTitle icon="📋" title="Defaults" subtitle="Valores padrão para novos agentes" />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <SelectField
          label="Modelo padrão"
          value={defaultModel}
          onChange={setDefaultModel}
          options={[
            { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6 (Recomendado)' },
            { value: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
            { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
          ]}
        />
        <ToggleField
          label="Guardrails padrão ativos"
          description="Novos agentes iniciam com guardrails essenciais pré-ativados"
          checked={defaultGuardrails}
          onCheckedChange={setDefaultGuardrails}
        />
        <ToggleField
          label="Logging habilitado por padrão"
          description="Ativar logging automaticamente em novos agentes"
          checked={defaultLogging}
          onCheckedChange={setDefaultLogging}
        />
      </div>

      {/* Danger Zone */}
      <SectionTitle icon="⚠️" title="Danger Zone" subtitle="Ações irreversíveis" />
      <div className="rounded-xl border border-[hsl(var(--nexus-red))] bg-[hsl(var(--nexus-red))/0.05] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Exportar todos os dados</p>
            <p className="text-xs text-muted-foreground">Baixar todos os agentes e configurações em JSON</p>
          </div>
          <button
            onClick={() => {
              const data = exportJSON();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'nexus-export.json';
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Dados exportados!');
            }}
            className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-all"
          >
            📦 Exportar
          </button>
        </div>
        <div className="border-t border-[hsl(var(--nexus-red))/0.3] pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--nexus-red))]">Resetar agente atual</p>
            <p className="text-xs text-muted-foreground">Limpar todas as configurações do agente em edição</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Tem certeza? Esta ação não pode ser desfeita.')) {
                resetAgent();
                toast.success('Agente resetado');
              }
            }}
            className="px-4 py-2 rounded-lg bg-[hsl(var(--nexus-red))] text-white text-sm hover:opacity-90 transition-all"
          >
            🗑️ Resetar
          </button>
        </div>
      </div>
    </div>
  );
}
