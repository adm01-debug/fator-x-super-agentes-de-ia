
Sprint 27 (SLO Dashboards) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 28 — Chaos Engineering (fault injection controlada)**.

## Por quê
- Temos observabilidade completa (traces + load + SLO) mas **nunca testamos como o sistema reage a falhas reais**: provider LLM down, timeout, rate limit 429, network blip
- Chaos engineering injeta falhas controladas em ambiente seguro para validar: retry funciona? fallback ativa? error budget é consumido como esperado? alertas disparam?
- Fecha o ciclo resiliência: observabilidade (saber) + chaos (validar resposta a falhas)
- Light-weight: feature flag + middleware no edge function — sem ferramenta externa (Gremlin, Litmus)

## Plano

**1. Tabela `chaos_experiments` (migração SQL):**
- Colunas: `id`, `workspace_id`, `name`, `target` (`llm-gateway` | `agent-workflow-runner`), `fault_type` (`latency` | `error_500` | `error_429` | `timeout`), `probability` (0–1), `enabled`, `created_by`, `created_at`, `expires_at`
- RLS: somente workspace admins criam/editam; membros visualizam
- Auto-disable via `expires_at < now()` (safety)

**2. `supabase/functions/_shared/chaos.ts` (novo):**
- `maybeInjectFault(target, supabaseAdmin)`: lê experimentos ativos para o target, sorteia por probability, retorna `{ inject: true, type, delayMs? } | null`
- `applyFault(fault)`: aplica latência (sleep) ou throw com status code apropriado
- Span OTel `chaos.inject` quando ativo (rastreável)

**3. Instrumentar `llm-gateway/index.ts` + `agent-workflow-runner/index.ts`:**
- No início do handler: `const fault = await maybeInjectFault(...)` 
- Antes da chamada externa: `if (fault) applyFault(fault)`
- Sem chaos ativo = zero overhead (early return)

**4. UI — `src/pages/ChaosLabPage.tsx` (rota `/observability/chaos`):**
- Lista de experimentos ativos + histórico
- Form criar: target, fault type, probability slider (0–10% típico), duração (max 1h, hardcoded safety)
- Botão "Pânico — Desativar Tudo" (kill switch)
- Badge warning persistente quando há experimento ativo
- Empty state explicando o que é chaos engineering

**5. `src/services/chaosService.ts`:**
- `listChaosExperiments`, `createChaosExperiment`, `disableChaosExperiment`, `disableAllChaos`
- Validação client: probability ≤ 0.5 (proibe >50%), duração ≤ 3600s

**6. Sidebar:** item "Chaos Lab" sob Operações/Observability (ícone `Zap` ou `AlertTriangle`)

**7. Indicador global:** banner amber no topo do app quando experimento ativo (`ChaosBanner.tsx` em `App.tsx`)

**8. `docs/RUNBOOK.md`:** seção "Chaos Engineering"
- Como executar primeiro experimento (5% latency injection no llm-gateway)
- Validações esperadas: SLO dashboard mostra degradação, alerta dispara, retry logs aparecem
- Política: nunca rodar em produção sem comunicação prévia + sempre `expires_at`

**9. `mem://features/audit-improvements`:** Sprint 28 logged + fila atualizada (Sprint 29 synthetic monitoring, Sprint 30 game days).

## Arquivos
- `supabase/migrations/<timestamp>_chaos_experiments.sql` (nova tabela + RLS + index)
- `supabase/functions/_shared/chaos.ts` (novo)
- `supabase/functions/llm-gateway/index.ts` (instrumentar)
- `supabase/functions/agent-workflow-runner/index.ts` (instrumentar)
- `src/services/chaosService.ts` (novo)
- `src/pages/ChaosLabPage.tsx` (nova)
- `src/components/shared/ChaosBanner.tsx` (novo)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota + banner)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Criar experimento `latency 500ms @ 10%` no llm-gateway → SLO dashboard mostra P95 subir
- Kill switch desativa todos os experimentos em 1 click
- Banner amber visível em toda navegação enquanto ativo
- `expires_at` no passado = fault não injetado (auto-safety)
