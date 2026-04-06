import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, InputField, TextAreaField, SelectionGrid, SliderField } from '../ui';
import { cn } from '@/lib/utils';
import type { AgentPersona } from '@/types/agentTypes';

const AVATAR_EMOJIS = [
  '🤖', '⚡', '🧠', '🎯', '🛡️', '🔮', '🦾', '🚀', '💎', '🌟',
  '🔥', '🧬', '🎨', '📊', '🔍', '🦅', '🐉', '🌐', '👁️', '⚙️',
];

const PERSONA_ITEMS = [
  { id: 'assistant' as AgentPersona, icon: '🤖', title: 'Assistente', description: 'Responde perguntas e executa tarefas sob demanda' },
  { id: 'specialist' as AgentPersona, icon: '🎓', title: 'Especialista', description: 'Domínio profundo em área específica' },
  { id: 'coordinator' as AgentPersona, icon: '🎯', title: 'Coordenador', description: 'Orquestra outros agentes e workflows' },
  { id: 'analyst' as AgentPersona, icon: '📊', title: 'Analista', description: 'Processa dados, gera insights e relatórios' },
  { id: 'creative' as AgentPersona, icon: '🎨', title: 'Criativo', description: 'Gera conteúdo, copy, design, ideias' },
  { id: 'autonomous' as AgentPersona, icon: '⚡', title: 'Autônomo', description: 'Opera proativamente com mínima supervisão' },
];

export function IdentityModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  return (
    <div className="space-y-8">
      {/* Seção A — Nome, Missão & Avatar */}
      <section>
        <SectionTitle icon="🧬" title="Nome, Missão & Avatar" subtitle="Defina a identidade fundamental do seu agente" />
        <div className="space-y-4">
          <InputField
            label="Nome do Agente"
            value={agent.name}
            onChange={(v) => updateAgent({ name: v })}
            placeholder="ARIA, Sentinela, Atlas..."
            hint="Escolha um nome memorável que represente a função do agente"
          />
          <InputField
            label="Missão"
            value={agent.mission}
            onChange={(v) => updateAgent({ mission: v })}
            placeholder="Automatizar o processo comercial..."
            hint="Uma frase clara que define o propósito principal"
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Avatar</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Selecionar avatar ${emoji}`}
                  onClick={() => updateAgent({ avatar_emoji: emoji })}
                  className={cn(
                    'w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all duration-200 border',
                    agent.avatar_emoji === emoji
                      ? 'border-primary bg-primary/10 scale-110 shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                      : 'border-border bg-muted/30 hover:bg-muted/60 hover:scale-105'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Seção B — Arquétipo / Persona */}
      <section>
        <SectionTitle icon="🎭" title="Arquétipo / Persona" subtitle="Selecione o papel principal do agente" />
        <SelectionGrid
          items={PERSONA_ITEMS}
          value={agent.persona}
          onChange={(v) => updateAgent({ persona: v as AgentPersona })}
          columns={3}
        />
      </section>

      {/* Seção C — Personalidade */}
      <section>
        <SectionTitle icon="🎚️" title="Personalidade" subtitle="Ajuste o comportamento e tom do agente" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SliderField
            label="Formalidade"
            value={agent.formality}
            onChange={(v) => updateAgent({ formality: v })}
            min={0} max={100}
            description="0 = Casual → 100 = Muito formal"
          />
          <SliderField
            label="Proatividade"
            value={agent.proactivity}
            onChange={(v) => updateAgent({ proactivity: v })}
            min={0} max={100}
            description="0 = Reativo → 100 = Muito proativo"
          />
          <SliderField
            label="Criatividade"
            value={agent.creativity}
            onChange={(v) => updateAgent({ creativity: v })}
            min={0} max={100}
            description="0 = Conservador → 100 = Muito criativo"
          />
          <SliderField
            label="Verbosidade"
            value={agent.verbosity}
            onChange={(v) => updateAgent({ verbosity: v })}
            min={0} max={100}
            description="0 = Conciso → 100 = Detalhado"
          />
        </div>
      </section>

      {/* Seção D — Escopo */}
      <section>
        <SectionTitle icon="📐" title="Escopo de Atuação" subtitle="Defina os limites do que o agente pode e não pode fazer" />
        <TextAreaField
          label="Escopo"
          value={agent.scope}
          onChange={(v) => updateAgent({ scope: v })}
          placeholder={"O agente PODE:\n- Responder dúvidas sobre produtos\n- Consultar estoque\n\nO agente NÃO PODE:\n- Alterar preços\n- Aprovar descontos acima de 10%"}
          rows={6}
          hint="Defina limites claros. O que pode e NÃO pode fazer."
          maxLength={2000}
        />
      </section>
    </div>
  );
}
