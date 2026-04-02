import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Settings, BookOpen, BarChart3, Zap, Plus, Send, Clock, DollarSign, CheckCircle, Key } from 'lucide-react';
import { toast } from 'sonner';
import * as llm from '@/services/llmService';
import * as modelRouter from '@/services/modelRouter';

const PRESETS = [
  // Originais
  { id: 'executive', name: 'Executivo', icon: '👔', models: 4, desc: '4 frontier models + peer review. Para decisões estratégicas.', cost: '$$$$', latency: '15-30s', mode: 'council' },
  { id: 'fast', name: 'Rápido', icon: '⚡', models: 3, desc: '3 modelos leves em paralelo. Resposta em <5s.', cost: '$', latency: '2-5s', mode: 'council' },
  { id: 'research', name: 'Pesquisa Profunda', icon: '🔬', models: 5, desc: '5 modelos × 3 camadas. Deep Research iterativo com fontes.', cost: '$$$$$', latency: '30-60s', mode: 'researcher' },
  { id: 'debate', name: 'Debate', icon: '⚔️', models: 2, desc: '2 modelos debatem 3 rounds + juiz. Decisões controversas.', cost: '$$$', latency: '20-40s', mode: 'advisor' },
  { id: 'technical', name: 'Técnico', icon: '🔧', models: 4, desc: '4 modelos especializados em código/dados.', cost: '$$$', latency: '10-20s', mode: 'council' },
  { id: 'validator', name: 'Verificação', icon: '✅', models: 3, desc: '3 modelos com web search. Fact-checking rigoroso.', cost: '$$', latency: '10-15s', mode: 'validator' },
  // v2: Presets por vertical
  { id: 'financial', name: 'Análise Financeira', icon: '💰', models: 3, desc: 'Projeções, ROI, custo-benefício com dados reais.', cost: '$$$', latency: '15-25s', mode: 'advisor' },
  { id: 'supplier_eval', name: 'Avaliação Fornecedor', icon: '🏭', models: 3, desc: 'Comparação com dados do CRM + Super Cérebro.', cost: '$$', latency: '10-20s', mode: 'advisor' },
  { id: 'legal', name: 'Jurídico & Compliance', icon: '⚖️', models: 3, desc: 'Verificação jurídica multi-perspectiva.', cost: '$$', latency: '10-15s', mode: 'validator' },
  { id: 'crisis', name: 'Resposta a Crise', icon: '🚨', models: 3, desc: 'Decisão rápida com ações imediatas + plano de comunicação.', cost: '$$', latency: '8-15s', mode: 'executor' },
  { id: 'content', name: 'Estratégia de Conteúdo', icon: '✍️', models: 3, desc: 'Brainstorming criativo com tendências e SEO.', cost: '$$', latency: '10-20s', mode: 'council' },
  { id: 'hr', name: 'RH & Pessoas', icon: '👥', models: 3, desc: 'Decisões sobre equipe com sensibilidade.', cost: '$$', latency: '10-15s', mode: 'advisor' },
];

const COUNCIL_STAGES = [
  { num: 1, name: 'Polling', desc: 'N modelos respondem em paralelo', icon: '📡' },
  { num: 2, name: 'Peer Review', desc: 'Cada modelo avalia os outros (anônimo)', icon: '🔍' },
  { num: 3, name: 'Síntese', desc: 'Chairman consolida as melhores respostas', icon: '✨' },
  { num: 4, name: 'Meta-análise', desc: 'Consensus Matrix com claims × modelos', icon: '📊' },
];

const MOCK_HISTORY = [
  { id: '1', query: 'Qual a melhor estratégia de precificação para canetas personalizadas?', preset: 'Executivo', consensus: 92, cost: 0.45, latency: 18200, models: 4, timestamp: '2026-03-31 10:30' },
  { id: '2', query: 'Devemos migrar do Qdrant para pgvector?', preset: 'Técnico', consensus: 78, cost: 0.32, latency: 14500, models: 4, timestamp: '2026-03-31 09:15' },
  { id: '3', query: 'Análise de risco: expandir para mercado B2C', preset: 'Pesquisa Profunda', consensus: 85, cost: 1.20, latency: 45000, models: 5, timestamp: '2026-03-30 16:00' },
  { id: '4', query: 'React vs Vue para o novo portal do cliente', preset: 'Debate', consensus: 65, cost: 0.28, latency: 32000, models: 2, timestamp: '2026-03-30 11:45' },
];

const CONSENSUS_EXAMPLE = {
  claims: ['Preço deve considerar volume', 'Margem mínima de 35%', 'Frete incluso acima de R$500', 'Desconto máximo 15%'],
  models: ['Claude Opus', 'GPT-4o', 'Gemini Pro', 'Claude Sonnet'],
  matrix: [
    ['🟢', '🟢', '🟢', '🟢'],
    ['🟢', '🟡', '🟢', '🟢'],
    ['🟡', '🟢', '🔴', '🟡'],
    ['🟢', '🟢', '🟢', '🔵'],
  ],
};

interface ConsultResult {
  query: string;
  preset: string;
  mode: string;
  consensus: number;
  responses: { model: string; summary: string; score: number }[];
  synthesis: string;
  cost: number;
  latency: number;
  timestamp: string;
}

export default function OraculoPage() {
  const [activeTab, setActiveTab] = useState('config');
  const [consultQuery, setConsultQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('executive');
  const [selectedGateway, setSelectedGateway] = useState('openrouter');
  const [selectedMode, setSelectedMode] = useState('council');
  const [isConsulting, setIsConsulting] = useState(false);
  const [consultResult, setConsultResult] = useState<ConsultResult | null>(null);
  const [consultStage, setConsultStage] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Model IDs for presets
  const PRESET_MODELS: Record<string, string[]> = {
    executive: ['anthropic/claude-opus-4', 'openai/gpt-4o', 'google/gemini-2.5-pro-preview', 'anthropic/claude-sonnet-4'],
    fast: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-chat-v3-0324'],
    research: ['anthropic/claude-opus-4', 'openai/gpt-4o', 'google/gemini-2.5-pro-preview', 'deepseek/deepseek-chat-v3-0324', 'anthropic/claude-sonnet-4'],
    debate: ['anthropic/claude-opus-4', 'openai/gpt-4o'],
    technical: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'deepseek/deepseek-chat-v3-0324', 'google/gemini-2.0-flash-001'],
    validator: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001'],
    financial: ['anthropic/claude-opus-4', 'openai/gpt-4o', 'anthropic/claude-sonnet-4'],
    supplier_eval: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001'],
    legal: ['anthropic/claude-opus-4', 'openai/gpt-4o', 'anthropic/claude-sonnet-4'],
    crisis: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.0-flash-001'],
    content: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001'],
    hr: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001'],
  };

  const runConsult = async () => {
    if (!consultQuery.trim()) return;
    const preset = PRESETS.find(p => p.id === selectedPreset);
    if (!preset) return;
    setIsConsulting(true);
    setConsultResult(null);

    const modelIds = PRESET_MODELS[selectedPreset] ?? PRESET_MODELS.fast;

    if (llm.isLLMConfigured()) {
      // ═══ REAL LLM COUNCIL CALL ═══
      try {
        const result = await llm.runCouncil(consultQuery, modelIds, {
          temperature: 0.7,
          maxTokens: 2048,
          onStageChange: setConsultStage,
        });

        setConsultResult({
          query: consultQuery,
          preset: preset.name,
          mode: preset.mode,
          consensus: result.consensus,
          responses: result.responses.map(r => ({
            model: r.model,
            summary: r.content.slice(0, 300) + (r.content.length > 300 ? '...' : ''),
            score: r.error ? 0 : Math.min(95, 70 + Math.floor(r.content.length / 50)),
          })),
          synthesis: result.synthesis,
          cost: result.totalCost,
          latency: result.totalLatencyMs,
          timestamp: new Date().toLocaleString('pt-BR'),
        });
        setConsultStage('');
        toast.success(`Consulta REAL concluída — consenso ${result.consensus}% entre ${modelIds.length} modelos ($${result.totalCost.toFixed(4)})`);
      } catch (err) {
        // Fallback via modelRouter when council fails
        setConsultStage('🔄 Fallback via modelRouter...');
        try {
          const fallbackResponse = await modelRouter.callWithFallback(
            [{ role: 'user', content: consultQuery }],
            { temperature: 0.7, maxTokens: 2048 }
          );
          setConsultResult({
            query: consultQuery,
            preset: preset.name,
            mode: 'fallback',
            consensus: 50,
            responses: [{ model: fallbackResponse.model, summary: fallbackResponse.content.slice(0, 300), score: 70 }],
            synthesis: fallbackResponse.content,
            cost: fallbackResponse.cost ?? 0,
            latency: fallbackResponse.latencyMs,
            timestamp: new Date().toLocaleString('pt-BR'),
          });
          setConsultStage('');
          toast.warning(`Council falhou — resposta via modelRouter fallback (${fallbackResponse.routing.modelId})`);
        } catch (fallbackErr) {
          toast.error(`Erro: ${fallbackErr instanceof Error ? fallbackErr.message : 'Falha no fallback'}`);
          setConsultStage('');
        }
      }
    } else {
      // ═══ FALLBACK SIMULATION ═══
      const modelNames = modelIds.map(id => llm.AVAILABLE_MODELS.find(m => m.id === id)?.name ?? id);
      setConsultStage('📡 Stage 1/4: Polling — enviando para ' + modelNames.length + ' modelos...');
      setTimeout(() => setConsultStage('🔍 Stage 2/4: Peer Review — avaliando respostas...'), 800);
      setTimeout(() => setConsultStage('✨ Stage 3/4: Síntese — consolidando...'), 1600);
      setTimeout(() => setConsultStage('📊 Stage 4/4: Meta-análise — consensus matrix...'), 2400);

      setTimeout(() => {
        const consensus = 65 + Math.floor(Math.random() * 30);
        setConsultResult({
          query: consultQuery,
          preset: preset.name,
          mode: preset.mode,
          consensus,
          responses: modelNames.map(model => ({
            model,
            summary: `[Simulação] Análise de "${consultQuery.slice(0, 50)}..." — Configure API key para respostas reais.`,
            score: 70 + Math.floor(Math.random() * 25),
          })),
          synthesis: `[SIMULAÇÃO — configure API key para respostas reais]\n\nSíntese simulada (${modelNames.length} modelos, modo ${preset.mode}): Consenso de ${consensus}%. Para deliberação real com LLMs, configure a API key do OpenRouter na aba Configuração.`,
          cost: 0,
          latency: 3200,
          timestamp: new Date().toLocaleString('pt-BR'),
        });
        setConsultStage('');
        toast.info(`Consulta SIMULADA — configure API key do OpenRouter para respostas reais`);
      }, 3200);
    }
    setIsConsulting(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Oráculo"
        description="Multi-LLM Council Engine — 6 padrões de deliberação, 4 estágios, Consensus Matrix"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" onClick={() => setActiveTab('consult')}><Sparkles className="h-4 w-4" /> Consulta Rápida</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Consultas realizadas', value: '47', icon: Sparkles },
          { label: 'Consenso médio', value: '84%', icon: CheckCircle },
          { label: 'Custo médio', value: '$0.38', icon: DollarSign },
          { label: 'Latência média', value: '18.2s', icon: Clock },
        ].map(kpi => (
          <div key={kpi.label} className="nexus-card text-center py-3">
            <kpi.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 p-1 w-full justify-start overflow-x-auto">
          {[
            { id: 'config', icon: Settings, label: 'Configuração' },
            { id: 'presets', icon: BookOpen, label: 'Presets' },
            { id: 'history', icon: Clock, label: 'Histórico' },
            { id: 'metrics', icon: BarChart3, label: 'Métricas' },
            { id: 'consult', icon: Zap, label: 'Consulta Rápida' },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs whitespace-nowrap">
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab 1: Configuração */}
        <TabsContent value="config" className="mt-4 space-y-4">
          {/* API Key Configuration */}
          <div className={`nexus-card border ${llm.isLLMConfigured() ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground"><Key className="h-3.5 w-3.5 inline mr-1" /> API Key — {llm.isLLMConfigured() ? '✅ Configurada' : '⚠️ Não configurada'}</h3>
              {llm.isLLMConfigured() && <span className="text-[10px] text-emerald-400">Provider: {llm.getLLMConfig().provider}</span>}
            </div>
            {!llm.isLLMConfigured() && (
              <p className="text-xs text-amber-400 mb-3">Configure uma API key para consultas reais. Sem key, o sistema usa simulação.</p>
            )}
            <div className="flex gap-2">
              <input
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                type="password"
                placeholder="sk-or-... (OpenRouter) ou sk-ant-... (Anthropic)"
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono"
              />
              <Button size="sm" onClick={() => {
                if (!apiKeyInput || apiKeyInput.length < 10) { toast.error('API key inválida'); return; }
                const provider = apiKeyInput.startsWith('sk-ant-') ? 'anthropic' : apiKeyInput.startsWith('sk-') ? 'openai' : 'openrouter';
                llm.configureLLM({ provider: provider as 'openrouter' | 'anthropic' | 'openai', apiKey: apiKeyInput });
                toast.success(`API key configurada (${provider}). Consultas reais habilitadas!`);
                setApiKeyInput('');
              }}>Salvar</Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Recomendamos OpenRouter (openrouter.ai) — acesso a 200+ modelos com uma única key.</p>
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Gateway LLM</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'openrouter', label: 'OpenRouter (recomendado)' },
                { id: 'direct', label: 'APIs Diretas' },
                { id: 'hybrid', label: 'Híbrido' },
              ].map(gw => (
                <button key={gw.id} onClick={() => { setSelectedGateway(gw.id); toast.success(`Gateway: ${gw.label}`); }}
                  className={`p-3 rounded-xl border text-xs text-center transition-all ${selectedGateway === gw.id ? 'border-primary bg-primary/5 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/30'}`}>
                  {gw.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5 Modos de Operação (v2) */}
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">5 Modos de Operação</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { id: 'council', icon: '🏛️', name: 'Conselho', desc: 'N modelos + peer review + síntese' },
                { id: 'researcher', icon: '🔬', name: 'Pesquisador', desc: 'Deep Research iterativo com fontes' },
                { id: 'validator', icon: '✅', name: 'Validador', desc: 'Verifica claims contra múltiplos modelos' },
                { id: 'executor', icon: '⚡', name: 'Executor', desc: 'Decompõe + orquestra sub-agentes' },
                { id: 'advisor', icon: '🎯', name: 'Conselheiro', desc: 'Debate prós/contras para decisão' },
              ].map(mode => (
                <div key={mode.id} onClick={() => { setSelectedMode(mode.id); toast.info(`Modo: ${mode.name}`); }}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${selectedMode === mode.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'}`}>
                  <span className="text-xl block">{mode.icon}</span>
                  <p className="text-xs font-semibold text-foreground mt-1">{mode.name}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{mode.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">4 Estágios do Council Mode</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {COUNCIL_STAGES.map((stage, i) => (
                <div key={stage.num} className="flex items-center gap-2 shrink-0">
                  <div className="p-3 rounded-xl border border-border bg-card text-center min-w-[140px]">
                    <span className="text-xl block mb-1">{stage.icon}</span>
                    <p className="text-xs font-semibold text-foreground">{stage.num}. {stage.name}</p>
                    <p className="text-[10px] text-muted-foreground">{stage.desc}</p>
                  </div>
                  {i < 3 && <span className="text-muted-foreground shrink-0">→</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Consensus Matrix — Exemplo</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">Claim</th>
                  {CONSENSUS_EXAMPLE.models.map(m => <th key={m} className="text-center py-2 px-2 font-medium text-muted-foreground">{m}</th>)}
                </tr></thead>
                <tbody>
                  {CONSENSUS_EXAMPLE.claims.map((claim, ci) => (
                    <tr key={claim} className="border-b border-border/30">
                      <td className="py-2 text-foreground">{claim}</td>
                      {CONSENSUS_EXAMPLE.matrix[ci].map((v, mi) => (
                        <td key={mi} className="text-center py-2 text-lg">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
              <span>🟢 Acordo forte</span>
              <span>🟡 Acordo parcial</span>
              <span>🔴 Disputado</span>
              <span>🔵 Insight único</span>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Presets */}
        <TabsContent value="presets" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map(preset => (
              <button key={preset.id} onClick={() => { setSelectedPreset(preset.id); toast.success(`Preset "${preset.name}" selecionado`); }}
                className={`nexus-card text-left transition-all ${selectedPreset === preset.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:ring-1 hover:ring-primary/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{preset.icon}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{preset.name}</h4>
                    <span className="text-[10px] text-muted-foreground">{preset.models} modelos</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{preset.desc}</p>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span>💰 {preset.cost}</span>
                  <span>⏱️ {preset.latency}</span>
                  <span className="px-1 py-0.5 rounded bg-primary/10 text-primary">{preset.mode}</span>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Histórico */}
        <TabsContent value="history" className="mt-4">
          <div className="space-y-2">
            {MOCK_HISTORY.map(h => (
              <div key={h.id} className="nexus-card">
                <p className="text-sm text-foreground mb-2">{h.query}</p>
                <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{h.preset}</span>
                  <span>Consenso: <strong className={h.consensus >= 80 ? 'text-emerald-400' : 'text-amber-400'}>{h.consensus}%</strong></span>
                  <span>{h.models} modelos</span>
                  <span>${h.cost.toFixed(2)}</span>
                  <span>{(h.latency / 1000).toFixed(1)}s</span>
                  <span>{h.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Métricas */}
        <TabsContent value="metrics" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="nexus-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Modelos Mais Usados</h3>
              {[
                { model: 'Claude Sonnet 4.6', calls: 89, pct: 38 },
                { model: 'GPT-4o', calls: 67, pct: 28 },
                { model: 'Gemini 2.5 Pro', calls: 45, pct: 19 },
                { model: 'Claude Opus 4.6', calls: 35, pct: 15 },
              ].map(m => (
                <div key={m.model} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-foreground">{m.model}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${m.pct}%` }} /></div>
                    <span className="text-muted-foreground w-12 text-right">{m.calls}x</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="nexus-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Modelo Mais Confiável</h3>
              {[
                { model: 'Claude Opus 4.6', accuracy: 96, agreement: 94 },
                { model: 'GPT-4o', accuracy: 93, agreement: 91 },
                { model: 'Claude Sonnet 4.6', accuracy: 91, agreement: 89 },
                { model: 'Gemini 2.5 Pro', accuracy: 88, agreement: 85 },
              ].map(m => (
                <div key={m.model} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-foreground">{m.model}</span>
                  <div className="flex gap-3">
                    <span className="text-emerald-400 font-mono">{m.accuracy}% acc</span>
                    <span className="text-primary font-mono">{m.agreement}% agr</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Consulta Rápida */}
        <TabsContent value="consult" className="mt-4 space-y-4">
          <div className="nexus-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Consulta ao Conselho</h3>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => setSelectedPreset(p.id)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${selectedPreset === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30'}`}>
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
            <textarea value={consultQuery} onChange={e => setConsultQuery(e.target.value)} className="w-full h-24 bg-muted/30 border border-border rounded-lg p-3 text-sm text-foreground resize-none" placeholder="Faça sua pergunta ao conselho de modelos..." />
            <Button onClick={runConsult} disabled={isConsulting || !consultQuery.trim()} className="w-full gap-2">
              {isConsulting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Consultando {PRESETS.find(p => p.id === selectedPreset)?.models} modelos...</> : <><Send className="h-4 w-4" /> Consultar Oráculo</>}
            </Button>
            {isConsulting && consultStage && (
              <p className="text-xs text-primary animate-pulse text-center">{consultStage}</p>
            )}
          </div>

          {/* Result display */}
          {consultResult && (
            <div className="nexus-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Resultado do Conselho</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Preset: {consultResult.preset}</span>
                  <span>Modo: {consultResult.mode}</span>
                  <span>${consultResult.cost}</span>
                  <span>{(consultResult.latency / 1000).toFixed(1)}s</span>
                </div>
              </div>

              {/* Consensus score */}
              <div className="text-center py-3 rounded-xl bg-muted/20">
                <p className={`text-4xl font-bold font-mono ${consultResult.consensus >= 80 ? 'text-emerald-400' : consultResult.consensus >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {consultResult.consensus}%
                </p>
                <p className="text-xs text-muted-foreground">Consenso entre {consultResult.responses.length} modelos</p>
              </div>

              {/* Synthesis */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <p className="text-xs font-semibold text-foreground mb-1">Síntese Final:</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{consultResult.synthesis}</p>
              </div>

              {/* Per-model responses */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Respostas por Modelo:</p>
                {consultResult.responses.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/10 text-xs">
                    <span className="font-mono font-semibold text-foreground shrink-0 w-32">{r.model}</span>
                    <span className="text-muted-foreground flex-1 truncate">{r.summary}</span>
                    <span className={`font-mono font-bold shrink-0 ${r.score >= 85 ? 'text-emerald-400' : r.score >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{r.score}%</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground text-right">{consultResult.timestamp}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RefreshCw(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>;
}
