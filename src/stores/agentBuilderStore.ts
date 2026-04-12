import { create } from 'zustand';
import type { AgentConfig, PromptVersion, AgentPersona, LLMModel, ReasoningPattern, AgentLifecycleStage } from '@/types/agentTypes';
import { DEFAULT_AGENT, TABS } from '@/data/agentBuilderData';
import { supabase } from '@/integrations/supabase/client';

import type { Json } from '@/integrations/supabase/types';
import { audit } from '@/lib/auditService';

interface AgentBuilderStore {
  agent: AgentConfig;
  activeTab: string;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  lastSaved?: string;
  savedAgents: AgentConfig[];
  promptVersions: PromptVersion[];

  setActiveTab: (tab: string) => void;
  nextTab: () => void;
  prevTab: () => void;

  updateAgent: (partial: Partial<AgentConfig>) => void;
  resetAgent: () => void;
  loadAgent: (agent: AgentConfig) => void;

  saveAgent: () => Promise<void>;
  loadAgentFromDB: (id: string) => Promise<void>;
  loadSavedAgents: () => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  duplicateAgent: (id: string) => void;

  savePromptVersion: (summary: string) => Promise<void>;
  loadPromptVersions: () => Promise<void>;
  activatePromptVersion: (versionId: string) => Promise<void>;

  exportJSON: () => string;
  exportMarkdown: () => string;

  getCompleteness: () => number;
  getActiveMemoryTypes: () => string[];
  getActiveToolsCount: () => number;
  getActiveGuardrailsCount: () => number;
  getEstimatedMonthlyCost: () => number;
}

function agentToDbRow(agent: AgentConfig, userId: string) {
  const { id, created_at: _ca, updated_at: _ua, ...rest } = agent;
  return {
    ...(id ? { id: id as string } : {}),
    user_id: userId,
    name: agent.name,
    mission: agent.mission,
    persona: agent.persona,
    model: agent.model,
    avatar_emoji: agent.avatar_emoji,
    reasoning: agent.reasoning,
    status: agent.status,
    version: agent.version,
    tags: agent.tags,
    config: rest as unknown as Json,
  };
}

function dbRowToAgent(row: Record<string, unknown>): AgentConfig {
  const config = (row.config || {}) as Record<string, any>;
  return {
    ...DEFAULT_AGENT,
    ...config,
    id: row.id as string | undefined,
    name: row.name as string,
    mission: (row.mission as string) || '',
    persona: ((row.persona as string) || 'assistant') as AgentPersona,
    model: ((row.model as string) || 'claude-sonnet-4.6') as LLMModel,
    avatar_emoji: (row.avatar_emoji as string) || '🤖',
    reasoning: ((row.reasoning as string) || 'react') as ReasoningPattern,
    status: ((row.status as string) || 'draft') as AgentLifecycleStage,
    version: (row.version as number) || 1,
    tags: (row.tags as string[]) || [],
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

let autoSaveTimer: number | undefined;

export const useAgentBuilderStore = create<AgentBuilderStore>((set, get) => ({
  agent: { ...DEFAULT_AGENT },
  activeTab: TABS[0].id,
  isDirty: false,
  isSaving: false,
  isLoading: false,
  lastSaved: undefined,
  savedAgents: [],
  promptVersions: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  nextTab: () => {
    const { activeTab } = get();
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx < TABS.length - 1) set({ activeTab: TABS[idx + 1].id });
  },

  prevTab: () => {
    const { activeTab } = get();
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx > 0) set({ activeTab: TABS[idx - 1].id });
  },

  updateAgent: (partial) => {
    set((s) => ({ agent: { ...s.agent, ...partial }, isDirty: true }));
    // Auto-save debounced (5s)
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      const state = get();
      if (state.isDirty && state.agent.id) {
        state.saveAgent();
      }
    }, 5000);
  },

  resetAgent: () => set({ agent: { ...DEFAULT_AGENT }, isDirty: false, activeTab: TABS[0].id }),

  loadAgent: (agent) => set({ agent, isDirty: false, activeTab: TABS[0].id }),

  loadAgentFromDB: async (id: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      const agent = dbRowToAgent(data);
      set({ agent, isDirty: false, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  saveAgent: async () => {
    set({ isSaving: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ isSaving: false });
      return;
    }

    const agent = get().agent;
    const row = agentToDbRow(agent, user.id);

    let error;
    if (agent.id) {
      // ═══ Optimistic locking: check version hasn't changed ═══
      const { data: current } = await supabase
        .from('agents')
        .select('version, updated_at')
        .eq('id', agent.id as string)
        .maybeSingle();

      if (current && current.version !== agent.version) {
        set({ isSaving: false });
        // Version conflict — use window.confirm since Zustand stores cannot render UI
        const overwrite = window.confirm(
          `⚠️ Conflito de versão detectado!\n\nVocê está na versão ${agent.version}, mas o banco tem a versão ${current.version}.\nAlguém pode ter salvo mudanças depois de você.\n\nDeseja sobrescrever mesmo assim?`
        );
        if (!overwrite) return;
      }

      // Bump version on update
      row.version = (agent.version || 1) + 1;

      const { error: e } = await supabase
        .from('agents')
        .update(row)
        .eq('id', agent.id as string);
      error = e;
      if (!e) {
        set((s) => ({ agent: { ...s.agent, version: row.version } }));
      }
    } else {
      const { data, error: e } = await supabase
        .from('agents')
        .insert(row)
        .select('id')
        .single();
      error = e;
      if (!e && data) {
        set((s) => ({ agent: { ...s.agent, id: data.id } }));
      }
    }

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    set({ isSaving: false, isDirty: !error, lastSaved: error ? undefined : now });

    if (!error) {
      const savedAgent = get().agent;
      const agentId = (agent.id || savedAgent.id) as string;
      if (agent.id) {
        audit.agentUpdated(agent.id as string, ['config']);
      } else if (savedAgent.id) {
        audit.agentCreated(savedAgent.id as string, savedAgent.name);
      }
      // Sync tool_policies to DB (non-blocking)
      if (agentId && savedAgent.tools?.length > 0) {
        for (const tool of savedAgent.tools) {
          supabase.from('tool_policies').upsert({
            agent_id: agentId,
            tool_integration_id: null,
            is_allowed: tool.enabled,
            max_calls_per_run: tool.max_calls_per_session,
            requires_approval: tool.requires_approval,
            config: { name: tool.name, category: tool.category, permission_level: tool.permission_level },
          }, { onConflict: 'agent_id,tool_integration_id' }).then(() => {}, () => {});
        }
      }
      // ═══ Auto-versioning: snapshot agent config on every save ═══
      if (agentId) {
        supabase.from('agent_versions').insert({
          agent_id: agentId,
          version: savedAgent.version || 1,
          config: row.config || {},
          system_prompt: (row.config as Record<string, unknown>)?.system_prompt as string || '',
          model: savedAgent.model,
          created_by: user.id,
          change_summary: `Save at ${now}`,
          environment: savedAgent.status === 'production' ? 'production' : savedAgent.status === 'staging' ? 'staging' : 'development',
        }).then(() => {}, () => {}); // Ignore duplicate version errors
      }
    }
  },

  loadSavedAgents: async () => {
    const { data } = await supabase
      .from('agents')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) {
      set({ savedAgents: data.map(dbRowToAgent) });
    }
  },

  deleteAgent: async (id: string) => {
    const agent = get().savedAgents.find(a => a.id === id);
    // Soft delete — preserva dados para auditoria
    await supabase.from('agents').update({ status: 'archived' as const }).eq('id', id);
    set((s) => ({ savedAgents: s.savedAgents.filter(a => a.id !== id) }));
    audit.agentDeleted(id, agent?.name ?? 'unknown');
  },

  duplicateAgent: () => {
    const { agent } = get();
    set({
      agent: { ...agent, id: undefined, name: `${agent.name} (cópia)`, status: 'draft', version: 1 },
      isDirty: true,
    });
  },

  savePromptVersion: async (summary: string) => {
    const { agent, promptVersions } = get();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !agent.id) return;

    const newVersion = (promptVersions.length > 0 ? Math.max(...promptVersions.map(v => v.version)) : 0) + 1;

    // Deactivate old versions
    if (promptVersions.length > 0) {
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('agent_id', agent.id);
    }

    const { data, error } = await supabase
      .from('prompt_versions')
      .insert({
        agent_id: agent.id,
        user_id: user.id,
        version: newVersion,
        content: agent.system_prompt,
        change_summary: summary,
        is_active: true,
      })
      .select()
      .single();

    if (!error && data) {
      const pv: PromptVersion = {
        id: data.id,
        version: data.version,
        content: data.content,
        change_summary: data.change_summary || '',
        author: 'user',
        is_active: true,
        created_at: data.created_at,
      };
      set({
        promptVersions: [...promptVersions.map(v => ({ ...v, is_active: false })), pv],
        agent: { ...agent, system_prompt_version: newVersion },
      });
    }
  },

  loadPromptVersions: async () => {
    const agent = get().agent;
    if (!agent.id) return;
    const { data } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('agent_id', agent.id)
      .order('version', { ascending: false });
    if (data) {
      set({
        promptVersions: data.map(d => ({
          id: d.id,
          version: d.version,
          content: d.content,
          change_summary: d.change_summary || '',
          author: 'user',
          is_active: d.is_active ?? false,
          created_at: d.created_at,
        })),
      });
    }
  },

  activatePromptVersion: async (versionId: string) => {
    const { promptVersions, agent } = get();
    const target = promptVersions.find(v => v.id === versionId);
    if (!target || !agent.id) return;

    await supabase
      .from('prompt_versions')
      .update({ is_active: false })
      .eq('agent_id', agent.id);
    await supabase
      .from('prompt_versions')
      .update({ is_active: true })
      .eq('id', versionId);

    set({
      promptVersions: promptVersions.map(v => ({ ...v, is_active: v.id === versionId })),
      agent: { ...agent, system_prompt: target.content, system_prompt_version: target.version },
      isDirty: true,
    });
  },

  exportJSON: () => JSON.stringify(get().agent, null, 2),

  exportMarkdown: () => {
    const a = get().agent;
    const memoryTypes = [
      a.memory_short_term && 'Curto Prazo',
      a.memory_episodic && 'Episódica',
      a.memory_semantic && 'Semântica',
      a.memory_procedural && 'Procedural',
      a.memory_profile && 'Perfil',
      a.memory_shared && 'Organizacional',
    ].filter(Boolean);
    const activeTools = a.tools.filter(t => t.enabled);
    const activeGuardrails = a.guardrails.filter(g => g.enabled);

    return [
      `# ${a.avatar_emoji} ${a.name}`,
      '',
      `**Missão:** ${a.mission}`,
      `**Persona:** ${a.persona}`,
      `**Modelo:** ${a.model}`,
      `**Raciocínio:** ${a.reasoning}`,
      `**Status:** ${a.status}`,
      `**Versão:** ${a.version}`,
      '',
      '## Memória',
      memoryTypes.length > 0 ? memoryTypes.map(t => `- ${t}`).join('\n') : '- Nenhuma ativa',
      '',
      '## RAG',
      `- Arquitetura: ${a.rag_architecture}`,
      `- Vector DB: ${a.rag_vector_db}`,
      `- Fontes: ${a.rag_sources.length}`,
      '',
      '## Ferramentas',
      activeTools.length > 0 ? activeTools.map(t => `- ${t.name}`).join('\n') : '- Nenhuma ativa',
      '',
      '## Guardrails',
      activeGuardrails.length > 0 ? activeGuardrails.map(g => `- ${g.name} (${g.severity})`).join('\n') : '- Nenhum ativo',
      '',
      '## System Prompt',
      '```',
      a.system_prompt || '(vazio)',
      '```',
      '',
      '## Deploy',
      `- Ambiente: ${a.deploy_environment}`,
      `- Canais: ${a.deploy_channels.filter(c => c.enabled).length}`,
      '',
    ].join('\n');
  },

  getEstimatedMonthlyCost: () => {
    const a = get().agent;
    const modelCosts: Record<string, number> = {
      'claude-opus-4.6': 150,
      'claude-sonnet-4.6': 50,
      'claude-haiku-4.5': 15,
      'gpt-4o': 60,
      'gemini-2.5-pro': 40,
      'llama-4': 20,
      'custom': 50,
    };
    const base = modelCosts[a.model] || 50;
    const toolMultiplier = 1 + (a.tools.filter(t => t.enabled).length * 0.05);
    const ragMultiplier = a.rag_sources.length > 0 ? 1.2 : 1;
    return Math.round(base * toolMultiplier * ragMultiplier);
  },

  getCompleteness: () => {
    const a = get().agent;
    let score = 0;
    if (a.name) score += 10;
    if (a.mission) score += 10;
    if (a.model) score += 10;
    if (a.system_prompt.length > 50) score += 15;
    if (a.tools.length > 0) score += 10;
    if (a.guardrails.length > 0) score += 10;
    if (a.test_cases.length > 0) score += 10;
    if (a.rag_sources.length > 0) score += 10;
    if (a.memory_episodic || a.memory_semantic) score += 10;
    if (a.logging_enabled) score += 5;
    return Math.min(score, 100);
  },

  getActiveMemoryTypes: () => {
    const a = get().agent;
    const types: string[] = [];
    if (a.memory_short_term) types.push('short_term');
    if (a.memory_episodic) types.push('episodic');
    if (a.memory_semantic) types.push('semantic');
    if (a.memory_procedural) types.push('procedural');
    if (a.memory_profile) types.push('profile');
    if (a.memory_shared) types.push('shared');
    return types;
  },

  getActiveToolsCount: () => get().agent.tools.filter((t) => t.enabled).length,

  getActiveGuardrailsCount: () => get().agent.guardrails.filter((g) => g.enabled).length,
}));
