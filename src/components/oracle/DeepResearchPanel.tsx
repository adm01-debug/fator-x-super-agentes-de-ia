/**
 * Deep Research Panel — UI para o oracle-research Edge Function
 * Pesquisa iterativa profunda com progresso em tempo real.
 */

import { useState, useCallback } from 'react';
import { invokeOracleResearch } from '@/services/securityService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface ResearchResult {
  report: string;
  iterations: number;
  sources: string[];
  total_tokens: number;
  latency_ms: number;
  steps: Array<{ iteration: number; findings: string; gaps_identified: string[] }>;
}

export function DeepResearchPanel() {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [isResearching, setIsResearching] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const startResearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsResearching(true);
    setError(null);
    setResult(null);

    try {
      const data = await invokeOracleResearch({
        query: query.trim(),
        depth,
        max_iterations: depth === 'quick' ? 2 : depth === 'standard' ? 5 : 10,
        language: 'pt',
      });
      setResult(data as ResearchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na pesquisa');
    } finally {
      setIsResearching(false);
    }
  }, [query, depth]);

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Deep Research</h3>
        <Badge variant="outline" className="text-[10px] border-primary text-primary">NOVO</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Pesquisa iterativa profunda: busca → analisa → identifica gaps → busca mais → sintetiza relatório completo.
      </p>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex: Análise completa do mercado de brindes promocionais no Brasil em 2026..."
        rows={3}
        className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder-muted-foreground resize-none focus:border-primary focus:outline-none"
      />

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {(['quick', 'standard', 'deep'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                depth === d ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {d === 'quick' ? '⚡ Rápido (2 iter.)' : d === 'standard' ? '📊 Padrão (5 iter.)' : '🔬 Profundo (10 iter.)'}
            </button>
          ))}
        </div>

        <Button onClick={startResearch} disabled={isResearching || !query.trim()} className="ml-auto nexus-gradient-bg" size="sm">
          {isResearching ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Pesquisando...</> : <><Search className="w-3 h-3 mr-1" />Iniciar Pesquisa</>}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">{error}</div>
      )}

      {result && (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Iterações', value: result.iterations, cls: 'text-primary' },
              { label: 'Fontes', value: result.sources.length, cls: 'text-nexus-cyan' },
              { label: 'Tokens', value: result.total_tokens.toLocaleString(), cls: 'text-nexus-emerald' },
              { label: 'Tempo', value: `${Math.round(result.latency_ms / 1000)}s`, cls: 'text-nexus-amber' },
            ].map(m => (
              <div key={m.label} className="bg-background rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${m.cls}`}>{m.value}</div>
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-background rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Relatório</h4>
            </div>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result.report}</div>
          </div>

          {result.steps && result.steps.length > 0 && (
            <button onClick={() => setShowSteps(!showSteps)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {showSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showSteps ? 'Ocultar' : 'Ver'} {result.steps.length} iterações
            </button>
          )}

          {showSteps && result.steps.map((step, i) => (
            <div key={i} className="bg-background rounded-lg p-3 text-xs">
              <div className="font-bold text-primary mb-1">Iteração {step.iteration}</div>
              <div className="text-foreground mb-2">{step.findings.substring(0, 300)}...</div>
              {step.gaps_identified.length > 0 && <div className="text-nexus-amber">Gaps: {step.gaps_identified.join(', ')}</div>}
            </div>
          ))}

          {result.sources.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-bold">Fontes:</span> {result.sources.slice(0, 5).join(' | ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
