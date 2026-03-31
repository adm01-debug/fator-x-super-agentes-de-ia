import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField, SliderField, InputField, SelectField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrchestrationPattern, SubAgentRef } from '@/types/agentTypes';

interface OrchPatternInfo {
  id: OrchestrationPattern;
  icon: string;
  title: string;
  description: string;
  diagram: string;
  complexity: string;
  cost: string;
  recommended_for: string;
  not_for: string;
}

const ORCHESTRATION_PATTERNS: OrchPatternInfo[] = [
  { id: 'single', icon: '🎯', title: 'Single Agent', description: 'Um agente centralizado faz tudo. Simples, eficaz para escopo limitado.', diagram: 'User → 🤖 Agent → [Tools] → Response', complexity: 'Baixa', cost: 'Baixo', recommended_for: 'Escopo < 10 tools, domínio único', not_for: 'Múltiplos domínios, alta complexidade' },
  { id: 'sequential', icon: '🔗', title: 'Pipeline Sequencial', description: 'Agentes em cadeia, cada um processa e passa adiante. Como linha de montagem.', diagram: 'User → 🤖A → 🤖B → 🤖C → Response', complexity: 'Média', cost: 'Médio (N chamadas LLM)', recommended_for: 'Workflows lineares: extração → análise → ação', not_for: 'Decisões dinâmicas, branching complexo' },
  { id: 'hierarchical', icon: '🏛️', title: 'Hierárquico (Supervisor)', description: 'Um supervisor inteligente delega para agentes especialistas conforme a necessidade.', diagram: 'User → 🎯 Supervisor → [🤖A | 🤖B | 🤖C] → Response', complexity: 'Alta', cost: 'Alto (2+ chamadas por request)', recommended_for: 'Múltiplos domínios, routing inteligente', not_for: 'Latência ultra-baixa, budget limitado' },
  { id: 'swarm', icon: '🐝', title: 'Swarm Colaborativo', description: 'Agentes se comunicam entre si, validam mutuamente, chegam a consenso.', diagram: 'User → [🤖A ↔ 🤖B ↔ 🤖C] → Consenso → Response', complexity: 'Muito Alta', cost: 'Muito Alto (N² chamadas possíveis)', recommended_for: 'Decisões críticas com cross-checking', not_for: 'Budget limitado, latência crítica' },
];

export function OrchestrationModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  const isMultiAgent = agent.orchestration_pattern !== 'single';

  const addSubAgent = () => {
    const newSub: SubAgentRef = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
    };
    updateAgent({ sub_agents: [...agent.sub_agents, newSub] });
  };

  const removeSubAgent = (id: string) => {
    updateAgent({ sub_agents: agent.sub_agents.filter((s) => s.id !== id) });
  };

  const updateSubAgent = (id: string, partial: Partial<SubAgentRef>) => {
    updateAgent({
      sub_agents: agent.sub_agents.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    });
  };

  const addTrigger = () => {
    updateAgent({ human_in_loop_triggers: [...agent.human_in_loop_triggers, ''] });
  };

  const removeTrigger = (idx: number) => {
    updateAgent({ human_in_loop_triggers: agent.human_in_loop_triggers.filter((_, i) => i !== idx) });
  };

  const updateTrigger = (idx: number, value: string) => {
    const updated = [...agent.human_in_loop_triggers];
    updated[idx] = value;
    updateAgent({ human_in_loop_triggers: updated });
  };

  return (
    <div className="space-y-10">
      {/* Seção A — Padrão de Orquestração */}
      <section>
        <SectionTitle
          icon="🎼"
          title="Padrão de Orquestração"
          subtitle="Como o agente se organiza para cumprir tarefas complexas."
        />
        <div className="space-y-3">
          {ORCHESTRATION_PATTERNS.map((p) => {
            const selected = agent.orchestration_pattern === p.id;
            return (
              <button
                key={p.id}
                onClick={() => updateAgent({ orchestration_pattern: p.id })}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all duration-200',
                  selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl" aria-hidden="true">{p.icon}</span>
                  <h3 className="text-sm font-semibold text-foreground flex-1">{p.title}</h3>
                  <NexusBadge color={p.complexity === 'Baixa' ? 'green' : p.complexity === 'Média' ? 'yellow' : p.complexity === 'Alta' ? 'orange' : 'red'}>
                    {p.complexity}
                  </NexusBadge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{p.description}</p>
                <div className="font-mono text-[11px] text-primary/70 bg-primary/5 rounded-lg px-3 py-1.5 mb-2">{p.diagram}</div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                  <span>💰 Custo: {p.cost}</span>
                  <span>✅ Para: {p.recommended_for}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Seção B — Sub-Agentes (visível apenas se multi-agent) */}
      {isMultiAgent && (
        <section>
          <SectionTitle
            icon="🤝"
            title="Sub-Agentes"
            subtitle="Defina os agentes que participam da orquestração."
            badge={<NexusBadge color="blue">{agent.sub_agents.length} agentes</NexusBadge>}
          />
          <div className="space-y-3">
            {agent.sub_agents.map((sub, idx) => (
              <CollapsibleCard
                key={sub.id}
                icon="🤖"
                title={sub.name || `Sub-Agente ${idx + 1}`}
                subtitle={sub.role || 'Sem papel definido'}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Nome"
                      value={sub.name}
                      onChange={(v) => updateSubAgent(sub.id, { name: v })}
                      placeholder="Ex: Pesquisador"
                    />
                    <InputField
                      label="Papel / Responsabilidade"
                      value={sub.role}
                      onChange={(v) => updateSubAgent(sub.id, { role: v })}
                      placeholder="Ex: Buscar informações na web"
                    />
                  </div>
                  <InputField
                    label="ID do Agente (opcional)"
                    value={sub.agent_config_id || ''}
                    onChange={(v) => updateSubAgent(sub.id, { agent_config_id: v || undefined })}
                    placeholder="UUID de um agente já criado"
                    hint="Se vinculado, herdará as configurações do agente referenciado."
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeSubAgent(sub.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remover
                    </Button>
                  </div>
                </div>
              </CollapsibleCard>
            ))}
            <Button variant="outline" size="sm" onClick={addSubAgent} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" /> Adicionar Sub-Agente
            </Button>
          </div>
        </section>
      )}

      {/* Seção C — Human-in-the-Loop */}
      <section>
        <SectionTitle
          icon="🧑‍💼"
          title="Human-in-the-Loop"
          subtitle="Quando o agente deve solicitar aprovação humana."
        />
        <div className="space-y-4">
          <ToggleField
            label="Ativar Human-in-the-Loop"
            description="O agente pausará e pedirá aprovação antes de ações críticas."
            checked={agent.human_in_loop}
            onCheckedChange={(v) => updateAgent({ human_in_loop: v })}
          />
          {agent.human_in_loop && (
            <div className="space-y-3 pl-2 border-l-2 border-primary/20">
              <p className="text-xs font-medium text-foreground">Gatilhos de aprovação</p>
              {agent.human_in_loop_triggers.map((trigger, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                    value={trigger}
                    onChange={(e) => updateTrigger(idx, e.target.value)}
                    placeholder="Ex: Enviar email, deletar dados, valor > R$1000"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeTrigger(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTrigger} className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" /> Adicionar Gatilho
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Seção D — Limites de Execução */}
      <section>
        <SectionTitle
          icon="⏱️"
          title="Limites de Execução"
          subtitle="Controles de iteração e timeout para evitar loops infinitos."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SliderField
            label="Max Iterações"
            value={agent.max_iterations}
            onChange={(v) => updateAgent({ max_iterations: v })}
            min={1}
            max={100}
            step={1}
            description="Número máximo de ciclos de raciocínio por execução."
          />
          <SliderField
            label="Timeout (segundos)"
            value={agent.timeout_seconds}
            onChange={(v) => updateAgent({ timeout_seconds: v })}
            min={10}
            max={600}
            step={10}
            unit="s"
            description="Tempo máximo de execução antes de interromper."
          />
        </div>
      </section>

      {/* Seção E — Resumo */}
      <section>
        <SectionTitle icon="📊" title="Resumo da Orquestração" subtitle="Visão geral da configuração atual." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl mb-1">
              {ORCHESTRATION_PATTERNS.find((p) => p.id === agent.orchestration_pattern)?.icon}
            </p>
            <p className="text-xs font-medium text-foreground">
              {ORCHESTRATION_PATTERNS.find((p) => p.id === agent.orchestration_pattern)?.title}
            </p>
            <p className="text-[10px] text-muted-foreground">Padrão</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl mb-1">🤖</p>
            <p className="text-xs font-medium text-foreground">{agent.sub_agents.length}</p>
            <p className="text-[10px] text-muted-foreground">Sub-agentes</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl mb-1">{agent.human_in_loop ? '✅' : '❌'}</p>
            <p className="text-xs font-medium text-foreground">
              {agent.human_in_loop ? 'Ativo' : 'Inativo'}
            </p>
            <p className="text-[10px] text-muted-foreground">Human-in-Loop</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl mb-1">⏱️</p>
            <p className="text-xs font-medium text-foreground">{agent.timeout_seconds}s</p>
            <p className="text-[10px] text-muted-foreground">Timeout</p>
          </div>
        </div>
      </section>

      {/* Seção F — Interoperabilidade A2A */}
      <section>
        <SectionTitle icon="🌐" title="Protocolo A2A (Agent-to-Agent)" subtitle="Interoperabilidade com agentes externos via protocolo Google A2A" badge={<NexusBadge color="purple">Novo</NexusBadge>} />
        <div className="space-y-4">
          {/* Agent Discovery */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Descoberta de Agentes Externos</h4>
            <p className="text-xs text-muted-foreground">Conecte agentes A2A externos para delegação de tarefas entre sistemas diferentes.</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="URL do Agent Card (ex: https://agents.empresa.com/.well-known/agent.json)"
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <Button variant="outline" size="sm">Descobrir</Button>
            </div>
          </div>

          {/* Delegation Rules */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Regras de Delegação</h4>
            <p className="text-xs text-muted-foreground">Defina quando este agente deve delegar tarefas para agentes A2A externos.</p>
            <div className="space-y-2">
              {[
                { condition: 'Assunto jurídico', target: 'agente-juridico.example.com', timeout: '30s' },
                { condition: 'Análise financeira', target: 'agente-financeiro.example.com', timeout: '45s' },
              ].map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">Se:</span>
                  <span className="text-foreground font-medium">{rule.condition}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-primary font-mono">{rule.target}</span>
                  <span className="text-muted-foreground ml-auto">⏱️ {rule.timeout}</span>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" /> Adicionar Regra
              </Button>
            </div>
          </div>

          {/* Protocol Info */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <div className="space-y-1">
                <p><strong className="text-foreground">MCP</strong> = Agente ↔ Ferramenta (Anthropic)</p>
                <p><strong className="text-foreground">A2A</strong> = Agente ↔ Agente (Google, 50+ parceiros)</p>
                <p className="text-[10px] mt-2">Suportamos ambos os protocolos para máxima interoperabilidade.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
