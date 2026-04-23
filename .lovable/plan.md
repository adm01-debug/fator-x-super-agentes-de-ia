

## Plano: 4 melhorias para "Limpar filtros" em AgentTracesPage

Aplicar as 4 melhorias sequencialmente nos filtros existentes (busca, nível, evento, agente, janela temporal). Os termos "canais/datas/sentimento" do pedido são mapeados aos filtros reais da página (evento/janela/nível) — confirmo no toast com os rótulos reais.

---

### Melhoria 1 — Toast detalhado ao limpar filtros

Ao clicar em "Limpar filtros", exibir toast Sonner detalhando exatamente o que foi limpo e o que foi removido do storage:

- Lista de filtros que estavam ativos e voltaram ao padrão (ex.: `Busca: "checkout" → vazio`, `Nível: error → todos`, `Janela: 7 dias → 24h`).
- Confirmação explícita de quais chaves de storage foram limpas (`nexus.traces.filters` quando aplicável).
- Botão "Desfazer" embutido no toast (ver Melhoria 3).

### Melhoria 2 — Persistência de filtros na conta (Cloud) + fallback localStorage

Criar persistência por usuário, com sincronização cross-device:

- Nova tabela `user_filter_preferences` no Cloud:
  ```
  user_id uuid (FK auth.users)
  scope   text          -- 'agent_traces' (multi-tela no futuro)
  filters jsonb         -- { search, level, event, agentId, sinceHours }
  updated_at timestamptz
  PRIMARY KEY (user_id, scope)
  ```
  RLS: usuário só lê/escreve as próprias linhas.
- Novo serviço `src/services/userFilterPreferencesService.ts` com `getFilters(scope)` / `saveFilters(scope, filters)` (debounced 800ms).
- Novo hook `useFilterPersistence('agent_traces', defaults)` que:
  1. Hidrata do Cloud no mount (com `isLoading`).
  2. Faz fallback para `localStorage` (`nexus.traces.filters`) se o usuário estiver offline ou a chamada falhar.
  3. Persiste em ambos (Cloud + localStorage) a cada mudança debounced.
- Indicador discreto "✓ Sincronizado" / "💾 Salvo localmente" abaixo do `TracesFilters`.

### Melhoria 3 — Undo (5s) ao limpar filtros

Implementar snapshot + restauração:

- Antes de aplicar o reset, capturar `snapshot = { search, level, event, agentFilter, sinceHours }`.
- Toast Sonner com ação "Desfazer" visível por 5s; ao clicar, restaura o snapshot exato (estado React + Cloud + localStorage).
- Se o usuário alterar qualquer filtro manualmente nesse intervalo, o undo é invalidado (botão removido).
- Implementado dentro do mesmo toast detalhado da Melhoria 1 (uma única notificação rica).

### Melhoria 4 — Modal de confirmação antes de limpar

Reusar o componente existente `ConfirmDialog` (já em `src/components/shared/ConfirmDialog.tsx`):

- Envolver os 2 gatilhos atuais de "Limpar filtros" (`ExecutionList` empty state + EmptyState do timeline).
- Modal exibe: lista de filtros ativos que serão resetados + aviso de que preferências sincronizadas na conta também serão limpas.
- Adicionar checkbox "Não perguntar novamente nesta sessão" (estado em `sessionStorage`, escopo: `agent_traces`).
- Botão de confirmação destrutivo (vermelho); cancelar mantém tudo.

---

### Ordem de execução (sequencial, autônoma)

1. **Migração SQL**: criar `user_filter_preferences` + RLS + índice por `(user_id, scope)`.
2. **Serviço + hook**: `userFilterPreferencesService.ts` e `useFilterPersistence.ts` com fallback localStorage.
3. **Integrar em AgentTracesPage**: hidratação + persistência debounced + indicador de sync.
4. **Refator `handleClearFilters`**: snapshot → ConfirmDialog → reset → toast custom com detalhamento + Undo (5s).
5. **Wrap dos gatilhos** em ConfirmDialog (com bypass por sessionStorage).
6. **Testes**: unit do hook (hidrata Cloud, fallback localStorage, persiste debounced) + integração da UI (modal abre, undo restaura, toast lista campos).

### Arquivos afetados

Criados:
- `supabase/migrations/<ts>_user_filter_preferences.sql`
- `src/services/userFilterPreferencesService.ts`
- `src/hooks/useFilterPersistence.ts`
- `src/components/agents/traces/ClearFiltersToast.tsx` (toast custom com Undo)
- `src/components/agents/traces/ClearFiltersConfirm.tsx` (wrapper ConfirmDialog)
- Testes correspondentes em `__tests__/`

Editados:
- `src/pages/AgentTracesPage.tsx` (handleClearFilters, hidratação, indicador)
- `src/components/agents/traces/ExecutionList.tsx` (passar trigger ao ConfirmDialog em vez de callback direto)

### Observações técnicas

- Debounce de 800ms na escrita Cloud evita spam de UPDATEs ao digitar na busca.
- Snapshot do undo vive em `useRef` (não dispara re-render) com timeout de 5s que limpa o ref.
- O toast usa `toast.custom` (Sonner) para acomodar lista de campos + botão Undo + duração 7s (5s undo + 2s grace).
- `ConfirmDialog` já existe e segue o design system — sem necessidade de novo componente Radix.

