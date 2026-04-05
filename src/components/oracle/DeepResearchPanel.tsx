/**
 * Deep Research Panel — UI para o oracle-research Edge Function
 * Pesquisa iterativa profunda com progresso em tempo real.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          query: query.trim(),
          depth,
          max_iterations: depth === 'quick' ? 2 : depth === 'standard' ? 5 : 10,
          language: 'pt',
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error((err as Record<string, string>).error || 'Pesquisa falhou');
      }

      setResult(await resp.json() as ResearchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na pesquisa');
    } finally {
      setIsResearching(false);
    }
  }, [query, depth]);

  return (
    <div className="bg-[#111122] rounded-xl border border-[#222244] p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-5 h-5 text-[#9B59B6]" />
        <h3 className="text-sm font-bold text-white">Deep Research</h3>
        <Badge variant="outline" className="text-[10px] border-[#9B59B6] text-[#9B59B6]">NOVO</Badge>
      </div>

      <p className="text-xs text-[#888888]">
        Pesquisa iterativa profunda: busca → analisa → identifica gaps → busca mais → sintetiza relatório completo.
      </p>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex: Análise completa do mercado de brindes promocionais no Brasil em 2026, incluindo tendências, principais players e oportunidades..."
        rows={3}
        className="w-full bg-[#0a0a1a] border border-[#222244] rounded-lg p-3 text-sm text-white placeholder-[#555555] resize-none focus:border-[#9B59B6] focus:outline-none"
      />

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {(['quick', 'standard', 'deep'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                depth === d
                  ? 'bg-[#9B59B6] text-white'
                  : 'bg-[#222244] text-[#888888] hover:text-white'
              }`}
            >
              {d === 'quick' ? '⚡ Rápido (2 iter.)' : d === 'standard' ? '📊 Padrão (5 iter.)' : '🔬 Profundo (10 iter.)'}
            </button>
          ))}
        </div>

        <Button
          onClick={startResearch}
          disabled={isResearching || !query.trim()}
          className="ml-auto bg-gradient-to-r from-[#9B59B6] to-[#4D96FF] hover:opacity-90"
          size="sm"
        >
          {isResearching ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Pesquisando...
            </>
          ) : (
            <>
              <Search className="w-3 h-3 mr-1" />
              Iniciar Pesquisa
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Iterações', value: result.iterations, color: '#9B59B6' },
              { label: 'Fontes', value: result.sources.length, color: '#4D96FF' },
              { label: 'Tokens', value: result.total_tokens.toLocaleString(), color: '#6BCB77' },
              { label: 'Tempo', value: `${Math.round(result.latency_ms / 1000)}s`, color: '#FFD93D' },
            ].map(m => (
              <div key={m.label} className="bg-[#0a0a1a] rounded-lg p-3 text-center">
                <div className="text-lg font-bold" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[10px] text-[#888888]">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#0a0a1a] rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#4D96FF]" />
              <h4 className="text-sm font-bold text-white">Relatório</h4>
            </div>
            <div className="text-sm text-[#E0E0E0] whitespace-pre-wrap leading-relaxed">
              {result.report}
            </div>
          </div>

          {result.steps && result.steps.length > 0 && (
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="flex items-center gap-1 text-xs text-[#888888] hover:text-white transition-colors"
            >
              {showSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showSteps ? 'Ocultar' : 'Ver'} {result.steps.length} iterações
            </button>
          )}

          {showSteps && result.steps.map((step, i) => (
            <div key={i} className="bg-[#0a0a1a] rounded-lg p-3 text-xs">
              <div className="font-bold text-[#9B59B6] mb-1">Iteração {step.iteration}</div>
              <div className="text-[#E0E0E0] mb-2">{step.findings.substring(0, 300)}...</div>
              {step.gaps_identified.length > 0 && (
                <div className="text-[#FFD93D]">Gaps: {step.gaps_identified.join(', ')}</div>
              )}
            </div>
          ))}

          {result.sources.length > 0 && (
            <div className="text-xs text-[#888888]">
              <span className="font-bold">Fontes:</span> {result.sources.slice(0, 5).join(' | ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
