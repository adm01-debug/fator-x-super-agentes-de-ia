import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField, SliderField } from '../ui';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Shield, ShieldAlert, ShieldCheck, Lock } from 'lucide-react';
import type { GuardrailConfig } from '@/types/agentTypes';

const DEFAULT_GUARDRAILS: GuardrailConfig[] = [
  // Input Validation
  { id: 'input_length', category: 'input_validation', name: 'Limite de Tamanho', description: 'Bloqueia inputs acima do limite configurado.', enabled: true, severity: 'block' },
  { id: 'input_injection', category: 'input_validation', name: 'Detecção de Injection', description: 'Detecta tentativas de prompt injection.', enabled: true, severity: 'block' },
  { id: 'input_language', category: 'input_validation', name: 'Filtro de Idioma', description: 'Restringe inputs a idiomas permitidos.', enabled: false, severity: 'warn' },
  { id: 'input_pii', category: 'input_validation', name: 'Detecção de PII', description: 'Detecta dados pessoais sensíveis no input.', enabled: false, severity: 'warn' },
  // Output Safety
  { id: 'output_toxicity', category: 'output_safety', name: 'Filtro de Toxicidade', description: 'Bloqueia respostas com conteúdo tóxico ou ofensivo.', enabled: true, severity: 'block' },
  { id: 'output_hallucination', category: 'output_safety', name: 'Detecção de Alucinação', description: 'Verifica se a resposta é fundamentada nas fontes.', enabled: true, severity: 'warn' },
  { id: 'output_format', category: 'output_safety', name: 'Validação de Formato', description: 'Garante que a saída segue o schema definido.', enabled: false, severity: 'warn' },
  { id: 'output_length', category: 'output_safety', name: 'Limite de Saída', description: 'Restringe o tamanho máximo da resposta.', enabled: true, severity: 'log' },
  // Access Control
  { id: 'access_auth', category: 'access_control', name: 'Autenticação Obrigatória', description: 'Exige token válido para interagir.', enabled: true, severity: 'block' },
  { id: 'access_rate_limit', category: 'access_control', name: 'Rate Limiting', description: 'Limita requisições por usuário/minuto.', enabled: true, severity: 'block' },
  { id: 'access_domain', category: 'access_control', name: 'Restrição de Domínio', description: 'Permite acesso apenas de domínios autorizados.', enabled: false, severity: 'block' },
  // Operational
  { id: 'op_budget', category: 'operational', name: 'Budget por Sessão', description: 'Limita tokens/custo por sessão.', enabled: true, severity: 'block' },
  { id: 'op_loop_detect', category: 'operational', name: 'Detecção de Loop', description: 'Detecta e interrompe loops de raciocínio.', enabled: true, severity: 'block' },
  { id: 'op_tool_approval', category: 'operational', name: 'Aprovação de Ferramentas', description: 'Exige aprovação para ferramentas críticas.', enabled: false, severity: 'warn' },
];

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  input_validation: { icon: <Shield className="h-4 w-4" />, label: 'Validação de Input', color: 'blue' },
  output_safety: { icon: <ShieldAlert className="h-4 w-4" />, label: 'Segurança de Output', color: 'orange' },
  access_control: { icon: <Lock className="h-4 w-4" />, label: 'Controle de Acesso', color: 'purple' },
  operational: { icon: <ShieldCheck className="h-4 w-4" />, label: 'Operacional', color: 'green' },
};

const SEVERITY_OPTIONS = [
  { value: 'block', label: '🚫 Bloquear' },
  { value: 'warn', label: '⚠️ Alertar' },
  { value: 'log', label: '📝 Registrar' },
];

export function GuardrailsModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  const guardrails = agent.guardrails.length > 0 ? agent.guardrails : DEFAULT_GUARDRAILS;

  const updateGuardrail = (id: string, partial: Partial<GuardrailConfig>) => {
    const updated = guardrails.map((g) => (g.id === id ? { ...g, ...partial } : g));
    updateAgent({ guardrails: updated });
  };

  const addBlockedTopic = () => {
    updateAgent({ blocked_topics: [...agent.blocked_topics, ''] });
  };

  const removeBlockedTopic = (idx: number) => {
    updateAgent({ blocked_topics: agent.blocked_topics.filter((_, i) => i !== idx) });
  };

  const updateBlockedTopic = (idx: number, value: string) => {
    const updated = [...agent.blocked_topics];
    updated[idx] = value;
    updateAgent({ blocked_topics: updated });
  };

  const addDomain = () => {
    updateAgent({ allowed_domains: [...agent.allowed_domains, ''] });
  };

  const removeDomain = (idx: number) => {
    updateAgent({ allowed_domains: agent.allowed_domains.filter((_, i) => i !== idx) });
  };

  const updateDomain = (idx: number, value: string) => {
    const updated = [...agent.allowed_domains];
    updated[idx] = value;
    updateAgent({ allowed_domains: updated });
  };

  const categories = ['input_validation', 'output_safety', 'access_control', 'operational'] as const;
  const enabledCount = guardrails.filter((g) => g.enabled).length;

  return (
    <div className="space-y-10">
      {/* Resumo */}
      <section>
        <SectionTitle
          icon="🛡️"
          title="Guardrails & Segurança"
          subtitle="Defina limites e proteções para o comportamento do agente."
          badge={<NexusBadge color="green">{enabledCount}/{guardrails.length} ativos</NexusBadge>}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const catGuardrails = guardrails.filter((g) => g.category === cat);
            const active = catGuardrails.filter((g) => g.enabled).length;
            return (
              <div key={cat} className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="flex justify-center mb-2 text-muted-foreground">{meta.icon}</div>
                <p className="text-xs font-medium text-foreground">{active}/{catGuardrails.length}</p>
                <p className="text-[11px] text-muted-foreground">{meta.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Guardrails por categoria */}
      {categories.map((cat) => {
        const meta = CATEGORY_META[cat];
        const catGuardrails = guardrails.filter((g) => g.category === cat);
        return (
          <section key={cat}>
            <SectionTitle
              icon={cat === 'input_validation' ? '🔍' : cat === 'output_safety' ? '🔒' : cat === 'access_control' ? '🔐' : '⚙️'}
              title={meta.label}
              subtitle={`${catGuardrails.filter((g) => g.enabled).length} de ${catGuardrails.length} ativos`}
            />
            <div className="space-y-2">
              {catGuardrails.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all ${
                    g.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/20 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ToggleField
                      label=""
                      checked={g.enabled}
                      onCheckedChange={(v) => updateGuardrail(g.id, { enabled: v })}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{g.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{g.description}</p>
                    </div>
                  </div>
                  <select
                    value={g.severity}
                    onChange={(e) => updateGuardrail(g.id, { severity: e.target.value as GuardrailConfig['severity'] })}
                    className="ml-3 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground"
                    disabled={!g.enabled}
                  >
                    {SEVERITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Limites Globais */}
      <section>
        <SectionTitle icon="📏" title="Limites Globais" subtitle="Configurações de tamanho e orçamento aplicadas globalmente." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SliderField
            label="Tamanho Máximo de Input"
            value={agent.input_max_length}
            onChange={(v) => updateAgent({ input_max_length: v })}
            min={100}
            max={32000}
            step={100}
            unit=" chars"
          />
          <SliderField
            label="Tamanho Máximo de Output"
            value={agent.output_max_length}
            onChange={(v) => updateAgent({ output_max_length: v })}
            min={100}
            max={32000}
            step={100}
            unit=" chars"
          />
          <SliderField
            label="Budget de Tokens por Sessão"
            value={agent.token_budget_per_session}
            onChange={(v) => updateAgent({ token_budget_per_session: v })}
            min={1000}
            max={500000}
            step={1000}
            unit=" tokens"
          />
        </div>
      </section>

      {/* Tópicos Bloqueados */}
      <section>
        <SectionTitle
          icon="🚫"
          title="Tópicos Bloqueados"
          subtitle="Assuntos que o agente não deve discutir."
          badge={<NexusBadge color="red">{agent.blocked_topics.length}</NexusBadge>}
        />
        <div className="space-y-2">
          {agent.blocked_topics.map((topic, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                value={topic}
                onChange={(e) => updateBlockedTopic(idx, e.target.value)}
                placeholder="Ex: política, religião, investimentos financeiros"
              />
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeBlockedTopic(idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addBlockedTopic} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Tópico
          </Button>
        </div>
      </section>

      {/* Domínios Permitidos */}
      <section>
        <SectionTitle
          icon="🌐"
          title="Domínios Permitidos"
          subtitle="Domínios de onde o agente pode acessar ou aceitar requisições."
          badge={<NexusBadge color="blue">{agent.allowed_domains.length}</NexusBadge>}
        />
        <div className="space-y-2">
          {agent.allowed_domains.map((domain, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                value={domain}
                onChange={(e) => updateDomain(idx, e.target.value)}
                placeholder="Ex: *.empresa.com, api.exemplo.com"
              />
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeDomain(idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addDomain} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Domínio
          </Button>
        </div>
      </section>
    </div>
  );
}
