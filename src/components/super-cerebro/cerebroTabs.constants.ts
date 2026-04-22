/**
 * Super Cérebro — definições de tabs (dados puros).
 * Extraído de `CerebroTabNav.tsx` para permitir HMR limpo.
 */

export const CEREBRO_TABS = [
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: '📊',
    description: 'Dashboard, health score, alertas',
  },
  { id: 'collections', label: 'Coleções', icon: '📚', description: 'Documentos, conectores, sync' },
  {
    id: 'graph',
    label: 'Grafo Temporal',
    icon: '🌐',
    description: 'Entidades, relacionamentos, timeline',
  },
  { id: 'facts', label: 'Fatos', icon: '💾', description: 'Regras de negócio validadas' },
  { id: 'experts', label: 'Especialistas', icon: '👨‍💼', description: 'Quem sabe sobre o quê?' },
  { id: 'health', label: 'Saúde', icon: '🩺', description: 'Decay, gaps, duplicatas' },
  { id: 'search', label: 'Busca Unificada', icon: '🔍', description: 'Vetor + BM25 + Grafo + RRF' },
  { id: 'sandbox', label: 'Sandbox', icon: '🧪', description: 'Testar o cérebro com perguntas' },
] as const;
