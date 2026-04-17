
Sprint 25 (k6 load test) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 26 — OpenTelemetry tracing nas edge functions críticas**.

## Por quê
- Já temos tracing client-side (`src/lib/tracing.ts`) com spans, attributes e exporters (Supabase + Langfuse)
- Edge functions (`llm-gateway`, agent execution) são caixa-preta: sem visibilidade de latência por etapa, falhas de provider, retry overhead
- OTel-compatible spans permitem correlacionar trace client → edge function → LLM provider em um único waterfall
- Fecha o tripé observabilidade: client traces (✅) + edge traces (Sprint 26) + load metrics (✅ Sprint 25)

## Plano

**1. `supabase/functions/_shared/otel.ts` (novo):** mini-tracer compatível com OTel semantic conventions
- `startSpan(name, kind, parentTraceId?)` retorna handle com `setAttribute`, `setStatus`, `end`
- `withSpan(name, kind, fn)` helper async
- Exporta para Supabase via `traces`/`spans` tables (mesmo schema do client)
- Aceita `traceparent` header (W3C Trace Context) para continuação cross-tier
- Lê env `LANGFUSE_PUBLIC_KEY` opcional para forward direto

**2. Instrumentar `supabase/functions/llm-gateway/index.ts`:**
- Span raiz `llm-gateway.handle` (kind=`server`)
- Sub-spans: `auth.verify`, `quota.check`, `provider.call` (com `gen_ai.request.model`, `gen_ai.usage.*`, `cost.usd`), `response.format`
- Propagar `traceparent` se cliente enviou
- Status `error` em qualquer throw + `status_message`

**3. Instrumentar 1 edge function de agent execution** (descobrir qual via `code--list_dir supabase/functions/`):
- Span raiz por execução
- Sub-spans por tool call / step

**4. Client tracing — propagação:**
- Atualizar `src/lib/tracing.ts` ou wrapper de chamada a edge function para enviar header `traceparent: 00-{traceId}-{spanId}-01`
- Buscar onde `supabase.functions.invoke('llm-gateway', ...)` é chamado e injetar header

**5. `docs/RUNBOOK.md`:** seção "Distributed Tracing"
- Diagrama waterfall esperado
- Como debugar trace em Langfuse/Supabase
- Convenções de naming OTel

**6. `mem://features/audit-improvements`:** Sprint 26 logged + nova fila (Sprint 27 SLO dashboards, Sprint 28 chaos testing).

## Arquivos
- `supabase/functions/_shared/otel.ts` (novo)
- `supabase/functions/llm-gateway/index.ts` (instrumentar)
- 1 outra edge function crítica (descobrir + instrumentar)
- `src/lib/tracing.ts` ou call site (propagação `traceparent`)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Chamada do client a `llm-gateway` gera trace único com 5+ spans encadeados
- Erro injetado no provider = span com status `error` + message preservada
- Header `traceparent` ausente = trace novo gerado (não quebra)
