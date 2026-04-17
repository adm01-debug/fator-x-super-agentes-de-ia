
Próxima da fila: **#5 Code Interpreter Sandbox (E2B-style)**.

Estado atual: `CodeInterpreterPage.tsx` é mock (setTimeout + string fixa). Edge function `smolagent-runtime` existe mas sem isolamento real.

## Plano

**Backend:**
1. Migration: tabela `code_executions` (id, user_id, workspace_id, runtime, code, stdout, stderr, exit_code, files jsonb, duration_ms, memory_mb, status, created_at) com RLS por user_id.
2. Edge function `code-interpreter-execute`:
   - Valida JWT + Zod schema (runtime ∈ python|node|deno, code ≤ 50KB)
   - Runtime **Deno**: executa nativo via `Deno.Command` em worker isolado com timeout 30s + memory cap
   - Runtime **Node/Python**: usa Lovable AI Gateway (gemini-2.5-flash) para "simular" execução determinística com sandbox virtual (retorna stdout/stderr/files plausíveis baseado em análise estática) — marcado como `simulated: true`. Realmente executar Python exige container externo (E2B/Daytona) — fora de escopo sem API key.
   - Persiste resultado em `code_executions`
3. Service `codeInterpreterService.ts`: execute(), list(), get(), remove()

**Frontend:**
4. Reescrever `CodeInterpreterPage.tsx`:
   - Editor real (textarea com syntax highlight via `<pre>` + line numbers)
   - Painel histórico de execuções (últimas 20) com replay
   - Output tabs: stdout (cor), stderr (vermelho), files (download via base64), métricas (duração, memória)
   - Badge "Sandbox real" (Deno) vs "Simulado" (Python/Node)
   - Snippets prontos: Hello World, fibonacci, JSON parse
   - Botão "Limpar histórico"

**Validação:**
- `tsc` clean
- Executar snippet Deno → ver stdout real
- Executar Python → ver simulação com aviso
- Verificar persistência ao recarregar página

**Arquivos:**
- migration `code_executions`
- `supabase/functions/code-interpreter-execute/index.ts` (novo)
- `src/services/codeInterpreterService.ts` (novo)
- `src/pages/CodeInterpreterPage.tsx` (reescrita)
