import { create } from 'zustand';
import type { AgentConfig, PromptVersion, ReadinessScore, ReadinessItem } from '@/types/agentTypes';
import { DEFAULT_AGENT, TABS } from '@/data/agentBuilderData';
import * as agentService from '@/services/agentService';
import { AgentConfigSchema } from '@/lib/validation';

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

// ═══ READINESS SCORE CALCULATOR ═══
function computeReadinessScore(agent: AgentConfig): ReadinessScore {
  const categories: ReadinessScore['categories'] = {};
  const blockers: string[] = [];
  const recommendations: string[] = [];

  // Identity (max 10)
  const identityItems: ReadinessItem[] = [
    { label: 'Nome definido', passed: !!agent.name, weight: 3, is_blocker: false },
    { label: 'Missão definida', passed: !!agent.mission, weight: 3, is_blocker: false },
    { label: 'Persona selecionada', passed: !!agent.persona, weight: 2, is_blocker: false },
    { label: 'Escopo definido (>50 chars)', passed: agent.scope.length > 50, weight: 2, is_blocker: false, fix_hint: 'Detalhe o escopo com mais de 50 caracteres' },
  ];
  categories.identity = { score: identityItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 10, items: identityItems };
  if (!agent.name) recommendations.push('💡 Defina um nome para o agente (+3 pontos)');
  if (agent.scope.length <= 50) recommendations.push('💡 Detalhe o escopo do agente (+2 pontos)');

  // Brain (max 12)
  const brainItems: ReadinessItem[] = [
    { label: 'Modelo selecionado', passed: !!agent.model, weight: 5, is_blocker: false },
    { label: 'Fallback configurado', passed: !!agent.model_fallback, weight: 3, is_blocker: false },
    { label: 'Raciocínio definido', passed: !!agent.reasoning, weight: 4, is_blocker: false },
  ];
  categories.brain = { score: brainItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: brainItems };
  if (!agent.model_fallback) recommendations.push('💡 Configurar modelo fallback (+3 pontos)');

  // Memory (max 12)
  const longTermCount = [agent.memory_episodic, agent.memory_semantic, agent.memory_procedural, agent.memory_profile, agent.memory_shared].filter(Boolean).length;
  const memoryItems: ReadinessItem[] = [
    { label: 'Short-term ativo', passed: agent.memory_short_term, weight: 3, is_blocker: false },
    { label: '≥2 memórias de longo prazo', passed: longTermCount >= 2, weight: 4, is_blocker: false },
    { label: 'Governança configurada', passed: longTermCount > 0, weight: 3, is_blocker: false },
    { label: 'Consolidação definida', passed: !!agent.memory_consolidation, weight: 2, is_blocker: false },
  ];
  categories.memory = { score: memoryItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: memoryItems };
  if (longTermCount < 2) recommendations.push('💡 Ativar ≥2 memórias de longo prazo (+4 pontos)');

  // RAG (max 12)
  const ragItems: ReadinessItem[] = [
    { label: 'Arquitetura selecionada', passed: !!agent.rag_architecture, weight: 3, is_blocker: false },
    { label: 'Vector DB selecionado', passed: !!agent.rag_vector_db, weight: 3, is_blocker: false },
    { label: '≥1 fonte de conhecimento', passed: agent.rag_sources.length > 0, weight: 3, is_blocker: false },
    { label: 'Reranker ativo', passed: agent.rag_reranker, weight: 1, is_blocker: false },
    { label: 'Hybrid search ativo', passed: agent.rag_hybrid_search, weight: 2, is_blocker: false },
  ];
  categories.rag = { score: ragItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: ragItems };
  if (agent.rag_sources.length === 0) recommendations.push('💡 Adicionar ≥1 fonte de conhecimento (+3 pontos)');

  // Tools (max 8)
  const activeTools = agent.tools.filter(t => t.enabled);
  const allToolsGoverned = activeTools.length > 0 && activeTools.every(t => t.max_calls_per_session > 0);
  const toolsItems: ReadinessItem[] = [
    { label: '≥3 ferramentas ativas', passed: activeTools.length >= 3, weight: 3, is_blocker: false },
    { label: 'Governança configurada em todas', passed: allToolsGoverned, weight: 3, is_blocker: false },
    { label: 'MCP server configurado', passed: agent.mcp_servers.length > 0, weight: 2, is_blocker: false },
  ];
  categories.tools = { score: toolsItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 8, items: toolsItems };

  // Prompt (max 15)
  const activeTechniques = agent.prompt_techniques.filter(t => t.enabled);
  const promptItems: ReadinessItem[] = [
    { label: 'System prompt >200 chars', passed: agent.system_prompt.length > 200, weight: 5, is_blocker: false },
    { label: '≥2 técnicas de prompt ativas', passed: activeTechniques.length >= 2, weight: 3, is_blocker: false },
    { label: '≥2 few-shot examples', passed: agent.few_shot_examples.length >= 2, weight: 4, is_blocker: false },
    { label: 'Output format definido', passed: !!agent.output_format, weight: 3, is_blocker: false },
  ];
  categories.prompt = { score: promptItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 15, items: promptItems };
  if (agent.system_prompt.length <= 200) recommendations.push('💡 Expandir system prompt para >200 chars (+5 pontos)');
  if (agent.few_shot_examples.length < 2) recommendations.push('💡 Adicionar ≥2 exemplos few-shot (+4 pontos)');

  // Guardrails (max 15) — has BLOCKERS
  const activeGuardrails = agent.guardrails.filter(g => g.enabled);
  const hasInjectionGuardrail = activeGuardrails.some(g => g.name.toLowerCase().includes('injection'));
  const hasPiiGuardrail = activeGuardrails.some(g => g.name.toLowerCase().includes('pii'));
  const guardrailItems: ReadinessItem[] = [
    { label: 'Prompt Injection Detection ativo', passed: hasInjectionGuardrail, weight: 5, is_blocker: true, fix_hint: 'Ativar detecção de prompt injection em Guardrails' },
    { label: '≥5 guardrails ativos', passed: activeGuardrails.length >= 5, weight: 4, is_blocker: false },
    { label: 'PII Redaction ativo', passed: hasPiiGuardrail, weight: 3, is_blocker: false },
    { label: 'Audit trail ativo', passed: activeGuardrails.some(g => g.name.toLowerCase().includes('audit')), weight: 3, is_blocker: false },
  ];
  categories.guardrails = { score: guardrailItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 15, items: guardrailItems };
  if (!hasInjectionGuardrail) blockers.push('⛔ Prompt Injection Detection não está ativo');

  // Testing (max 10) — has BLOCKERS
  const testingItems: ReadinessItem[] = [
    { label: '≥3 cenários de teste', passed: agent.test_cases.length >= 3, weight: 4, is_blocker: true, fix_hint: 'Criar pelo menos 3 cenários de teste em Avaliação & Testes' },
    { label: '≥1 bateria executada', passed: !!agent.last_test_results, weight: 3, is_blocker: false },
    { label: 'Accuracy >80%', passed: (agent.last_test_results?.accuracy ?? 0) > 80, weight: 3, is_blocker: false },
  ];
  categories.testing = { score: testingItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 10, items: testingItems };
  if (agent.test_cases.length < 3) blockers.push('⛔ Menos de 3 cenários de teste criados');

  // Observability (max 6) — has BLOCKERS
  const obsItems: ReadinessItem[] = [
    { label: 'Logging ativo', passed: agent.logging_enabled, weight: 3, is_blocker: true, fix_hint: 'Ativar logging em Deploy & Canais' },
    { label: 'Alerting ativo', passed: agent.alerting_enabled, weight: 3, is_blocker: false },
  ];
  categories.observability = { score: obsItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 6, items: obsItems };
  if (!agent.logging_enabled) blockers.push('⛔ Logging não está habilitado');

  // Calculate total
  const total = Object.values(categories).reduce((s, c) => s + c.score, 0);
  const maxTotal = Object.values(categories).reduce((s, c) => s + c.max, 0);
  const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

  // Maturity level
  let maturity_level: ReadinessScore['maturity_level'] = 'prototype';
  if (percentage >= 80 && blockers.length === 0) maturity_level = 'production_ready';
  else if (percentage >= 60) maturity_level = 'staging';
  else if (percentage >= 40) maturity_level = 'tested';

  return { total: percentage, categories, blockers, recommendations, maturity_level };
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
