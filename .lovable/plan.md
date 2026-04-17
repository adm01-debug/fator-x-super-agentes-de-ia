
Sprint 24 (Visual regression) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 25 — k6 load test do edge function crítico**.

## Por quê
- Edge functions são o caminho crítico (chat completion, agent execution) — performance sob carga é desconhecida
- k6 é o padrão indústria para load testing: scriptável em JS, roda em CI, métricas Prometheus-compatíveis
- Detecta degradação P95/P99, error rate sob concorrência, throughput limit antes de produção

## Plano

**1. Identificar edge function crítica:** inspecionar `supabase/functions/` e escolher a de maior tráfego esperado (provavelmente `chat-completion` ou similar). Se múltiplas candidatas, focar em 1 com endpoint público autenticado.

**2. `tests/load/chat-completion.k6.js` (novo):**
- Smoke test: 1 VU por 30s (sanity check)
- Load test: ramp-up 0→20 VUs em 1min, sustentar 3min, ramp-down 30s
- Thresholds: `http_req_duration p(95)<2000`, `http_req_failed rate<0.01`, `checks rate>0.95`
- Auth: usar service role key para gerar JWT sintético (espelha padrão E2E)
- Skip gracioso se `SUPABASE_SERVICE_ROLE_KEY` ausente

**3. `tests/load/README.md`:** como rodar local (`k6 run`), interpretar output, calibrar thresholds.

**4. `package.json`:** scripts
- `"test:load": "k6 run tests/load/chat-completion.k6.js"`
- `"test:load:smoke": "k6 run --vus 1 --duration 30s tests/load/chat-completion.k6.js"`

**5. `.github/workflows/ci.yml`:** novo job `load-test`
- `if: github.event_name == 'pull_request'` + label gate (`load-test` label) — não roda em todo PR (caro)
- Setup k6 via `grafana/setup-k6-action@v1`
- Roda smoke test sempre, full load apenas com label
- Upload de `summary.json` como artifact

**6. `docs/RUNBOOK.md`:** seção "Load Testing — k6"
- Tabela de thresholds
- Política: rodar full load antes de releases majors + quando edge function crítica muda
- Como interpretar P95/P99 spikes

**7. `mem://features/audit-improvements`:** Sprint 25 logged + fila atualizada (Sprint 26 OTel).

## Arquivos
- `tests/load/chat-completion.k6.js` (novo)
- `tests/load/README.md` (novo)
- `package.json` (2 scripts)
- `.github/workflows/ci.yml` (novo job opt-in)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- `npm run test:load:smoke` local passa em <40s com 0 erros
- CI: smoke roda em todo PR, full apenas com label `load-test`
- Thresholds violados = job falha vermelho com summary detalhado
