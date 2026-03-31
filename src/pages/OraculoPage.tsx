import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Settings, BookOpen, BarChart3, Zap, Plus, Send, Clock, DollarSign, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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

export default function OraculoPage() {
  const [activeTab, setActiveTab] = useState('config');
  const [consultQuery, setConsultQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('executive');
  const [isConsulting, setIsConsulting] = useState(false);

  const runConsult = () => {
    if (!consultQuery.trim()) return;
    setIsConsulting(true);
    setTimeout(() => {
      setIsConsulting(false);
      toast.success('Consulta concluída — consenso de 88% entre 4 modelos');
    }, 3000);
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
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Gateway LLM</h3>
            <div className="grid grid-cols-3 gap-3">
              {['OpenRouter (recomendado)', 'APIs Diretas', 'Híbrido'].map((gw, i) => (
                <button key={gw} className={`p-3 rounded-xl border text-xs text-center transition-all ${i === 0 ? 'border-primary bg-primary/5 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/30'}`}>
                  {gw}
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
                <div key={mode.id} className="p-3 rounded-xl border border-border bg-card text-center hover:bg-muted/30 transition-all cursor-pointer">
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RefreshCw(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>;
}
