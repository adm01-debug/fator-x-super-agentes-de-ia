import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, CollapsibleCard, ToggleField, SliderField, SelectField } from '../ui';
import { NexusBadge } from '../ui/NexusBadge';
import { PipelineFlow } from '../ui/PipelineFlow';
import { ConfigCard } from '../ui/ConfigCard';
import type { ConsolidationStrategy } from '@/types/agentTypes';

// ═══ Governance Panel (reused by each memory layer) ═══
function GovernancePanel({
  prefix,
  config,
  onChange,
}: {
  prefix: string;
  config: {
    retention_days: number;
    update_policy: string;
    forgetting_policy: string;
    read_permission: string;
    write_permission: string;
    audit_trail: boolean;
    gdpr_compliance: boolean;
  };
  onChange: (partial: Record<string, unknown>) => void;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Governança</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SliderField
          label="Retenção (dias)"
          value={config.retention_days === -1 ? 365 : config.retention_days}
          onChange={(v) => onChange({ [`${prefix}.retention_days`]: v })}
          min={1} max={365} step={1} unit=" dias"
          description="-1 = indefinido"
        />
        <SelectField
          label="Política de Atualização"
          value={config.update_policy}
          onChange={(v) => onChange({ [`${prefix}.update_policy`]: v })}
          options={[
            { value: 'append', label: 'Append (adicionar)' },
            { value: 'overwrite', label: 'Overwrite (sobrescrever)' },
            { value: 'version', label: 'Versionado' },
          ]}
        />
        <SelectField
          label="Política de Esquecimento"
          value={config.forgetting_policy}
          onChange={(v) => onChange({ [`${prefix}.forgetting_policy`]: v })}
          options={[
            { value: 'time_decay', label: 'Decay temporal' },
            { value: 'relevance_decay', label: 'Decay por relevância' },
            { value: 'manual', label: 'Manual' },
            { value: 'compliance', label: 'Compliance (LGPD)' },
          ]}
        />
        <SelectField
          label="Permissão de Leitura"
          value={config.read_permission}
          onChange={(v) => onChange({ [`${prefix}.read_permission`]: v })}
          options={[
            { value: 'agent_only', label: 'Somente este agente' },
            { value: 'team', label: 'Time' },
            { value: 'all_agents', label: 'Todos os agentes' },
            { value: 'admin', label: 'Apenas admin' },
          ]}
        />
        <SelectField
          label="Permissão de Escrita"
          value={config.write_permission}
          onChange={(v) => onChange({ [`${prefix}.write_permission`]: v })}
          options={[
            { value: 'agent_only', label: 'Somente este agente' },
            { value: 'supervisor', label: 'Supervisor' },
            { value: 'human_only', label: 'Apenas humanos' },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <ToggleField label="Audit Trail" description="Registrar todas as operações de memória" checked={config.audit_trail} onCheckedChange={(v) => onChange({ [`${prefix}.audit_trail`]: v })} />
        <ToggleField label="LGPD / GDPR Compliance" description="Garantir conformidade com leis de proteção de dados" checked={config.gdpr_compliance} onCheckedChange={(v) => onChange({ [`${prefix}.gdpr_compliance`]: v })} />
      </div>
    </div>
  );
}

// Helper to deep-update nested config
function useMemoryUpdate() {
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);
  const agent = useAgentBuilderStore((s) => s.agent);

  return (updates: Record<string, unknown>) => {
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      const parts = key.split('.');
      if (parts.length === 2) {
        const [configKey, field] = parts;
        patch[configKey] = { ...(agent as Record<string, unknown>)[configKey] as Record<string, unknown>, [field]: value };
      } else {
        patch[key] = value;
      }
    }
    updateAgent(patch as Partial<typeof agent>);
  };
}

const CONSOLIDATION_OPTIONS: { id: ConsolidationStrategy; icon: string; title: string; description: string; recommended?: boolean }[] = [
  { id: 'hot_path', icon: '⚡', title: 'Hot Path', description: 'Tempo real — o agente decide o que guardar durante a conversa.' },
  { id: 'background', icon: '🌙', title: 'Background', description: 'Batch pós-sessão — processamento mais completo e organizado.' },
  { id: 'hybrid', icon: '🔄', title: 'Hybrid', description: 'Combina ambos: salva urgentes em tempo real, consolida o resto depois.', recommended: true },
];

const MEMORY_PIPELINE_STEPS = [
  { icon: '📝', label: 'User Input' },
  { icon: '⚡', label: 'Working Memory' },
  { icon: '👤', label: 'Profile' },
  { icon: '📖', label: 'Episodic' },
  { icon: '🌐', label: 'Semantic' },
  { icon: '🔌', label: 'External' },
  { icon: '🧠', label: 'LLM' },
  { icon: '✅', label: 'Response' },
  { icon: '🔄', label: 'Consolidation' },
];

export function MemoryModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);
  const memUpdate = useMemoryUpdate();

  const activeCount = [agent.memory_short_term, agent.memory_episodic, agent.memory_semantic, agent.memory_procedural, agent.memory_profile, agent.memory_shared].filter(Boolean).length;

  return (
    <div className="space-y-10">
      {/* Seção A — 6 Camadas */}
      <section>
        <SectionTitle
          icon="💾"
          title="Camadas de Memória"
          subtitle="A memória é o que diferencia um chatbot de um agente de verdade."
          badge={<NexusBadge color="blue">{activeCount}/6 ativas</NexusBadge>}
        />
        <div className="space-y-3">

          {/* 1. Short-term */}
          <CollapsibleCard icon="⚡" title="Memória de Curto Prazo" subtitle="Buffer conversacional — contexto da sessão atual" badge={<NexusBadge color="yellow">{agent.memory_short_term ? 'Ativa' : 'Inativa'}</NexusBadge>} accentColor="hsl(var(--nexus-yellow))">
            <ToggleField label="Ativar Memória de Curto Prazo" checked={agent.memory_short_term} onCheckedChange={(v) => updateAgent({ memory_short_term: v })} />
            {agent.memory_short_term && (
              <div className="mt-4 space-y-4">
                <SliderField label="Máximo de Mensagens" value={agent.memory_short_term_config.max_messages} onChange={(v) => updateAgent({ memory_short_term_config: { ...agent.memory_short_term_config, max_messages: v } })} min={5} max={50} step={1} />
                <SliderField label="Máximo de Tokens" value={agent.memory_short_term_config.max_tokens} onChange={(v) => updateAgent({ memory_short_term_config: { ...agent.memory_short_term_config, max_tokens: v } })} min={1000} max={8000} step={100} />
                <SelectField label="Estratégia" value={agent.memory_short_term_config.strategy} onChange={(v) => updateAgent({ memory_short_term_config: { ...agent.memory_short_term_config, strategy: v as 'sliding_window' | 'summarization' | 'hybrid' } })} options={[
                  { value: 'sliding_window', label: 'Janela deslizante' },
                  { value: 'summarization', label: 'Sumarização' },
                  { value: 'hybrid', label: 'Híbrido' },
                ]} />
              </div>
            )}
          </CollapsibleCard>

          {/* 2. Episodic */}
          <CollapsibleCard icon="📖" title="Memória Episódica" subtitle="Lembra experiências — o que funcionou e o que falhou" badge={<NexusBadge color="green">{agent.memory_episodic ? 'Ativa' : 'Inativa'}</NexusBadge>} accentColor="hsl(var(--nexus-green))">
            <ToggleField label="Ativar Memória Episódica" checked={agent.memory_episodic} onCheckedChange={(v) => updateAgent({ memory_episodic: v })} />
            {agent.memory_episodic && (
              <div className="mt-4 space-y-4">
                <SelectField label="Storage" value={agent.memory_episodic_config.storage} onChange={(v) => updateAgent({ memory_episodic_config: { ...agent.memory_episodic_config, storage: v as 'vector_db' | 'structured_db' } })} options={[
                  { value: 'vector_db', label: 'Vector DB' },
                  { value: 'structured_db', label: 'Banco Estruturado' },
                ]} />
                <SliderField label="Decay Rate" value={agent.memory_episodic_config.decay_rate} onChange={(v) => updateAgent({ memory_episodic_config: { ...agent.memory_episodic_config, decay_rate: v } })} min={0} max={100} unit="%" description="Velocidade de esquecimento de episódios antigos." />
                <SliderField label="Máximo de Episódios" value={agent.memory_episodic_config.max_episodes} onChange={(v) => updateAgent({ memory_episodic_config: { ...agent.memory_episodic_config, max_episodes: v } })} min={100} max={100000} step={100} />
                <GovernancePanel prefix="memory_episodic_config" config={agent.memory_episodic_config} onChange={memUpdate} />
              </div>
            )}
          </CollapsibleCard>

          {/* 3. Semantic */}
          <CollapsibleCard icon="🌐" title="Memória Semântica" subtitle="Fatos, regras e relacionamentos generalizados" badge={<NexusBadge color="blue">{agent.memory_semantic ? 'Ativa' : 'Inativa'}</NexusBadge>} accentColor="hsl(var(--nexus-blue))">
            <ToggleField label="Ativar Memória Semântica" checked={agent.memory_semantic} onCheckedChange={(v) => updateAgent({ memory_semantic: v })} />
            {agent.memory_semantic && (
              <div className="mt-4 space-y-4">
                <SelectField label="Storage" value={agent.memory_semantic_config.storage} onChange={(v) => updateAgent({ memory_semantic_config: { ...agent.memory_semantic_config, storage: v as 'vector_db' | 'knowledge_graph' | 'hybrid' } })} options={[
                  { value: 'vector_db', label: 'Vector DB' },
                  { value: 'knowledge_graph', label: 'Knowledge Graph' },
                  { value: 'hybrid', label: 'Híbrido' },
                ]} />
                <SelectField label="Embedding Model" value={agent.memory_semantic_config.embedding_model} onChange={(v) => updateAgent({ memory_semantic_config: { ...agent.memory_semantic_config, embedding_model: v } })} options={[
                  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
                  { value: 'text-embedding-3-small', label: 'text-embedding-3-small' },
                  { value: 'voyage-3', label: 'Voyage 3' },
                  { value: 'custom', label: 'Custom' },
                ]} />
                <SelectField label="Graph DB" value={agent.memory_semantic_config.graph_db} onChange={(v) => updateAgent({ memory_semantic_config: { ...agent.memory_semantic_config, graph_db: v as 'neo4j' | 'memgraph' | 'none' } })} options={[
                  { value: 'none', label: 'Nenhum' },
                  { value: 'neo4j', label: 'Neo4j' },
                  { value: 'memgraph', label: 'Memgraph' },
                ]} />
                <GovernancePanel prefix="memory_semantic_config" config={agent.memory_semantic_config} onChange={memUpdate} />
              </div>
            )}
          </CollapsibleCard>

          {/* 4. Procedural */}
          <CollapsibleCard icon="⚙️" title="Memória Procedural" subtitle="Skills aprendidas — processos e workflows otimizados" badge={<NexusBadge color="red">{agent.memory_procedural ? 'Ativa' : 'Inativa'}</NexusBadge>} accentColor="hsl(var(--nexus-red))">
            <ToggleField label="Ativar Memória Procedural" checked={agent.memory_procedural} onCheckedChange={(v) => updateAgent({ memory_procedural: v })} />
            {agent.memory_procedural && (
              <div className="mt-4 space-y-4">
                <SelectField label="Storage" value={agent.memory_procedural_config.storage} onChange={(v) => updateAgent({ memory_procedural_config: { ...agent.memory_procedural_config, storage: v as 'structured_db' | 'code_repo' } })} options={[
                  { value: 'structured_db', label: 'Banco Estruturado' },
                  { value: 'code_repo', label: 'Code Repository' },
                ]} />
                <SliderField label="Learning Rate" value={agent.memory_procedural_config.learning_rate} onChange={(v) => updateAgent({ memory_procedural_config: { ...agent.memory_procedural_config, learning_rate: v } })} min={0} max={100} unit="%" />
                <ToggleField label="Controle de Versão" description="Manter histórico de cada procedimento" checked={agent.memory_procedural_config.version_control} onCheckedChange={(v) => updateAgent({ memory_procedural_config: { ...agent.memory_procedural_config, version_control: v } })} />
                <GovernancePanel prefix="memory_procedural_config" config={agent.memory_procedural_config} onChange={memUpdate} />
              </div>
            )}
          </CollapsibleCard>

          {/* 5. Profile */}
          <CollapsibleCard icon="👤" title="Memória de Perfil" subtitle="Preferências, cargo e contexto do usuário" badge={<NexusBadge color="orange">{agent.memory_profile ? 'Ativa' : 'Inativa'}</NexusBadge>} accentColor="hsl(var(--nexus-orange))">
            <ToggleField label="Ativar Memória de Perfil" checked={agent.memory_profile} onCheckedChange={(v) => updateAgent({ memory_profile: v })} />
            {agent.memory_profile && (
              <div className="mt-4 space-y-4">
                <ToggleField label="Auto-extração" description="Detecta e armazena dados automaticamente" checked={agent.memory_profile_config.auto_extract} onCheckedChange={(v) => updateAgent({ memory_profile_config: { ...agent.memory_profile_config, auto_extract: v } })} />
                <ToggleField label="Atualizar a cada interação" checked={agent.memory_profile_config.update_on_interaction} onCheckedChange={(v) => updateAgent({ memory_profile_config: { ...agent.memory_profile_config, update_on_interaction: v } })} />
                <SelectField label="Escopo" value={agent.memory_profile_config.scope} onChange={(v) => updateAgent({ memory_profile_config: { ...agent.memory_profile_config, scope: v as 'per_user' | 'per_organization' | 'per_channel' } })} options={[
                  { value: 'per_user', label: 'Por usuário' },
                  { value: 'per_organization', label: 'Por organização' },
                  { value: 'per_channel', label: 'Por canal' },
                ]} />
                <GovernancePanel prefix="memory_profile_config" config={agent.memory_profile_config} onChange={memUpdate} />
              </div>
            )}
          </CollapsibleCard>

          {/* 6. Shared */}
          <CollapsibleCard icon="🏢" title="Memória Organizacional" subtitle="Conhecimento compartilhado entre agentes e equipes" badge={<NexusBadge color="purple">{agent.memory_shared ? 'Ativa' : 'Inativa'}</NexusBadge>} accentColor="hsl(var(--nexus-purple))">
            <ToggleField label="Ativar Memória Compartilhada" checked={agent.memory_shared} onCheckedChange={(v) => updateAgent({ memory_shared: v })} />
            {agent.memory_shared && (
              <div className="mt-4 space-y-4">
                <SelectField label="Escopo de Leitura" value={agent.memory_shared_config.read_scope} onChange={(v) => updateAgent({ memory_shared_config: { ...agent.memory_shared_config, read_scope: v as 'all_agents' | 'same_team' | 'same_workspace' } })} options={[
                  { value: 'all_agents', label: 'Todos os agentes' },
                  { value: 'same_team', label: 'Mesmo time' },
                  { value: 'same_workspace', label: 'Mesmo workspace' },
                ]} />
                <SelectField label="Escopo de Escrita" value={agent.memory_shared_config.write_scope} onChange={(v) => updateAgent({ memory_shared_config: { ...agent.memory_shared_config, write_scope: v as 'any_agent' | 'supervisors_only' | 'human_only' } })} options={[
                  { value: 'any_agent', label: 'Qualquer agente' },
                  { value: 'supervisors_only', label: 'Apenas supervisores' },
                  { value: 'human_only', label: 'Apenas humanos' },
                ]} />
                <SelectField label="Resolução de Conflitos" value={agent.memory_shared_config.conflict_resolution} onChange={(v) => updateAgent({ memory_shared_config: { ...agent.memory_shared_config, conflict_resolution: v as 'last_write_wins' | 'version_merge' | 'human_review' } })} options={[
                  { value: 'last_write_wins', label: 'Último escrito vence' },
                  { value: 'version_merge', label: 'Merge de versões' },
                  { value: 'human_review', label: 'Revisão humana' },
                ]} />
                <GovernancePanel prefix="memory_shared_config" config={agent.memory_shared_config} onChange={memUpdate} />
              </div>
            )}
          </CollapsibleCard>
        </div>
      </section>

      {/* Seção C — Estratégia de Consolidação */}
      <section>
        <SectionTitle icon="🔄" title="Estratégia de Consolidação" subtitle="Como as memórias são processadas e armazenadas a longo prazo." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CONSOLIDATION_OPTIONS.map((opt) => (
            <ConfigCard
              key={opt.id}
              icon={opt.icon}
              title={opt.title}
              description={opt.description}
              selected={agent.memory_consolidation === opt.id}
              onClick={() => updateAgent({ memory_consolidation: opt.id })}
              badge={opt.recommended ? <NexusBadge color="green">Recomendado</NexusBadge> : undefined}
            />
          ))}
        </div>
      </section>

      {/* Seção D — Diagrama de Fluxo */}
      <section>
        <SectionTitle icon="📊" title="Fluxo de Memória" subtitle="Visualização do pipeline de memória durante uma interação." />
        <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
          <PipelineFlow steps={MEMORY_PIPELINE_STEPS} />
        </div>
      </section>

      {/* Seção E — Governança Global */}
      <section>
        <SectionTitle icon="🛡️" title="Governança Global de Memória" subtitle="Configurações que se aplicam a todas as camadas de memória." />
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <ToggleField label="Audit Trail Global" description="Registrar todas as operações de leitura/escrita em qualquer memória" checked={agent.logging_enabled} onCheckedChange={(v) => updateAgent({ logging_enabled: v })} />
          <ToggleField label="LGPD/GDPR Compliance Mode" description="Ativar conformidade com leis de proteção de dados em todas as memórias" checked={agent.memory_profile_config.gdpr_compliance} onCheckedChange={(gdpr) => {
            updateAgent({
              memory_episodic_config: { ...agent.memory_episodic_config, gdpr_compliance: gdpr },
              memory_semantic_config: { ...agent.memory_semantic_config, gdpr_compliance: gdpr },
              memory_procedural_config: { ...agent.memory_procedural_config, gdpr_compliance: gdpr },
              memory_profile_config: { ...agent.memory_profile_config, gdpr_compliance: gdpr },
              memory_shared_config: { ...agent.memory_shared_config, gdpr_compliance: gdpr },
            });
          }} />
        </div>
      </section>
    </div>
  );
}
