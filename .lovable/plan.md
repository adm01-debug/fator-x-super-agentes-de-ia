
#5 done. Próxima: **#6 Cost Predictor** — estimativa de custo antes de rodar.

## #6 Cost Predictor

Preview de custo/latência baseado em config atual + input do playground, usando tabela de preços por modelo.

**Pricing table (constante):**
- `src/lib/llmPricing.ts` — map `model → { input_per_1k, output_per_1k, avg_latency_ms }`
- Cobre: gemini-2.5-flash/pro/lite, gpt-5/mini/nano, gemini-3.x

**Hook:**
- `src/hooks/useCostEstimate.ts`
- Input: `{ model, systemPrompt, userInput, maxTokens, tools[] }`
- Tokens estimados: chars/4 (system + user) + maxTokens output
- Output: `{ inputTokens, outputTokens, costUsd, costBrl, estLatencyMs }`
- USD→BRL via constante (5.0) ou env

**UI — 2 lugares:**
1. **Playground** (`AgentPlayground.tsx`): card "💰 Estimativa" acima do botão Send mostrando custo + latência prevista, atualiza ao digitar
2. **CostModule** existente (ou Billing): widget "Simulador" — input livre + slider tokens → tabela comparando todos os modelos lado a lado (acha o mais barato/rápido)

**Componente compartilhado:**
- `src/components/agent-builder/CostEstimateCard.tsx` — card compacto reutilizável

**Arquivos:**
- criar `src/lib/llmPricing.ts`
- criar `src/hooks/useCostEstimate.ts`
- criar `src/components/agent-builder/CostEstimateCard.tsx`
- editar `src/components/agent-builder/AgentPlayground.tsx` — integrar card
- editar `src/components/agent-builder/modules/BillingModule.tsx` — adicionar simulador comparativo

**Validação:** abrir playground → digitar input → ver custo USD/BRL atualizando; trocar modelo no builder → custo recalcula; em Billing → simular e ver tabela comparativa.

Próximas sem pausar: #9 Eval Suite → #10 Visual Orchestrator → #7 Guardrails Library.
