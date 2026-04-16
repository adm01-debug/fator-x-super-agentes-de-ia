
O usuário quer que eu execute testes abrangentes simulando cenários do dia a dia, focado **exclusivamente** no que acabamos de implementar nas últimas iterações: os specialists templates (Manuseio/Embalagem + 4 de Gravação) e o `CreateAgentWizard` com merge/dedupe + badges "Verificado" + contadores de categoria.

Como estou em modo READ-ONLY (chat-and-plan), não posso executar testes diretamente. Vou apresentar um plano de QA estruturado que executarei em modo default.

## Escopo dos testes (somente o que foi implementado nas últimas iterações)

**Backend / Banco:**
1. Templates persistidos em `agent_templates` (16 specialists + Manuseio/Embalagem + 4 de Gravação = ~22 ativos PT-BR)
2. Limpeza dos 8 legados em inglês (não devem retornar)
3. Índices de performance (`idx_agent_templates_public_category`, `idx_agent_templates_name_lower`, `idx_agent_templates_created_by`)

**Frontend / Wizard:**
4. Merge dedupe por nome normalizado (sem duplicatas visíveis)
5. Badge "Verificado" 🛡️ aparece apenas em templates do banco
6. Contadores de categoria (`Todos (N)`, `Operações (N)`, `Gravação (N)`...)
7. Parser de tools resiliente (string[] e object[])
8. Seleção de template → preenche campos do wizard corretamente
9. Criação de agente a partir de template specialist

## Plano de Execução

### Fase 1 — Validação de Banco (SQL via supabase--read_query)
- Query 1: `SELECT COUNT(*), category FROM agent_templates WHERE is_public=true GROUP BY category` — confirmar distribuição
- Query 2: `SELECT name FROM agent_templates WHERE name ILIKE 'Especialista%' ORDER BY name` — validar lista PT-BR completa dos 16 + Manuseio + 4 Gravação
- Query 3: `SELECT name, category FROM agent_templates WHERE category IN ('creative','analysis','data','automation')` — deve retornar 0 (legados removidos)
- Query 4: `SELECT indexname FROM pg_indexes WHERE tablename='agent_templates'` — confirmar 3 índices criados
- Query 5: `EXPLAIN ANALYZE SELECT * FROM agent_templates WHERE is_public=true AND category='Gravação'` — confirmar uso do índice
- Query 6: Verificar config JSON dos 5 últimos templates (model, tools, system_prompt, guardrails)

### Fase 2 — Testes Unitários Vitest
Criar `src/test/agent-templates-merge.test.ts`:
- Dedupe por nome normalizado (case + espaços)
- Priorização DB > static
- Parser de tools: string[] vs object[] vs null
- categoryCount: contagem correta com filtro 'all'
- dbTemplateIds: marca apenas IDs vindos do DB

Rodar suite com `npm test -- agent-templates-merge`.

### Fase 3 — Type-check & Build
- `npx tsc --noEmit` — zero erros
- `npm run build` — build limpo

### Fase 4 — Smoke Test E2E (browser tool)
Cenário do dia a dia: usuário cria agente a partir de specialist
1. Navegar `/agents/create` (autenticado)
2. Filtrar categoria "Gravação" → confirmar contador correto
3. Selecionar "Especialista - Gravação - Sublimação Canecas" → confirmar badge "Verificado"
4. Avançar wizard → campos preenchidos (nome, persona, model `gpt-4o`, tools)
5. Concluir criação → agente aparece em `/agents`
6. Repetir para "Manuseio e Embalagem de Brindes"

### Fase 5 — Relatório Final
Tabela com: módulo testado / cenário / resultado (PASS/FAIL) / evidência (query result, screenshot, log). Score 10/10 só se 100% PASS.

## Entregáveis
- 1 arquivo de teste novo: `src/test/agent-templates-merge.test.ts`
- Relatório QA inline na resposta (não cria .md, mantém repo limpo)
- Correções imediatas se algum FAIL aparecer

## Restrições
- Não toco em código fora do escopo das últimas iterações
- Não crio novos templates (somente valido os existentes)
- Browser usado apenas se Fases 1–3 passarem (economizar quota)
