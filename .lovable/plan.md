

## Renomear agente do rascunho direto no banner

Adiciono um botão **lápis** ao lado do nome de cada rascunho no `DraftRecoveryBanner` que troca aquele item para modo edição inline. Salvar persiste no `localStorage` (via novo helper) e propaga para a UI imediatamente — sem precisar restaurar primeiro.

### Comportamento

- Cada item do banner (single OU multi) ganha um botão lápis pequeno ao lado do nome.
- Clicar → o nome vira `<input>` inline com 2 botões: ✓ confirmar, ✗ cancelar.
- `Enter` confirma, `Esc` cancela. Validado contra `quickIdentitySchema.shape.name` (2-60 chars + regex).
- Erro inline em vermelho abaixo do input (sem toast, evita ruído).
- Ao confirmar:
  - Atualiza o `form.name` do rascunho no `localStorage`.
  - Atualiza `pendingDrafts` no wizard (re-renderiza summary + chip "Identidade" + estado `restorable`).
  - Toast curto: `Nome do rascunho atualizado`.

### Por que isso resolve

Hoje, se o rascunho está marcado como **Incompleto** só porque faltou o nome, o usuário precisa descartar ou tentar restaurar (bloqueado pela validação). Com renomear inline, ele conserta em 3s e o botão **Continuar** destrava na hora.

### Mudanças

**`src/components/agents/wizard/draftStore.ts`** — novo helper puro:
```ts
export function renameDraft(
  store: DraftsStoreV2,
  id: string,
  newName: string,
): DraftsStoreV2;
```
Atualiza `form.name` (trimmed) do rascunho `id` e bumpa `savedAt`.

**`src/components/agents/wizard/DraftRecoveryBanner.tsx`**:
- Nova prop `onRename: (id: string, newName: string) => void`.
- State local `editingId | draftName | nameError`.
- Componente interno `<NameLabelOrEditor>` reutilizado em modo single + multi.
- Validação local com `quickIdentitySchema.shape.name.safeParse(...)`.
- A11y: `aria-label="Renomear rascunho"`, `aria-invalid` no input, autofocus ao entrar em edição.

**`src/components/agents/wizard/QuickCreateWizard.tsx`**:
- Novo `handleRenameDraft(id, newName)`:
  - `setDraftsStore` com `renameDraft` + `saveDrafts`.
  - `setPendingDrafts` mapeando o item alterado.
  - `toast.success('Nome do rascunho atualizado')`.
- Passa `onRename={handleRenameDraft}` para o banner.

### Arquivos

- **Editar**: `src/components/agents/wizard/draftStore.ts`
- **Editar**: `src/components/agents/wizard/DraftRecoveryBanner.tsx`
- **Editar**: `src/components/agents/wizard/QuickCreateWizard.tsx`

### Impacto

- Conserta o rascunho sem sair do banner (zero context switch).
- Destrava CTA "Continuar" automaticamente quando o nome era o único bloqueador.
- Validação 100% consistente com o wizard (mesmo schema).
- Zero mudança em backend/store schema.

