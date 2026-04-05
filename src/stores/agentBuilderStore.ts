import { create } from 'zustand';
import type { AgentConfig, PromptVersion, ReadinessScore } from '@/types/agentTypes';
import { DEFAULT_AGENT, TABS } from '@/data/agentBuilderData';
import * as agentService from '@/services/agentService';
import { AgentConfigSchema } from '@/lib/validation';
import * as agentGovernance from '@/services/agentGovernance';
import { computeReadinessScore, computeCompleteness } from '@/services/readinessService';

interface AgentBuilderStore {
  agent: AgentConfig;
  activeTab: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved?: string;
  savedAgents: agentService.AgentSummary[];
  promptVersions: PromptVersion[];
  currentUserId?: string;

  setActiveTab: (tab: string) => void;
  nextTab: () => void;
  prevTab: () => void;

  updateAgent: (partial: Partial<AgentConfig>) => void;
  resetAgent: () => void;
  loadAgent: (agent: AgentConfig) => void;
  setCurrentUserId: (userId: string) => void;

  saveAgent: () => Promise<void>;
  loadSavedAgents: () => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  duplicateAgent: (id: string) => void;

  savePromptVersion: (summary: string) => Promise<void>;
  loadPromptVersions: () => Promise<void>;
  activatePromptVersion: (versionId: string) => Promise<void>;

  exportJSON: () => string;
  exportMarkdown: () => string;

  getCompleteness: () => number;
  getReadinessScore: () => ReadinessScore;
  getActiveMemoryTypes: () => string[];
  getActiveToolsCount: () => number;
  getActiveGuardrailsCount: () => number;
  getEstimatedMonthlyCost: () => number;
}

export const useAgentBuilderStore = create<AgentBuilderStore>((set, get) => ({
  agent: { ...DEFAULT_AGENT },
  activeTab: TABS[0].id,
  isDirty: false,
  isSaving: false,
  lastSaved: undefined,
  savedAgents: [],
  promptVersions: [],
  currentUserId: undefined,

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

  updateAgent: (partial) =>
    set((s) => ({ agent: { ...s.agent, ...partial }, isDirty: true })),

  resetAgent: () => set({ agent: { ...DEFAULT_AGENT }, isDirty: false, activeTab: TABS[0].id }),

  loadAgent: (agent) => set({ agent, isDirty: false, activeTab: TABS[0].id }),

  setCurrentUserId: (userId) => set({ currentUserId: userId }),

  saveAgent: async () => {
    const { agent, currentUserId } = get();
    if (!currentUserId) {
      // Fallback: simulated save for unauthenticated users
      set({ isSaving: true });
      await new Promise((r) => setTimeout(r, 600));
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      set({ isSaving: false, isDirty: false, lastSaved: now });
      return;
    }

    // Validate with Zod before saving
    const validation = AgentConfigSchema.safeParse({
      name: agent.name, mission: agent.mission, persona: agent.persona, model: agent.model,
      reasoning: agent.reasoning, temperature: agent.temperature, top_p: agent.top_p,
      max_tokens: agent.max_tokens, system_prompt: agent.system_prompt, status: agent.status,
      version: agent.version, avatar_emoji: agent.avatar_emoji, scope: agent.scope,
      formality: agent.formality, proactivity: agent.proactivity, creativity: agent.creativity,
      verbosity: agent.verbosity,
    });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      set({ isSaving: false });
      throw new Error(`Validação: ${firstError?.path.join('.')} — ${firstError?.message}`);
    }

    set({ isSaving: true });
    try {
      const saved = await agentService.saveAgent(agent, currentUserId);
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      set({ agent: saved, isSaving: false, isDirty: false, lastSaved: now });
      agentGovernance.saveVersion(saved.id ?? 'new', saved as unknown as Record<string, unknown>, 'Auto-save');
    } catch {
      set({ isSaving: false });
    }
  },

  loadSavedAgents: async () => {
    const { currentUserId } = get();
    if (!currentUserId) return;
    try {
      const agents = await agentService.loadAgents(currentUserId);
      set({ savedAgents: agents });
    } catch {
      // Silently fail — dashboard will show empty state
    }
  },

  deleteAgent: async (id: string) => {
    try {
      await agentService.deleteAgent(id);
      const { savedAgents } = get();
      set({ savedAgents: savedAgents.filter(a => a.id !== id) });
    } catch {
      // Handle error silently
    }
  },

  duplicateAgent: (id: string) => {
    const { currentUserId } = get();
    if (!currentUserId) {
      // Local duplicate
      const { agent } = get();
      set({
        agent: { ...agent, id: undefined, name: `${agent.name} (cópia)`, status: 'draft', version: 1 },
        isDirty: true,
      });
      return;
    }
    agentService.duplicateAgent(id, currentUserId).then((copy) => {
      set({ agent: copy, isDirty: false });
    });
  },

  savePromptVersion: async (summary: string) => {
    const { agent, promptVersions, currentUserId } = get();
    const newVersion: PromptVersion = {
      id: crypto.randomUUID(),
      version: (promptVersions.length > 0 ? Math.max(...promptVersions.map(v => v.version)) : 0) + 1,
      content: agent.system_prompt,
      change_summary: summary,
      author: 'user',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Save to Supabase if authenticated
    if (currentUserId && agent.id) {
      try {
        await agentService.savePromptVersion(agent.id, currentUserId, agent.system_prompt, newVersion.version, summary);
      } catch {
        // Continue with local state even if remote fails
      }
    }

    set({
      promptVersions: [...promptVersions.map(v => ({ ...v, is_active: false })), newVersion],
      agent: { ...agent, system_prompt_version: newVersion.version },
    });
  },

  loadPromptVersions: async () => {
    const { agent } = get();
    if (!agent.id) return;
    try {
      const versions = await agentService.loadPromptVersions(agent.id);
      set({
        promptVersions: versions.map(v => ({
          id: v.id,
          version: v.version,
          content: v.content,
          change_summary: v.change_summary ?? '',
          author: 'user',
          is_active: v.is_active ?? false,
          created_at: v.created_at,
        })),
      });
    } catch {
      // Keep existing local state
    }
  },

  activatePromptVersion: async (versionId: string) => {
    const { promptVersions, agent } = get();
    const target = promptVersions.find(v => v.id === versionId);
    if (!target) return;

    if (agent.id) {
      try {
        await agentService.activatePromptVersion(agent.id, versionId);
      } catch {
        // Continue with local update
      }
    }

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
      'claude-opus-4.6': 150, 'claude-sonnet-4.6': 50, 'claude-haiku-4.5': 15,
      'gpt-4o': 60, 'gemini-2.5-pro': 40, 'llama-4': 20, 'custom': 50,
    };
    const base = modelCosts[a.model] || 50;
    const toolMultiplier = 1 + (a.tools.filter(t => t.enabled).length * 0.05);
    const ragMultiplier = a.rag_sources.length > 0 ? 1.2 : 1;
    return Math.round(base * toolMultiplier * ragMultiplier);
  },

  getCompleteness: () => computeCompleteness(get().agent),

  getReadinessScore: () => computeReadinessScore(get().agent),

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
