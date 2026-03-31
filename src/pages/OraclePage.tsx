import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Copy, RefreshCw } from 'lucide-react';
import { useOracleStore } from '@/stores/oracleStore';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const MODES = [
  { value: 'executive', label: '👔 Conselho Executivo' },
  { value: 'quick', label: '⚡ Oráculo Rápido' },
  { value: 'research', label: '🔬 Pesquisa Profunda' },
  { value: 'technical', label: '💻 Conselho Técnico' },
  { value: 'debate', label: '⚖️ Debate de Decisão' },
  { value: 'factcheck', label: '🔍 Verificação de Fatos' },
];

const STAGES = ['Opiniões', 'Review', 'Síntese'];

export default function OraclePage() {
  const { query, mode, isRunning, currentStage, results, error, setQuery, setMode, submitQuery, clearResults } = useOracleStore();

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="🔮 Oráculo — Multi-LLM Council" description="Consulte múltiplas IAs e obtenha respostas sintetizadas com consenso" />

      <div className="nexus-card space-y-4">
        <Textarea placeholder="Faça sua pergunta ao conselho de IAs..." value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-[100px] bg-secondary/50 border-border/50 text-sm" />
        <div className="flex items-center gap-3">
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={submitQuery} disabled={isRunning || !query.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isRunning ? 'Consultando...' : '🔮 Convocar Conselho'}
          </Button>
        </div>
      </div>

      {isRunning && (
        <div className="nexus-card">
          <div className="flex items-center gap-4">
            {STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-2 flex-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${currentStage > i + 1 ? 'bg-primary text-primary-foreground' : currentStage === i + 1 ? 'nexus-gradient-bg text-primary-foreground animate-pulse' : 'bg-secondary text-muted-foreground'}`}>{i + 1}</div>
                <span className={`text-xs ${currentStage >= i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{stage}</span>
                {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 ${currentStage > i + 1 ? 'bg-primary' : 'bg-secondary'}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="nexus-card border-destructive/30 bg-destructive/5"><p className="text-sm text-destructive">{error}</p></div>}

      {results && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { v: `${results.confidence_score}%`, l: 'Confiança', c: 'text-primary' },
              { v: `${results.consensus_degree}%`, l: 'Consenso', c: 'text-nexus-emerald' },
              { v: `$${results.metrics.total_cost_usd.toFixed(4)}`, l: 'Custo', c: 'text-foreground' },
              { v: `${(results.metrics.total_latency_ms / 1000).toFixed(1)}s`, l: 'Tempo', c: 'text-foreground' },
            ].map(m => (
              <div key={m.l} className="nexus-card text-center py-3">
                <p className={`text-xl font-heading font-bold ${m.c}`}>{m.v}</p>
                <p className="text-[10px] text-muted-foreground">{m.l}</p>
              </div>
            ))}
          </div>

          <Tabs defaultValue="response">
            <TabsList className="bg-secondary/50 border border-border/50">
              <TabsTrigger value="response" className="text-xs">Resposta</TabsTrigger>
              <TabsTrigger value="individual" className="text-xs">Individual</TabsTrigger>
              <TabsTrigger value="consensus" className="text-xs">Consenso</TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs">Métricas</TabsTrigger>
            </TabsList>

            <TabsContent value="response" className="mt-4">
              <div className="nexus-card">
                <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">{results.final_response}</div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(results.final_response); toast.success('Copiado!'); }}><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</Button>
                  <Button size="sm" variant="outline" onClick={() => { clearResults(); submitQuery(); }}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="individual" className="mt-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.stage1_results.map((r, i) => (
                  <div key={i} className="nexus-card">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px]">{r.model.split('/').pop()}</Badge>
                      <Badge variant={r.success ? 'default' : 'destructive'} className="text-[10px]">{r.success ? '✓' : '✗'}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">{r.persona}</p>
                    <div className="text-xs text-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto">{r.content}</div>
                    <div className="flex gap-2 mt-3 text-[10px] text-muted-foreground">
                      <span>{r.tokens?.total || 0} tok</span>
                      <span>{(r.latency_ms / 1000).toFixed(1)}s</span>
                      <span>${(r.cost_usd || 0).toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="consensus" className="mt-4">
              <div className="nexus-card grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-nexus-emerald mb-2">🟢 Consenso</p>
                  <div className="text-xs text-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">{results.final_response.match(/## Pontos de Consenso[\s\S]*?(?=##|$)/)?.[0] || 'Veja resposta sintetizada.'}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-nexus-amber mb-2">🔴 Divergências</p>
                  <div className="text-xs text-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">{results.final_response.match(/## Divergências[\s\S]*?(?=##|$)/)?.[0] || 'Veja resposta sintetizada.'}</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="mt-4">
              <div className="nexus-card space-y-2 text-xs">
                {[
                  ['Modelos utilizados', results.metrics.models_used],
                  ['Tokens totais', results.metrics.total_tokens.toLocaleString()],
                  ['Custo total', `$${results.metrics.total_cost_usd.toFixed(4)}`],
                  ['Estágio 1', `${(results.metrics.stage1_latency_ms / 1000).toFixed(1)}s`],
                  ['Estágio 2', `${(results.metrics.stage2_latency_ms / 1000).toFixed(1)}s`],
                  ['Estágio 3', `${(results.metrics.stage3_latency_ms / 1000).toFixed(1)}s`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="text-foreground">{v}</span></div>
                ))}
                <div className="flex justify-between font-semibold border-t border-border/50 pt-2"><span className="text-foreground">Tempo total</span><span className="text-primary">{(results.metrics.total_latency_ms / 1000).toFixed(1)}s</span></div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </div>
  );
}
