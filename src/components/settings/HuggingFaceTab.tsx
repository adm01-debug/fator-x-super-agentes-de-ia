import { Sparkles } from 'lucide-react';

const FEATURES = [
  { name: 'Injection Detection ML', desc: 'ProtectAI deberta-v3 · Detecta prompt injection com 99.9% precisão', status: 'active' },
  { name: 'RAG Reranker', desc: 'BAAI/bge-reranker-v2-m3 · Cross-encoder multilingual gratuito', status: 'active' },
  { name: 'Auto-Classificação de Traces', desc: 'xlm-roberta-large-xnli · 8 categorias zero-shot em PT', status: 'active' },
  { name: 'NER no Super Cérebro', desc: 'bert-base-NER · Extração de entidades 10x mais rápida', status: 'active' },
  { name: 'Sentiment Analysis (WhatsApp)', desc: 'twitter-roberta-base-sentiment · Análise de sentimento no DataHub', status: 'active' },
  { name: 'LLM Provider (Inference API)', desc: 'Qwen3, Mistral Small, Llama 4 Scout · Modelos gratuitos no Agent Builder', status: 'active' },
  { name: 'Fine-tuning (AutoTrain)', desc: 'Treine modelos custom com dados dos seus agentes', status: 'available' },
];

export function HuggingFaceTab() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-nexus-amber" />
        <h3 className="font-semibold">HuggingFace Integration</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Modelos open-source gratuitos para guardrails, RAG, classificação e inferência.
        Configure o token HF na aba API Keys com o nome <code className="text-xs bg-muted px-1 py-0.5 rounded">huggingface_api_key</code>.
      </p>
      <div className="space-y-3 pt-2">
        <h4 className="text-sm font-medium">Funcionalidades Ativas</h4>
        <div className="grid gap-3">
          {FEATURES.map((f) => (
            <div key={f.name} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div>
                <p className="text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'active' ? 'bg-nexus-emerald/12 text-nexus-emerald' : 'bg-primary/12 text-primary'}`}>
                {f.status === 'active' ? 'Ativo' : 'Disponível'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-3 border-t space-y-2">
        <h4 className="text-sm font-medium">Self-Hosted (TEI)</h4>
        <p className="text-xs text-muted-foreground">
          Para alto volume, deploy TEI localmente com GPU. Configure os endpoints nas env vars
          <code className="bg-muted px-1 py-0.5 rounded ml-1">HF_TEI_ENDPOINT</code> e
          <code className="bg-muted px-1 py-0.5 rounded ml-1">HF_TEI_RERANK_ENDPOINT</code>.
        </p>
        <div className="bg-muted/30 p-3 rounded text-xs font-mono text-muted-foreground whitespace-pre-wrap">
{`docker run -p 8080:80 \\
  ghcr.io/huggingface/tei:latest \\
  --model-id BAAI/bge-reranker-v2-m3`}
        </div>
      </div>
    </div>
  );
}
