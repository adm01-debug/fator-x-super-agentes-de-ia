import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { useOracleStore } from '@/stores/oracleStore';
import { OracleInputArea } from '@/components/oracle/OracleInputArea';
import { OracleResultsPanel } from '@/components/oracle/OracleResultsPanel';
import { StageProgress } from '@/components/oracle/StageProgress';
import { OracleHistory } from '@/components/oracle/OracleHistory';
import { DeepResearchPanel } from '@/components/oracle/DeepResearchPanel';
import { OracleComparisonPanel } from '@/components/oracle/OracleComparisonPanel';
import { OracleAnalyticsPanel } from '@/components/oracle/OracleAnalyticsPanel';
import { AccessControl } from '@/components/rbac';

export default function OraclePage() {
  const store = useOracleStore();
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="🔮 Oráculo v2 — Conselho Multi-LLM"
        description="5 modos de operação • Revisão por pares • Consenso visual • Raciocínio expandível"
        gradient={false}
      />

      <OracleInputArea />

      {store.isRunning && <StageProgress mode={store.mode} currentStage={store.currentStage} />}

      {store.error && (
        <div className="nexus-card border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{store.error}</p>
        </div>
      )}

      {store.results && <OracleResultsPanel />}

      <div className="nexus-card">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 w-full text-left"
        >
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Histórico de Consultas</span>
          {showHistory ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
          )}
        </button>
        {showHistory && (
          <div className="overflow-hidden mt-4">
            <OracleHistory />
          </div>
        )}
      </div>

      <AccessControl permission="oracle.write">
        <DeepResearchPanel />
      </AccessControl>
      <OracleComparisonPanel />
      <OracleAnalyticsPanel />
    </div>
  );
}
