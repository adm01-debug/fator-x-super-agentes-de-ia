# 🤖 Fator X — Super Agentes de IA

Plataforma completa para criação, configuração, deploy e monitoramento de agentes de IA.

## Stack

- **Frontend:** React + Vite + Tailwind + shadcn/ui + Zustand
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + RLS + pgvector)
- **LLMs:** Multi-provider via LLM Gateway (Anthropic, OpenAI, Google, OpenRouter, HuggingFace, Lovable)
- **ML/AI:** HuggingFace Inference API (guardrails, embeddings, reranking, NER, classification, sentiment)

## Arquitetura

```
┌─ Frontend (React) ──────────────────────────────────────┐
│  Dashboard │ Agent Builder │ Oracle │ Super Cérebro      │
│  Workflows │ Knowledge    │ Memory │ Monitoring          │
│  DataHub │ Evaluations │ Deployments │ Billing           │
│  Security │ LGPD │ Team │ Settings (+ HuggingFace tab)  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌─ Edge Functions (13) ┴──────────────────────────────────┐
│  llm-gateway      → 6 providers + ML guardrails         │
│  oracle-council   → Conselho multi-IA (3 stages)        │
│  rag-ingest       → Chunking + HF/OpenAI embeddings     │
│  rag-rerank       → Cohere → HF BGE → LLM fallback     │
│  cerebro-brain    → Knowledge graph + HF NER            │
│  cerebro-query    → Super Cérebro + bancos externos     │
│  datahub-query    → Multi-banco + HF sentiment          │
│  eval-judge       → HF/paid model judge evaluation      │
│  workflow-engine  → Graph + tool_call + code_execution  │
│  hf-autotrain     → Fine-tuning pipeline via HF Hub     │
│  memory-tools     → MemGPT/Letta (6 tipos memória)     │
│  lgpd-manager     → LGPD compliance                     │
│  test-runner      → Testes automatizados                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌─ Supabase ───────────┴──────────────────────────────────┐
│  PostgreSQL + pgvector │ Auth │ RLS │ Triggers           │
│  40+ tabelas │ 4 bancos externos via DataHub             │
└─────────────────────────────────────────────────────────┘
```

## 🤗 HuggingFace Integration (12 integrações)

| # | Feature | Modelo HF | Edge Function |
|---|---------|-----------|---------------|
| 1 | Injection Detection ML (99.9%) | `protectai/deberta-v3-base-prompt-injection-v2` | llm-gateway |
| 2 | RAG Reranker (cross-encoder) | `BAAI/bge-reranker-v2-m3` | rag-rerank |
| 3 | Auto-classificação de traces | `joeddav/xlm-roberta-large-xnli` | llm-gateway |
| 4 | LLM Provider (Llama 4, Qwen3, Mistral) | Via HF Inference Providers | llm-gateway |
| 5 | RAG Embeddings (gratuito) | `BAAI/bge-m3` | rag-ingest |
| 6 | NER (extração de entidades) | `dslim/bert-base-NER` | cerebro-brain |
| 7 | Eval Judge gratuito | Qualquer modelo HF chat | eval-judge |
| 8 | Sentiment Analysis (WhatsApp) | `cardiffnlp/twitter-roberta-base-sentiment-latest` | datahub-query |
| 9 | HF Space (canal de deploy) | — | DeployModule.tsx |
| 10 | tool_call em workflows | Qualquer modelo HF | workflow-engine-v2 |
| 11 | code_execution (smolagents) | Qwen3 / Mistral | workflow-engine-v2 |
| 12 | Fine-tuning (AutoTrain) | — | hf-autotrain |

Todas as integrações são **toggleáveis**, com **timeout** e **fallback** para providers pagos.

## Setup

```bash
npm install
cp .env.example .env   # editar com suas keys
npm run dev
```

### Variáveis obrigatórias

| Variável | Descrição |
|----------|-----------|
| `HF_API_TOKEN` | Token HuggingFace (gratuito em huggingface.co/settings/tokens) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Anon key do Supabase |

### Feature toggles (env vars, default: true)

| Variável | Controla |
|----------|----------|
| `ENABLE_ML_INJECTION_CHECK` | Injection detection ML |
| `ENABLE_HF_RERANKER` | Reranker BGE no RAG |
| `ENABLE_HF_EMBEDDINGS` | Embeddings BGE-M3 |
| `ENABLE_AUTO_CLASSIFY` | Auto-classificação em traces |
| `HF_TEI_ENDPOINT` | TEI self-hosted (embeddings) |
| `HF_TEI_RERANK_ENDPOINT` | TEI self-hosted (reranker) |

## Deploy

```bash
# Migrations
supabase db push

# Edge Functions (todas)
for fn in llm-gateway oracle-council rag-ingest rag-rerank cerebro-brain cerebro-query datahub-query eval-judge workflow-engine-v2 hf-autotrain memory-tools test-runner lgpd-manager; do
  supabase functions deploy $fn
done

# Set HF token
supabase secrets set HF_API_TOKEN=hf_xxxxxxxxxxxxx
```

## Self-Hosted TEI (opcional)

```bash
# Embeddings
docker run --gpus all -p 8080:80 ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 --model-id BAAI/bge-m3

# Reranker
docker run --gpus all -p 8081:80 ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 --model-id BAAI/bge-reranker-v2-m3
```

## Modelos HF no Agent Builder

| Modelo | Params | Badge |
|--------|--------|-------|
| `huggingface/meta-llama/Llama-4-Scout-17B-16E-Instruct` | 17B MoE | HF Free |
| `huggingface/Qwen/Qwen3-30B-A3B` | 30B MoE | HF Free |
| `huggingface/mistralai/Mistral-Small-24B-Instruct-2501` | 24B | HF Free |

Prefixo `huggingface/` roteia pelo provider HF automaticamente.

## Config centralizada

`src/config/huggingface.ts` — todos os modelos, URLs, thresholds e Docker commands.
