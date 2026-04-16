
Vou executar as 4 frentes em sequência, sem pausas. Cada frente entregue por completo antes de passar pra próxima.

## Frente 1 — Cobertura de Testes >80%
- Rodar `vitest --coverage` em chunks (services, lib, hooks separados) pra capturar % real sem timeout.
- Identificar e corrigir os ~24 testes falhando (mocks legados WhatsApp/Bitrix24 — ajustar `vi.mock` pra refletir contratos atuais).
- Adicionar testes unitários nos arquivos abaixo de 70%: services órfãos, helpers em `src/lib/`, hooks críticos.
- Criar testes de integração Deno pra 5 edge functions críticas: `whatsapp-webhook`, `bitrix24-webhook`, `nlp-pipeline`, `guardrails-engine`, `oracle-research`.
- Atualizar thresholds em `vitest.config.ts` de 70→80.

## Frente 2 — Performance & Otimização
- Auditoria de bundle: `vite build --mode production` + `rollup-plugin-visualizer` pra mapear chunks pesados.
- Lazy loading agressivo: converter rotas pesadas (Oracle, DataHub, Workflows, Cerebro) em `React.lazy` + Suspense.
- React Query tuning: definir `staleTime`/`gcTime` por domínio (listas: 30s, detalhes: 5min, configs: 1h).
- Índices DB: rodar `EXPLAIN ANALYZE` em queries lentas conhecidas, criar migration com índices faltantes em `agent_traces`, `evaluation_runs`, `oracle_history`.
- Edge Functions: revisar cold-start removendo imports desnecessários nas 5 mais chamadas.

## Frente 3 — Novo Módulo: Vision Agents
Escolho **Vision Agents** (mais valor imediato pro caso "Fator X"):
- Tabela `vision_analyses` (workspace_id, agent_id, image_url, analysis_json, model, tokens, created_at) + RLS.
- Edge function `vision-analyze` usando `google/gemini-2.5-pro` via Lovable AI (multimodal já suportado).
- Página `/vision-agents` com upload de imagem, seleção de agente, histórico, comparação lado-a-lado.
- Service `visionAgentsService.ts` + hook `useVisionAnalyses` + testes.
- Item de menu na sidebar (PT-BR: "Agentes de Visão").

## Frente 4 — Hardening de Produção
- Sentry: adicionar `@sentry/react` + DSN como secret, integração no `main.tsx`, source maps no build.
- Rate limiting global: middleware nas edge functions usando `_shared/rate-limiter.ts` (já existe), aplicar em todas as 27 functions.
- Runbooks: criar `docs/runbooks/` com playbooks pra incidentes comuns (DB down, edge function 500, rate limit hit, OAuth expirado).
- Backup/restore: documentar processo de export do Supabase + script de restore. Schedule `pg_dump` semanal via GH Action.
- Disaster recovery: documento `DR-PLAN.md` com RTO/RPO, contatos, rollback steps.

## Ordem de execução
1. **Mensagem 1 (próxima)**: Frente 1 completa — coverage report + correção de testes + novos testes + thresholds atualizados.
2. **Mensagem 2**: Frente 2 completa.
3. **Mensagem 3**: Frente 3 completa.
4. **Mensagem 4**: Frente 4 completa + relatório final 10/10.

Aprove o plano e eu inicio a Frente 1 imediatamente na próxima resposta.
