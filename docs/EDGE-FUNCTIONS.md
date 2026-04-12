# Edge Functions API Reference

Base URL: `https://tdprnylgyrogbbhgdoik.supabase.co/functions/v1`
Auth: `Authorization: Bearer <anon_key>` + `apikey: <anon_key>`

## Core Functions

### nlp-pipeline
- **POST** `{ text, pipeline: ["ner","sentiment"] }` → NER entities + sentiment
- **GET** → health check

### guardrails-ml (5 layers)
- **POST** `{ text, direction: "input"|"output" }` → injection/toxicity/PII/secrets/length
- **GET** → health + ml_enabled status

### smart-model-router
- **POST** `{ query, preferred_provider? }` → recommended model + tier + cost
- **GET** → models count

### llm-gateway
- **POST** `{ model, messages, temperature?, max_tokens? }` → LLM response
- **GET** → health

### rag-embed-v2
- **POST** `{ texts, provider?, dimension? }` → embeddings array
- Providers: bge-m3, qwen3-embedding-8b, jina-embeddings-v3

### rag-rerank-v2
- **POST** `{ query, documents, top_k?, model? }` → reranked results
- Fallback: keyword overlap when ML unavailable

### eval-engine-v2
- **POST** `{ test_cases, workspace_id?, agent_id? }` → RAGAS metrics

## Integration Functions

| Function | Auth | Description |
|---|---|---|
| datahub-query | JWT | Multi-DB query engine (NL-to-SQL) |
| oracle-council | JWT | Multi-LLM consensus (3 stages) |
| oracle-research | JWT | Deep research (iterative search) |
| cerebro-brain | JWT | Knowledge graph + health + extraction |
| cerebro-query | JWT | Super Cerebro orchestrator |
| workflow-engine-v2 | JWT | Graph workflow executor |
| smolagent-runtime | JWT | ReAct agent with 14 tools |
| hf-autotrain | JWT | Fine-tuning dataset prep |

## Utility Functions

| Function | Auth | Description |
|---|---|---|
| health-check | JWT | DB + runtime health |
| memory-tools | JWT | MemGPT-style memory CRUD |
| lgpd-manager | JWT | LGPD data export/delete |
| notification-sender | JWT | Multi-channel notifications |
| webhook-receiver | None | External webhook intake |
| cron-executor | JWT | Scheduled task runner |
| queue-worker | JWT | Task queue processor |

## Media Functions

| Function | Auth | Description |
|---|---|---|
| audio-transcribe | JWT | Whisper STT |
| text-to-speech | JWT | TTS (PT/EN/ES) |
| image-analysis | JWT | Classification + OCR |
| doc-ocr | JWT | Document text extraction |
| product-mockup | JWT | Studio-quality mockup gen |
