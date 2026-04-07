import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FlaskConical, Layers } from "lucide-react";
import { invokeCerebroBrain } from "@/services/cerebroService";
import { toast } from "sonner";

interface SandboxResult {
  mode: string;
  response: string;
  context_size: number;
  cost: number;
}

const modeLabels: Record<string, string> = {
  full: '🧠 Contexto Completo (Fatos + RAG)',
  facts_only: '📊 Apenas Fatos',
  rag_only: '📚 Apenas RAG',
  no_context: '🚫 Sem Contexto',
};

export function BrainSandboxTab() {
  const [query, setQuery] = useState('');
  const [contextMode, setContextMode] = useState('full');
  const [isTesting, setIsTesting] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [results, setResults] = useState<SandboxResult[]>([]);

  const handleTest = async () => {
    if (!query.trim()) return;
    setIsTesting(true);
    try {
      const data = await invokeCerebroBrain({ action: 'brain_sandbox', query, context_mode: contextMode });
      setResults(prev => [...prev, {
        mode: contextMode,
        response: data?.response || 'Sem resposta',
        context_size: data?.context_size || 0,
        cost: data?.cost_usd || 0,
      }]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro no sandbox');
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunAll = async () => {
    if (!query.trim()) return;
    setIsRunningAll(true);
    setResults([]);
    const modes: Array<'full' | 'facts_only' | 'rag_only' | 'no_context'> = [
      'full',
      'facts_only',
      'rag_only',
      'no_context',
    ];
    const collected: SandboxResult[] = [];
    for (const mode of modes) {
      try {
        const data = await invokeCerebroBrain({ action: 'brain_sandbox', query, context_mode: mode });
        collected.push({
          mode,
          response: data?.response || 'Sem resposta',
          context_size: data?.context_size || 0,
          cost: data?.cost_usd || 0,
        });
        // Update progressively so user sees results streaming in
        setResults([...collected]);
      } catch (e: unknown) {
        collected.push({
          mode,
          response: `[ERRO] ${e instanceof Error ? e.message : 'falhou'}`,
          context_size: 0,
          cost: 0,
        });
        setResults([...collected]);
      }
    }
    setIsRunningAll(false);
    toast.success('Comparação completa em todos os modos');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Brain Sandbox
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Teste como o Super Cérebro responde com diferentes contextos — compare respostas lado a lado</p>
      </div>

      <div className="nexus-card space-y-4">
        <Textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Faça uma pergunta para testar com diferentes contextos..."
          className="bg-secondary/50 min-h-[60px] text-sm"
        />

        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] text-muted-foreground font-medium">Modo de Contexto</label>
            <Select value={contextMode} onValueChange={setContextMode}>
              <SelectTrigger className="bg-secondary/50 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">🧠 Completo (Fatos + RAG)</SelectItem>
                <SelectItem value="facts_only">📊 Apenas Fatos da plataforma</SelectItem>
                <SelectItem value="rag_only">📚 Apenas RAG / base de docs</SelectItem>
                <SelectItem value="no_context">🚫 Sem contexto (LLM puro)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleTest} disabled={isTesting || isRunningAll || !query.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Testar
          </Button>
          <Button
            variant="outline"
            onClick={handleRunAll}
            disabled={isTesting || isRunningAll || !query.trim()}
            className="gap-2"
            title="Executa a query nos 4 modos em sequência para comparar"
          >
            {isRunningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            Comparar Todos
          </Button>
          {results.length > 0 && !isRunningAll && (
            <Button variant="outline" size="sm" onClick={() => setResults([])} className="text-xs">Limpar</Button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((r, i) => (
            <div key={i} className="nexus-card">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[11px]">{modeLabels[r.mode] || r.mode}</Badge>
                <span className="text-[11px] text-muted-foreground">
                  {r.context_size} chars • ${r.cost.toFixed(6)}
                </span>
              </div>
              <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {r.response}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
