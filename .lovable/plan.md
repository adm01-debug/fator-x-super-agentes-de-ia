

## Confirmação modal ao descartar rascunho

Hoje os botões **Descartar** (single + por item no multi) e **Descartar todos** no `DraftRecoveryBanner` removem o rascunho imediatamente, sem chance de desfazer. Vou envolver cada um deles com `ConfirmDialog` (já existente em `src/components/shared/ConfirmDialog.tsx`, baseado em Radix `AlertDialog`) para exigir confirmação explícita.

### Comportamento

- **Descartar (single)**: clique abre modal com título `Descartar este rascunho?` e descrição mencionando o nome do agente (ou "sem nome ainda"). Botões: **Cancelar** / **Descartar** (vermelho).
- **Descartar item (multi)**: o botão `X` ao lado de cada rascunho na lista também passa por modal, mencionando qual rascunho será removido pelo nome.
- **Descartar todos (multi)**: modal mais enfático — título `Descartar todos os N rascunhos?`, descrição avisando que a ação é irreversível.
- `Esc` e clique fora cancelam (comportamento nativo do Radix).
- `Enter` confirma quando o foco está no botão de ação (padrão do AlertDialog).

### Mudanças

**`src/components/agents/wizard/DraftRecoveryBanner.tsx`**:
- Importar `ConfirmDialog` de `@/components/shared/ConfirmDialog`.
- Single mode: trocar `<Button onClick={() => onDiscardOne(only.id)}>` por `<ConfirmDialog trigger={<Button …>} … onConfirm={() => onDiscardOne(only.id)} />`.
- Multi mode item: trocar o `<button>` X dentro do loop por `<ConfirmDialog trigger={<button …>} … onConfirm={() => onDiscardOne(d.id)} />`. Manter `onClick` com `stopPropagation` no trigger para não selecionar o item ao abrir o modal.
- Multi mode footer: trocar `<Button onClick={onDiscardAll}>` por `<ConfirmDialog trigger={<Button …>} … onConfirm={onDiscardAll} />`.
- Helper local `discardCopy(name: string)` para gerar título/descrição consistentes mencionando o nome (ou fallback "sem nome ainda").

### Arquivos

- **Editar**: `src/components/agents/wizard/DraftRecoveryBanner.tsx`

### Impacto

- Zero descarte acidental — toda remoção exige 2 cliques explícitos.
- Reusa componente existente (`ConfirmDialog`), zero nova dependência.
- A11y herdada do Radix `AlertDialog`: foco trap, `Esc` cancela, leitores de tela anunciam título/descrição.
- Zero mudança em store, props públicas (`onDiscardOne`/`onDiscardAll` mantêm assinatura) ou backend.

