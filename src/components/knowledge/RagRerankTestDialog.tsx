import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FlaskConical, Trophy } from "lucide-react";
import { toast } from "sonner";
import { invokeRagRerank } from "@/services/ragPipelineService";

interface RerankedItem {
  chunk: Record<string, unknown>;
  relevance_score: number;
}

export function RagRerankTestDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("Quais brindes promocionais funcionam melhor para feiras de tecnologia?");
  const [chunksRaw, setChunksRaw] = useState(
    'Canetas personalizadas funcionam para qualquer feira mas têm baixa retenção.\nCadernos e blocos de anotação são premiados em feiras corporativas.\nPower banks e produtos de tech são os campeões em feiras de tecnologia.\nSquezzes esportivos atraem público fitness, não tech.\nMochilas premium têm o maior ROI em feiras B2B de tecnologia.'
  );
  const [topK, setTopK] = useState(3);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RerankedItem[] | null>(null);
  const [method, setMethod] = useState<string | null>(null);

  const handleRun = async () => {
    if (!query.trim() || !chunksRaw.trim()) {
      toast.error("Preencha query e chunks");
      return;
    }
    setRunning(true);
    setResults(null);
    try {
      const chunks = chunksRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((content, i) => ({ id: `chunk-${i + 1}`, content }));

      const result = await invokeRagRerank({
        query: query.trim(),
        chunks,
        top_k: topK,
      });

      setResults(result.reranked ?? []);
      setMethod(result.method ?? "unknown");
      toast.success(`Reranked com ${result.method ?? "—"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no rerank");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <FlaskConical className="h-3.5 w-3.5" />
          Testar Rerank
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Testar Pipeline de Rerank
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rerank-query">Query</Label>
            <Input
              id="rerank-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="O que você quer buscar?"
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rerank-chunks">Chunks (1 por linha)</Label>
            <Textarea
              id="rerank-chunks"
              value={chunksRaw}
              onChange={(e) => setChunksRaw(e.target.value)}
              rows={6}
              className="bg-secondary/50 text-xs font-mono resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rerank-topk">Top K</Label>
            <Input
              id="rerank-topk"
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Math.max(1, Math.min(20, Number(e.target.value) || 3)))}
              className="bg-secondary/50 w-24"
            />
          </div>

          {results && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label>Resultados Rerankeados</Label>
                {method && <span className="text-[11px] text-muted-foreground">método: <code>{method}</code></span>}
              </div>
              {results.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum resultado retornado.</p>
              ) : (
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs flex-1">{String(r.chunk.content ?? "")}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {i === 0 && <Trophy className="h-3.5 w-3.5 text-nexus-amber" />}
                          <span className="text-[11px] font-mono text-primary">
                            {(r.relevance_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
            Fechar
          </Button>
          <Button onClick={handleRun} disabled={running} className="gap-1.5">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Executar Rerank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
