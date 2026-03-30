import { create } from 'zustand';
import type { AgentConfig, PromptVersion, ReadinessScore } from '@/types/agentTypes';
import { DEFAULT_AGENT, TABS } from '@/data/agentBuilderData';

interface AgentBuilderStore {
  agent: AgentConfig;
  activeTab: string;
  isDirty: boolean;
  isSaving: boolean;
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

export const useAgentBuilderStore = create<AgentBuilderStore>((set, get) => ({
  agent: { ...DEFAULT_AGENT },
  activeTab: TABS[0].id,
  isDirty: false,
  isSaving: false,
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

  updateAgent: (partial) =>
    set((s) => ({ agent: { ...s.agent, ...partial }, isDirty: true })),

  resetAgent: () => set({ agent: { ...DEFAULT_AGENT }, isDirty: false, activeTab: TABS[0].id }),

  loadAgent: (agent) => set({ agent, isDirty: false, activeTab: TABS[0].id }),

  saveAgent: async () => {
    set({ isSaving: true });
    // Simulated save — will be replaced with Supabase in Etapa 20
    await new Promise((r) => setTimeout(r, 800));
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    set({ isSaving: false, isDirty: false, lastSaved: now });
  },

  loadSavedAgents: async () => {
    // Will be replaced with Supabase
  },

  deleteAgent: async () => {
    // Will be replaced with Supabase
  },

  duplicateAgent: () => {
    const { agent } = get();
    set({
      agent: { ...agent, id: undefined, name: `${agent.name} (cópia)`, status: 'draft', version: 1 },
      isDirty: true,
    });
  },

  exportJSON: () => JSON.stringify(get().agent, null, 2),

  exportMarkdown: () => {
    const a = get().agent;
    return `# ${a.avatar_emoji} ${a.name}\n\n**Missão:** ${a.mission}\n**Modelo:** ${a.model}\n**Status:** ${a.status}\n`;
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
