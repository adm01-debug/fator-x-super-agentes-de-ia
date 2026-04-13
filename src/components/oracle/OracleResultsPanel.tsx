import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy, FileText, RefreshCw,
} from "lucide-react";
import type { OracleResult, OracleMode } from "@/stores/types/oracleTypes";
import { ORACLE_MODES } from "@/stores/oracleStore";
import { ModelCard } from "@/components/oracle/ModelCard";
import { ConsensusMatrix } from "@/components/oracle/ConsensusMatrix";
import { toast } from "sonner";

interface OracleResultsPanelProps {
  results: OracleResult;
  mode: OracleMode;
  chairmanModel: string;
  enableThinking: boolean;
  selectedPreset: string;
  currentPresetName?: string;
  onExportMd: () => void;
  onRefresh: () => void;
}

export function OracleResultsPanel({
  results, mode, chairmanModel, enableThinking,
  selectedPreset, currentPresetName,
  onExportMd, onRefresh,
}: OracleResultsPanelProps) {
  const modeConfig = ORACLE_MODES[mode];

  return (
    <div className="space-y-4">
      {/* Metrics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { v: `${results.confidence_score}%`, l: 'Confiança', c: results.confidence_score >= 80 ? 'text-nexus-emerald' : results.confidence_score >= 50 ? 'text-nexus-amber' : 'text-nexus-rose' },
          { v: `${results.consensus_degree}%`, l: 'Consenso', c: results.consensus_degree >= 80 ? 'text-nexus-emerald' : results.consensus_degree >= 50 ? 'text-nexus-amber' : 'text-nexus-rose' },
          { v: `$${results.metrics.total_cost_usd.toFixed(4)}`, l: 'Custo Total', c: 'text-foreground' },
          { v: `${(results.metrics.total_latency_ms / 1000).toFixed(1)}s`, l: 'Tempo Total', c: 'text-foreground' },
        ].map(m => (
          <div key={m.l} className="nexus-card text-center py-3">
            <p className={`text-xl font-heading font-bold ${m.c}`}>{m.v}</p>
            <p className="text-[11px] text-muted-foreground">{m.l}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="response">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="response" className="text-xs">Resposta</TabsTrigger>
          <TabsTrigger value="individual" className="text-xs">Individual ({results.stage1_results.length})</TabsTrigger>
          <TabsTrigger value="consensus" className="text-xs">Consenso</TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="response" className="mt-4">
          <div className="nexus-card">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-[11px]">{modeConfig.icon} {modeConfig.label}</Badge>
              <Badge variant="outline" className="text-[11px] text-muted-foreground">Chairman: {chairmanModel.split('/').pop()}</Badge>
            </div>
            <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
              {results.final_response}
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(results.final_response); toast.success('Copiado!'); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
              <Button size="sm" variant="outline" onClick={onExportMd}><FileText className="h-3.5 w-3.5 mr-1" /> Markdown</Button>
              <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="individual" className="mt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.stage1_results.map((r, i) => (
              <ModelCard key={i} response={r} rank={i + 1} showThinking={enableThinking} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="consensus" className="mt-4">
          {results.consensus_points && results.consensus_points.length > 0 ? (
            <ConsensusMatrix points={results.consensus_points} overallConsensus={results.consensus_degree} />
          ) : (
            <div className="nexus-card grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-nexus-emerald mb-2">🟢 Consenso</p>
                <div className="text-xs text-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">
                  {results.final_response.match(/## Pontos de Consenso[\s\S]*?(?=##|$)/)?.[0] || 'Veja resposta sintetizada.'}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-nexus-amber mb-2">🔴 Divergências</p>
                <div className="text-xs text-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">
                  {results.final_response.match(/## Divergências[\s\S]*?(?=##|$)/)?.[0] || 'Veja resposta sintetizada.'}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <div className="nexus-card space-y-2 text-xs">
            {[
              ['Modo', `${modeConfig.icon} ${modeConfig.label}`],
              ['Preset', currentPresetName || selectedPreset],
              ['Chairman', chairmanModel.split('/').pop()],
              ['Modelos utilizados', results.metrics.models_used],
              ['Tokens totais', results.metrics.total_tokens.toLocaleString()],
              ['Custo total', `$${results.metrics.total_cost_usd.toFixed(4)}`],
              ...ORACLE_MODES[mode].stages.map((s, i) => {
                const latencies = [results.metrics.stage1_latency_ms, results.metrics.stage2_latency_ms, results.metrics.stage3_latency_ms];
                return [`${s}`, `${((latencies[i] || 0) / 1000).toFixed(1)}s`];
              }),
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-foreground">{v}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold border-t border-border/50 pt-2">
              <span className="text-foreground">Tempo total</span>
              <span className="text-primary">{(results.metrics.total_latency_ms / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
