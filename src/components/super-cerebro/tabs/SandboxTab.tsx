/**
 * Super Cérebro — Brain Sandbox
 * Test the brain with questions before connecting to agents.
 */

import { logger } from '@/lib/logger';
import { useState, useCallback } from 'react';
import { invokeCerebroQuery } from '@/services/cerebroService';

interface TestResult {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  latencyMs: number;
  status: 'success' | 'error' | 'no_answer';
}

export function SandboxTab() {
  const [questions, setQuestions] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const runTest = useCallback(async () => {
    const lines = questions.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const testResults: TestResult[] = [];

    for (let i = 0; i < lines.length; i++) {
      const question = lines[i].trim();
      try {
        const start = Date.now();
        const data = await invokeCerebroQuery({ query: question, top_k: 5 });
        const latencyMs = Date.now() - start;

        testResults.push({
          question,
          answer: String((data as Record<string, unknown>).answer || (data as Record<string, unknown>).result || 'Sem resposta'),
          confidence: Number((data as Record<string, unknown>).confidence || 0),
          sources: Array.isArray((data as Record<string, unknown>).sources) ? (data as Record<string, string[]>).sources : [],
          latencyMs,
          status: 'success',
        });
      } catch (err) { logger.error("Operation failed:", err);
        testResults.push({
          question,
          answer: 'Erro ao consultar o cérebro',
          confidence: 0,
          sources: [],
          latencyMs: 0,
          status: 'error',
        });
      }

      setProgress(Math.round(((i + 1) / lines.length) * 100));
      setResults([...testResults]);
    }

    setIsRunning(false);
  }, [questions]);

  const avgConfidence = results.length > 0
    ? results.reduce((s, r) => s + r.confidence, 0) / results.length
    : 0;
  const avgLatency = results.length > 0
    ? results.reduce((s, r) => s + r.latencyMs, 0) / results.length
    : 0;
  const successRate = results.length > 0
    ? (results.filter(r => r.status === 'success').length / results.length) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-sm font-bold text-foreground mb-3">🧪 Perguntas para testar</h3>
        <p className="text-xs text-muted-foreground mb-3">Uma pergunta por linha. O cérebro responderá cada uma.</p>
        <textarea
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          placeholder={`Qual fornecedor de canetas atende SP com prazo < 5 dias?\nQuem é o vendedor responsável pela empresa X?\nQual o prazo médio de entrega do fornecedor Y?`}
          rows={6}
          className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder-muted-foreground resize-none focus:border-primary focus:outline-none"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">{questions.split('\n').filter(l => l.trim()).length} perguntas</span>
          <button
            onClick={runTest}
            disabled={isRunning || !questions.trim()}
            className="px-4 py-2 text-sm text-foreground bg-gradient-to-r from-primary to-nexus-emerald rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isRunning ? `⏳ Testando... ${progress}%` : '▶️ Executar Teste'}
          </button>
        </div>

        {isRunning && (
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-nexus-emerald transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Aggregate Metrics */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Perguntas', value: results.length, color: 'hsl(var(--nexus-blue))' },
            { label: 'Confiança Média', value: `${Math.round(avgConfidence * 100)}%`, color: avgConfidence > 0.7 ? 'hsl(var(--nexus-emerald))' : 'hsl(var(--nexus-yellow))' },
            { label: 'Latência Média', value: `${Math.round(avgLatency)}ms`, color: avgLatency < 2000 ? 'hsl(var(--nexus-emerald))' : 'hsl(var(--nexus-red))' },
            { label: 'Taxa de Sucesso', value: `${Math.round(successRate)}%`, color: successRate > 80 ? 'hsl(var(--nexus-emerald))' : 'hsl(var(--nexus-red))' },
          ].map(m => (
            <div key={m.label} className="bg-card rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">#</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Pergunta</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Resposta</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Confiança</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Latência</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 text-foreground max-w-[200px] truncate">{r.question}</td>
                    <td className="p-3 text-foreground max-w-[300px] truncate">{r.answer}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.confidence > 0.7 ? 'bg-nexus-emerald/10 text-nexus-emerald' : r.confidence > 0.4 ? 'bg-nexus-amber/10 text-nexus-amber' : 'bg-destructive/10 text-destructive'}`}>
                        {Math.round(r.confidence * 100)}%
                      </span>
                    </td>
                    <td className="p-3 text-center text-muted-foreground">{r.latencyMs}ms</td>
                    <td className="p-3 text-center">
                      {r.status === 'success' ? '✅' : r.status === 'error' ? '❌' : '⚠️'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
