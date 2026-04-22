

## Estado "Custom" persistente para travar a detecção de variação

Hoje `detectPromptVariant(type, prompt)` decide a chip ativa por **comparação exata**: se o usuário editar 1 caractere a chip muda para "customizado", e se editar de volta volta a aparecer ativa. Isso faz as chips piscarem entre estados durante a edição. A solução é introduzir um *lock* explícito.

### O que muda na visão do usuário

1. **Primeira edição manual do prompt** (digitar, colar, inserir snippet do checklist, jumpToSection com inserção) → chip ativa fica "fantasma" e aparece o **chip "Customizado" travado** com ícone 🔒. As três chips Balanceado/Conciso/Detalhado ficam levemente esmaecidas, mas continuam clicáveis.
2. Clicar em qualquer variação (Balanceado/Conciso/Detalhado) → toast de confirmação *"Substituir prompt customizado pela variação X?"* (`AlertDialog`). Confirmando: aplica o template e **destrava** o lock (volta ao modo automático).
3. Botão **"Sair do modo customizado"** ao lado da chip travada → equivalente a "Restaurar template" mas só destrava o lock (sem mudar o texto), permitindo o auto-detect rodar de novo.
4. **Trocar tipo de agente** (`form.type`) → reseta o lock automaticamente, porque o usuário está começando de outro template.
5. **Aplicar template / Restaurar template** → reseta o lock.
6. **Restaurar do histórico de prompts** → reativa o lock (é uma "edição manual" recuperada).

### Como funciona (técnico)

**Novo estado no `QuickCreateWizard`**:
```ts
const [promptCustomLocked, setPromptCustomLocked] = useState(false);
const lastTypeForLockRef = useRef(form.type);
```
- Resetado para `false` em: `applyTemplate`, `applyPromptVariant`, `restorePromptFromType`, troca de `form.type`.
- Setado para `true` em: `update('prompt', …)` quando vier de uma fonte "manual" (typing/paste/insertSection/jumpToSection com inserção/restore do histórico).

Para distinguir "manual" de "programático" sem invadir o `update` genérico, adiciono um helper:
```ts
const updatePromptManual = (next: string) => {
  setForm((p) => ({ ...p, prompt: next }));
  setPromptCustomLocked(true);
};
```
- `StepQuickPrompt` recebe `updatePromptManual` como nova prop e usa-o em vez de `update('prompt', …)` em todos os caminhos de edição (handleChange, handlePaste, insertSectionSnippet, jumpToSection-com-inserção, PromptHistoryPanel.onRestore, checklist.onInsert).
- `applyPromptVariant`, `applyTemplate`, `restorePromptFromType` continuam usando `setForm`/`update` direto (programáticos) e fazem `setPromptCustomLocked(false)`.

**Detecção efetiva**:
```ts
const detected = detectPromptVariant(form.type as QuickAgentType, form.prompt);
const activeVariant = promptCustomLocked ? null : detected;
```
Esse `activeVariant` continua sendo o que o `PromptVariantSelector` recebe — então o UI se comporta exatamente como hoje, só que com o lock impedindo o "match acidental".

**Reset automático ao trocar tipo**:
```ts
useEffect(() => {
  if (lastTypeForLockRef.current !== form.type) {
    lastTypeForLockRef.current = form.type;
    setPromptCustomLocked(false);
  }
}, [form.type]);
```

**Confirmação ao aplicar variação com lock ativo** (em `applyPromptVariant`):
```ts
if (promptCustomLocked && form.prompt.trim().length > 0) {
  setPendingVariant(variantId);   // abre AlertDialog
  return;
}
// senão, aplica direto.
```
- Novo `AlertDialog` no Wizard com título *"Substituir prompt customizado?"* e descrição com prévia diff (chars atuais → chars da variação). Confirmar chama o caminho real e destrava.

**Persistência no draft** (`draftStore`):
- Adiciono `promptCustomLocked: boolean` ao shape do `DraftEntry` (campo opcional, default `false`).
- Salvo junto com o resto do form em `upsertDraft`.
- Restaurado quando o usuário aceita um draft → o lock volta como estava.

### Mudanças no `PromptVariantSelector`

- Recebe nova prop opcional `customLocked: boolean` e `onUnlock: () => void`.
- Quando `customLocked`:
  - O badge "customizado" ganha ícone 🔒 (`Lock` do lucide) + tooltip *"Edição manual detectada — clique numa variação para substituir, ou em 'Sair do modo custom'."*
  - Aparece um pequeno botão `ghost` *"Sair do modo customizado"* ao lado do badge → chama `onUnlock`.
  - Os 3 botões de variação ganham `opacity-70` para indicar que vão **sobrescrever** o texto atual.

### Arquivos tocados

- **Editar** `src/components/agents/wizard/QuickCreateWizard.tsx` — estado `promptCustomLocked`, helper `updatePromptManual`, reset em troca de tipo / templates / variantes, AlertDialog de confirmação, prop nova para o step.
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — recebe `onPromptManualEdit` (ou helper `updatePromptManual`), substitui todos os `update('prompt', …)` de origem manual, recebe `customLocked` para passar adiante.
- **Editar** `src/components/agents/wizard/quickSteps/PromptVariantSelector.tsx` — props `customLocked` + `onUnlock`, badge com 🔒 e botão de unlock.
- **Editar** `src/components/agents/wizard/draftStore.ts` — campo opcional `promptCustomLocked: boolean` no `DraftEntry`.

### Casos cobertos

| Cenário | Resultado |
|---|---|
| Aplico "Conciso" → digito 1 char | Chip "customizado 🔒" trava; "Conciso" perde o highlight. |
| Apago o char (volta ao texto exato da variante) | Continua travado em "customizado" — não pisca mais. |
| Clico "Balanceado" enquanto travado | AlertDialog pede confirmação; ao confirmar, destrava e aplica. |
| Clico "Sair do modo customizado" | Mantém o texto, destrava. Se o texto bater com alguma variante, ela volta a aparecer ativa. |
| Troco o tipo do agente | Lock reseta automaticamente. |
| Restauro do histórico de prompts | Lock ativa (texto vem "manual" de fato). |
| Recarrego o wizard com draft salvo | Lock vem persistido do draft. |

### Impacto

- Zero mudança de schema/backend.
- Zero impacto em validação / criação de agente (só afeta a chip e o AlertDialog).
- Elimina o "piscar" das chips durante edição — comportamento previsível e intencional.

