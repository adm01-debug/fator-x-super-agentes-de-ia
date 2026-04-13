import { create } from 'zustand';
import { saveOracleHistory } from '@/lib/oracleHistory';
import { invokeTracedFunction } from '@/services/llmGatewayService';

export type { OracleMode, OraclePreset, ModelResponse, ConsensusPoint, Citation, OracleResult } from './types/oracleTypes';
import type { OracleMode, OracleResult } from './types/oracleTypes';
export { ORACLE_MODES, ORACLE_PRESETS } from './presets/oraclePresets';
import { ORACLE_MODES, ORACLE_PRESETS } from './presets/oraclePresets';

interface OracleStore {
  query: string;
  mode: OracleMode;
  selectedPreset: string;
  isRunning: boolean;
  currentStage: number;
  stageLabel: string;
  results: OracleResult | null;
  error: string | null;
  history: Array<{
    query: string;
    results: OracleResult;
    timestamp: string;
    preset: string;
    mode: OracleMode;
  }>;
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
    const preset = ORACLE_PRESETS.find((p) => p.id === selectedPreset);
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

    const preset = ORACLE_PRESETS.find((p) => p.id === selectedPreset) || ORACLE_PRESETS[0];
    const modeConfig = ORACLE_MODES[mode];

    set({
      isRunning: true,
      currentStage: 1,
      stageLabel: modeConfig.stages[0],
      results: null,
      error: null,
    });

    try {
      // Progressive stage tracking while API processes
      const stageCount = modeConfig.stages.length;
      const stageTimers: ReturnType<typeof setTimeout>[] = [];
      for (let i = 1; i < stageCount - 1; i++) {
        stageTimers.push(
          setTimeout(() => {
            const { isRunning } = get();
            if (isRunning) set({ currentStage: i + 1, stageLabel: modeConfig.stages[i] });
          }, i * 4000),
        );
      }

      const data = await invokeTracedFunction<OracleResult>(
        'oracle-council',
        {
          query,
          mode,
          members: preset.members,
          chairman_model: chairmanModel,
          enable_peer_review: preset.enablePeerReview,
          enable_thinking: enableThinking,
          preset_id: preset.id,
        },
        {
          spanKind: 'llm',
          extractCostUsd: (d) => (d as OracleResult)?.metrics?.total_cost_usd,
          extractTokens: (d) => {
            const m = (d as OracleResult)?.metrics;
            return m ? { input: m.total_tokens, output: 0 } : undefined;
          },
          extractModel: (b) => (b as { chairman_model?: string }).chairman_model,
        },
      );

      // Clear stage timers since API completed
      stageTimers.forEach(clearTimeout);

      const results = data;
      set({
        results,
        currentStage: stageCount,
        stageLabel: modeConfig.stages[stageCount - 1],
        isRunning: false,
        history: [
          ...get().history,
          { query, results, timestamp: new Date().toISOString(), preset: preset.id, mode },
        ],
      });

      // Persist to database
      saveOracleHistory(
        query,
        mode,
        preset.id,
        preset.name,
        chairmanModel,
        enableThinking,
        results,
      ).catch(() => {});
    } catch (e: unknown) {
      set({
        error: e instanceof Error ? e.message : 'Erro ao consultar o Oráculo',
        isRunning: false,
        currentStage: 0,
        stageLabel: '',
      });
    }
  },

  clearResults: () => set({ results: null, currentStage: 0, stageLabel: '', error: null }),
}));
