

## Estados vazios + "sem resultados após filtros" com CTA limpar na tela de Traces

Hoje a `ExecutionList` mostra um único bloco genérico ("Nenhuma execução encontrada com esses filtros") tanto quando a base está vazia quanto quando os filtros eliminam tudo — sem CTA. O loading também é só um texto. Vou diferenciar os dois cenários, padronizar com `EmptyState` e oferecer "Limpar filtros".

### Visão final

**Sem traces na base** (filtros padrão, nada existe):
```text
        📊
       [📥]
   Sem traces ainda
   Quando seus agentes começarem a executar,
   as sessões aparecerão aqui em tempo real.
```

**Filtros ativos sem resultado**:
```text
        🔍
       [⛛]
   Nenhuma execução para esses filtros
   Ajuste o nível, evento, agente ou janela
   temporal para ampliar a busca.
   [ Limpar filtros ]
```

**Loading**: 5 skeletons pulsando no lugar do texto.

### Mudanças

**1. `src/components/agents/traces/ExecutionList.tsx`**
- Novas props opcionais: `hasActiveFilters?: boolean`, `onClearFilters?: () => void`.
- Loading: substituir o texto por 5 `<div>` skeleton com `animate-pulse`.
- Empty: usar `<EmptyState>` (já existe em `@/components/shared/EmptyState`):
  - Se `hasActiveFilters`: ícone `Filter`, ilustração `search`, título "Nenhuma execução para esses filtros", `actionLabel="Limpar filtros"` chamando `onClearFilters`.
  - Caso contrário: ícone `Inbox`, ilustração `data`, título "Sem traces ainda", sem CTA.

**2. `src/pages/AgentTracesPage.tsx`**
- Computar `hasActiveFilters` a partir do estado atual:
  ```ts
  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    level !== 'all' ||
    event !== 'all' ||
    (id ? agentFilter !== id : agentFilter !== 'all') ||
    sinceHours !== 24;
  ```
- `handleClearFilters()`: reseta `search`, `level`, `event`, `agentFilter` (para `id ?? 'all'`), `sinceHours` (para 24) e `selectedId` (null).
- Passar `hasActiveFilters` e `onClearFilters` para `<ExecutionList>`.
- Painel da Linha do tempo: quando `executions.length === 0` mostrar um `EmptyState` consistente (mesma lógica filtros vs vazio) em vez do placeholder atual. Quando há execuções mas nenhuma selecionada, manter a mensagem curta atual com ícone `Activity`.

### Arquivos

- **Editar**: `src/components/agents/traces/ExecutionList.tsx` — props de filtros, skeleton de loading, dois `EmptyState` distintos com CTA.
- **Editar**: `src/pages/AgentTracesPage.tsx` — `hasActiveFilters`, `handleClearFilters`, repassar para a lista e usar `EmptyState` no painel da timeline.

### Impacto

- Usuário entende imediatamente se o problema é "ainda não rodou nada" ou "filtros restritivos demais".
- 1 clique para resetar todos os filtros via CTA.
- Loading com skeletons fica consistente com o resto do app.
- Zero mudança em serviços, schema ou store.

