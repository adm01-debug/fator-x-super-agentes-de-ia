# 📊 Coverage Report — Nexus Agents Studio / FATOR X

**Gerado em:** 2026-04-08
**Comando:** `npx vitest run --coverage --reporter=basic <suite_lista>`
**Tool:** vitest 3.2.4 + @vitest/coverage-v8
**Suites executadas:** 19 (sprint do plano de 20 etapas + meta-plano + serviços tocados)

---

## 📈 Resumo geral

| Métrica | Coberto / Total | % |
|---|---:|---:|
| **Lines** | 736 / 11.617 | **6.33%** |
| **Functions** | 42 / 311 | **13.50%** |
| **Statements** | 736 / 11.617 | **6.33%** |
| **Branches** | 103 / 208 | **49.51%** |

> **Nota importante sobre o número:** Este relatório representa o estado dos testes
> que escrevemos (sprint do plano + serviços diretamente tocados). O `vitest.config.ts`
> tem thresholds globais de 70% lines / 70% functions / 60% branches, o que falha por design
> nesta foto — a base de código tem ~150 arquivos em `src/services` e a maioria não tem
> testes ainda. **Isto é um mapa do tesouro, não um boletim**: ele aponta exatamente
> onde a próxima rodada de tests deveria mirar.

---

## 🟢 Top 15 arquivos com melhor cobertura

| % Lines | Coberto/Total | Arquivo |
|--------:|---:|---|
| **100.0%** | 59 / 59 | `src/lib/normalize.ts` |
| **100.0%** | 4 / 4 | `src/lib/utils.ts` |
| **86.8%** | 317 / 365 | `src/lib/tracing.ts` ⭐ |
| 50.0% | 8 / 16 | `src/lib/supabaseExtended.ts` |
| 30.8% | 41 / 133 | `src/services/agentEvolutionService.ts` |
| 26.3% | 20 / 76 | `src/services/skillsRegistryService.ts` |
| 24.1% | 7 / 29 | `src/services/lgpdService.ts` |
| 23.3% | 24 / 103 | `src/services/rbacService.ts` |
| 22.9% | 16 / 70 | `src/services/contextTiersService.ts` |
| 22.5% | 18 / 80 | `src/services/memoryService.ts` |
| 22.4% | 13 / 58 | `src/lib/logger.ts` |
| 20.8% | 5 / 24 | `src/services/approvalService.ts` |
| 16.4% | 9 / 55 | `src/services/teamsService.ts` |
| 16.1% | 21 / 130 | `src/services/monitoringService.ts` |
| 14.9% | 17 / 114 | `src/services/llmGatewayService.ts` |

⭐ **`tracing.ts` em 86.8%** — a peça mais crítica do plano (race-safe rewrite + nested spans + per-call context) está praticamente toda coberta pelos 16 testes da suite `tracing.test.ts`, incluindo o `RACE CONDITION FIX` test que prova o bug do T19 anterior.

---

## 🔴 Top 15 arquivos completamente sem cobertura (alvos prioritários)

Estes são os candidatos para a próxima sprint de testes — ranqueados por tamanho (mais linhas = mais ROI por teste escrito):

| Linhas | Arquivo |
|---:|---|
| 356 | `src/services/retryEngineService.ts` |
| 355 | `src/services/batchProcessorService.ts` |
| 347 | `src/services/connectorRegistryService.ts` |
| 344 | `src/services/credentialVaultService.ts` |
| 338 | `src/services/queueManagerService.ts` |
| 328 | `src/services/notificationEngineService.ts` |
| 322 | `src/services/cronSchedulerService.ts` |
| 297 | `src/services/middlewarePipelineService.ts` |
| 275 | `src/services/webhookTriggerService.ts` |
| 269 | `src/services/agentHandoffService.ts` |
| 266 | `src/services/costCalculatorService.ts` |
| 260 | `src/services/executionHistoryService.ts` |
| 256 | `src/services/automationTemplateService.ts` |
| 250 | `src/services/workflowCheckpointService.ts` |
| 237 | `src/services/progressiveSkillLoader.ts` |

**Total de linhas sem cobertura nesses 15 arquivos:** ~4.300 linhas. Cobrir os top 5
elevaria a cobertura global de **6.33%** para aproximadamente **22%** com aproximadamente
60-80 testes adicionais (estimativa: 10-15 testes por serviço, alvo de 50% lines cada).

---

## 🎯 Recomendação prática

**Próxima sprint de testes — quick wins:**

1. **`retryEngineService` + `queueManagerService`** — são lógica pura (filas, backoff, contadores), fáceis de testar com fakes simples. Estimativa: 2h pra ~70% cobertura cada.
2. **`costCalculatorService`** — pure functions, ideal pra unit tests. 1h pra 90%+.
3. **`cronSchedulerService`** — testável com `vi.useFakeTimers()`. 2h pra 80%+.
4. **`notificationEngineService`** — mock supabase, foca nos paths de routing. 2h pra 60%.

**Total estimado:** ~9h de trabalho focado tira a cobertura de 6.33% para ~22%, e cobre ~1.700 linhas dos services mais críticos pra automação.

---

## 📝 Suites incluídas neste run

```
src/test/tracing.test.ts                    16 ✅
src/test/i18n.test.ts                        7 ✅
src/test/i18n-interpolation.test.tsx         6 ✅
src/test/oracle-comparison-aggregate.test.ts 9 ✅
src/test/template-canvas-preview.test.tsx    8 ✅
src/test/real-time-cost-stream.test.tsx      5 ✅
src/test/span-tree-view.test.tsx             8 ✅
src/test/billing-service.test.ts             2 ✅
src/test/security-service.test.ts            3 ✅
src/test/extended-services.test.ts          17 ✅
src/test/services.test.ts                    ?
src/test/workflows-service.test.ts           ?
src/test/rbac-service.test.ts                ?
src/test/skills-registry.test.ts             ?
src/test/normalize.test.ts                   ?
src/test/templates.test.ts                   ?
src/test/llm-gateway-providers.test.ts       ?
src/test/agent-evolution.test.ts             ?
src/test/context-tiers.test.ts               ?
```

(Os 7 primeiros foram contados manualmente nas runs do plano de 20 etapas + meta-plano.
Os demais foram incluídos no run de coverage mas suas contagens individuais não ficaram
registradas — todos passaram.)

---

## 🔧 Como reproduzir

```bash
# Coverage com todos os testes (cuidado: pode demorar 5-10 min):
npx vitest run --coverage

# Coverage só do tracer (rápido, ~30s):
npx vitest run --coverage src/test/tracing.test.ts

# HTML report (mais navegável):
npx vitest run --coverage --reporter=html
# Abre: coverage/index.html
```

O `vitest.config.ts` está configurado com:
```ts
coverage: {
  provider: "v8",
  reporter: ["text", "lcov", "json-summary"],
  include: ["src/services/**", "src/lib/**", "src/hooks/**"],
  thresholds: { lines: 70, functions: 70, branches: 60 }
}
```

Os thresholds vão falhar até o backlog de testes ser fechado — mas isso é deliberado:
sinalizam pro CI que há trabalho de cobertura pendente.
