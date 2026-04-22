

## Múltiplos rascunhos por sessão no Quick Wizard

Hoje há **um único rascunho** salvo em `localStorage` na chave `quick-agent-wizard-draft`. O envelope é sobrescrito a cada autosave, então trocar de tipo de agente perde o trabalho anterior. Vou migrar para uma **coleção de rascunhos** identificados por `id`, com seleção visual no banner — sem mudar nada no backend.

### Visão final

**Banner com 1 rascunho** (caso atual): mantém comportamento — "Continuar de onde parei" + Descartar.

**Banner com 2+ rascunhos**:
```text
┌──────────────────────────────────────────────────┐
│ 📂 3 rascunhos encontrados                        │
│                                                   │
│ ◉ "Vendedor IA"          tipo · há 5 min          │
│   ✓ Identidade ✓ Tipo ✓ Modelo ─ Prompt           │
│                                                   │
│ ○ "Suporte L1"           atendimento · há 2 h     │
│   ✓ Identidade ✓ Tipo ─ Modelo ─ Prompt           │
│                                                   │
│ ○ sem nome ainda         pesquisa · há 1 dia      │
│   ✓ Identidade ─ Tipo ─ Modelo ─ Prompt           │
│                                                   │
│ [✕] em cada linha para descartar individualmente  │
│                                                   │
│            [ Descartar todos ]  [ Continuar ]     │
└──────────────────────────────────────────────────┘
```

Ao restaurar, abre no passo onde aquele rascunho parou (lógica atual de `resumeIdx`).

### Modelo de armazenamento

Nova chave `quick-agent-wizard-drafts` (plural) com schema versionado:
```ts
interface DraftsStoreV2 {
  version: 2;
  activeId: string | null;     // rascunho em edição agora
  drafts: Array<{
    id: string;                 // crypto.randomUUID()
    form: QuickAgentForm;
    savedAt: string;            // ISO
    createdAt: string;          // ISO
  }>;
}
```

**Migração transparente**: ao montar, se existir a chave antiga `quick-agent-wizard-draft` e nenhuma nova, converte para um rascunho único na coleção e remove a antiga.

**Limite**: máximo 5 rascunhos. Ao criar o 6º, descarta o mais antigo automaticamente (LRU por `savedAt`).

**Heurística de "novo rascunho"**: quando o usuário **muda o `type`** depois de já ter um rascunho meaningful em edição, oferece via toast de ação rápida: "Salvar como novo rascunho?" — assim o usuário pode manter um por tipo. Se ignorar, sobrescreve o ativo (comportamento normal).

### Mudanças

**1. `src/components/agents/wizard/draftStore.ts`** (novo) — utilitários puros:
- `loadDrafts(): DraftsStoreV2` (com migração v1 → v2)
- `saveDrafts(store)`, `upsertDraft(store, draft)`, `removeDraft(store, id)`, `setActive(store, id)`
- `summarize(form)` movido para cá (reuso do banner)
- `MAX_DRAFTS = 5`, `DRAFT_TTL_MS` mantido

**2. `src/components/agents/wizard/DraftRecoveryBanner.tsx`** — refatorar:
- Aceitar `drafts: Array<{ id; savedAt; summary; typeLabel? }>` em vez de `savedAt + summary`.
- Quando `drafts.length === 1`: mantém UI atual (compat).
- Quando `drafts.length > 1`: lista com radio buttons (`role="radiogroup"`), um chip de tipo, chips de progresso compactos, botão `X` por linha, e CTAs `Descartar todos` + `Continuar` (usa o selecionado).
- Props: `onRestore(id)`, `onDiscardOne(id)`, `onDiscardAll()`.
- Acessibilidade: navegação por setas entre opções, `aria-checked`, foco inicial no primeiro item.

**3. `src/components/agents/wizard/QuickCreateWizard.tsx`** — adaptar:
- Substituir `pendingDraft: DraftEnvelope | null` por `pendingDrafts: DraftEntry[]`.
- `useEffect` de mount: carrega via `loadDrafts()`, filtra por TTL + `isDraftMeaningful`, ordena por `savedAt desc`.
- `restoreDraft(id)`: marca como `activeId`, hidrata `form`, calcula step de retomada.
- `discardDraft(id)`: remove do store; se `id === activeId`, limpa.
- `discardAllDrafts()`: zera coleção.
- Autosave (`useEffect [form, draftDecided, activeId]`): faz `upsertDraft` no `activeId` (cria novo id se ausente e `isDraftMeaningful(form)`).
- **Novo rascunho ao mudar tipo**: efeito que dispara quando `form.type` muda e o ativo já tinha tipo diferente meaningful → `toast` com ação "Salvar como novo" que cria entrada nova e troca `activeId`.
- Após salvar agente com sucesso: remove **apenas** o rascunho ativo (não a coleção toda).

### Arquivos

- **Novo**: `src/components/agents/wizard/draftStore.ts` — store, migração v1→v2, LRU, summarize.
- **Editar**: `src/components/agents/wizard/DraftRecoveryBanner.tsx` — modo lista + modo single (compat).
- **Editar**: `src/components/agents/wizard/QuickCreateWizard.tsx` — usar coleção, autosave por id, nova heurística de troca de tipo, descarte individual.

### Impacto

- Mantém múltiplos rascunhos paralelos (ex.: 1 vendedor + 1 suporte) sem perder trabalho ao trocar de tipo.
- Compat retroativa: rascunho antigo aparece automaticamente como o primeiro da nova coleção.
- Zero mudança de schema/serviço/backend — tudo `localStorage`.
- LRU de 5 evita inflar storage; TTL de 7 dias preservado.
- Banner totalmente acessível (`radiogroup`, setas, aria-checked).

