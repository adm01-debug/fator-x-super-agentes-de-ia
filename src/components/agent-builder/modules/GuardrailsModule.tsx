import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField, SliderField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Shield, ShieldAlert, ShieldCheck, Lock } from 'lucide-react';
import type { GuardrailConfig } from '@/types/agentTypes';

const DEFAULT_GUARDRAILS: GuardrailConfig[] = [
  // Input Validation (5)
  { id: 'input_injection', category: 'input_validation', name: 'Prompt Injection Detection', description: 'Detecta tentativas de prompt injection e jailbreak.', enabled: true, severity: 'block' },
  { id: 'input_pii', category: 'input_validation', name: 'PII Redaction', description: 'Detecta e mascara dados pessoais sensíveis (CPF, email, telefone).', enabled: false, severity: 'block' },
  { id: 'input_classification', category: 'input_validation', name: 'Content Classification', description: 'Classifica o conteúdo do input por categoria e nível de risco.', enabled: false, severity: 'warn' },
  { id: 'input_rate_limit', category: 'input_validation', name: 'Rate Limiting', description: 'Limita requisições por usuário/minuto para prevenir abuso.', enabled: true, severity: 'block' },
  { id: 'input_sanitization', category: 'input_validation', name: 'Input Sanitization', description: 'Sanitiza inputs removendo caracteres e padrões perigosos.', enabled: true, severity: 'block' },
  // Output Safety (5)
  { id: 'output_toxicity', category: 'output_safety', name: 'Toxicity Filter', description: 'Bloqueia respostas com conteúdo tóxico, ofensivo ou discriminatório.', enabled: true, severity: 'block' },
  { id: 'output_hallucination', category: 'output_safety', name: 'Hallucination Detection', description: 'Verifica se a resposta é fundamentada nas fontes disponíveis.', enabled: true, severity: 'warn' },
  { id: 'output_factcheck', category: 'output_safety', name: 'Fact-checking Pipeline', description: 'Valida fatos citados contra fontes confiáveis antes de entregar.', enabled: false, severity: 'warn' },
  { id: 'output_bias', category: 'output_safety', name: 'Bias Detection', description: 'Detecta viés discriminatório ou tendencioso nas respostas.', enabled: false, severity: 'log' },
  { id: 'output_copyright', category: 'output_safety', name: 'Copyright Check', description: 'Verifica se a resposta não reproduz conteúdo protegido por direitos autorais.', enabled: false, severity: 'warn' },
  // Access Control (5)
  { id: 'access_auth', category: 'access_control', name: 'Zero Trust OAuth', description: 'Exige autenticação OAuth válida para cada interação.', enabled: true, severity: 'block' },
  { id: 'access_identity', category: 'access_control', name: 'Agent Identity Management', description: 'Gerencia identidade e credenciais do agente de forma segura.', enabled: true, severity: 'block' },
  { id: 'access_jit', category: 'access_control', name: 'Just-in-Time Provisioning', description: 'Provisiona permissões temporárias sob demanda, revogando após uso.', enabled: false, severity: 'block' },
  { id: 'access_audit', category: 'access_control', name: 'Action Audit Trail', description: 'Registra cada ação executada para auditoria completa.', enabled: true, severity: 'log' },
  { id: 'access_scope', category: 'access_control', name: 'Scope Limitation', description: 'Limita ações estritamente ao escopo definido do agente.', enabled: true, severity: 'block' },
  // Operational (5)
  { id: 'op_budget', category: 'operational', name: 'Token Budget Limits', description: 'Limita consumo de tokens e custo por sessão.', enabled: true, severity: 'block' },
  { id: 'op_timeout', category: 'operational', name: 'Timeout Controls', description: 'Controla timeouts de execução, resposta e ferramentas.', enabled: true, severity: 'block' },
  { id: 'op_fallback', category: 'operational', name: 'Fallback Strategies', description: 'Define estratégias de fallback automáticas em caso de falha.', enabled: false, severity: 'warn' },
  { id: 'op_human_gate', category: 'operational', name: 'Human-in-the-Loop Gates', description: 'Exige aprovação humana para ações sensíveis ou de alto risco.', enabled: false, severity: 'block' },
  { id: 'op_kill_switch', category: 'operational', name: 'Emergency Kill Switch', description: 'Botão de emergência para parar o agente imediatamente.', enabled: true, severity: 'block' },
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
                <p className="text-[10px] text-muted-foreground">{meta.label}</p>
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

      {/* Seção E — Governança Forense (Gap Gemini #5) */}
      <section>
        <SectionTitle icon="🔬" title="Governança Forense" subtitle="Auditoria avançada para compliance enterprise" badge={<NexusBadge color="purple">Avançado</NexusBadge>} />
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <ToggleField
            label="Forensic Snapshots"
            description="Grava estado completo (contexto, memória, dados, decisão) em cada ação autônoma com hash SHA-256 imutável. Essencial para auditoria legal."
            checked={agent.logging_enabled}
            onCheckedChange={(v) => updateAgent({ logging_enabled: v })}
          />
          <ToggleField
            label="Pre-execution Plan Validation"
            description="Antes de executar qualquer ação sensível, valida o plano completo contra regras de compliance. Bloqueia se violar políticas."
            checked={agent.guardrails.some(g => g.id === 'access_scope' && g.enabled)}
            onCheckedChange={() => {}}
          />
          <ToggleField
            label="Audit Trail Completo"
            description="Registra TODA ação do agente (leitura, escrita, tool call) com timestamp, contexto e resultado."
            checked={agent.guardrails.some(g => g.id === 'access_audit' && g.enabled)}
            onCheckedChange={() => {}}
          />
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Forensic Snapshot</strong> grava: input do usuário, memórias consultadas, chunks RAG recuperados, prompt montado, resposta do LLM, tools chamadas, guardrails acionados, hash SHA-256 do estado completo. Imutável para auditoria.
          </div>
        </div>
      </section>
    </div>
  );
}
