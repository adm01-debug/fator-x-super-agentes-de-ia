# Service Level Objectives (SLOs)

> Metas de qualidade e desempenho para a plataforma Fator X Super Agentes de IA.

---

## Visao Geral

SLOs definem os niveis minimos de qualidade que a plataforma deve manter. Eles guiam decisoes de engenharia, priorizam trabalho de confiabilidade e definem quando o time deve pausar features para focar em estabilidade.

**Regra geral:** Se algum SLO esta sendo violado consistentemente, novas features devem ser pausadas ate que o SLO seja restaurado.

---

## Disponibilidade

| Metrica | Alvo | Janela | Medicao |
|---------|------|--------|---------|
| Uptime da aplicacao | **99.9%** | Mensal (rolling 30 dias) | Monitoramento sintetico (health check a cada 1 min) |

### O que significa 99.9%

| Janela | Downtime maximo permitido |
|--------|---------------------------|
| Diario | 1 minuto e 26 segundos |
| Semanal | 10 minutos e 5 segundos |
| Mensal | 43 minutos e 50 segundos |
| Anual | 8 horas e 46 minutos |

### Como medir

- Endpoint de health check: `GET /api/health` (ou pagina principal retornando 200)
- Considerar indisponivel quando: HTTP status >= 500 ou timeout > 10s
- Excluir manutencoes programadas (com aviso de 48h) do calculo

### Error Budget

Com 99.9% de alvo mensal, temos **43 minutos de error budget** por mes. Se o budget for consumido:

1. Congelar deploys de features
2. Focar exclusivamente em confiabilidade
3. Revisar incidentes recentes para identificar padroes
4. Descongelar quando o budget do proximo mes iniciar, se houver plano de acao

---

## Latencia

| Metrica | Alvo | Medicao |
|---------|------|---------|
| Page Load (P50) | < 1s | Web Vitals (LCP) |
| Page Load (P95) | < 2s | Web Vitals (LCP) |
| Chamadas LLM (P50) | < 3s | Tempo de resposta da API de IA |
| Chamadas LLM (P95) | < 5s | Tempo de resposta da API de IA |
| Chamadas LLM (P99) | < 5s | Tempo de resposta da API de IA |
| Queries Supabase (P95) | < 500ms | Latencia medida no cliente |
| Navegacao SPA (P95) | < 300ms | Transicao entre rotas |

### Como medir

```typescript
// Exemplo de medicao de latencia no cliente
const start = performance.now();
const result = await supabase.from('table').select('*');
const duration = performance.now() - start;
logger.info('query_duration_ms', { duration, table: 'table' });
```

### Acoes quando fora do SLO

- **Page Load > 2s (P95):** Auditar bundle size, verificar code splitting, revisar queries N+1
- **LLM > 5s (P99):** Implementar streaming de resposta, revisar prompts, considerar cache de respostas frequentes
- **Supabase > 500ms (P95):** Adicionar indices, otimizar queries, verificar RLS policies complexas

---

## Taxa de Erro

| Metrica | Alvo | Medicao |
|---------|------|---------|
| Erros de API (5xx) | < **0.1%** de todas as requisicoes | Logs do servidor |
| Erros de cliente (crashes) | < **0.5%** das sessoes | Error boundary + logger |
| Falhas de autenticacao inesperadas | < **0.01%** | Logs do Supabase Auth |

### Como medir

```typescript
// Error boundary global para capturar crashes
// Ja deve estar implementado em src/components/ErrorBoundary
const errorRate = totalErrors / totalSessions * 100;
```

### Acoes quando fora do SLO

- Revisar logs de erro para identificar os erros mais frequentes
- Priorizar fixes para erros que afetam > 1% dos usuarios
- Implementar retry com backoff exponencial para falhas transientes

---

## Performance de Build

| Metrica | Alvo | Medicao |
|---------|------|---------|
| Bundle size (main, gzipped) | < **300KB** | `vite build` + analise de output |
| Tempo de build | < **30 segundos** | CI pipeline |
| Tempo de deploy | < **5 minutos** | Push ate URL acessivel |
| Tempo de `vite dev` startup | < **5 segundos** | Local |

### Como medir

```bash
# Bundle size
bun run build
# Verificar output em dist/assets/

# Tempo de build
time bun run build

# Analise detalhada de bundle (se configurado)
npx vite-bundle-visualizer
```

### Acoes quando fora do SLO

- **Bundle > 300KB:** Auditar dependencias com `npx vite-bundle-visualizer`, aplicar tree shaking, lazy load rotas
- **Build > 30s:** Verificar dependencias pesadas, otimizar configuracao do Vite
- **Deploy > 5min:** Verificar pipeline do CI, otimizar steps desnecessarios

---

## Qualidade de Codigo

| Metrica | Alvo | Medicao |
|---------|------|---------|
| Taxa de testes passando | **100%** | `bun run test` |
| TypeScript strict sem erros | **0 erros** | `bun run types:check` |
| Lint sem erros | **0 erros** | `bun run lint` |
| Cobertura de testes (linhas) | > **70%** | Vitest coverage |

### Como medir

```bash
# Rodar todos os checks
bun run types:check && bun run lint && bun run test

# Cobertura
bun run test -- --coverage
```

### Acoes quando fora do SLO

- Testes falhando: **Bloquear merge** ate corrigir
- Erros de TypeScript: **Bloquear merge** ate corrigir
- Cobertura abaixo de 70%: Adicionar testes antes de features novas

---

## Confiabilidade Operacional

| Metrica | Alvo | Medicao |
|---------|------|---------|
| MTTR (P0) | < **1 hora** | Tempo de deteccao ate resolucao |
| MTTR (P1) | < **4 horas** | Tempo de deteccao ate resolucao |
| MTBF (Mean Time Between Failures) | > **7 dias** | Tempo entre incidentes P0/P1 |
| Deploys com rollback | < **5%** | Deploys revertidos / total de deploys |

### Acoes quando fora do SLO

- **MTTR > 1h para P0:** Melhorar runbooks, automatizar rollback, investir em observabilidade
- **MTBF < 7 dias:** Pausar features, focar em testes e estabilidade
- **Rollback > 5%:** Reforcar testes pre-deploy, adicionar feature flags

---

## Dashboard de SLOs

Recomenda-se criar um dashboard (Grafana, Supabase Dashboard ou planilha) que mostre:

1. **Semaforo por SLO:** Verde (dentro do alvo), Amarelo (< 10% de margem), Vermelho (violando)
2. **Error budget restante** para o mes corrente
3. **Tendencia** dos ultimos 30/60/90 dias
4. **Incidentes** que impactaram cada SLO

### Revisao Mensal

Na primeira semana de cada mes, o Tech Lead deve:

1. Revisar todos os SLOs do mes anterior
2. Documentar violacoes e causas
3. Propor ajustes nos alvos se necessario (SLOs devem ser ambiciosos mas atingiveis)
4. Comunicar o status ao time

---

## Glossario

| Termo | Definicao |
|-------|-----------|
| **SLO** | Service Level Objective - meta interna de qualidade |
| **SLI** | Service Level Indicator - metrica que mede o SLO |
| **Error Budget** | Quantidade de indisponibilidade/erros permitida antes de violar o SLO |
| **P50/P95/P99** | Percentis de distribuicao (50% / 95% / 99% das requisicoes) |
| **RTO** | Recovery Time Objective - tempo maximo para recuperar o servico |
| **MTTR** | Mean Time To Recovery - tempo medio de recuperacao |
| **MTBF** | Mean Time Between Failures - tempo medio entre falhas |
| **LCP** | Largest Contentful Paint - metrica de Web Vitals para carregamento |
