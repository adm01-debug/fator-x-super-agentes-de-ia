/**
 * NLPAnalysisDialog — Analyze text with NER + Sentiment using nlpPipelineService.
 * Can be embedded anywhere for quick text analysis.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, Tag, Heart } from 'lucide-react';
import { useNLPAnalysis } from '@/hooks/useNLPAnalysis';

export function NLPAnalysisDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { analyze, result, loading } = useNLPAnalysis();

  const handleAnalyze = () => {
    if (text.trim()) analyze(text);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Brain className="h-3.5 w-3.5" />
          Analisar NLP
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-nexus-purple" />
            Análise NLP
            <Badge variant="outline" className="text-[10px]">NER + Sentiment</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Cole aqui um texto para analisar (ex: pedido de cliente, mensagem WhatsApp...)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="text-sm min-h-[80px]"
          />
          <Button size="sm" className="gap-1.5" onClick={handleAnalyze} disabled={loading || !text.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            Analisar
          </Button>

          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Sentiment */}
              {result.sentiment && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-nexus-pink" />
                    <span className="text-xs font-semibold">Sentimento</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{result.sentiment.emoji}</span>
                    <div>
                      <Badge className={`text-[10px] ${
                        result.sentiment.label === 'positive' ? 'bg-nexus-emerald/10 text-nexus-emerald' :
                        result.sentiment.label === 'negative' ? 'bg-destructive/10 text-destructive' :
                        result.sentiment.label === 'urgent' ? 'bg-nexus-amber/10 text-nexus-amber' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {result.sentiment.label.toUpperCase()}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Score: {(result.sentiment.score * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* NER Entities */}
              {result.ner && result.ner.entities.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-nexus-blue" />
                    <span className="text-xs font-semibold">Entidades ({result.ner.entity_count})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.ner.entities.map((e, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] gap-1">
                        <span className="font-bold">{e.type}</span>: {e.value}
                        <span className="text-muted-foreground">({(e.confidence * 100).toFixed(0)}%)</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Structured Order */}
              {result.ner?.structured_order && Object.keys(result.ner.structured_order).some(k => (result.ner!.structured_order as Record<string, unknown>)[k]) && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-semibold mb-2">📦 Pedido Estruturado</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {Object.entries(result.ner.structured_order).map(([key, val]) => val ? (
                      <div key={key}>
                        <span className="text-muted-foreground">{key}: </span>
                        <span className="font-medium">{String(val)}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
