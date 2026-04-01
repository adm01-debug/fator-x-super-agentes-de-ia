import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField, SliderField, InputField } from '../ui';
import { SelectionGrid } from '../ui/SelectionGrid';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { OrchestrationPattern, SubAgentRef } from '@/types/agentTypes';

const ORCHESTRATION_PATTERNS: { id: OrchestrationPattern; icon: string; title: string; description: string; badge?: string }[] = [
  { id: 'single', icon: '🎯', title: 'Single Agent', description: 'Um único agente executa tudo de forma autônoma.' },
  { id: 'sequential', icon: '🔗', title: 'Sequential', description: 'Agentes executam em cadeia, passando contexto.' },
  { id: 'hierarchical', icon: '🏛️', title: 'Hierarchical', description: 'Um supervisor delega tarefas a sub-agentes.', badge: 'Avançado' },
  { id: 'swarm', icon: '🐝', title: 'Swarm', description: 'Agentes colaboram em paralelo sem hierarquia.' },
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
        <SelectionGrid
          items={ORCHESTRATION_PATTERNS.map((p) => ({
            ...p,
            badge: p.badge ? <NexusBadge color="purple">{p.badge}</NexusBadge> : undefined,
          }))}
          value={agent.orchestration_pattern}
          onChange={(v) => updateAgent({ orchestration_pattern: v as OrchestrationPattern })}
          columns={2}
        />
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
    </div>
  );
}
