

## Validação extra no "Continuar de onde parei"

Hoje `restoreDraft` aceita qualquer rascunho marcado como `meaningful` (basta um campo digitado) e abre direto no primeiro passo inválido. Vou adicionar uma **validação de mínimo viável** antes de restaurar: se o rascunho não tiver pelo menos a **identidade básica** (`name` + `mission` válidos pelo `quickIdentitySchema`), bloqueia a restauração e mostra toast indicando qual é o próximo passo necessário.

### Regra de "incompleto demais"

Um rascunho é restaurável se passar em **pelo menos** `quickIdentitySchema` (nome 2-60 chars + emoji + missão ≥10 chars). Justificativa: sem nome+missão o usuário não consegue se reconectar mentalmente ao trabalho — restaurar gera mais confusão que valor.

### Comportamento

1. Usuário clica **Continuar selecionado** (multi) ou **Continuar de onde parei** (single).
2. `restoreDraft(id)` valida via `quickIdentitySchema` antes de hidratar `form`.
3. Se inválido:
   - **Não** restaura, **não** muda `activeId`, **não** fecha o banner.
   - `toast.warning('Rascunho incompleto demais para retomar', { description: 'Próximo passo necessário: <campo>. Continue daqui ou descarte.' })`.
   - Mensagem específica do primeiro erro do schema (ex.: "Defina um nome para o agente", "Escreva uma missão de pelo menos 10 caracteres").
4. Se válido: fluxo atual (hidrata form, calcula `resumeIdx`, toast de sucesso).

### Sinalização visual no banner

Itens incompletos demais ganham um chip `Incompleto` discreto ao lado do tempo, e o botão "Continuar selecionado" fica `disabled` enquanto o item selecionado for inválido (com `title` explicando). No modo single, o botão também desabilita com tooltip.

### Mudanças

**`src/components/agents/wizard/draftStore.ts`** — utilitário puro novo:
```ts
export interface DraftRestoreCheck {
  canRestore: boolean;
  reason?: string;        // mensagem amigável p/ toast
  nextStep?: string;      // label do passo (Identidade/Tipo/Modelo/Prompt)
}
export function checkDraftRestorable(form: QuickAgentForm): DraftRestoreCheck;
```
Usa `quickIdentitySchema.safeParse` e mapeia o primeiro erro (`name`/`emoji`/`mission`) para uma frase PT-BR. Retorna `nextStep: 'Identidade'` quando bloqueia.

**`src/components/agents/wizard/DraftRecoveryBanner.tsx`**:
- Aceitar nova prop opcional por entry: `restorable?: boolean` em `DraftBannerEntry`.
- Renderizar chip "Incompleto" (estilo warning) quando `restorable === false`.
- Desabilitar o CTA principal (single + multi) quando o item selecionado/único for `restorable === false`, com `title` explicativo.

**`src/components/agents/wizard/QuickCreateWizard.tsx`**:
- Em `bannerEntries`: adicionar `restorable: checkDraftRestorable(d.form).canRestore`.
- Em `restoreDraft(id)`: chamar `checkDraftRestorable(target.form)` antes; se `!canRestore`, `toast.warning(reason, { description: 'Próximo passo necessário: <nextStep>' })` e abortar.

### Arquivos

- **Editar**: `src/components/agents/wizard/draftStore.ts` — novo `checkDraftRestorable`.
- **Editar**: `src/components/agents/wizard/DraftRecoveryBanner.tsx` — chip "Incompleto" + CTA disabled.
- **Editar**: `src/components/agents/wizard/QuickCreateWizard.tsx` — gate em `restoreDraft` + propaga `restorable`.

### Impacto

- Evita restaurar rascunhos vazios/sem identidade que só atrapalham.
- Usuário vê *exatamente* o que falta, sem precisar abrir o passo.
- Zero mudança em backend/store schema; tudo lógica de UI.

