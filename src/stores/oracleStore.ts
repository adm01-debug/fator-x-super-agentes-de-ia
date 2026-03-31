import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { saveOracleHistory } from '@/lib/oracleHistory';

// ═══ TYPES ═══

export type OracleMode = 'council' | 'researcher' | 'validator' | 'executor' | 'advisor';

export interface OraclePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  mode: OracleMode;
  members: Array<{ model: string; persona: string }>;
  chairman: string;
  enablePeerReview: boolean;
  enableThinking: boolean;
  criteriaWeights?: Record<string, number>;
}

export interface ModelResponse {
  index: number;
  model: string;
  persona: string;
  content: string;
  thinking?: string;
  tokens: { total: number };
  cost_usd: number;
  latency_ms: number;
  success: boolean;
}

export interface ConsensusPoint {
  id: string;
  claim: string;
  category: 'fact' | 'opinion' | 'recommendation' | 'risk' | 'number';
  modelPositions: Array<{
    model: string;
    position: 'agree' | 'disagree' | 'partially_agree' | 'not_mentioned';
    detail: string;
    confidence: number;
  }>;
  consensusLevel: 'strong' | 'partial' | 'disputed' | 'unique';
  resolution?: string;
}

export interface Citation {
  id: string;
  claim: string;
  sourceType: 'web' | 'model_consensus' | 'internal';
  sourceModel?: string;
  excerpt?: string;
  consensusLevel: number;
  verified: boolean;
}

export interface OracleResult {
  final_response: string;
  confidence_score: number;
  consensus_degree: number;
  stage1_results: ModelResponse[];
  stage2_results: any[];
  consensus_points?: ConsensusPoint[];
  citations?: Citation[];
  metrics: {
    total_latency_ms: number;
    stage1_latency_ms: number;
    stage2_latency_ms: number;
    stage3_latency_ms: number;
    total_cost_usd: number;
    total_tokens: number;
    models_used: number;
  };
}

interface OracleStore {
  query: string;
  mode: OracleMode;
  selectedPreset: string;
  isRunning: boolean;
  currentStage: number;
  stageLabel: string;
  results: OracleResult | null;
  error: string | null;
  history: Array<{ query: string; results: OracleResult; timestamp: string; preset: string; mode: OracleMode }>;
  enableThinking: boolean;
  chairmanModel: string;
  chairmanSelection: 'auto' | 'manual';

  setQuery: (q: string) => void;
  setMode: (m: OracleMode) => void;
  setSelectedPreset: (p: string) => void;
  setEnableThinking: (v: boolean) => void;
  setChairmanModel: (m: string) => void;
  setChairmanSelection: (s: 'auto' | 'manual') => void;
  submitQuery: () => Promise<void>;
  clearResults: () => void;
}

// ═══ MODE DEFINITIONS ═══

export const ORACLE_MODES: Record<OracleMode, { label: string; icon: string; description: string; stages: string[] }> = {
  council: {
    label: 'Conselho',
    icon: '🏛️',
    description: 'N modelos + peer review + síntese — padrão Karpathy',
    stages: ['Opiniões', 'Peer Review', 'Síntese'],
  },
  researcher: {
    label: 'Pesquisador',
    icon: '🔬',
    description: 'Pesquisa profunda multi-fonte com relatório estruturado',
    stages: ['Decomposição', 'Análise', 'Síntese', 'Verificação'],
  },
  validator: {
    label: 'Validador',
    icon: '✅',
    description: 'Verifica claims contra múltiplos modelos',
    stages: ['Verificação', 'Cruzamento', 'Veredicto'],
  },
  executor: {
    label: 'Executor',
    icon: '⚡',
    description: 'Decompõe tarefa em sub-tarefas e orquestra execução',
    stages: ['Planejamento', 'Execução', 'Consolidação'],
  },
  advisor: {
    label: 'Conselheiro',
    icon: '🎯',
    description: 'Debate estruturado com prós/contras para decisões',
    stages: ['Análise', 'Debate', 'Recomendação'],
  },
};

// ═══ PRESETS ═══

export const ORACLE_PRESETS: OraclePreset[] = [
  // Generic presets
  {
    id: 'executive',
    name: '👔 Conselho Executivo',
    icon: '👔',
    description: 'Decisões estratégicas com múltiplas perspectivas de liderança',
    mode: 'council',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Analista Estratégico' },
      { model: 'openai/gpt-5', persona: 'Consultor de Negócios' },
      { model: 'google/gemini-2.5-flash', persona: 'Especialista em Dados' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: true,
    enableThinking: false,
  },
  {
    id: 'quick',
    name: '⚡ Oráculo Rápido',
    icon: '⚡',
    description: 'Respostas rápidas com 2 modelos e sem peer review',
    mode: 'council',
    members: [
      { model: 'google/gemini-2.5-flash', persona: 'Assistente Rápido' },
      { model: 'openai/gpt-5-mini', persona: 'Analista' },
    ],
    chairman: 'google/gemini-2.5-flash',
    enablePeerReview: false,
    enableThinking: false,
  },
  {
    id: 'technical',
    name: '💻 Arquitetura Técnica',
    icon: '💻',
    description: 'Decisões de arquitetura, tech stack, code review',
    mode: 'council',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Arquiteto Senior focado em escalabilidade' },
      { model: 'openai/gpt-5', persona: 'Especialista em segurança e edge cases' },
      { model: 'google/gemini-2.5-flash', persona: 'Pesquisador de melhores práticas' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: true,
    enableThinking: true,
  },
  {
    id: 'debate',
    name: '⚖️ Debate de Decisão',
    icon: '⚖️',
    description: 'Debate estruturado com prós e contras',
    mode: 'advisor',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Defensor (a favor)' },
      { model: 'openai/gpt-5', persona: 'Oponente (contra)' },
      { model: 'google/gemini-2.5-flash', persona: 'Mediador neutro' },
    ],
    chairman: 'google/gemini-2.5-flash',
    enablePeerReview: true,
    enableThinking: false,
  },
  // Domain presets
  {
    id: 'financial_analysis',
    name: '💰 Análise Financeira',
    icon: '💰',
    description: 'Decisões financeiras com projeções e análise de risco',
    mode: 'advisor',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Analista Financeiro Senior' },
      { model: 'openai/gpt-5', persona: 'Controller e Gestor de Riscos' },
      { model: 'google/gemini-2.5-flash', persona: 'Especialista em Projeções' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: true,
    enableThinking: true,
    criteriaWeights: { accuracy: 30, reasoning: 25, practicality: 25, risk_assessment: 20 },
  },
  {
    id: 'market_research',
    name: '🔬 Pesquisa de Mercado',
    icon: '🔬',
    description: 'Análise profunda de mercado com fontes verificáveis',
    mode: 'researcher',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Pesquisador de Mercado' },
      { model: 'openai/gpt-5', persona: 'Analista de Tendências' },
      { model: 'google/gemini-2.5-flash', persona: 'Coletor de Dados' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: true,
    enableThinking: true,
  },
  {
    id: 'factcheck',
    name: '🔍 Verificação de Fatos',
    icon: '🔍',
    description: 'Verifica claims contra múltiplos modelos',
    mode: 'validator',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Verificador de Fatos' },
      { model: 'openai/gpt-5', persona: 'Analista Crítico' },
      { model: 'google/gemini-2.5-flash', persona: 'Pesquisador de Fontes' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: true,
    enableThinking: false,
  },
  {
    id: 'legal_compliance',
    name: '⚖️ Jurídico & Compliance',
    icon: '⚖️',
    description: 'Análise jurídica com múltiplas perspectivas e legislação',
    mode: 'validator',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Consultor Jurídico' },
      { model: 'openai/gpt-5', persona: 'Especialista em Compliance' },
      { model: 'google/gemini-2.5-flash', persona: 'Pesquisador de Legislação' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: true,
    enableThinking: true,
  },
  {
    id: 'crisis_response',
    name: '🚨 Resposta a Crise',
    icon: '🚨',
    description: 'Decisão rápida em situação crítica — sem peer review',
    mode: 'council',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Gestor de crise focado em ação imediata' },
      { model: 'openai/gpt-5', persona: 'Analista de riscos e consequências' },
      { model: 'google/gemini-2.5-flash', persona: 'Comunicador — stakeholders' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: false,
    enableThinking: false,
  },
  {
    id: 'content_strategy',
    name: '✍️ Estratégia de Conteúdo',
    icon: '✍️',
    description: 'Brainstorming criativo com múltiplas perspectivas',
    mode: 'council',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Estrategista de marca' },
      { model: 'openai/gpt-5', persona: 'Copywriter criativo e storyteller' },
      { model: 'google/gemini-2.5-flash', persona: 'Analista de tendências e SEO' },
    ],
    chairman: 'openai/gpt-5',
    enablePeerReview: true,
    enableThinking: false,
  },
  {
    id: 'hr_people',
    name: '👥 RH & Pessoas',
    icon: '👥',
    description: 'Decisões sobre pessoas, cultura e desenvolvimento',
    mode: 'advisor',
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Diretor de RH' },
      { model: 'openai/gpt-5', persona: 'Especialista em Cultura Organizacional' },
      { model: 'google/gemini-2.5-flash', persona: 'Analista de Desenvolvimento' },
    ],
    chairman: 'google/gemini-2.5-pro',
    enablePeerReview: true,
    enableThinking: false,
  },
];

// ═══ STORE ═══

export const useOracleStore = create<OracleStore>((set, get) => ({
  query: '',
  mode: 'council',
  selectedPreset: 'executive',
  isRunning: false,
  currentStage: 0,
  stageLabel: '',
  results: null,
  error: null,
  history: [],
  enableThinking: false,
  chairmanModel: 'google/gemini-2.5-pro',
  chairmanSelection: 'auto',

  setQuery: (query) => set({ query }),
  setMode: (mode) => set({ mode }),
  setSelectedPreset: (selectedPreset) => {
    const preset = ORACLE_PRESETS.find(p => p.id === selectedPreset);
    if (preset) {
      set({
        selectedPreset,
        mode: preset.mode,
        enableThinking: preset.enableThinking,
        chairmanModel: preset.chairman,
      });
    }
  },
  setEnableThinking: (enableThinking) => set({ enableThinking }),
  setChairmanModel: (chairmanModel) => set({ chairmanModel }),
  setChairmanSelection: (chairmanSelection) => set({ chairmanSelection }),

  submitQuery: async () => {
    const { query, selectedPreset, mode, enableThinking, chairmanModel } = get();
    if (!query.trim()) return;

    const preset = ORACLE_PRESETS.find(p => p.id === selectedPreset) || ORACLE_PRESETS[0];
    const modeConfig = ORACLE_MODES[mode];

    set({ isRunning: true, currentStage: 1, stageLabel: modeConfig.stages[0], results: null, error: null });

    try {
      // Simulate stage progression
      const stageCount = modeConfig.stages.length;
      for (let i = 1; i < stageCount; i++) {
        setTimeout(() => {
          const { isRunning } = get();
          if (isRunning) set({ currentStage: i + 1, stageLabel: modeConfig.stages[i] });
        }, i * 4000);
      }

      const { data, error } = await supabase.functions.invoke('oracle-council', {
        body: {
          query,
          mode,
          members: preset.members,
          chairman_model: chairmanModel,
          enable_peer_review: preset.enablePeerReview,
          enable_thinking: enableThinking,
          preset_id: preset.id,
        },
      });

      if (error) throw error;

      const results = data as OracleResult;
      set({
        results,
        currentStage: stageCount,
        stageLabel: modeConfig.stages[stageCount - 1],
        isRunning: false,
        history: [...get().history, { query, results, timestamp: new Date().toISOString(), preset: preset.id, mode }],
      });

      // Persist to database
      saveOracleHistory(query, mode, preset.id, preset.name, chairmanModel, enableThinking, results).catch(() => {});
    } catch (e: any) {
      set({ error: e.message || 'Erro ao consultar o Oráculo', isRunning: false, currentStage: 0, stageLabel: '' });
    }
  },

  clearResults: () => set({ results: null, currentStage: 0, stageLabel: '', error: null }),
}));
