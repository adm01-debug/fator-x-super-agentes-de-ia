
Plano já aprovado, estou em modo plano de novo. Vou re-confirmar a Frente 1 com escopo executável dentro dos limites do sandbox (timeouts) e seguir.

## Frente 1 — Cobertura de Testes (execução em chunks)

**Problema observado nas tentativas anteriores:** rodar `vitest --coverage` na suíte inteira (81 arquivos, ~2400 testes) estoura o timeout de 9min do sandbox antes de gerar `coverage-summary.json`. Solução: rodar em chunks por diretório.

### Passos
1. **Mapear falhas** — rodar vitest em 4 chunks paralelos curtos:
   - `src/test/whatsapp-*` + `src/test/bitrix24-*` (mocks legados suspeitos)
   - `src/test/*service*.test.ts`
   - `src/test/*hook*.test.ts` + `src/test/*store*.test.ts`
   - resto (`src/test/*.test.ts` excluindo os acima)
   Capturar `--reporter=json` por chunk em `/tmp/chunk-N.json`.

2. **Corrigir ~24 falhas** — para cada teste falhando:
   - Ler o service/hook real
   - Atualizar `vi.mock(...)` no teste pra refletir a assinatura atual (provavelmente novos campos, retornos `{data,error}`, ou métodos renomeados)
   - Re-rodar só o arquivo corrigido até passar

3. **Coverage por chunk** — `vitest run --coverage src/services` etc., somar manualmente os `coverage-summary.json` parciais pra obter % global. Identificar arquivos <70%.

4. **Novos testes unitários** pra fechar gaps (alvos prováveis baseado no que vi):
   - `src/lib/agentService.ts`, `src/lib/logger.ts`, `src/lib/externalClient.ts`
   - Services órfãos sem teste: rodar `ls src/services/*.ts` vs `ls src/test/*service*.test.ts` pra achar diff
   - Hooks: `useI18n`, `useNotificationStore`, `useUIStore`

5. **Testes de integração Deno** pra 5 edge functions críticas usando `supabase--test_edge_functions`:
   - `whatsapp-webhook/index.test.ts` — provider detection + HMAC + persistência
   - `bitrix24-webhook/index.test.ts` — OAuth flow + payload routing
   - `nlp-pipeline/index.test.ts` — happy path + erro de validação Zod
   - `guardrails-engine/index.test.ts` — 4 camadas (input/output/PII/policy)
   - `oracle-research/index.test.ts` — iteração + cap de tokens
   Cada teste usa `Deno.test` + `dotenv/load.ts` conforme padrão Lovable.

6. **Atualizar `vitest.config.ts`** — thresholds 70→80 (lines/functions/statements), 60→70 (branches).

### Após Frente 1 concluída
Sigo direto pra Frentes 2 (perf), 3 (Vision Agents), 4 (hardening) em mensagens subsequentes — uma frente completa por mensagem, sem pausas pra perguntas.

### Observação honesta
A suíte é grande. Se durante a execução algum chunk individual estourar timeout, vou subdividir em chunks menores ainda (por arquivo) — não vou pular nem mockar resultados. Meta real: >80% medido, não estimado.

Aprove e eu inicio a execução do passo 1 imediatamente.
