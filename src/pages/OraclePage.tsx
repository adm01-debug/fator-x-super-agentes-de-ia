import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Copy, RefreshCw, ChevronDown, ChevronUp, Settings2, FileText, History } from 'lucide-react';
import { useOracleStore, ORACLE_MODES, ORACLE_PRESETS } from '@/stores/oracleStore';
import { PresetSelector } from '@/components/oracle/PresetSelector';
import { StageProgress } from '@/components/oracle/StageProgress';
import { ConsensusMatrix } from '@/components/oracle/ConsensusMatrix';
import { ModelCard } from '@/components/oracle/ModelCard';
import { OracleHistory } from '@/components/oracle/OracleHistory';
import { exportToMarkdown, downloadText } from '@/lib/oracleExport';
import { toast } from 'sonner';
import { DeepResearchPanel } from '@/components/oracle/DeepResearchPanel';
// Generative UI: available via GenerativeUI component
// SSE Streaming: available via useStreamingResponse hook

const CHAIRMAN_MODELS = [
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openai/gpt-5', label: 'GPT-5' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
];

export default function OraclePage() {
  const store = useOracleStore();
  const [showPresets, setShowPresets] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const currentPreset = ORACLE_PRESETS.find(p => p.id === store.selectedPreset);
  const modeConfig = ORACLE_MODES[store.mode];

  const handleExportMd = () => {
    if (!store.results) return;
    const md = exportToMarkdown(store.query, store.results, currentPreset?.name || store.selectedPreset, `${modeConfig.icon} ${modeConfig.label}`, store.chairmanModel);
    downloadText(md, `oraculo_${Date.now()}.md`);
    toast.success('Markdown exportado!');
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="🔮 Oráculo v2 — Multi-LLM Council" description="5 modos de operação • Peer review • Consenso visual • Thinking expandível" />

      {/* ═══ INPUT AREA ═══ */}
      <div className="nexus-card space-y-4">
        {/* Mode & Preset selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors"
            >
              <span className="text-sm">{currentPreset?.icon || '🏛️'}</span>
              <span className="text-xs font-medium text-foreground">{currentPreset?.name.replace(/^[^\s]+\s/, '') || 'Conselho Executivo'}</span>
              {showPresets ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
            </button>
            <Badge variant="outline" className="text-[11px]">
              {modeConfig.icon} {modeConfig.label}
            </Badge>
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              {currentPreset?.members.length || 3} modelos
            </Badge>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Avançado
          </button>
        </div>

        {/* Preset selector (collapsible) */}
        {showPresets && (
            <div className="overflow-hidden">
              <PresetSelector selectedPreset={store.selectedPreset} onSelect={(id) => { store.setSelectedPreset(id); setShowPresets(false); }} />
            </div>
          )}
        

        {/* Advanced settings (collapsible) */}
        {showAdvanced && (
            <div className="overflow-hidden">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  {/* Chairman selector */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Chairman (Sintetizador)</Label>
                    <Select value={store.chairmanModel} onValueChange={store.setChairmanModel}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHAIRMAN_MODELS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Chairman selection mode */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Seleção Chairman</Label>
                    <Select value={store.chairmanSelection} onValueChange={(v) => store.setChairmanSelection(v as 'auto' | 'manual')}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto" className="text-xs">🤖 Auto (por domínio)</SelectItem>
                        <SelectItem value="manual" className="text-xs">✋ Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Thinking toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-[11px]">💭 Modo Thinking</Label>
                    <p className="text-[11px] text-muted-foreground">Mostra raciocínio passo-a-passo de cada modelo</p>
                  </div>
                  <Switch checked={store.enableThinking} onCheckedChange={store.setEnableThinking} />
                </div>
              </div>
            </div>
          )}
        

        {/* Query input */}
        <Textarea
          placeholder="Faça sua pergunta ao conselho de IAs..."
          value={store.query}
          onChange={(e) => store.setQuery(e.target.value)}
          className="min-h-[100px] bg-secondary/50 border-border/50 text-sm"
        />

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">{modeConfig.stages.join(' → ')}</p>
          <Button onClick={store.submitQuery} disabled={store.isRunning || !store.query.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
            {store.isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {store.isRunning ? 'Consultando...' : '🔮 Convocar Conselho'}
          </Button>
        </div>
      </div>

      {/* ═══ STAGE PROGRESS ═══ */}
      {store.isRunning && <StageProgress mode={store.mode} currentStage={store.currentStage} />}

      {/* ═══ ERROR ═══ */}
      {store.error && (
        <div className="nexus-card border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{store.error}</p>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {store.results && (
        <div className="space-y-4">
          {/* Metrics cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { v: `${store.results.confidence_score}%`, l: 'Confiança', c: store.results.confidence_score >= 80 ? 'text-nexus-emerald' : store.results.confidence_score >= 50 ? 'text-nexus-amber' : 'text-nexus-rose' },
              { v: `${store.results.consensus_degree}%`, l: 'Consenso', c: store.results.consensus_degree >= 80 ? 'text-nexus-emerald' : store.results.consensus_degree >= 50 ? 'text-nexus-amber' : 'text-nexus-rose' },
              { v: `$${store.results.metrics.total_cost_usd.toFixed(4)}`, l: 'Custo Total', c: 'text-foreground' },
              { v: `${(store.results.metrics.total_latency_ms / 1000).toFixed(1)}s`, l: 'Tempo Total', c: 'text-foreground' },
            ].map(m => (
              <div key={m.l} className="nexus-card text-center py-3">
                <p className={`text-xl font-heading font-bold ${m.c}`}>{m.v}</p>
                <p className="text-[11px] text-muted-foreground">{m.l}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="response">
            <TabsList className="bg-secondary/50 border border-border/50">
              <TabsTrigger value="response" className="text-xs">Resposta</TabsTrigger>
              <TabsTrigger value="individual" className="text-xs">Individual ({store.results.stage1_results.length})</TabsTrigger>
              <TabsTrigger value="consensus" className="text-xs">Consenso</TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs">Métricas</TabsTrigger>
            </TabsList>

            {/* Response tab */}
            <TabsContent value="response" className="mt-4">
              <div className="nexus-card">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[11px]">{modeConfig.icon} {modeConfig.label}</Badge>
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">Chairman: {store.chairmanModel.split('/').pop()}</Badge>
                </div>
                <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                  {store.results.final_response}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(store.results!.final_response); toast.success('Copiado!'); }}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportMd}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Markdown
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { store.clearResults(); store.submitQuery(); }}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Individual responses tab */}
            <TabsContent value="individual" className="mt-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {store.results.stage1_results.map((r, i) => (
                  <ModelCard key={i} response={r} rank={i + 1} showThinking={store.enableThinking} />
                ))}
              </div>
            </TabsContent>

            {/* Consensus tab */}
            <TabsContent value="consensus" className="mt-4">
              {store.results.consensus_points && store.results.consensus_points.length > 0 ? (
                <ConsensusMatrix points={store.results.consensus_points} overallConsensus={store.results.consensus_degree} />
              ) : (
                <div className="nexus-card grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-nexus-emerald mb-2">🟢 Consenso</p>
                    <div className="text-xs text-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">
                      {store.results.final_response.match(/## Pontos de Consenso[\s\S]*?(?=##|$)/)?.[0] || 'Veja resposta sintetizada.'}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-nexus-amber mb-2">🔴 Divergências</p>
                    <div className="text-xs text-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">
                      {store.results.final_response.match(/## Divergências[\s\S]*?(?=##|$)/)?.[0] || 'Veja resposta sintetizada.'}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Metrics tab */}
            <TabsContent value="metrics" className="mt-4">
              <div className="nexus-card space-y-2 text-xs">
                {[
                  ['Modo', `${modeConfig.icon} ${modeConfig.label}`],
                  ['Preset', currentPreset?.name || store.selectedPreset],
                  ['Chairman', store.chairmanModel.split('/').pop()],
                  ['Modelos utilizados', store.results.metrics.models_used],
                  ['Tokens totais', store.results.metrics.total_tokens.toLocaleString()],
                  ['Custo total', `$${store.results.metrics.total_cost_usd.toFixed(4)}`],
                  ...ORACLE_MODES[store.mode].stages.map((s, i) => {
                    const latencies = [store.results!.metrics.stage1_latency_ms, store.results!.metrics.stage2_latency_ms, store.results!.metrics.stage3_latency_ms];
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
                  <span className="text-primary">{(store.results.metrics.total_latency_ms / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ═══ HISTORY ═══ */}
      <div className="nexus-card">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 w-full text-left"
        >
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Histórico de Consultas</span>
          {showHistory ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
        </button>
        {showHistory && (
            <div className="overflow-hidden mt-4">
              <OracleHistory />
            </div>
          )}
        
      </div>

      {/* Deep Research */}
      <DeepResearchPanel />
    </div>
  );
}
