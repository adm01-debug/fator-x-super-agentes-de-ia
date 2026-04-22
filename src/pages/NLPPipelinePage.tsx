/**
 * NLPPipelinePage — Tela standalone para análise NLP em larga escala
 * Consome useNLPAnalysis + nlpPipelineService (NER + Sentiment + Pedido Estruturado)
 */
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { InfoHint } from '@/components/shared/InfoHint';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Brain, Loader2, Tag, Heart, Package, Sparkles, Trash2, Copy } from 'lucide-react';
import { useNLPAnalysis } from '@/hooks/useNLPAnalysis';
import { toast } from 'sonner';

const SAMPLE_TEXTS = [
  'Quero 50 canecas brancas com gravação a laser do logo da empresa, prazo 15 dias. Meu telefone é (11) 98765-4321.',
  'Não estou satisfeito com o atendimento, preciso de uma resposta URGENTE!',
  'Gostei muito do produto, recomendo! Vou comprar mais 20 unidades.',
];

export default function NLPPipelinePage() {
  const [text, setText] = useState('');
  const [usesNer, setUsesNer] = useState(true);
  const [usesSentiment, setUsesSentiment] = useState(true);
  const { analyze, result, loading, error } = useNLPAnalysis();

  const pipeline: ('ner' | 'sentiment')[] = [];
  if (usesNer) pipeline.push('ner');
  if (usesSentiment) pipeline.push('sentiment');

  const handleAnalyze = () => {
    if (text.trim() && pipeline.length > 0) analyze(text, pipeline);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      toast.success('JSON copiado para a área de transferência');
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="🧬 NLP Pipeline"
        description="Extração de entidades (NER), análise de sentimento e parsing de pedidos estruturados"
      />

      <InfoHint title="Como funciona">
        Pipeline de NLP customizada (v2.4) para o mercado brasileiro: detecta produtos, quantidades,
        cores, prazos, telefones, CPF/CNPJ e classifica intenção/sentimento. Ideal para preprocessar
        mensagens de WhatsApp, e-mails de cotação e tickets de suporte antes de roteamento por
        agente.
      </InfoHint>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card className="nexus-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Brain className="h-4 w-4 text-nexus-purple" />
              Texto de entrada
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setText('')} disabled={!text}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Textarea
            placeholder="Cole aqui um texto livre — uma mensagem de cliente, e-mail, ticket, transcrição..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="text-sm min-h-[200px] font-mono"
          />

          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
              Pipelines
            </p>
            <div className="flex gap-4">
              <span className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={usesNer} onCheckedChange={(v) => setUsesNer(v === true)} />
                <Tag className="h-3.5 w-3.5 text-nexus-blue" />
                NER (entidades)
              </span>
              <span className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={usesSentiment}
                  onCheckedChange={(v) => setUsesSentiment(v === true)}
                />
                <Heart className="h-3.5 w-3.5 text-nexus-pink" />
                Sentimento
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
              Exemplos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_TEXTS.map((sample, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7"
                  onClick={() => setText(sample)}
                >
                  Exemplo {i + 1}
                </Button>
              ))}
            </div>
          </div>

          <Button
            className="w-full gap-1.5"
            onClick={handleAnalyze}
            disabled={loading || !text.trim() || pipeline.length === 0}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Analisar texto
          </Button>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2">
              {error}
            </div>
          )}
        </Card>

        {/* Output */}
        <Card className="nexus-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-nexus-emerald" />
              Resultado
            </h3>
            {result && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {result.processing_time_ms}ms · v{result.version}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {!result && !loading && (
            <div className="text-xs text-muted-foreground text-center py-12 bg-secondary/30 rounded-lg">
              Cole um texto e clique em "Analisar texto" para ver o resultado.
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              {result.sentiment && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-nexus-pink" />
                    <span className="text-xs font-semibold">Sentimento</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{result.sentiment.emoji}</span>
                    <div>
                      <Badge
                        className={`text-[10px] ${
                          result.sentiment.label === 'positive'
                            ? 'bg-nexus-emerald/10 text-nexus-emerald'
                            : result.sentiment.label === 'negative'
                              ? 'bg-destructive/10 text-destructive'
                              : result.sentiment.label === 'urgent'
                                ? 'bg-nexus-amber/10 text-nexus-amber'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {result.sentiment.label.toUpperCase()}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Confiança: {(result.sentiment.score * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {result.ner && result.ner.entities.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-nexus-blue" />
                    <span className="text-xs font-semibold">
                      Entidades detectadas ({result.ner.entity_count})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.ner.entities.map((e, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] gap-1">
                        <span className="font-bold">{e.type}</span>: {e.value}
                        <span className="text-muted-foreground">
                          ({(e.confidence * 100).toFixed(0)}%)
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.ner?.structured_order &&
                Object.keys(result.ner.structured_order).some(
                  (k) => (result.ner!.structured_order as Record<string, unknown>)[k],
                ) && (
                  <div className="rounded-lg border border-nexus-emerald/30 bg-nexus-emerald/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-nexus-emerald" />
                      <span className="text-xs font-semibold">Pedido estruturado</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {Object.entries(result.ner.structured_order).map(([key, val]) =>
                        val ? (
                          <div key={key} className="bg-background/50 rounded px-2 py-1">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}:{' '}
                            </span>
                            <span className="font-semibold">{String(val)}</span>
                          </div>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
