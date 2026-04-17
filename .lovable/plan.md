
Próximo da fila: **#9 Computer Use / Browser Automation Agent** (Anthropic Computer Use style, P1).

Estado atual: zero infra de browser automation. Sem Playwright, sem screenshots, sem ações em DOM.

## Plano

**Backend:**
1. Migration: tabela `browser_sessions` (id, user_id, workspace_id, agent_id, goal text, status: running/completed/failed/cancelled, started_at, ended_at, steps jsonb [{action, target, screenshot_url, reasoning, ts}], final_result text, screenshots_count int, cost_cents int). RLS por user_id + workspace.
2. Edge function `browser-agent-run`: recebe `{goal, start_url, max_steps}` → loop server-side com Gemini 2.5 Pro multimodal:
   - Fetch URL → render simplificado (extrair HTML/texto via fetch + cheerio-like parsing no Deno)
   - Capturar "screenshot" textual (DOM serializado + lista de elementos clicáveis numerados)
   - LLM decide próxima ação: `click(n)`, `type(n, text)`, `navigate(url)`, `extract(selector)`, `done(result)`
   - Persiste cada step. Para em `done`, `max_steps` ou erro.
3. Edge function `browser-session-cancel`: marca cancelled.

**Service `browserAgentService.ts`:**
- runAgent(goal, startUrl, agentId), cancelSession(id), listSessions(), getSession(id), deleteSession(id).

**Frontend — nova `BrowserAgentPage.tsx` em `/browser-agent`:**
- Hero: textarea "Qual o objetivo?" + input URL inicial + seletor de agente + botão "▶ Executar".
- Painel ao vivo: indicador de step atual, lista de ações executadas com reasoning, "screenshot" textual do DOM atual, botão "Cancelar".
- Histórico de sessões: tabela com goal, status badge, steps count, custo, link para replay.
- Replay modal: timeline step-by-step com reasoning de cada decisão.

**Integração:**
- Rota `/browser-agent` em `App.tsx`.
- Item no sidebar (ícone `Globe` ou `MousePointer`).

**Validação:** `tsc` clean, executar goal simples ("buscar preço de X em Y") → ver steps → resultado final.

**Arquivos:**
- migration `browser_sessions`
- `supabase/functions/browser-agent-run/index.ts` (novo)
- `supabase/functions/browser-session-cancel/index.ts` (novo)
- `src/services/browserAgentService.ts` (novo)
- `src/pages/BrowserAgentPage.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/layout/AppSidebar.tsx` (item menu)

**Nota:** "Computer Use" real (Playwright + screenshots PNG) requer container persistente fora do Deno edge runtime. Esta entrega é DOM-based agent (texto + elementos numerados) — funciona para 80% dos casos (formulários, scraping, navegação) com zero overhead. Trocar por Browserbase/E2B Desktop fica para iteração futura quando houver budget.
