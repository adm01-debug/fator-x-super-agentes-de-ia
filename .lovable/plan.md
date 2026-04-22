

## Exportar execução selecionada como JSON no modal de Replay

Adiciono um botão **"Exportar JSON"** no header do `ReplayDialog` que baixa um arquivo com toda a execução: metadados agregados + lista completa de eventos com input, output e metadata (o "contexto mockado").

### O que muda

**`src/components/agents/traces/ReplayDialog.tsx`** — única alteração:

1. Importar o utilitário existente `downloadJSON` de `@/lib/agentExportImport` e `toast` de `@/hooks/use-toast` (não duplico Blob/URL).
2. Reorganizar o `DialogHeader` em duas colunas: à esquerda título + descrição (session_id, contagem, ms); à direita botão **outline** `<Download /> Exportar JSON`.
3. Função `handleExport()`:
   - Sanitiza `session_id` para nome de arquivo seguro (`[^a-zA-Z0-9_-]` → `_`, máx 40 chars) + timestamp ISO.
   - Nome final: `execution-{session}-{YYYY-MM-DDTHH-MM-SS}.json`.
   - Monta payload estruturado:
     ```json
     {
       "exported_at": "...",
       "schema_version": 1,
       "execution": {
         "session_id", "agent_id", "started_at", "ended_at",
         "total_ms", "total_tokens", "total_cost_usd",
         "counts": { "info", "warning", "error" },
         "event_count"
       },
       "events": [
         { "index", "id", "agent_id", "session_id", "level", "event",
           "created_at", "latency_ms", "tokens_used", "cost_usd",
           "input", "output", "metadata" }
       ]
     }
     ```
   - `downloadJSON(JSON.stringify(payload, null, 2), filename)`.
   - Toast de sucesso com nº de eventos exportados; toast destrutivo se falhar.

### O que não muda

- Nenhuma mudança em serviços, schema ou outros componentes.
- O `ReplayDialog` continua aceitando `execution: ExecutionGroup | null` — o botão só aparece quando há execução (o early return `if (!execution) return null` já garante).
- Reaproveita `downloadJSON` que já existe em `src/lib/agentExportImport.ts`.

### Arquivos

- **Editar**: `src/components/agents/traces/ReplayDialog.tsx` — header com botão de export e função `handleExport`.

### Impacto

- 1 clique para arquivar/compartilhar uma execução completa (eventos + input/output/metadata) como JSON portável.
- Schema versionado (`schema_version: 1`) permite evoluir sem quebrar consumidores externos.
- Acessível via `aria-label` + `title`; feedback via toast.

