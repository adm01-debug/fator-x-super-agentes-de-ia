/**
 * Super Cérebro v2 — 8-Tab Navigation
 * The Enterprise Memory Layer that no competitor has.
 */

import { useCerebroStore } from '@/stores/cerebroStore';

const CEREBRO_TABS = [
  { id: 'overview',    label: 'Visão Geral',      icon: '📊', description: 'Dashboard, health score, alertas' },
  { id: 'collections', label: 'Coleções',          icon: '📚', description: 'Documentos, conectores, sync' },
  { id: 'graph',       label: 'Grafo Temporal',    icon: '🌐', description: 'Entidades, relacionamentos, timeline' },
  { id: 'facts',       label: 'Fatos',             icon: '💾', description: 'Regras de negócio validadas' },
  { id: 'experts',     label: 'Especialistas',     icon: '👨‍💼', description: 'Quem sabe sobre o quê?' },
  { id: 'health',      label: 'Saúde',             icon: '🩺', description: 'Decay, gaps, duplicatas' },
  { id: 'search',      label: 'Busca Unificada',   icon: '🔍', description: 'Vetor + BM25 + Grafo + RRF' },
  { id: 'sandbox',     label: 'Sandbox',           icon: '🧪', description: 'Testar o cérebro com perguntas' },
] as const;

export function CerebroTabNav() {
  const { activeTab, setActiveTab } = useCerebroStore();

  return (
    <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border mb-6">
      {CEREBRO_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all
            ${activeTab === tab.id
              ? 'bg-primary/5 text-primary border border-primary/25'
              : 'text-muted-foreground hover:text-foreground hover:bg-card'
            }
          `}
          title={tab.description}
        >
          <span>{tab.icon}</span>
          <span className="hidden md:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export { CEREBRO_TABS };
export default CerebroTabNav;
