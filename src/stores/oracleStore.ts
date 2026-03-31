import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface OracleResult {
  final_response: string;
  confidence_score: number;
  consensus_degree: number;
  stage1_results: Array<{
    model: string;
    persona: string;
    content: string;
    tokens: { total: number };
    cost_usd: number;
    latency_ms: number;
    success: boolean;
  }>;
  stage2_results: any[];
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
  mode: string;
  isRunning: boolean;
  currentStage: number;
  results: OracleResult | null;
  error: string | null;
  history: Array<{ query: string; results: OracleResult; timestamp: string }>;

  setQuery: (q: string) => void;
  setMode: (m: string) => void;
  submitQuery: () => Promise<void>;
  clearResults: () => void;
}

const PRESETS: Record<string, { members: Array<{ model: string; persona: string }>; chairman: string }> = {
  executive: {
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Analista Estratégico' },
      { model: 'openai/gpt-5', persona: 'Consultor de Negócios' },
      { model: 'google/gemini-2.5-flash', persona: 'Especialista em Dados' },
    ],
    chairman: 'google/gemini-2.5-pro',
  },
  quick: {
    members: [
      { model: 'google/gemini-2.5-flash', persona: 'Assistente Rápido' },
      { model: 'openai/gpt-5-mini', persona: 'Analista' },
    ],
    chairman: 'google/gemini-2.5-flash',
  },
  technical: {
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Engenheiro Senior' },
      { model: 'openai/gpt-5', persona: 'Arquiteto de Software' },
      { model: 'google/gemini-2.5-flash', persona: 'DevOps Specialist' },
    ],
    chairman: 'google/gemini-2.5-pro',
  },
  research: {
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Pesquisador Acadêmico' },
      { model: 'openai/gpt-5', persona: 'Cientista de Dados' },
      { model: 'google/gemini-2.5-flash', persona: 'Analista de Mercado' },
    ],
    chairman: 'openai/gpt-5',
  },
  debate: {
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Defensor (a favor)' },
      { model: 'openai/gpt-5', persona: 'Oponente (contra)' },
      { model: 'google/gemini-2.5-flash', persona: 'Mediador neutro' },
    ],
    chairman: 'google/gemini-2.5-flash',
  },
  factcheck: {
    members: [
      { model: 'google/gemini-2.5-pro', persona: 'Verificador de Fatos' },
      { model: 'openai/gpt-5', persona: 'Analista Crítico' },
      { model: 'google/gemini-2.5-flash', persona: 'Pesquisador' },
    ],
    chairman: 'google/gemini-2.5-pro',
  },
};

export const useOracleStore = create<OracleStore>((set, get) => ({
  query: '',
  mode: 'executive',
  isRunning: false,
  currentStage: 0,
  results: null,
  error: null,
  history: [],

  setQuery: (query) => set({ query }),
  setMode: (mode) => set({ mode }),

  submitQuery: async () => {
    const { query, mode } = get();
    if (!query.trim()) return;

    set({ isRunning: true, currentStage: 1, results: null, error: null });

    try {
      const preset = PRESETS[mode] || PRESETS.executive;

      // Simulate stage progression
      setTimeout(() => set({ currentStage: 2 }), 3000);
      setTimeout(() => set({ currentStage: 3 }), 8000);

      const { data, error } = await supabase.functions.invoke('oracle-council', {
        body: {
          query,
          members: preset.members,
          chairman_model: preset.chairman,
          enable_peer_review: true,
        },
      });

      if (error) throw error;

      const results = data as OracleResult;
      set({
        results,
        currentStage: 3,
        isRunning: false,
        history: [...get().history, { query, results, timestamp: new Date().toISOString() }],
      });
    } catch (e: any) {
      set({ error: e.message || 'Erro ao consultar o Oráculo', isRunning: false, currentStage: 0 });
    }
  },

  clearResults: () => set({ results: null, currentStage: 0, error: null }),
}));
